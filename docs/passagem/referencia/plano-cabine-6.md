# Plano cabine 6 — rascunho v2, após revisão cética (22/nov)

Origem: fim de semana de 21–22/nov, o app não deu confiança no culto. Quatro frentes.
Base: `feat/cabine-5` (`53210f1`). Fecho da janela de saída = 598 arquivos (`fechoDoRef` do `ancora.mjs`, `ANCORA: ok`); **[FECHO]** = exige "aprovo" do André antes. Os "aprovo" serão pedidos em lote por frente, com arquivo, diff e motivo.

Revisão cética (Fable, 22/nov): diagnósticos 1, 2, 6, 7 confirmados; 3 e 5 parciais; o uso de `cropping` para a área do LED foi **derrubado** (ver 1). Mudanças incorporadas abaixo.

---

## Frente 1 — Telas: o LED abre certo, sempre (P0)

### Diagnóstico (conferido duas vezes)
- **Perde ao fechar:** `save.ts:468` tem `outputs: null`; `unsavedUpdater` (364-407) pula lojas null. Nenhuma tela de posição (`ChangeOutputValues`, `Screens`, `AliancaMapaTelas`) marca "não salvo"; `initializeClosing` (338-344) com `saved=true` fecha sem gravar. Só persiste se outra coisa sujar o estado ou o autosave de 15 min passar. Mesmo defeito do `53210f1` (mídia).
- **"Aparece pela metade":** `OutputVisibility.ts:67-69` — com `screen` gravado, a janela vira o monitor inteiro e `bounds`/cadeado são ignorados. 1024×768 com slide 16:9 = 1024×576 a partir de y=96; o LED (linhas 0–320) mostra 96 linhas pretas + 39% de cima da imagem. O mapa do Aliança sempre grava `screen` (`AliancaMapaTelas.svelte:81`) e o popup "Tamanho" zera `screen` (`ChangeOutputValues.svelte:41`): **os dois brigam**.
- **Windows sobrescreve:** `OutputLifecycle.ts:224` — `resize` com condição invertida: com `moveEnabled=false` (padrão) todo resize feito pelo sistema (LED perde/volta sinal, DPI) vira `MOVE` e sobrescreve `bounds` (sem cadeado). Conferir o upstream FreeShow antes de mexer.
- **DPI:** os campos do popup são DIP; com escala ≠100% o "x=1920" não é o começo do monitor 2.

### Decisão técnica: provar em pixel ANTES de codar (fatia 1.0)
O `cropping` (`Zoomed.svelte:80-103`) calcula margens numa resolução normalizada a 1920 e aplica em px da janela; para 1024×768 recortado a 896×320 com estilo 14:5 a conta dá margens erradas (≈ −176 px no topo). Também é ignorado em espelhos e saída de palco, e NDI/captura levaria a janela inteira. **Não é robusto.**
- **1.0** — no perfil de teste (nunca nos dados reais), com monitor virtual/janela 1024×768: comparar
  - **(A) janela 896×320 na origem do monitor**, `screen` nulo, cadeado ligado, estilo com `outputResolutionAsRatio` (caminho nativo do FreeShow);
  - (B) monitor inteiro + recorte.
  Critério: padrão de teste com borda de 1 px e cantos numerados encaixado exato na área. Escolher pelo resultado. Expectativa: (A).

### Desenho (interface — independe de A/B)
- Saída = **monitor + área usada**, relativa ao monitor: "Telão: Monitor 2 (1024×768) · usar só 896×320 a partir do canto superior esquerdo". "Retorno: Monitor 3 inteiro". Nada de coordenadas absolutas do desktop; o app converte DIP/escala.
- Monitor reencontrado na partida e em `display-*` por id → tamanho/posição → senão **aviso laranja alto** ("Monitor do telão não encontrado"), nunca cai calado.
- Botão **"Testar"**: grade com bordas e cantos numerados no telão por 10 s.
- O formato da área (14:5) define o formato do slide — **depende da resposta do André** (desenhar slides em 14:5 ou encaixar 16:9). Liga com a Frente 3: modelos 1920×1080 têm caixas em px absolutos e cortam em 14:5.

