# Plano Modelos + Visual (Frente 3 da cabine 6) — fatia a fatia

Rascunho de 23/nov, para revisão cética antes do código. Base: `feat/cabine-6` (`3915df6`). Segue as decisões D1–D29 de `plano-cabine-6.md` e o board `leiaute-v2-prototipos/Rodada-cabine-6.html` (P2, P3, P4).

**[FECHO]** = arquivo no fecho da janela de saída (606 arquivos, `fechoDoRef("src/frontend/MainOutput.svelte", "HEAD")`, conferido arquivo por arquivo para este plano). Exige "aprovo" do André antes, com diff e motivo.

Objetivo da primeira build testável (V1 + V2): o André cria um modelo para o LED no tamanho certo, liga esse modelo ao Telão LED num Visual (Música e Bíblia), vê na página Mostrar qual modelo está valendo em cada saída e o LED sai limpo.

---

## 1. O que o código diz (e três correções ao que se supunha)

**1.1 O motor do "modelo da saída" existe e é ao vivo (D10b).** `Output.svelte:199/218` chama `setTemplateStyle` (`output.ts:1724`) a cada desenho, com o estilo da saída. `getStyleTemplate` (`output.ts:1696`) escolhe `style.templateScripture[_2.._4]` se o slide é Bíblia, senão `style.template`. Os estilos chegam à janela de saída pelo canal `STYLES` (`listeners.ts:247`). Conclusão: o Visual pode ser um **predefinido que escreve nesses campos**, e o caminho de desenho não muda.

**1.2 O motor só distingue Bíblia de "o resto".** `output.ts:1700-1707` só calcula `isScripture`. Música e Aviso usam o mesmo `style.template`. A distinção é possível (música = categoria com ícone `song`, `aliancaSemLetraLogica.ts:31`; a janela de saída já recebe `categories`, `listeners.ts:159`), mas exige mexer em `output.ts` **[FECHO]**. Fica para a V5; até lá a tabela tem a coluna única "Música e avisos". Não piora nada: hoje já é assim.

**1.3 Correção ao D20: aplicar modelo hoje NÃO é estampa, é vínculo.** `show/Slides.svelte:184-199` (montado no leiaute v2 por `AliancaCentro` → `Show.svelte`) reaplica o modelo do show **toda vez que o show é aberto** (`history TEMPLATE, save:false`), e o modelo da categoria (`categories[].template`) passa por cima do modelo do show. Editar um modelo zera `slidesUpdated` em todos os shows (`listeners.ts:173-181`). O vínculo só cai quando alguém ajusta uma caixa à mão (`history.ts:78/90` → `removeTemplatesFromShow`). Ou seja: hoje editar o modelo muda as músicas já prontas na próxima abertura. Para cumprir o D20 é preciso cortar essa reaplicação (V3, arquivo livre).

**1.4 Correção ao D7: o modelo não tem tamanho; as caixas são guardadas em 1920×1080 e "esticadas" por saída.** `percentageStylePos` (`output.ts:765-793`) converte posição e tamanho das caixas em proporção e reaplica no formato da saída (`Textbox.svelte:133`). A letra não distorce, mas a caixa muda de forma. O editor de modelo desenha no formato da **primeira saída ativa**, não do modelo: `TemplateSlide.svelte:34`, `Editbox.svelte:167-171`, `Snaplines.svelte:73-77`. Por isso um modelo "de LED" desenhado com o telão 16:9 ativo sai errado no LED. `TemplateSettings.resolution` já existe no tipo (`types/Show.ts:557`) e ninguém lê (só comentários). `getResolution(initial)` devolve `initial` quando ele tem largura (`output.ts:687`).

**1.5 D21 hoje não acontece.** Conteúdo sem modelo numa saída de outro formato tem as caixas reposicionadas em proporção (1.4), não é encaixado com barras. Encaixar exige `Output.svelte:206` e `Textbox.svelte` **[FECHO]** (V6).

**1.6 Sobreposições (D19).** São desenhadas por `Overlays.svelte`/`Overlay.svelte` **[FECHO]** com as mesmas caixas proporcionais. Não há modelo de sobreposição por saída, mas cada caixa pode ser presa a saídas (`item.bindings`, `itemHelpers.ts:319-325`, menu em `menuClick.ts:1864`). Dá para fazer a tarja por saída sem fecho: uma sobreposição com um jogo de caixas por saída (V7).

