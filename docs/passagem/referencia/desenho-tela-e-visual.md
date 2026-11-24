# Desenho: "Tela" + "Visual" no lugar de "Estilo" + "Visual" (cabine 6, 23/nov)

Escolha do André (23/nov, PC da igreja): **caminho C**, "copiar o fluxo o máximo possível do ProPresenter, porque isso era algo muito versátil".
Motivo: hoje existem duas opções que se sobrepõem, o **Estilo** (do FreeShow) e o **Visual** (cabine 6). O teste de 23/nov caiu justamente aí: o LED perdeu o estilo e saiu 16:9 com barras, calado.

## O modelo do ProPresenter que vamos copiar
| ProPresenter | AliançaShow (novo) | O que guarda |
|---|---|---|
| **Screens** (Configurar telas) | **Tela** = a página de cada saída em Configurações › Saídas | O que é **físico** e não muda de culto para culto: monitor, tamanho, proporção, alinhamento, linhas máximas, encaixe da mídia |
| **Looks** | **Visual** (Configurações › Visual + o botão do telão) | O que é **aparência** e se troca com um clique, por tela: **camadas ligadas** (fundo, slide, sobreposições), modelo de Música e avisos, modelo de Bíblia (com 2–4 versões), fundo, transição, créditos, leiaute do retorno |
| Theme override do Look | Coluna de modelo do Visual | Igual: o Look escolhe o tema de cada tela |
| Layers do Look | **Camadas** no Visual (novo) | No ProPresenter o Look liga/desliga camadas por tela. Ex.: "Pregação" com o LED só com fundo |
| Mask do Look | Fundo do Visual | Não há máscara no FreeShow; o fundo da tela é o mais próximo |
| Stage screen layout | Leiaute do retorno no Visual | Já existe (V1) |
| Macros | (depois) | Um Visual já é um "macro" simples; macro de verdade fica para outra rodada |

**O Estilo some da interface.** Por dentro ele continua existindo, porque é o que a janela de saída lê, mas vira um **resultado**: `estilo da saída = Tela da saída + Visual ativo para aquela saída`. Ninguém mais edita o estilo à mão.

## Decisão principal: o fecho NÃO muda
A janela de saída continua lendo `styles[outputs[id].style]` exatamente como hoje (`getCurrentStyle`, `getResolution`, `getOutputResolution`, `Output.svelte`). Toda a mudança é **quem escreve** o estilo, e isso mora na janela principal, fora do fecho:
- nenhum arquivo do fecho alterado; nenhum arquivo novo no fecho;
- a Prova do Culto tem de dar **0 divergência em outputs** (a migração só reorganiza o dado; o estilo resultante é idêntico).

Se a revisão cética achar que algo exige mexer no fecho (ex.: tirar o 16:9 calado de `getResolution`), isso vira um "aprovo" separado e pequeno.

## Dados
1. **Tela** — `outputs[id].aliancaTelaFisica` (em `settings.json`, por máquina; é o certo, porque a proporção depende dos monitores daquela máquina):
   `{ proporcao: "saida" | "16:9" | "4:3" | {width, height}, alinhamento?: "center"|"start"|"end", tamanhoFonte?: number, linhas?: number, encaixe?: MediaFit, volume?: number }`
   ↦ no estilo: `aspectRatio` (com `outputResolutionAsRatio` quando "saida", `alignPosition`, `fontSizeRatio`), `lines`, `fit`, `volume`.
2. **Visual** — `special.aliancaVisuais[].saidas[id]` ganha, além de `musica` e `biblia`:
   `biblia2?`, `biblia3?`, `biblia4?` (vazio = igual à Bíblia; `output.ts:1708` já cai em `templateScripture` quando `_N` está vazio), `camadas?: ("background"|"slide"|"overlays")[]`, `fundo?: { cor?, midia?, limparNoTexto? }`, `transicao?`, `creditos?` (`metadata`).
   ↦ no estilo: `template`, `templateScripture`, `templateScripture_2..4`, `layers`, `background`, `backgroundImage`, `clearStyleBackgroundOnText`, `transition`, `metadata`.
3. **Estilo** — um por saída normal, **nunca dividido**, nome = nome da saída. Campos que não estão em nenhuma das duas listas (`blurAmount`, `blurOpacity`, `showAsFaded`, `lineOpacity`, `skipVirtualBreaks`, `cropping`/`resolution` antigos) **ficam como estão** no estilo: o compositor não toca.

