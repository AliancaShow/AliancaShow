# Passagem 22–23/nov → PC da igreja

Para o Claude Code que continua no PC da cabine (RX 580, 3 monitores). Leia antes `../LEIA-PRIMEIRO.md` (regras não negociáveis, dados reais, fecho, Prova do Culto). Branch: **`feat/cabine-6`**, versão **1.8.0**.

## Objetivo da sessão na igreja
Testar com as telas reais e validar tudo o que foi feito nestes dois dias. **Nunca rode o app de dev sobre `Documentos\AliancaShow`** — use perfil de teste (`FS_MOCK_STORE_PATH` + `--user-data-dir`), ou faça backup antes e combine com o André.

## Montagem
```
git fetch
git checkout feat/cabine-6
git pull
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install   (o npm global 11 falha com deps git)
```
`bundled-bibles\` precisa estar na raiz (ARA e NVI). Atenção: com as Bíblias presentes, a fumaça **t11 falha** (espera 1 linha e encontra 2) — é do teste, não do app (verificado no base 53210f1).

## O que foi feito (em ordem)
| Frente | O que mudou | Onde |
|---|---|---|
| Áudio (D11) | Áudio derrubado pelo vídeo **nunca volta sozinho** (regra geral D4) | `audio/audioFading.ts` (fecho, aprovado) |
| Spotify | Mudo, volume e Parar no cartão; conta na camada Áudio (F4) | `AliancaTransporte`, `aliancaSpotifyCartao*` |
| Telas 1a | Config das saídas **não se perde ao fechar** (vigia marca não salvo) | `utils/aliancaSaidasSalvas.ts` |
| Telas | Resize do Windows não sobrescreve a posição da saída | `OutputLifecycle.ts` (fecho, aprovado) |
| Transporte | Pausar suave 0,7 s (vídeo e áudio), Parar limpa; cartão do vídeo no centro (sem vídeo grande) | `aliancaPausaSuave*`, `AliancaCentroVideo` |
| Vídeo (fatia A) | Prévias da janela principal por **captura** da janela da saída: decodificações 4→1 (GPU 80%→51% aqui). Saída desligada desenha o slide com vídeo em miniatura. Vigia de queda recria a janela | `AliancaCaptura`, `aliancaVigiaSaida` (fecho, aprovado) |
| Visual V1 | Página **Configurações › Visual** (saídas × Música e avisos / Bíblia + leiaute do retorno), "Culto padrão" criado da config atual, linha de origem em Mostrar, troca vale no próximo slide | `aliancaVisual*`, `AliancaVisual.svelte` |
| Visual (ajustes) | "Sem modelo" no lugar de "usa o slide"; sem aviso de "próximo slide" na tela principal; **estilo próprio automático** quando duas saídas dividem estilo | idem |
| Botão do telão | Pílula do Visual + "Ligar telão" viraram **um botão**: `● No ar · Culto padrão ▾` (vermelho), Congelado (azul-gelo), Desligado (tracejado). Menu: Congelar, Desligar, Voltar o que foi limpo, Visuais, Editar visuais. **App abre com o telão ligado** (só na partida) | `AliancaTelaoPilula`, `aliancaTelaoPartida.ts` |
| Versão | 1.7.2 → **1.8.0**; regra: todo instalador sobe a versão (função nova = meio, correção = fim) | `package.json`, LEIA-PRIMEIRO |
| Prova da Mostrar | Critério aprovado em `criterios/criterio-mostrar.md` (ESC é o pânico; congelar não). Correções: **ESC em dois toques** com cursor/camada (1º solta, 2º limpa), F1–F5/Ctrl+L passam em campos; **mídia sumida não vai ao ar** (X "OFFLINE" no cartão + aviso que fica); contraste | `aliancaCampoTeclasLogica`, `aliancaMidiaSumida*` |
| Avisos | Toast flutuante substituído por **linha de avisos no pé** (neutro/laranja/vermelho, info some em 5 s, aviso/erro ficam, "(N×)", histórico "Últimos avisos" com divisória). Queda de saída e falha interna entram nela (uma barra só) | `AliancaAvisos`, `aliancaAvisos*`, `aliancaQuedaAvisos.ts` |

Testes na última junção: `test:layout` 103/103, vitest 1679 ok (só os 4 RtmpStreamer falham), svelte-check 151, `ANCORA: ok`. Prova do Culto (no 3915df6): **0 divergência em outputs**; esperadas: 38 `principal.sinais` + `OUTPUT:SPECIAL` (autoBackupPrevious, aliancaVisuais/aliancaVisualAtivo, aliancaTelaoNaPartida).

## O que testar na igreja (com as telas reais)
1. **Escala do Windows** de cada monitor (anotar). Roteiro do POC de vídeo: `roteiro-igreja-23nov.md` (decide se o motor de vídeo único completo vale a pena na RX 580).
2. **LED 896×320:** Configurações › Saídas › LED › "Tamanho" 896×320 no canto do monitor 2, cadeado ligado, **estilo próprio do LED com Proporção = "resolução da saída"**, não clicar no mapa. Fechar e reabrir: tem que continuar igual.
3. **Visual:** conferir o "Culto padrão" gerado; escolher modelo do LED em Música e Bíblia; trocar Visual pelo botão do telão com um slide no ar (muda no próximo slide).
4. **Botão do telão:** abre "No ar"; congelar/descongelar; desligar (não religa sozinho). Conferir que fica encostado nos botões do Windows.
5. **Vídeo:** tocar um vídeo 1080 e um 4K com LED + retorno ligados; ver se o PC engasga; pausar (curva suave) e parar (limpa).
6. **ESC:** com o cursor na busca e na Mensagem pro palco: 1º solta, 2º limpa. O X vermelho limpa sempre com 1 clique.
7. **Mídia offline:** renomear um arquivo de teste → card com X, não vai ao ar, aviso laranja fica.
8. **Queda:** se alguma saída cair, aviso vermelho na linha de avisos e a janela volta sozinha.

## O que saiu do teste na igreja (23/nov, noite) — `feat/cabine-6-monitores`, juntada na `feat/cabine-6`
- **Fumaças** no PC da cabine: 14/15 OK (t11 só o A6c, conhecido). **POC do vídeo:** `a:4k` perde ~47% dos quadros com o decodificador em 96%; `b2`/`b3` 4K perdem 0 (decodificador 30–37%). O motor de vídeo único vale a pena na RX 580. Tudo em `testes-igreja-23nov/` (branch `teste/igreja-23nov` tem os brutos do POC).
- **Monitores** (`testes-igreja-23nov/achados-monitores-23nov.md`): o número do monitor (`Display.id`) é estável (5 trocas de ordem, desconectar/reconectar); o defeito era a saída guardar coordenadas soltas. Windows numera pela conexão (1 cabine, 2 retorno, 3 LED), o app pela posição: o mapa agora mostra o **nome** do monitor (E2241, T27C310, NOVA HD CARD).
- **"aprovo monitor-desconectado"** (desenho e revisão cética em `desenho-monitor-desconectado.md`): a saída fica presa ao monitor (o LED 896×320 segue o NOVA HD CARD); monitor ausente = a janela some, a saída continua ligada, erro fixo na linha de avisos, volta sozinha quando o monitor volta. Fecho: só `OutputVisibility.ts` + 3 novos, registrados no `ancora.mjs`. Validado pelo André nas telas reais (escolher no mapa, trocar a ordem, desconectar/reconectar, reabrir). Testes: unit 1715 ok (só `RtmpStreamer.integration`, 6 agora que o ffmpeg está instalado), `test:layout` ok, svelte-check 151, fumaças 14/15, Prova do Culto base×HEAD gravadas no PC da igreja: 0 divergência em outputs (só `OUTPUT:SPECIAL` autoBackupPrevious e o id do Visual).
- **Antes de instalar na cabine:** a config real tem o Retorno com um monitor que não existe mais (3010161637) e o LED sem monitor. Com o instalador novo, o Retorno abre "desconectado" e o LED com aviso laranja: escolher os dois **uma vez** no mapa (Retorno → T27C310; LED → NOVA HD CARD, "mantendo 896×320").
- **Achado do perfil de teste:** com `FS_MOCK_STORE_PATH`, os arquivos portáteis (estilos, modelos, cultos, palco: `settings_synced.json` etc.) são lidos da pasta `store\`, não de `Config\`. Para testar com uma cópia dos dados reais, copie também `Documentos\AliancaShow\Config\*.json` para `store\`. Sem isso o LED perde o estilo e sai 16:9 com barras (foi o que pareceu defeito no teste).
- **Próxima conversa:** Visual × Estilo. O André quer **uma opção só** (hoje há "Visual" e "Estilos", herdado do FreeShow, e "Proporção = resolução da saída" fica escondido em Estilos). Também: quando o estilo de uma saída some, o Visual cria um estilo vazio e o LED cai em 16:9 calado — tem de quebrar alto.

## Tela + Visual ("aprovo tela-visual", 24/nov) — `feat/cabine-6-tela-visual`
- O "Estilo" do FreeShow deixou de ser opção: cada saída tem a **Tela** (física: proporção, posição, fonte, linhas, como vídeos e imagens preenchem) e o **Visual** é o Look do ProPresenter (por saída: camadas, modelos de Música e Bíblia, fundo). Desenho, revisão cética e o que foi feito: `desenho-tela-e-visual.md`.
- Na primeira abertura com a versão nova, a migração lê os estilos de hoje (nada muda na tela) e separa saídas que dividiam estilo (na cabine: NDI-FullScreen e NDI-Alpha).
- Testes: unit 1574 ok no frontend, svelte-check 151, `ANCORA: ok` sem exceção nova; migração provada na cópia da config real.

## Pendências (perguntas abertas ao André)
- **"aprovo selecionar-tela"** — tirar a janela que bloqueia quando o telão não liga (`src/frontend/IPC/responsesMain.ts`, fecho; diff de 1 linha pronto no histórico: `if (a === "error.display") return` antes do `alertMessage.set`). Depois do aprovo: registrar em `ancora.mjs` (EXCECOES + recalcular SHA_EXCECOES).
- **V2 do Modelo** (modelo nasce no tamanho da tela; precisa de "aprovo" para TemplateSlide, Editbox, Snaplines, Textbox, autoPosition — ver `plano-modelos-visual.md` + adendo). Perguntas: (1) coluna única "Música e avisos" por enquanto? (2) cortar a reaplicação automática do modelo ao abrir a música (estampa D20)? (3) miniaturas do centro imitam o LED? (4) Bíblia com duas versões usa modelo próprio?
- Saída "fora do ar": o aviso só some quando a saída volta ou é desligada nas Configurações — confirmar se está bom.
- Motor de vídeo único completo (F2/F3): decidir depois do POC na RX 580 (`desenho-motor-de-saida.md`).
- Próxima rodada de critério (grill-me): tela **Preparar**.
- Frente 1b/1c/1d (nova tela de monitor + área, reencontrar monitor, botão Testar), Spotify 4c (fecho), sobreposições por saída (D19).

## Documentos de referência
`plano-cabine-6.md` (D1–D29) · `plano-modelos-visual.md` · `desenho-motor-de-saida.md` · `criterios/criterio-mostrar.md` · `roteiro-igreja-23nov.md` · `leiaute-v2-prototipos/Rodada-cabine-6.html`.
Fumaças novas: `scripts/prova-culto/t16-visual.mjs` (passo 1 e `reaberto`).