### Fatias
- **1.0** Prova em pixel A × B (sem código de produto).
- **1a** **[FECHO]** Persistência + `resize` juntos (um aprovo): vigia em `AliancaTela` (livre) que faz `save()` com atraso curto (não só `saved=false`) quando `bounds/screen/cropping/boundsLocked` mudam por ação do operador; **não** persistir `MOVE` vindo do sistema; corrigir o `if` invertido.
- **1b** Tela "monitor + área" (livre: `AliancaMapaTelas.svelte`, `aliancaSaidasLogica.ts`, `settings/tabs/Outputs.svelte`; **não** tocar `Screens.svelte`, que é fecho). Mapa e popup param de brigar por `screen`.
- **1c** **[FECHO]** Reencontrar monitor + aviso (`OutputVisibility/OutputLifecycle/OutputBounds`).
- **1d** **[FECHO]** Padrão de teste (estender `OutputIdentify.ts`).

### Aceite
Foto do LED físico mostrando as 4 bordas e os cantos — repetida após: fechar/reabrir; fechar em <10 s depois de mudar; matar o processo; reiniciar o Windows; desligar/religar o LED com o app aberto; trocar a escala do Windows. `settings.json` conferido em cada passo.

---

## Frente 2 — Vídeo liso (P0)

### Diagnóstico
- Cada lugar que mostra a saída monta um `<Video>` completo em resolução cheia (`Video.svelte:208`): **telão** (`Media.svelte:62`), **retorno** se o leiaute tem "saída atual" (`Stagebox.svelte:395`, +1 se `includeMedia`), **"No ar"** (`AliancaNoAr.svelte:84`), **"Outras telas"** (`AliancaOutrasTelas.svelte:33`, aberta por padrão). Na cabine (telão + retorno com saída atual) = **4 decodificações**. Conta real é por saída habilitada.
- Multiplicadores: `fit: "blur"` e `softLoop` montam um 2º `<video>` por instância (`Video.svelte:205-215`); troca de fundo mantém 2 por ~800 ms; relógio é um `Audio` na janela principal.
- Sincronia (`videoSync.ts:53-100`, `videoPlayer.ts:757`): tempo a cada 100 ms por IPC sem carimbo; ajusta velocidade ±6% com diferença >80 ms; seek inicial >0,05 s; seek >1,5 s. Hipótese (não medida): cadência irregular.
- `bind:currentTime` = laço rAF por quadro em cada `Video`; saídas sempre `transparent: true` (`windowOptions.ts:44`).
- Já existe `special.optimizedMode` (sincronia a 500 ms), botão comentado em `Other.svelte:40`.

### Ordem (medir primeiro; o ganho já provado veio de cortar decodificador e fonte 4K)
- **2.0** Medição: script de fumaça no perfil de teste tocando o **vídeo real do culto** 60 s — `droppedVideoFrames` por janela, nº de `<video>` vivos por janela, uso do decodificador da GPU. Antes/depois de cada fatia. Conferir `chrome://gpu` (Video Decode = hardware) na cabine.
- **2a** Fonte: fundos em 1080p H.264; aviso no import "vídeo 4K/HEVC — converter?" (livre).
- **2b** Cortar decodificadores livres: "Outras telas" recolhida por padrão / retorno sem vídeo na prévia; "No ar" com espelho leve (decidir com o André); `loadFullImage` não pedir vídeo em `drawer/media/Media.svelte` (livre — `MediaLoader.svelte` é fecho e fica fora).
- **2c** **[FECHO]** Espelhos não decodificam: quadro parado + selo "▶ vídeo 02:13" (`Video/Output/PreviewOutput`). Checar `blur`/`softLoop` na mesma fatia.
- **2d** **[FECHO]** `transparent:false` quando a saída não é transparente; `on:timeupdate` no lugar de `bind:currentTime`.
- **2e** **[FECHO, só se a medição ainda reprovar]** Sincronia com carimbo de hora, sem mexer na velocidade, seek só >0,5 s.

### Aceite
Vídeo real, 60 s, todas as saídas: quadros perdidos no telão ≈ 0 e decodificações vivas = nº de saídas que realmente precisam mostrar vídeo.

---

## Frente 3 — Modelos que dão confiança (P0)