**1.7 Retorno (D16).** O leiaute do retorno é `outputs[id].stageOutput` (`types/Output.ts:11`, escrito em `Outputs.svelte:377`). O Visual escreve esse campo; é independente dos modelos.

---

## 2. Decisões técnicas

### 2.1 Dado do Visual e onde fica
```
special.aliancaVisuais = {
  ativo: "culto-padrao",
  telaPrincipal: outputId,                      // D17
  lista: { [id]: { nome, nota,
      saidas:  { [outputId]: { musica: "slide" | templateId, biblia: "slide" | templateId,
                               bibliaVersoes?: {2?: id, 3?: id, 4?: id}, aviso?: ..., } },
      retorno: { [outputId]: stageLayoutId } } }   // D16: campo separado
}
```
Fica dentro de `special`, que já é gravado inteiro no `settings.json` (`save.ts:202`) e já marca "não salvo" (`save.ts:511`). Assim `stores.ts`, `save.ts` e `updateSettings.ts` (todos fecho) não mudam. `special` também vai para a janela de saída (`listeners.ts:366`); lá ninguém lê essa chave.

### 2.2 Ativar um Visual = escrever campos que já existem
Por saída normal: `styles[output.style].template` (Música e avisos) e `templateScripture` (+ `_2.._4` de `bibliaVersoes`). `"slide"` = campo vazio. Por saída de retorno: `outputs[id].stageOutput`. Uma função pura `planoDeEscrita(visual, saidas, estilos)` devolve a lista de escritas; o aplicador só executa.

- **Um estilo por saída.** Se duas saídas dividem o mesmo estilo, ou a saída não tem estilo, o aplicador cria/duplica o estilo **só na hora em que o operador põe um modelo naquela casa**, com aviso na tela. Nunca na carga.
- **Quem manda é o Visual (D13).** Em "Estilo da saída" (`Styles.svelte:190-199`) os dois campos de modelo viram somente leitura com o texto "definido no Visual X · abrir".
- **Divergência é alta.** Na partida, se os campos do estilo não batem com o Visual ativo (alguém mexeu por fora, perfil antigo), faixa laranja: "A saída X não está como o Visual diz" com "Reaplicar o Visual" / "Guardar o que está na saída". Nunca corrige calado.
- **Modelo apagado ou leiaute de retorno apagado:** casa em laranja "modelo não existe mais"; a saída mostra o slide como foi feito (`output.ts:1708` devolve vazio).

### 2.3 D15: vale no próximo slide
Trocar o Visual (ou mudar uma casa do Visual ativo) não escreve na hora se a saída tem slide no ar: guarda uma **pendência por saída**. O aplicador (janela principal, montado em `AliancaTela.svelte`, como o vigia de `aliancaSaidasSalvas.ts`) assina `outputs`; quando a identidade de `out.slide` daquela saída muda (show, layout ou posição; `line` não conta; ir para vazio conta), escreve o estilo **dentro do mesmo assinante, síncrono**. Como `STYLES` é enviado na hora (`listeners.ts:247`) e `OUTPUTS` espera pelo menos 1 ms (`listeners.ts:225-231`), o estilo chega à janela de saída antes do slide novo. Saída sem slide no ar: escreve na hora.

Risco medido na V0: entre as duas mensagens o slide antigo é revestido com o modelo novo por alguns ms. Com transição de texto isso tende a ser invisível; com transição "nenhuma" pode aparecer um quadro. Se a medição reprovar, o plano B é fecho (o slide enviado carrega o id do modelo resolvido), pedido à parte. A pílula mostra "Impulso · entra no próximo slide" enquanto houver pendência.

