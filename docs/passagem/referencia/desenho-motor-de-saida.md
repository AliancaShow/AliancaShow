# Desenho: motor de saída (um decodificador, N saídas) — rascunho para revisão cética (22/nov)

Base: `feat/cabine-6`, `ANCORA: ok` (fecho de 598 arquivos no HEAD, rodado por mim). Decisão do André: variante **b2** do POC (`bancada/poc-video-unico`): um renderer decodifica cada vídeo uma vez; as saídas são janelas filhas abertas por `window.open` (mesmo processo) e cada uma desenha o `<video>` compartilhado no seu canvas.

Este documento escolhe **como** portar. Nada aqui foi codado. O que é medido e o que é hipótese está marcado.

## 0. Como é hoje (conferido no código)

- Cada saída é um `BrowserWindow` próprio, com processo próprio: `OutputLifecycle.ts:141` (`new BrowserWindow`) e `:155` (`loadWindowContent(window, "output")`). O tipo chega por `STARTUP/TYPE` (`index.ts:256-258`) e a janela monta `MainOutput` (`App.svelte:73`), que pede o estado com `REQUEST_DATA_MAIN` (`startup.ts:214`, `receivers.ts:178`).
- O principal fala com cada saída por `output.window.webContents.send` (`OutputSend.ts:18`), filtrando `OUTPUTS` por id (`:24-29`). Cada saída só conhece a si mesma (`MainOutput.svelte:14`).
- Captura (NDI, Blackmagic, RTMP, prévia): `captureOpts.window.webContents.capturePage()` (`CaptureLifecycle.ts:139`). Saídas invisíveis são renderizadas escondidas (`OutputVisibility.ts:34-40`, `OutputBounds.ts:53-65`).
- Vídeo: `Video.svelte:208` monta um `<video muted>` por instância, mais um para `blur` (`:205-207`) e um para `softLoop` (`:213-215`). **O som não está na saída:** o relógio é um `new Audio(arquivo)` na janela principal (`videoPlayer.ts:268`), que publica o tempo a cada 100 ms (`videoPlayer.ts:757`, `listeners.ts:393-395`, `receivers.ts:293`). Cada `<video>` persegue esse tempo com seek e ±6% de velocidade (`videoSync.ts:36-110`).
- Espelhos que decodificam de novo: `PreviewOutput.svelte:28` (usado em `AliancaNoAr.svelte:84` e `AliancaOutrasTelas.svelte:33`) e o retorno com "saída atual" (`Stagebox.svelte:395`).
- **Não existe nenhum tratamento de `render-process-gone` em `src/electron`** (busca vazia). Hoje, se uma saída cai, a janela fica morta e ninguém é avisado.

## 1. Opções de arquitetura

**(i) Motor completo.** Um renderer dono roda todo o Svelte da saída e monta cada saída em `child.document` (filhas `about:blank`, sem preload).

**(ii) Híbrido com janela de vídeo por baixo.** Saídas continuam como hoje; um motor de mídia abre uma janela só de canvas empilhada sob cada saída transparente.

**(iii) Irmãs no mesmo processo (recomendada).** Uma janela **motor** oculta abre cada saída com `window.open` apontando para a **mesma URL do app**. Cada filha é um `BrowserWindow` de verdade (chega por `did-create-window`), roda o seu próprio Svelte e o seu próprio preload, mas divide o processo com o motor. Só o `Video.svelte` muda: em vez de `<video src>`, um `<canvas>` que desenha o `<video>` que vive no motor (`window.opener`, mesma origem).

**(iv) Espelho por captura (variante c do POC).** Uma saída decodifica; as outras mostram captura da janela dela. Fica como plano B só para prévias.