## O compositor (substitui o aplicador do Visual)
`aliancaTelaVisual.ts` (janela principal) é o **único** que escreve campos de estilo das duas listas. Ele roda:
- ao ativar ou mudar um Visual (como hoje, com a regra D15: saída com slide no ar recebe no próximo slide);
- ao mudar a Tela de uma saída (na hora: é configuração física, não troca ao vivo);
- na partida, só para **conferir** (não escreve; ver Guarda).
Continua sem `history` (Ctrl+Z não desfaz troca de Visual, como o ProPresenter). A Tela entra no rascunho normal das Configurações: **Descartar desfaz** mudança de Tela.

## Migração (uma vez, na primeira carga com a versão nova)
Lendo o estado de hoje, sem mudar nada na tela:
1. Saídas normais que dividem estilo ganham estilo próprio (cópia exata), como o `darEstiloProprio` já faz.
2. `aliancaTelaFisica` de cada saída = campos físicos do estilo dela.
3. Em **cada** Visual existente: os campos novos (`camadas`, `fundo`, `transicao`, `creditos`, `biblia2..4`) recebem o valor atual do estilo da saída. Assim trocar de Visual depois da migração não muda fundo/transição de surpresa; o André personaliza a partir daí.
4. Saída sem estilo ou com estilo apagado: **não** cria estilo vazio. Vai para a Guarda.

## Guarda (o "quebrar alto" pedido em 23/nov)
Vigia na janela principal: saída normal ligada cujo `style` não existe.
- Com `aliancaTelaFisica` (já migrada): **refaz** o estilo a partir de Tela + Visual ativo (sai idêntico ao que era) e mostra aviso laranja "Painel LED: o estilo interno sumiu e foi refeito".
- Sem `aliancaTelaFisica`: **erro vermelho fixo** "Painel LED: configuração de aparência perdida, a saída está em 16:9. Abra Configurações › Saídas › Painel LED". Nunca cria estilo vazio calado.
- Nunca remenda na carga se os dados ainda não chegaram (`loadedState` com `synced_settings`, igual ao Visual hoje).

## Telas (o que o operador vê)
- **Configurações › Saídas › [saída]**: bloco novo **"Tela"** logo abaixo do monitor/tamanho:
  Proporção (`Preenche a tela (896×320)` | 16:9 | 4:3 | personalizada), alinhamento, tamanho da fonte, linhas máximas, encaixe da mídia. O "Proporção = resolução da saída" sai do popup escondido e vira o primeiro item, com o tamanho real escrito.
- **Configurações › Visual**: a tabela atual (saídas × colunas) ganha, por saída, um botão "Aparência ▸" que abre camadas, fundo, transição, créditos e Bíblia 2–4 versões. Visual com fundo/camada diferente do ativo mostra a diferença na linha de origem.
- **Configurações › Estilos**: sai do menu. Ninguém mais precisa dela. (O componente fica no código, só não aparece; dá para voltar com uma linha.)
- Botão do telão: igual (troca de Visual).
- Lugares que hoje dizem "estilo X" (`AliancaModeloBiblia`, popups de modelo do FreeShow, `TemplateInfo`): passam a dizer "Visual X / saída Y".

## Onde muda
| Arquivo | Fecho? | O quê |
|---|---|---|
| `src/frontend/utils/aliancaTelaVisualLogica.ts` (novo) | não | puro: `estiloComposto(tela, casaDoVisual, estiloAtual)`, migração, guarda; testes |
| `src/frontend/utils/aliancaTelaVisual.ts` (novo, absorve `aliancaVisualAplicador.ts`) | não | compositor, migração, guarda |
| `src/frontend/utils/aliancaVisualLogica.ts` | não | colunas/campos novos do Visual; `planoDeEscrita` passa a usar o compositor |
| `src/frontend/components/settings/AliancaVisual.svelte` | não | "Aparência ▸" por saída |
| `src/frontend/components/settings/tabs/Outputs.svelte` + bloco novo `AliancaTelaDaSaida.svelte` | não | bloco "Tela" |
| `src/frontend/components/settings/SettingsTabs.svelte` | não | tira "Estilos" do menu |
| `src/frontend/utils/aliancaSaidasSalvas.ts` | não | `aliancaTelaFisica` em `CAMPOS_DE_CONFIGURACAO` |
| textos que citam "estilo" | não | trocar por Visual/saída |