### Diagnóstico
- Três camadas: modelo do show/slide · modelo da Bíblia · **estilo da saída** ("Substituir slide/versículo com modelo", `Styles.svelte:190-199`) que vence os dois (`output.ts:1696/1724`; Bíblia em `scripture.ts:1855`, só com uma saída normal). As miniaturas já mostram a sobreposição (`Slide.svelte:224-229`) e o Editar tem selo "▤ Modelo", mas **nada diz de onde vem** o modelo que está valendo.
- "Modelos" escondido em Biblioteca › Ferramentas; aplicar = clique no cartão, sem botão nem prévia.
- "Telas e monitor de retorno" = leiautes de palco, não modelos. Tela/estilo/modelo misturados.
- Aplicar copia o modelo para os itens (`historyActions.ts:777`, `mergeWithTemplate` `output.ts:1217`); texto cai nas caixas por tipo+ordem; na Bíblia por marcador (`{scripture_text}`, `{scripture_reference}`, `scripture.ts:832/919-923`), invisível ao operador. O modelo padrão "Bíblia" já tem 2 caixas.
- Opções da Bíblia (`ScriptureInfo.svelte`) não montadas no leiaute v2. Sem padrão por tipo de conteúdo.

### Desenho
- Raiz **"Modelos"** na biblioteca (fora de Ferramentas), por tipo: Música · Bíblia · Aviso/Slide · Retorno (renomeia "Telas e monitor de retorno").
- Editor do modelo: cada caixa com **papel** escolhível — Letra, Versículo, Referência, Versão, Título. Grava o marcador que já existe; em música mostra "caixa 1 de texto".
- **Aplicar ▾** com prévia: neste slide · selecionados · música/show inteiro · padrão para novas (por tipo).
- **Indicador de origem** em Mostrar/Editar: "Modelo: X (da música)". Se o estilo da saída sobrepõe: laranja "Telão usa Z (estilo da saída)" + **"ver/editar o modelo desta saída"** (não "Desligar": no LED 14:5 a sobreposição pode ser o que faz a letra caber).
- Renomes: "Estilos" → "Estilo da saída"; "Substituir slide com modelo" → "Forçar modelo nesta saída (ignora o da música)". Nunca "tela" para modelo.
- Bíblia: versículos por slide / referência / versão de volta ao cabeçalho, junto ao "Modelo: X ▾".

### Fatias
- **3a** Indicador de origem + aviso de sobreposição + renomes (livre).
- **3b** Raiz Modelos por tipo + Aplicar ▾ com prévia (livre: `Templates.svelte`, árvore).
- **3c** Papéis das caixas (livre: `TemplateStyle.svelte`, `EditTools`).
- **3d** Opções da Bíblia no cabeçalho (livre).
- **3e** **[FECHO]** Padrão por tipo para conteúdo novo (`classes/Show.ts`).
- Pré-requisito: decidir o formato do LED (Frente 1) — modelos do telão desenhados em 14:5?

### Aceite
Em música e Bíblia, com sobreposição ligada e desligada, no formato do LED: aplicar → foto do telão = miniatura = o que o indicador diz. Modelo Bíblia com 2 caixas (versículo + referência) criado do zero por um voluntário, sem ajuda, em < 5 min.

---

## Frente 4 — Spotify como áudio (P1)

### Diagnóstico
Corte por vídeo existe (`aliancaSpotifyComSom*.ts`), sempre ligado, sem voltar; áudio da gaveta/efeito também derruba. Cartão (`AliancaTransporte.svelte:166-196`) sem volume/mudo/parar. Board C2: linha 2 = barra + crossfade fixo + mudo 24 px + volume 40 px; cartão 60 px. `setVolume` = volume do app no mixer do Windows. Não existe comando `play` (só `playpause`/`pause`). Fade interrompido deixa o volume em 0.

### Fatias
- **4a** (livre) Mudo + volume na linha 2 conforme board; barra de posição ~185 px na coluna de 300; teste de largura interna.
- **4b** (livre) Parar = pausar + voltar ao início — no Spotify e na gaveta (confirmar).
- **4c** **[FECHO]** Mesmo comportamento do áudio: obedecer a opção de silenciar com vídeo, lembrar "pausei por vídeo", voltar com fade no fim — precisa de `play` em `electron/utils/spotify.ts`. Garantir volume restaurado se o fade for interrompido.

---

## Critério de entrega de cada fatia
`npm run test:layout` verde; unit (só os 4 RtmpStreamer falham); svelte-check ≤152; fumaças da lista — **registrar a linha de base atual primeiro** (t8, t10, t11 já falhavam desde a cabine 4); `ancora.mjs` = `ANCORA: ok` rodado por mim; Prova do Culto 0 divergência em outputs. Tudo no perfil de teste, nunca em `Documentos\AliancaShow`.