### 2.4 D7: tamanho da tela no modelo
Grava `template.settings.resolution = {width, height}` (campo que já existe) e `settings.alvoNome` ("Telão LED"). Escolhido ao criar; as opções vêm das saídas cadastradas mais "Full HD 1920×1080". Três mudanças de fecho, pequenas (lote "aprovo modelos-1"):
- `TemplateSlide.svelte:34` **[FECHO]**: `getResolution(template?.settings?.resolution, …)` e repassa `resolucaoAlvo` para `Editbox` e `Snaplines`.
- `Editbox.svelte:168-172` **[FECHO]**: propriedade `resolucaoAlvo`; se veio, usa no lugar de `getOutputResolution(primeira saída ativa)`.
- `Snaplines.svelte:73-77` **[FECHO]**: idem.
Sem a propriedade, tudo fica como hoje (slides e janela de saída não passam nada). A coordenada interna continua 1920 de largura; as medidas "px da tela de verdade" do board são conversão na interface (`ItemStyle.svelte`, livre, V4).

### 2.5 D20: estampa de verdade
Cortar `Slides.svelte:184-199` (livre) e trocar por: estampar **uma vez** (show novo ou show antigo sem marca) e gravar `show.settings.aliancaEstampa = { modelo, assinatura }` (assinatura = hash de `items` + `settings` do modelo). Depois disso só muda com "Reaplicar modelo". Marca "o modelo mudou desde a estampa" = assinatura guardada ≠ assinatura atual. O modelo da categoria deixa de passar por cima: vira o "padrão para novas".

### 2.6 D21 e D19
- D21: V1/V2 só **avisam** (triângulo na casa, linha em Mostrar: "formato diferente do slide: as caixas são reposicionadas"). O encaixe com barras é a V6 **[FECHO]**.
- D19: V7 livre com `bindings`; coluna "Sobreposição" no Visual só depois, se o André quiser (fecho).

---

## 3. Fatias

Critério de toda fatia: o da `plano-cabine-6.md` (test:layout verde, unit, svelte-check ≤152, fumaças, `ANCORA: ok` rodado por mim, Prova do Culto 0 divergência em outputs, perfil de teste).

### V0 — Preparo e medição (sem código de produto)
- Linha de base das fumaças e da Prova do Culto no HEAD.
- Script no perfil de teste: duas saídas (896×320 com `outputResolutionAsRatio` e 1920×1080), trocar `style.template` no mesmo tick de `setOutput`, gravar a janela de saída quadro a quadro com transição "nenhuma" e com fade. Critério: nenhum quadro com o slide antigo no modelo novo. Decide 2.3.
- Depende da Frente 1 (1a/1b): o LED precisa abrir em 896×320 e o estilo dele em "formato da saída".

### V1 — Visual mínimo, pílula e linha de origem (livre)
**Entrega:** página Configurações › Visual com a tabela (linhas = saídas normais; colunas = "Música e avisos", "Bíblia"), campo separado "Leiaute do retorno" por saída de retorno, lista de visuais (novo, duplicar, renomear, "Usar este agora"); pílula "Visual: X ▾" no topo; linha de origem em Mostrar; renomes.

**Arquivos**
- novos (livres): `utils/aliancaVisualLogica.ts` (+ teste), `utils/aliancaVisual.ts` (lê/escreve `special.aliancaVisuais`), `utils/aliancaVisualAplicador.ts`, `components/settings/AliancaVisual.svelte`, `components/main/AliancaVisualPilula.svelte`, `components/main/AliancaOrigemModelo.svelte`.
- editados (livres): `AliancaTela.svelte` (liga o aplicador), `AliancaTopo.svelte:36-48` (pílula), `AliancaCentroCabecalho.svelte` (linha de origem), `settings/Settings.svelte` + `aliancaConfigSecao.ts:12` ("Estilos" → "Estilo da saída", item "Visual"), `Styles.svelte:190-199` (campos somente leitura), `settings/tabs/Outputs.svelte` (resumo "No Visual X esta saída usa…", D13), `AliancaModeloBiblia.svelte` (o aviso laranja "outro modelo (estilo)" vira etiqueta neutra, D14).
- Nenhum arquivo do fecho. Os novos arquivos não podem ser importados por nada do fecho (teste de guarda).

**Linha de origem (D14, P4):** `Visual: Culto padrão · Telão LED: Letra LED [modelo da saída] · Telão: Letra cheia (da música) · Retorno: Só texto`. Usa o mesmo cálculo da saída (`getStyleTemplate`, já usado em `AliancaEditarCentro.svelte:78`). Etiqueta neutra; laranja só para problema (modelo apagado, divergência, formato diferente). Clicar abre o modelo no Editar.