## Riscos que a revisão precisa olhar
1. Algum leitor do estilo fora do fecho que escreve nele (popups do FreeShow, `menuClick`, API, `Profiles.svelte`) e fura o "único escritor".
2. Perfis (`Profiles.svelte`) que trocam estilos: o compositor não pode brigar com eles.
3. `settings_synced.json` (estilos) é portável e `settings.json` (saídas) não: copiar a config para outra máquina leva o estilo mas não a Tela. A Guarda/compositor tem de lidar com isso sem quebrar.
4. D15 com camadas/fundo: o fundo do estilo é desenhado mesmo sem slide (`Output.svelte:357`). Trocar Visual com fundo novo durante o culto deve esperar o próximo slide como o modelo? Ou trocar na hora (é o que o ProPresenter faz com Looks)?
5. Saída de retorno (`stageOutput`) e saída-chave: não têm Tela de proporção (`getResolution` usa `bounds`).

## Testes
- vitest do puro: composição campo a campo; migração produz estilo **idêntico** ao atual (com o estado real de 23/nov do perfil de teste); guarda; Bíblia 2–4.
- `test:layout`, svelte-check, `ANCORA: ok` (sem exceção nova).
- Prova do Culto base × HEAD: 0 divergência em outputs.
- Na igreja: LED com "Preenche a tela" pela página da saída; dois Visuais com camadas diferentes trocados pelo botão do telão; apagar o estilo do LED no perfil de teste e ver a guarda.

## Revisão cética (23/nov) e o que mudou no desenho
Revisor independente, lendo o código; o fecho foi recalculado (609 arquivos) e os achados principais foram conferidos.
1. **Bloqueio: "o fecho não muda" só vale para o núcleo.** Os popups do FreeShow (`TemplateInfo`, `SelectStyle`, `AspectRatio`, `MaxLines`, `MediaFit`, `Transition`, `MetadataDisplay`), `menuClick.ts`, `contextMenus.ts`, `showActions.ts`, `apiHelper.ts` e `types/*` **estão no fecho**. → O núcleo (compositor, Tela, Visual, guarda, migração) fica fora do fecho e não os toca. Limpar textos e menus que falam de "estilo" nesses arquivos vira um **"aprovo estilo-menus"** separado e opcional. O campo novo é lido com tipo local (`any`), sem editar `types/Output.ts`.
2. **Bloqueio: há outros escritores** (`change_style` no menu da prévia, `menuClick.ts:1351`; "Estilo ativo" em Outputs; `changeOutputStyle` em `showActions.ts:560`, chamado pela API e por ações de slide; `SelectStyle` cria estilo vazio). Ações guardadas apontam para ids antigos e podem fazer duas saídas dividirem estilo de novo. → **Tela + Visual são a fonte da verdade e o compositor confere sempre**: qualquer mudança em `outputs[*].style` ou em `styles` vinda de fora é conferida campo a campo; estilo dividido é separado de novo, o estilo é recomposto e aparece aviso laranja ("Painel LED: o estilo foi trocado por uma ação/atalho e foi refeito"). Os atalhos de dentro da janela principal que abrem a aba Estilos passam a abrir a página da saída ou o Visual.
3. **Bloqueio: portabilidade.** Estilos são portáteis e sincronizados pela nuvem item a item; `outputs`/`special` não. Um `settings_synced` vindo de outra máquina traria o estilo com o mesmo id e os valores dela, e a guarda que só olha "existe?" ficaria calada (a falha de 23/nov). → A conferência do item 2 roda também na carga e a cada chegada de SETTINGS/SYNCED_SETTINGS (restaurar, nuvem), depois de ~2 s de estado estável. Achado de passagem, já existente: `backup.ts:218` testa `includes("SETTINGS")`, que também pega `SYNCED_SETTINGS` (anotado, fora desta rodada).
4. **Saída nova não pode cair no vermelho.** Saídas novas e o "resetar saída" nascem sem estilo. → O vigia dá Tela padrão (16:9, como o FreeShow) e estilo próprio a toda saída normal nova. Vermelho só para saída já migrada que perdeu a Tela física (marcador em `special.aliancaTelaVersao`). O compositor nunca compõe sem Tela.
5. **Migração idêntica de verdade.** Marcador próprio (`special.aliancaTelaVersao`), porque o `migrar` atual não roda de novo. Todo campo tem "ausente = não escrever" (estilo sem `aspectRatio`, com `resolution` antigo, `lines: 0`, `fit: null` continuam como estão). "Visual novo" herda camadas/fundo/transição do ativo. **A Prova do Culto não compara estilos** (grava só `out`): o teste de identidade ganha um comparador de `styles` antes × depois da migração, rodado sobre uma cópia do perfil real.
6. **Descartar.** Só os campos vindos do Visual entram na foto do rascunho; `aliancaTelaFisica` entra nas chaves de saída do rascunho; depois do Descartar o compositor confere de novo.
7. **D15 por campo, como o Look do ProPresenter.** Camadas, fundo e transição valem **na hora** (a "Pregação" com o LED só com fundo tira a letra imediatamente); os **modelos** esperam o próximo slide, como hoje. A ordem STYLES antes de OUTPUTS já é garantida (`listeners.ts`). Testar o cache de `getOutputResolution`, cuja chave não inclui `aspectRatio` (`output.ts:717`).
8. **A página Visual mora na aba `styles`.** → Esconder só o botão "Estilos"; a aba `styles` sem seção abre o Visual.
9. **Campos órfãos** (`showAsFaded`, `lineOpacity`, `skipVirtualBreaks`, `blurAmount`, `blurOpacity`): entram na Tela física (são de leitura do telão), no bloco "Tela" como avançados.
10. Perfis do FreeShow só controlam acesso: não brigam com o compositor.
11. O nome `aliancaTela` já existe (larguras dos painéis e `utils/aliancaTela.ts`): o campo passa a se chamar **`aliancaTelaFisica`**.
12. Guarda: esperar estado estável, reler a saída dentro do `update` e desistir se ela foi apagada.