| critério | (i) motor completo | (ii) janela por baixo | (iii) irmãs no mesmo processo |
|---|---|---|---|
| decodificações | 1 por vídeo | 1 por vídeo | 1 por vídeo |
| IPC atual (`OutputSend`) | reescrever: tudo passa pelo dono, com envelope por saída | intacto | **intacto** (cada filha tem `webContents`) — *a provar: preload roda na filha* |
| lojas Svelte | uma realm para N saídas; `MainOutput.svelte:14` e todo `document`/`window` global quebram | intactas | **intactas** (uma realm por filha) |
| captura/NDI | `capturePage` na filha: a provar | **quebra**: a captura da saída não contém o vídeo | `capturePage` na filha: a provar (inclusive escondida) |
| retorno com conteúdo diferente | exige lojas multi-saída | intacto | intacto; o espelho do retorno desenha o mesmo `<video>` do motor, sem captura |
| queda | cai tudo; recriar = remontar todo o app | cai só o vídeo; texto segue | cai motor + todas as saídas; a janela principal e o **som** seguem |
| disputa de thread | 1 thread para tudo | como hoje | 1 thread para N apps Svelte (risco; medir) |
| DPI / multimonitor | filhas reais | **duas janelas por saída para alinhar ao pixel** | filhas reais; `OutputBounds` inalterado |
| transparência / ordem Z no Windows | como hoje | **duas janelas topmost por saída; filtros e `mix-blend-mode` do fundo (`Background.svelte:19`) não atravessam janelas** | como hoje (uma janela por saída) |
| Prova do Culto | o gravador só enxerga páginas `localhost:3000` (`cdp.mjs:22`); filhas `about:blank` somem | intacta | filhas carregam a URL real: continuam visíveis |
| quanto do fecho muda | `OutputLifecycle`, `OutputSend`, `MainOutput`, `startup`, `receivers`, lojas: o coração | pouco, mas não entrega | criação da janela + `Video.svelte` (lista na seção 6) |

**Recomendação: (iii).** Entrega o b2 medido (1 decodificador, 0 quadros perdidos, 33,4±1,9 ms) sem reescrever IPC, lojas nem captura. (ii) é descartada por quebrar NDI/captura e a composição do fundo. (i) fica como destino só se (iii) reprovar na prova da fatia 0.

**O que (iii) ainda não tem provado** (o POC usou filhas `about:blank` sem preload):
1. O preload e o `ipcRenderer` funcionam em filha de `window.open` com URL real e `contextIsolation`.
2. Em produção a página é `file://` (`index.ts:249`): a filha acessa `window.opener` como mesma origem.
3. `capturePage` e `getMediaSourceId` funcionam na filha, visível e escondida.
4. Três apps Svelte numa thread não engasgam a troca de slide durante vídeo.

Se o item 1 reprovar, a saída é **(iii-b)**: o motor repassa o IPC às filhas (muda `OutputSend.ts` e `request.ts`). É decisão de desenho tomada na fatia 0, não um modo alternativo em produção.

**O dono é uma janela motor dedicada e oculta**, não a janela do LED: `createOutput` fecha e reabre a saída quando ela já existe (`OutputLifecycle.ts:67-71`), o que mataria as irmãs. Custo conhecido: em dono oculto o `requestVideoFrameCallback` cai a ~1 Hz (POC `b2-hidden_4k`: 1013 ms). O desenho então é puxado por um **marcador do motor**: `requestAnimationFrame` de qualquer filha visível, e `setInterval` quando nenhuma está visível (saída só-NDI). Só redesenha quando `getVideoPlaybackQuality().totalVideoFrames` muda. O POC `b2-hidden_4k` deu decode 42% contra 32% do `b2_4k`; a causa não foi isolada (redesenho a 60 Hz é suspeita) e isso é remedido na fatia 0. Se não fechar, o dono passa a ser a janela do telão e o `createOutput` deixa de fechá-la.

## 2. Enquadramento por saída (D1/D10)

Nada novo de modelo: o enquadramento já é por saída. `BackgroundMedia.svelte:31` calcula `mediaStyle` com o **estilo daquela saída** (`getMediaStyle`, `media.ts:382`: `fit: currentStyle?.fit`). Cada filha roda o seu `Video.svelte`, então cada canvas aplica o seu `fit`:

- `contain`, `cover`, `fill`: conta de retângulo no `drawImage` (igual ao `drawAll` do POC, `page.js`). LED 14:5 = `cover`; demais = `contain`.
- `blur`: dois `drawImage` no mesmo canvas (fundo `cover` com `ctx.filter` + frente `contain`). Elimina o segundo `<video>`.
- espelhar, filtro, mesclagem, opacidade e transições continuam CSS no elemento canvas; a troca de fundo (`Background.svelte:154/159`) segue com dois elementos por ~800 ms, que no motor são dois vídeos de caminhos diferentes.
- Tamanho do canvas = caixa CSS × `devicePixelRatio` **da própria filha**, recalculado em `resize` e mudança de escala.
- Texto e slides seguem DOM por cima, com o modelo da saída (D10): nenhuma mudança.

Registro no motor: `adquirir(caminho)` / `soltar(caminho)` com contagem de uso. Decodificações = vídeos distintos tocando, não saídas. `softLoop` pede um segundo elemento no motor (2 no sistema, não 2 por janela).

Lacuna: legendas embutidas (`<track>`, `Video.svelte:209-211`) não saem no `drawImage`. Ver pergunta 5.

## 3. Prévias com movimento total (D3) sem decodificar

A janela principal é outro processo: não alcança o `<video>` do motor.

- **"No ar" e "Outras telas"**: `PreviewOutput` vira um `<video srcObject>` com a captura da janela daquela saída (`getMediaSourceId`, já exposto em `responsesMain.ts:476`; medido em 22/nov: 896×320 a ~27 fps). Pedir a fonte **pelo id da saída**, nunca pelo título. Ganho extra: o "No ar" mostra o que está de fato no telão, enquadramento incluído.
- **Saída desligada ou escondida**: a captura congela (medido na variante c). Nesse caso a prévia volta à árvore DOM atual, com o vídeo como quadro parado + selo "▶ vídeo 02:13 · telão desligado". Não é fallback calado: é o estado "não está no ar", dito na tela.
- **Retorno em espelho (D2-b)**: mesmo processo do motor, canvas direto, zero captura.
- Em nenhum caso a janela principal monta `<video src>` de saída (`mirror` na principal nunca decodifica).

## 4. Relógio e controles

- **O som fica onde está** (`Audio` na principal). Volume, fades, analisador, D4/D11 e a faixa de transporte (`AliancaTransporteVideo.svelte` → `VideoPlayer`) **não mudam**.
- Some a sincronia entre janelas: todas desenham o mesmo quadro (POC: 0…1 quadro). Sobra **um** ponto de sincronia, vídeo do motor × áudio.
- `videoSync()` (`videoSync.ts:4-15`) continua em cada `Video.svelte`, mas em vez de mexer num elemento local chama `motor.sincronizar(caminho, estado)`. O motor aplica `syncVideoToAudio` uma vez por estado (descarta repetidos das outras saídas).
- Pausar, buscar, repetir e fim de vídeo já são do áudio: o motor só acompanha.
- Fatia opcional: carimbar o estado com a hora e trocar o ±6% por seek acima de 0,5 s (a antiga 2e). Só se a medição pedir.

## 5. Falhas — sempre altas, nunca caladas

| falha | o que a igreja vê | como é anunciado | recuperação |
|---|---|---|---|
| processo do motor cai | todas as saídas param juntas; o som continua | faixa vermelha na principal: "Saídas caíram — recriando" com contador | `render-process-gone` → destrói filhas, recria motor e saídas, reenvia estado; o vídeo volta no tempo do áudio |
| recriação falha 3 vezes em 60 s | preto | faixa vermelha fixa "Saídas fora do ar" + botão "Recriar saídas" | manual; **não** abre saída avulsa por fora do motor |
| saída sem motor (`window.opener` nulo) | preto no fundo; texto segue | erro vermelho na principal com o nome da saída | recriar saídas |
| vídeo não carrega no motor | fundo anterior/preto | o `on:error` atual (`Media.svelte:42-56`) + aviso na principal | nova tentativa como hoje |
| captura da prévia falha | nada muda no telão | selo laranja na prévia "sem imagem do telão" | nova tentativa a cada 2 s |