## Ordem sugerida
1. **1.0** (prova em pixel) + **2.0** (medição) + linha de base das fumaças — sem código de produto.
2. **3a** (indicador de origem) e **2a/2b** — livres, maior alívio imediato.
3. Lote de "aprovo" 1: **1a** + **1b**.
4. **3b/3c/3d**, **4a/4b**.
5. Lote de "aprovo" 2: **2c/2d** (e **2e** se a medição pedir), **1c/1d**, **3e**, **4c**.

## Decisões do André (22/nov) — prevalecem sobre o texto acima

- **D1 — Modelo por saída, como no ProPresenter.** O telão de LED tem slides **desenhados** em 14:5 (nunca esticar a imagem). Outras saídas usam modelos 16:9. O mesmo conteúdo (música, Bíblia) sai em cada saída com o **modelo daquela saída**, e o vídeo e as caixas de texto se ajustam. Consequência: a camada "estilo da saída" (`style.template`, `templateScripture`) deixa de ser vilã e vira **o mecanismo central**, só que visível e por tipo de conteúdo: "Telão (LED 14:5): Música → Modelo X · Bíblia → Modelo Y · Aviso → Z". A Frente 3 passa a ser desenhada em torno disso (antes do 3a).
- **D2 — Retorno com dois tipos de leiaute**, escolhidos pelo operador: (a) **só texto** (letra, próximo, relógio) → não decodifica vídeo, mostra "▶ vídeo · 02:13 restantes"; (b) **espelho** → mostra o que está no telão, incluindo vídeo e slideshow de imagens. A decisão de decodificar segue o leiaute ativo. Hoje já há um leiaute de retorno com espelho que funciona.
- **D3 — "No ar" com movimento total.** Não pode virar quadro parado. Alternativa a testar na 2.0: alimentar o "No ar" com um **MediaStream da própria janela de saída** (captura de janela da GPU) em vez de decodificar o arquivo de novo — movimento real sem decodificação extra.
- **D4 — Regra "nada volta sozinho".** Entrada derrubada por outra **nunca** volta automaticamente; vale para tudo. A 4c vira: obedecer a mesma regra de derrubar, sem volta. Conflito encontrado: o áudio da gaveta hoje **volta com fade** quando o vídeo para (`audioFading.ts` `fadeinAllPlayingAudio`, fecho) — viola D4; confirmar com o André e corrigir **[FECHO]**.
- **D5 — Vídeo é o maior incômodo.** O PC inteiro trava; a igreja converteu os vídeos de 4K para 1080p para contornar. Meta: 4K não pode travar o PC, como no ProPresenter. Além de cortar decodificações, avaliar **gerar versão otimizada automática na importação** (como o "otimizar mídia" de outros apps), em segundo plano.
- **Novo bug (Frente 1):** ao clicar no monitor para escolher a tela de uma saída, às vezes a saída não aparece selecionada. Investigar no mapa (`AliancaMapaTelas.svelte`) junto com a briga `screen` × `bounds`.
- Escala do Windows: o André acredita que está 100% em todos, mas vai confirmar na igreja. No ProPresenter a configuração das telas funciona sem problema.

- **D6 — Modelos por saída e por momento ("visuais", como os Looks do ProPresenter).** Há modelos do mesmo conteúdo ajustados para telas diferentes, e modelos para momentos/cultos diferentes (ex.: culto padrão × culto do Impulso). No culto normal vale um padrão, que pode mudar eventualmente. Desenho: um **Visual** nomeado ("Culto padrão", "Impulso") = para cada saída, qual modelo usar por tipo de conteúdo (Música, Bíblia, Aviso). O operador troca o Visual ativo num lugar só; o indicador mostra o Visual e o modelo valendo em cada saída.
- **D7 — O modelo mostra o tamanho da tela.** Ao criar/editar um modelo, a tela de desenho tem o formato e o tamanho da saída-alvo ("Telão LED · 896×320 · 14:5"), escolhido ao criar o modelo. Não pode ser possível desenhar um modelo de LED numa tela 16:9 sem perceber.
- **D8 — O fim de semana falhou em tudo junto:** não ficou claro que o modelo funcionou, nem como aplicar um modelo a um tipo de tela e outro a outro, e as saídas davam problema (Frente 1). As frentes 1 e 3 precisam chegar juntas para o André voltar a usar na igreja.
- **D9 — Spotify = mídia só de áudio.** Comporta-se como se o operador tivesse puxado um arquivo de áudio: entra na **camada Áudio (F4)** ao lado do "No ar" (acende quando toca, F4/"Parar áudio" para, "Limpar tudo" para), é derrubado pelas mesmas regras que derrubam áudio, e nunca volta sozinho (D4). Hoje a camada Áudio (`aliancaCamadasLogica.ts:25`) ignora o Spotify. A 4c passa a ser "Spotify na camada Áudio".