**Resultado:** o núcleo não mexe no fecho. Opcional, com aprovo próprio: "aprovo estilo-menus" (tirar "Trocar estilo"/"Editar estilo" do menu da prévia, textos de `TemplateInfo`/`SelectTemplate` dizendo "Visual" em vez de "estilo"). Sem ele, esses caminhos continuam existindo, mas o compositor desfaz o efeito e avisa.

## Implementado (23–24/nov, "aprovo tela-visual") — branch `feat/cabine-6-tela-visual`
- Núcleo sem tocar o fecho (`ANCORA: ok`, nenhuma exceção nova). Estilo = Tela física (`outputs[id].aliancaTelaFisica`) + Visual ativo; compositor e conferência em `aliancaVisualAplicador.ts`, lógica pura em `aliancaVisualLogica.ts` (testes em `aliancaTelaVisualLogica.test.ts`).
- **Tela** (Configurações › Telas e saídas, no lugar de "Estilo ativo"): Proporção ("Preenche a saída (896×320)" | 16:9 | 4:3 | 21:9 | 1:1 | Outra), posição quando sobra espaço, tamanho da fonte, linhas por vez e **Vídeos e imagens**: Encaixar (contain), Preencher (cover: zoom até ocupar, corta o que passa), Esticar (fill: deforma), Encaixar com fundo desfocado (blur). Nomes pedidos pelo André.
- **Visual**: coluna **Camadas** por saída (Fundo, Texto, Sobreposições; vale na hora) e "▸ Aparência" (cor de fundo, transparente para NDI com alpha, tirar fundo quando houver texto, imagem de fundo [só tirar], Bíblia 2/3/4 versões "Igual à Bíblia" ou modelo). Visual novo herda camadas/fundo do ativo.
- **Estilos** saiu do menu; qualquer atalho para a aba `styles` abre o Visual.
- Conferência: 1,5 s depois de qualquer mudança em estilos/saídas/Visual, refaz o que não bate e avisa (laranja). Descartar: a Tela volta pelo rascunho e a conferência recompõe em silêncio; **mudança de comportamento:** o modelo que esperava o próximo slide é aplicado pela conferência (antes o Descartar o cancelava).
- Provado: migração na config real da cabine (cópia) não muda nenhum estilo; no perfil de teste da igreja, NDI-FullScreen e NDI-Alpha (que dividiam o estilo "default") foram separadas; desligar o Fundo só na NDI-Alpha funcionou ao vivo; "Trocar estilo" por fora foi desfeito com aviso.
- **Não feito (depois):** editar transição e escolher imagem de fundo pela página do Visual (os valores de hoje são preservados); campos avançados da Tela (volume, desfoque, linhas apagadas); "aprovo estilo-menus" (opcional) para tirar "Trocar estilo"/"Editar estilo" do menu da prévia e os textos de "estilo" nos popups do fecho.