Não medido: tempo de recriação. Piso conhecido: `MainOutput.svelte:36-38` espera 2 s antes de montar `<Output>`. Também não medido: o que uma janela `transparent: true` (`windowOptions.ts:44`) mostra com o renderer morto (pode ser a área de trabalho). O teste "matar o motor" responde os dois; se aparecer a área de trabalho, entra uma cortina preta do processo principal atrás de cada saída visível.

## 6. Fatias

Marcação de fecho calculada com `fechoDoRef("src/frontend/MainOutput.svelte", "HEAD")`.

**F0 — Provas, sem código de produto.**
- Na igreja (RX 580, 3 monitores, sem outros apps): `pwsh -File run.ps1` completo + `-Chaos crash:MAIN`. Passa se `b2_4k` e `b2_1080` derem 0 quadros perdidos, cadência com desvio < 5 ms e decode < 70%.
- POC "b3" na bancada (fora do repo): filhas com URL real + preload; os 4 itens não provados da seção 1; canvas nos tamanhos reais (896×320, 1024×768, 1920×1080) e escala 125%; dono oculto com o marcador × dono = LED; matar o motor e fotografar o LED.
- **Portão:** F2 em diante só começa com F0 aprovada pelo André.

**F1 — Vigia de queda (vale sozinha, já hoje).** `render-process-gone` nas saídas atuais → faixa vermelha + recriar.
Fecho: `electron/output/helpers/OutputLifecycle.ts`, `electron/output/OutputHelper.ts`, `frontend/utils/receivers.ts`. Livre: componente da faixa.
Aceite: matar o processo de uma saída → faixa em < 1 s, saída de volta, tempo anotado.

**F2 — Saídas nascem do motor (vídeo ainda como hoje).**
Fecho: `OutputLifecycle.ts` (criação via `setWindowOpenHandler`/`did-create-window`), `OutputVisibility.ts` (`toggleOutput:28-32` passa a esperar a janela), `electron/utils/windowOptions.ts`, `electron/index.ts` (tipo "motor"), `frontend/utils/startup.ts`. Livre: `App.svelte`, `preload.ts`.
Aceite: todas as saídas com o mesmo PID; Prova do Culto 0 divergência em outputs; foto do LED nos 4 cantos; NDI e saída invisível com imagem; teste matar-o-motor. Testada sozinha, **vai para instalador junto com a F3**.

**F3 — Vídeo pelo motor.**
Fecho: `components/media/Video.svelte`, `components/media/video/softLoop.ts`, `components/media/video/videoSync.ts`; novo `motorMidia.ts` (entra em `NOVOS_NO_FECHO`).
Aceite (vídeo real do culto, 60 s, 1080p e 4K): 1 decodificação por vídeo nas saídas; 0 quadros perdidos; cadência < 5 ms de desvio; A/V dentro de ±40 ms; LED em `cover` e retorno em `contain` por foto; `blur` e `softLoop` conferidos; saída NDI invisível com movimento; Prova 0 divergência.

**F4 — Prévias por captura.**
Fecho: `components/output/preview/PreviewOutput.svelte`, `electron/IPC/responsesMain.ts`, `types/IPC/Main.ts`. Livre: `AliancaNoAr.svelte`, `AliancaOutrasTelas.svelte`.
Aceite: nº de `<video src>` na principal = 0; decode total igual ao da F3; "No ar" ≥ 25 fps; telão desligado mostra o selo.

**F5 — Relógio carimbado (só se a medição reprovar).** Fecho: `videoPlayer.ts`, `videoSync.ts`, `frontend/utils/listeners.ts`.

Toda fatia: critério de entrega do `plano-cabine-6.md`, `ancora.mjs` rodado por mim, um "aprovo" por fatia com arquivo, diff e motivo.

## 7. Perguntas ao André