**Migração:** na primeira carga sem `special.aliancaVisuais`, cria o Visual "Culto padrão" **lendo** o que já está nos estilos (`template`, `templateScripture[_2.._4]`) e o `stageOutput` de cada retorno. Não escreve em `styles` nem em `outputs`: o perfil antigo continua desenhando igual. Saída sem estilo = linha inteira em "usa o slide".

**Testes**
- vitest: migração (perfil sem estilos, estilo dividido, `_2.._4`), `planoDeEscrita`, pendência por saída (D15), casa órfã, texto da linha de origem, divergência.
- guarda: só `aliancaVisualAplicador.ts` escreve `template`/`templateScripture` de estilo no código Aliança.
- fumaça nova `scripts/prova-culto/t15-visual.mjs`: cria Visual, põe modelo no LED, manda slide, confere o modelo na janela de saída; troca o Visual com slide no ar e confere que só muda no slide seguinte.
- Prova do Culto: 0 divergência em outputs (a migração não escreve). Em `principal.sinais` entram a pílula e a página nova: registrar como esperadas.

### V2 — Modelo com o tamanho da tela (D7) e miniaturas da tela principal (D17)
**Entrega:** "Novo modelo" pergunta "para qual conteúdo?" e "para qual tela?"; o editor desenha no formato do modelo, com a faixa fixa "Telão LED · 896×320 · 14:5"; cartões de modelo no formato de cada um; na tabela do Visual cada casa só lista modelos do formato daquela saída (os sem tamanho aparecem num grupo "sem tamanho definido", com triângulo); miniaturas do centro seguem a "tela principal".

**Arquivos**
- **[FECHO]** `TemplateSlide.svelte`, `Editbox.svelte`, `Snaplines.svelte` (diffs de 2.4).
- livres: `components/main/AliancaNovoModelo.svelte` (novo), `Templates.svelte:29,245` (cartão no formato; botão abre o diálogo), `TemplateEditor.svelte` (faixa do tamanho), `AliancaEditarCentro.svelte:96` (selo do modelo ganha o tamanho), `slide/Slide.svelte:170-174,233` (usa `telaPrincipal`), `AliancaVisual.svelte` (filtro por formato, escolha da tela principal).
- Enquanto o "aprovo" não vem, a parte livre já mostra faixa laranja no editor quando o formato do desenho ≠ formato do modelo ("você está desenhando em 16:9 um modelo 14:5"). Com o fecho aprovado a faixa nunca aparece.

**Migração:** modelos existentes ficam sem `settings.resolution` e continuam abrindo como hoje (formato da primeira saída ativa), marcados "sem tamanho definido · definir". "Definir" só grava o tamanho; não mexe nas caixas.

**Testes:** vitest para formato do modelo × formato da saída (igual, proporcional, diferente) e para a lista de telas-alvo; fumaça `t15` ganha: criar modelo LED com o telão 16:9 ativo e conferir que a área de desenho tem proporção 14:5 e que a caixa cai no mesmo lugar na janela do LED. Prova do Culto: 0 divergência em outputs (sem a propriedade nova o caminho é o antigo); recalcular os shas das exceções depois do "aprovo".

**Aceite na igreja (V1 + V2):**
1. Configurações › Visual: existe "Culto padrão" igual ao que já estava.
2. Biblioteca › Modelos › Novo modelo → Música → Telão LED 896×320. A tela de desenho é uma faixa 14:5 e o tamanho fica escrito no alto. Desenhar "Letra LED". Repetir para Bíblia com versículo e referência ("Versículo LED").
3. No Visual, linha Telão LED: Música e avisos → Letra LED; Bíblia → Versículo LED. Telão comum em "usa o slide".
4. Mandar uma música e um versículo. Foto do LED = miniatura = o que a linha de origem diz. No telão comum o slide sai como foi feito.
5. Duplicar para "Impulso", trocar uma casa, usar com slide no ar: o LED não pula; muda no slide seguinte.
6. Fechar e reabrir: tudo igual.