- **D10 — Dois comportamentos por saída, como no ProPresenter.** (a) **Saída "slide como foi feito"** (ex.: telão principal hoje): mostra o slide com o modelo aplicado na criação e os ajustes manuais — ajuste manual **fica**. (b) **Saída "com modelo próprio"** (ex.: OBS, LED 14:5): recebe texto e vídeo **crus** e aplica o modelo da saída na hora, **passando por cima** de qualquer estilo do slide. O motor já existe (`style.template`/`templateScripture`, `output.ts:1696/1724`); falta tornar explícito na tela de cada saída e no Visual (D6): por saída e tipo de conteúdo, "usa o slide" ou "aplica modelo X".
- **D11 — Áudio:** um áudio novo (arquivo ou Spotify) **para o Spotify**. O áudio da gaveta não volta mais depois do vídeo — André autorizou a correção (22/nov); diff de `audioFading.ts`/`videoPlayer.ts` será mostrado antes de aplicar, por ser fecho.
- **D12 — "Substituir slide com modelo":** o André não se lembra da opção — provavelmente existia e ninguém achou. Reforça a 3a (indicador de origem).

### Respostas do André ao board Rodada-cabine-6 (22/nov)
- **D13 — Onde manda:** na tabela do Visual (P2). A tela de saídas só mostra o resumo.
- **D14 — Etiqueta "modelo da saída": neutra.** Laranja só para problema.
- **D15 — Trocar o Visual com slide no ar:** vale no próximo slide.
- **D16 — Retorno tem leiaute próprio, fora dos modelos de saída.** Os modelos de retorno são completamente diferentes dos de saída; o Visual tem um **campo separado "Leiaute do retorno"** (não uma casa da tabela de modelos).
- **D17 — Miniaturas do centro mostram como está configurada a tela principal.**
- **D18 — "Aplicar" no slide:** fica a critério do desenho (manter com aviso quando nenhuma saída usa o slide).
- **D19 — Tarja do pregador / título da mensagem = sobreposição**, e as sobreposições também entram no enquadramento por saída (cada saída posiciona a tarja no seu formato).
- **D20 — Modelo aplicado é ESTAMPA, não vínculo.** Aplicar um modelo num slide/música cria uma cópia ("instância"); editar o modelo depois **não** muda o que já foi estampado — só muda se o operador reaplicar à mão. O formato de um modelo pode ser alterado. Já o **modelo de saída é aplicado na hora**, a cada exibição, sobre o conteúdo cru. (O motor já funciona assim: `mergeWithTemplate` copia; `style.template` aplica ao vivo. Falta a interface deixar isso explícito: "Reaplicar modelo".)
- **D21 — Conteúdo sem modelo numa saída de outro formato** (ex.: apresentação 16:9 recebida de fora, no LED 14:5): encaixar sem distorcer (com barras), com aviso claro e sutil. Nunca esticar.
- **D22 — "No ar" no formato 14:5:** não mover os botões das camadas; o espaço dos botões é regra, a imagem fica menor. Aceita ideias melhores.
- **D23 — Área do LED:** hoje sempre no canto superior esquerdo, mas manter a opção de escolher canto/deslocamento (escondida em "avançado").
- **D24 — "Testar" com culto no ar: bloqueado.**
- **D25 — Transporte: botões Pausar e Parar.** O **Pausar desacelera numa curva até parar** (sem congelar brusco no ar). Vale para vídeo (e confirmar áudio/Spotify).
- **D26 — Clicar num vídeo não mostra o vídeo grande no centro.** No lugar, um cartão grande com a miniatura do vídeo e talvez os controles. (Bônus: tira mais uma decodificação, o `VideoShow.svelte:364`.)

## Resultados das provas (22/nov, perfil de teste isolado, PC de dev RTX 3080 Ti)