1. Se o motor cair no meio do culto, todas as telas apagam juntas por alguns segundos e voltam sozinhas, com o som sem interrupção. Hoje cairia só uma tela, mas ficaria morta sem aviso. Aceita essa troca?
2. Durante a recuperação, as telas ficam **pretas**. Prefere outra coisa (ex.: logo da igreja)?
3. O "No ar" passará a mostrar a imagem real do telão, no formato do LED (faixa 14:5). Com o telão desligado mostra quadro parado + selo. Serve?
4. Pode reservar uma janela na igreja, sem culto, para rodar a F0 (uns 30 min, com o vídeo real)?
5. Vocês usam vídeos com legenda embutida? Se sim, entra uma fatia a mais.
6. F2 e F3 vão num instalador só. Tudo bem receber as duas juntas, depois de eu testá-las separadas?

---

## Adendo (22/nov, noite): revisão cética + POC b3

**Veredito da revisão: "go com mudanças".** POC b3 (`bancada/poc-video-unico/b3`, `run-b3.ps1`) testou os riscos com webPreferences iguais às da saída, em `file://` (produção, sandbox) e em http (dev).

### Provado (PASS)
- Filhas de `window.open` com URL real recebem o preload e falam IPC (8–19 ms); `did-create-window` entrega `BrowserWindow` controlável (bounds exatos, alwaysOnTop).
- Motor e filhas no **mesmo processo**, em `file://` e em http.
- `window.opener.document.querySelector('video')` funciona com contextIsolation, sem contorno.
- 4K com dono oculto, desenho pelo rAF da filha **com portão** (só redesenha quando `totalVideoFrames` muda): 0/900 perdidos, 33,33±1,4 ms, decode ~43%.
- Queda do motor: detectada em 22–46 ms; telas ficam **pretas** (não mostram a área de trabalho); recriação com as 3 filhas desenhando em **0,6–0,8 s**.

### Reprovado / riscos novos
- **Portão obrigatório:** desenhar a 60 Hz sem portão congelou o vídeo 4K.
- **rVFC com dono oculto = 1 Hz:** não usar.
- **`capturePage` de filha oculta trava** (NDI, saída invisível). Filha fora da tela captura sem carga e congela com carga. → saídas invisíveis/NDI continuam como janelas avulsas, ou visíveis fora da tela com folga medida.
- **Thread única:** texto animado que mexe em layout em 3 saídas derrubou o vídeo de todas (247 quadros pulados, CPU 150%). Texto estático com troca de slide a cada 2 s ficou quase limpo (10 pulos/600). → animações só de compositor (transform/opacity) e medir as transições reais do Svelte.
- Retomar após a queda deixa o vídeo ~0,4 s atrás do relógio → compensar.

### Correções da revisão incorporadas
- Chave do decodificador = **instância** em `playingVideos` (`${path}_${outputId}`), não o caminho.
- `MediaItem.svelte` (vídeo dentro do slide) e YouTube/Vimeo (som na saída) entram no escopo.
- `App.svelte` e `preload.ts` tratados como fecho (mudam a saída, apesar de fora do cálculo).
- F1 + `OutputVisibility.ts`; F2 + `OutputSend.ts`, `CaptureLifecycle.ts`, `responsesMain.ts`; F3 + `Media.svelte`, `Background.svelte`, `MediaItem.svelte`, `videoPlayer.ts`; Prova do Culto: `cdp.mjs` não pode classificar o motor como saída.
- Aceite da F4 = "0 decodificações do vídeo no ar na principal".
- Janela opaca quando `!output.transparent`.
- Aceite de disputa de thread: troca de slide com texto autoajustado ×3 durante 4K, 0 perdidos; motor oculto por 10 min; `unresponsive` vigiado; quedas deduplicadas.

### Nova ordem
1. **Passo intermediário (antes do motor):** previews da principal ("No ar", "Outras telas") e espelho do retorno (`Stagebox:395`) por **captura da janela do telão**; centro mostra cartão com miniatura em vez do vídeo (D26); vigia de queda (F1). Sem mexer em processos. Tira ~4 das ~5 decodificações.
2. **F0 na igreja:** POC `run.ps1` + `run-b3.ps1` na RX 580 com 3 monitores, e medir o passo 1 no app real.
3. Decidir F2/F3 (motor) com esses números.