### V3 — Estampa, "Reaplicar" e "Aplicar ▾" com prévia (D18, D20) — livre
- `show/Slides.svelte:184-199`: sai a reaplicação a cada abertura; entra a estampa única com `aliancaEstampa` (2.5).
- `Templates.svelte:150-183`: clicar no cartão não aplica mais; botão "Aplicar ▾" (neste slide · selecionados · música inteira · padrão para novas) com prévia antes/depois e contagem de slides. Continua usando `history TEMPLATE` (`historyActions.ts:600-830` **[FECHO]**, sem alteração). "Desfazer" por 10 s.
- Aviso do D18 no diálogo: "No Telão LED nada muda: essa saída aplica modelo próprio".
- Em Mostrar/Editar: selo "modelo mudou desde que foi aplicado · Reaplicar" quando a assinatura difere.
- **Migração:** show sem marca é estampado uma vez na primeira abertura (igual ao que hoje acontece em toda abertura) e ganha a marca. Slides com ajuste manual já estão sem vínculo e não são tocados.
- Testes: vitest para assinatura e decisão "estampar / não tocar / oferecer reaplicar"; fumaça: editar o modelo e reabrir a música → slide igual; "Reaplicar" → muda. Prova do Culto: conferir que a gravação-base não dependia da reaplicação ao abrir (se depender, a divergência aparece em outputs e a fatia para até decidir).

### V4 — Raiz "Modelos", papéis das caixas e opções da Bíblia — livre
- `aliancaArvoreLogica.ts:13-26,39-44`: raiz `modelos` fora de Ferramentas, filhos Música · Bíblia · Aviso/Slide · Sobreposição; `AliancaArvore.svelte`. Tipo do modelo em `template.settings.tipo` (Bíblia deduzida de `mode === "scripture"` ou de marcador `{scripture`; o resto cai em "sem tipo", visível, nunca escondido). Retorno continua em "Leiautes do retorno", fora de Modelos (D16).
- Papéis: `TemplateStyle.svelte`/`AliancaEditarFerramentas.svelte` gravam os marcadores que já existem — Versículo `{scripture_text}`, Referência `{scripture_reference}`, Versão `{scripture_name}` (`scripture.ts:832,919-923,968`); em música, "Letra" = 1ª caixa de texto (regra de ordem do `mergeWithTemplate`, `output.ts:1217`). Etiqueta colorida sobre a caixa no editor: se precisar de `Editbox`/`EditboxPlain` **[FECHO]**, vai no lote 2; senão, lista lateral.
- Bíblia: versículos por slide, referência e versão no cabeçalho ao lado de "Modelo: X ▾" (`AliancaBibliotecaPainel.svelte:141`, reaproveitando os campos de `ScriptureInfo.svelte:49-62,258`).
- Medidas em px da tela-alvo em `ItemStyle.svelte`.
- Aceite: voluntário cria modelo de Bíblia do LED com duas caixas em menos de 5 min, sem ajuda.

### V5 — Aviso separado de Música + padrão por tipo — **[FECHO]** (lote 2)
- `output.ts:1707`: se o slide não é Bíblia e o show não é de categoria música, usar `currentStyle.templateAviso` (campo novo; vazio = comportamento atual). `types/Settings.ts:31` ganha o campo. A coluna "Música e avisos" se divide; migração copia o valor para as duas.
- `classes/Show.ts:29-33`: show novo recebe o padrão do tipo (antiga 3e).
- Prova do Culto: 0 divergência (campo vazio no perfil-base).

### V6 — Encaixe com barras (D21) — **[FECHO]**
`Output.svelte:206` e `Textbox.svelte:131-135`: casa "usa o slide" em saída de outro formato → o quadro do slide é desenhado 16:9 centrado, com barras. Exige prova em pixel no LED (como a 1.0) antes do diff.

### V7 — Tarja por saída (D19) — livre
No editor de sobreposição: "Esta caixa aparece em: todas · Telão LED · OBS" (`bindings`) e troca do formato de desenho por saída (usa as propriedades da V2 em `OverlayEditor.svelte:43,100`). Coluna de sobreposição no Visual só se o André pedir.

---

## 4. Ordem e lotes de "aprovo"
1. V0 junto com a Frente 1 (1a/1b).
2. V1 (livre) em paralelo com o pedido do **lote modelos-1** (3 arquivos da V2). Build de teste = V1 + V2.
3. V3 e V4 (livres).
4. **Lote 2:** V5, V6 e, se precisar, a etiqueta de papel na caixa.
5. V7.