- **1.0 — LED: opção A escolhida.** Janela 896×320 na origem do monitor, `screen` nulo, cadeado, `outputResolutionAsRatio`: slide cai em x 0..895, y 0..319, os 4 cantos no pixel exato. Opção B (monitor inteiro + recorte) **reprovada**: `Zoomed` gera `margin-inline-start: 234.67px; margin-top: -176px`, slide desloca 234 px e perde os cantos 2 e 4.
- **Persistência confirmada:** aplicar A pelo caminho do popup deixa `saved=true`; fechar pelo X grava 1920×1080 no `settings.json` e a janela reabre errada. Com `save()` antes de fechar, fica 896×320. → fatia 1a.
- **2.0 — vídeo:** a configuração da cabine faz **4 decodificações** por vídeo (No ar + Outras telas na principal, telão, retorno com "saída atual"). 4K: decodificador da GPU a 80% com 4; 65% com Outras telas recolhida; 54% com retorno só texto. CPU quase não muda — o custo é todo do decodificador. Sem quadros perdidos nesta máquina (muito mais forte que a da cabine). A oscilação ±6% do `videoSync` aparece só em 4K, mais no "No ar" (até 1,06).
- **D3 — "No ar" por captura da janela do telão funciona** (`getMediaSourceId` via `GET_WINDOWS` + `getUserMedia` desktop: 896×320 a ~27 fps). Custo exato não medido limpo (POC paralela contaminou). Filtrar sempre pelo id da janela, nunca pelo nome.
- Pendente: repetir 1080p e o custo da captura sem processos paralelos; repetir na cabine com o vídeo real.

### POC "decodifica uma vez, mostra N vezes" (`aliancashow\bancada\poc-video-unico`, fora do repo)
3 saídas (960x540, LED 896x320 cover, 640x360) + principal com prévia, Electron 37.10.3 do repo, vídeo 60 s com código de barras do nº do quadro em cada quadro.
| variante | 4K: decode do sistema | quadros perdidos | cadência | sincronia entre janelas |
|---|---|---|---|---|
| (a) hoje: um `<video>` por janela | **98% (saturado)** | **75%** | 174±175 ms | deriva até 28 quadros |
| (b) captureStream compartilhado | 54% | ~22% nos filhos | 52±37 ms | 0…2 |
| **(b2) 1 `<video>` + canvas em cada saída (window.open, mesmo processo)** | **32%** | **0** | **33,4±1,9 ms** | **0…1 quadro** |
| (c) espelho por captura da janela | 45% | 0 | 33,3 ms | 0…1 (congela se a fonte for minimizada) |
- **(b2) vence:** 1 decodificador e 1 processo para todas as saídas, enquadramento próprio por saída (cover no LED, contain nas outras), texto em DOM por cima, áudio toca uma vez só. Dono oculto precisa desenhar pelo rAF de uma janela filha visível (senão cai a 1 fps). O dono não pode ser a janela da interface.
- **Riscos do port:** ponto único de falha (se o processo dono cai, todas as saídas morrem — detectar `render-process-gone` e recriar); as filhas abertas por `window.open` não têm preload/IPC, então todo o Svelte da saída tem de rodar no dono e montar em `child.document` — é reescrever o coração do fecho (`OutputLifecycle.createOutput`, `OutputSend`, `MainOutput`); previews da principal precisam virar captura de baixa taxa; nada validado na RX 580 nem com 3 monitores/DPI.
- **(c)** fica como plano B barato para o retorno e o "No ar".
- Próximo passo proposto: rodar `run.ps1` do POC **na cabine** (RX 580, sem outros apps) antes de decidir o port.

## Perguntas ainda abertas
1. Escala do Windows em cada monitor da igreja (confirmar no local).
2. Slides do telão desenhados em 14:5 (896×320) ou 16:9 encaixado?
3. Retorno: mesma coisa do telão ou leiaute próprio? Precisa mostrar vídeo?
4. Vídeo trava no telão, no retorno ou na interface?
5. "No ar" pode virar quadro parado + tempo, ou precisa de movimento?
6. Tipos de modelo usados (Música, Bíblia, Aviso, Título/Pregador…?).
7. Um modelo para todas as músicas, ou por música?
8. O que exatamente falhou no fim de semana com os modelos?
9. Spotify volta sozinho quando o vídeo termina?
10. Áudio da gaveta/efeito também derruba o Spotify?
11. "Substituir slide/versículo com modelo" estava ligado em Estilos?
12. Ajuste manual num slide × trocar o modelo: manter o ajuste ou o modelo vence?