## 5. Perguntas ao André antes de codar
1. Na primeira build a tabela terá **uma coluna "Música e avisos"** (o motor não separa). Serve para o teste, com a separação vindo na V5?
2. "aprovo" para os três arquivos da V2 (`TemplateSlide`, `Editbox`, `Snaplines`)? Diff sai junto com a V1.
3. D20: confirma **cortar a reaplicação automática ao abrir a música**, inclusive o modelo de categoria que hoje passa por cima? Músicas existentes seriam estampadas uma última vez na primeira abertura.
4. Qual é a **tela principal** das miniaturas (D17) na igreja: o LED ou o telão comum?
5. O board diz que o formato do modelo "não muda depois"; o D20 diz que "pode ser alterado". Proposta: pode mudar com confirmação, e existe "Duplicar para outra tela".
6. Bíblia com duas ou mais versões lado a lado: mesma casa "Bíblia" ou casas próprias? (o motor tem `templateScripture_2.._4`.)

---

## Adendo — revisão cética (23/nov): "go com mudanças"

1. **Visual × rascunho de Configurações.** O rascunho (`aliancaConfigRascunho.ts`) fotografa `special`, `styles` e `outputs.stageOutput`, e só renova a foto ao Salvar/Descartar. **Decisão:** trocar o Visual (pílula ou página) **vale na hora** e entra na foto (`aceitarNaFoto("special"/"styles")`, e um caminho equivalente novo para `outputs.stageOutput`), para não aparecer como "alteração não salva" nem ser desfeito por "Descartar". A pendência do D15 é cancelada se o operador Descartar. O aplicador escreve direto na loja, **sem `history`** (Ctrl+Z não desfaz o Visual).
2. **D15.** A ordem STYLES→OUTPUTS confere, mas o risco estava invertido: com transição de fade, o slide que sai já está redesenhado no modelo novo, e o texto velho no modelo novo fica visível **durante todo o fade**. A identidade do slide precisa incluir `tempItems`/`customDynamicValues` (a Bíblia da gaveta vai como `id:"temp"`, `scripture.ts:310`). **Plano B (o slide carrega o id do modelo resolvido, fecho) entra já no lote modelos-1**; a V0 mede se o plano A basta sem fade.
3. **Lote modelos-1 (fecho) = `TemplateSlide`, `Editbox` (166-171), `Snaplines` + `Textbox.svelte:131-135` + `edit/scripts/autoPosition.ts:16-17`**, mais `types/Show.ts` se campos novos ficarem no modelo ou no show. Alternativa sem fecho de tipo: guardar metadados (tela-alvo, estampa) em `special` indexados pelo id do modelo/show.
4. **V3 (estampa).** Cortar a reaplicação ao abrir (`show/Slides.svelte:184-199`) também tira: modelo de grupo (`historyActions.ts:742-745`), recorte `maxLinesPerSlide`/`breakLongLines` a cada abertura e `firstSlideTemplate`. O modelo de categoria hoje é **sobrescrita** a cada abertura (via `createItems`), não vínculo: tratar como "padrão para novas". `slidesUpdated` é código morto (só escrito). Prova do Culto deve cobrir show "não mesclado".
5. **Sem dependência da 1b.** O LED já pode ser configurado hoje: Configurações › Saídas › LED › "Tamanho" 896×320 na origem do monitor (zera `screen`), cadeado ligado, **estilo próprio do LED com Proporção = "resolução da saída"** (`outputResolutionAsRatio`), e **não clicar no mapa** (grava `screen`). Coordenadas são normalizadas: o "tamanho" do modelo vale como proporção (896×320 = 14:5); modelo 14:5 sai exato no LED; numa prévia 16:9 as caixas esticam 1,575× na vertical (fonte não muda).
6. **Prova do Culto:** a migração escreve `special.aliancaVisuais`, que vai para a saída (`listeners.ts:366`) → divergência esperada em `OUTPUT:SPECIAL`, registrar. Faltam no plano: migração de modelos de categoria/grupo para "padrão para novas" (V3); linhas do Visual quando uma saída é criada/apagada; troca de `output.style` em Saídas.
