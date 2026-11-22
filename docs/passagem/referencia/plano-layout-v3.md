# Plano v3: leiaute novo do AliançaShow (uma tela só)

- **Aprovado por:** André, 17/nov/2026. **Fonte da verdade:** `Tela-luz.dc.html` (visual final) e `Tela-unica.dc.html` (mesmo esqueleto, claro; serve só de referência de estrutura). Cópia em `bancada\leiaute-v2-prototipos\`. **Referência da cabine:** `Tela-luz-1080.dc.html`, na mesma pasta (board a 1920×1080, feito por quem coordena). Na fatia 1 os protótipos entram no repositório em `aplicar/leiaute-v2/`, anotados com `data-regiao` (a pasta `aplicar/` já existe).
- **Código de referência:** worktree `bancada\show-preparar`, branch `feat/layout-f1b`, HEAD `091f4cd`. Caminhos relativos a `src/frontend/` quando não indicado.
- **O que mudou da v2 para a v3:** incorpora a revisão cética (`revisao-layout-v2.md`, 25 achados), as respostas do André de 17/nov e as decisões de quem coordena. Fatos da v2 que estavam errados foram conferidos no código e corrigidos (seção 9).
- **Isto não é remendo.** A fatia 1 entrega a tela do protótipo em Mostrar e apaga o esqueleto antigo no mesmo PR.
- **Status:** plano revisado; a fatia 1 foi reescrita em 17/nov depois de `revisao-fatia1-v3.md`. As perguntas 1 e 2 estão respondidas (fim do documento). Não codar a fatia 1 antes de o André aprovar o board `Tela-luz-1080.dc.html` e de a Archivo estar em `bancada\leiaute-v2-prototipos\fontes\`.

## 1. Regras duras

1. Não existe modo clássico, fallback nem flag. O que não tem lugar no novo chama `falhaAlta(origem, erro)` e acende a faixa. Nunca cai calado numa tela antiga.
2. Quebrar alto continua valendo: nunca manda nada ao telão, nunca trava a cabine, nenhum elemento novo intercepta clique.
3. A janela de saída não muda. `scripts/prova-culto/ancora.mjs` continua sendo o juiz (seção 4.3).
4. Nenhum painel permanente flutua sobre o conteúdo. Popover aberto por clique, menu de contexto, aviso passageiro e diálogo continuam (o protótipo tem todos). Única exceção consciente: a barra de controle de vídeo sobre a tela do "No ar" (resposta P9 do André).
5. Saem na fatia 1, sem pergunta: as flags `special.aliancaSeletorCompacto` (`components/show/Projects.svelte:438,610` e `components/show/ProjectList.svelte:68`) e `special.aliancaVisual` (`utils/aliancaTema.ts:17`, `utils/aliancaTemaLogica.ts`). Não há chave de emergência do visual.
6. Só gesto do operador na cabine troca Mostrar ↔ Editar: o segmentado do topo e o "Editar" do botão direito. Efeito colateral ou origem remota que tente trocar é recusado com `falhaAlta`. Todo caminho que chega em Mostrar arma antes o anteparo de 700 ms.
7. Região do protótipo que uma fatia ainda não entrega fica vazia de propósito e listada no PR como "diferença declarada". Nunca um componente antigo ocupando o lugar.
8. Uma aparência só: escuro Luz de Projeção. Sem tema claro, sem interruptor de desfoque. A aba Tema das Configurações sai na fatia 1.

## 2. Mapa protótipo → código

### 2.1 Esqueleto e tema

| Protótipo | Hoje | Vira |
|---|---|---|
| Raiz 1440×900: topo 56 px + corpo `[(esquerda \| centro) / biblioteca] \| direita` | `src/frontend/MainLayout.svelte` (287 linhas, colunas por `page`, gaveta dentro do centro), montado por `App.svelte:94` | Novo `components/main/AliancaTela.svelte`, montado por `App.svelte`. `MainLayout.svelte` é apagado na fatia 1. |
| Divisórias de 8 px: esquerda 280 (200–460), direita 330 (260–460), biblioteca 260 (140–560) | `components/system/Resizeable.svelte`; arrasto próprio em `components/drawer/Drawer.svelte`; valores em `resized` e `drawer` | Novo `components/main/AliancaDivisoria.svelte` + lógica pura `utils/aliancaTelaLogica.ts`. Larguras em store novo `utils/aliancaTelaEstado.ts` (`{ esq, dir, bib }`), gravado em chave nova `aliancaTela` das configurações. As chaves antigas (`resized.leftPanel`, `rightPanel`, `leftPanelDrawer`, `rightPanelDrawer`, `project_timeline`, `drawer.height`) não são lidas: toda instalação abre com 280 / 330 / 260, em qualquer resolução (na cabine, a 1920×1080, o centro absorve a sobra). Na carga o valor novo é preso aos limites e ao mínimo do centro (seção 5, fatia 1). |
| Mostrar \| Editar: as mesmas colunas trocam de conteúdo | `activePage` (78 escritas em 38 arquivos) e `modoAlianca` (`stores.ts:367`, 2 escritores: `components/main/AliancaModo.svelte:27` e `utils/aliancaPilula.ts:104`) | Fatia 1: nada muda na regra; o segmentado novo escreve o par (página, modo). Fatia 2: `utils/aliancaTela.ts` com `tela` (`mostrar` \| `editar` \| `pagina`) e a porta única `trocarTela`; `modoAlianca` é apagado (seção 5, fatia 2). |
| Tema Luz de Projeção (fundo `#0d0d0f`, painel `rgba(19,19,21,.62)` raio 14, texto `#f8f8f0`, vermelho `#f21a27`, verde `#5ec48d`, âmbar `#f1d278`; Archivo no app, Montserrat no slide) | `utils/aliancaTema.ts` + bloco `FV:INICIO…FV:FIM` de `public/global.css` (linhas 255–340, sob `body[data-tema="padrao"]`) | Bloco FV substituído. Todo token novo fica sob `body[data-tema="luz"]`; só a janela principal escreve `data-tema` (mecanismo de `aliancaTema.ts`, que passa a valer nos dois modos e perde a leitura de `aliancaVisual` e do tema do FreeShow). O tema do FreeShow escreve variáveis em `document.documentElement` (`utils/updateSettings.ts:242`); declaradas no `body`, as nossas ganham dentro da janela principal e não existem na saída. Archivo variável (largura 62–125, peso 300–800) empacotada em `public/fonts` com a licença OFL. Montserrat já está lá. Fontes que ficarem sem uso depois do tema (conferir por grep no commit: Inter, SpaceGrotesk, CMGSans, JetBrainsMono) são apagadas. A Archivo é entregue por quem coordena; o executor não a baixa. |
| Luz ambiente que acende com fundo no ar (2 gradientes radiais em tela cheia, opacidade 0 → 0,55 em 400 ms) e painéis com `backdrop-filter: blur(22px) saturate(150%)` | não existe | Novo, decorativo, `pointer-events: none`, dentro de `AliancaTela`. Só entra depois da medição da seção 5, fatia 1, passo 1. Se não passar: painel opaco para todos. |

### 2.2 Topo

| Protótipo | Hoje | Vira |
|---|---|---|
| Marca + menu do app (Configurações, Telas e monitor de retorno, Ferramentas da saída, Importar, Atalhos · Ajuda · Sobre) | Marca em `components/main/Top.svelte`; `components/inputs/TopButton.svelte`; `components/main/PrepararMenu.svelte`; `components/main/MenuBar.svelte` no Windows | Novo `AliancaTopo.svelte` + `AliancaMenuApp.svelte`, com os cinco itens funcionando já na fatia 1. Apagados na fatia 1: `Top.svelte`, `TopButton.svelte`, `PrepararBarra.svelte`, `PrepararMenu.svelte`, `PrepararPilula.svelte`, `AliancaModo.svelte`, `SirvoIndicador.svelte`. `MenuBar` fica como está na fatia 1 (diferença declarada D10); a decisão é da fatia 4 (pergunta 8). |
| Pílula "● Sirvo" | `components/main/SirvoIndicador.svelte`; `utils/aliancaPilula.ts`, `aliancaPilulaLogica.ts` | Novo `AliancaSirvoPilula.svelte`. Fatia 1: só estado, com a lógica `calcular` de `SirvoIndicador.svelte` levada para `utils/aliancaSirvoPilulaLogica.ts`; o clique abre Configurações na conexão, como hoje. Fatia 4: popover com culto seguido, "conduz", material e chat. Os dois botões "SÓ NO PROTÓTIPO" do popover (alternar horário, trocar proporção) são controles de cenário e não são implementados. |
| Segmentado Mostrar \| Editar | `AliancaModo.svelte` + `TopButton` show/edit | Novo. Sem atalho de teclado, de propósito. |
| Relógio | `components/system/Clock.svelte` no rodapé da direita, só fora do modo foco e fora do Preparar (`MainLayout.svelte:151`) | `Clock` no topo, sempre (também em Editar, como no protótipo); `.clockArea` e `Date.svelte` saem da coluna. |
| Pílula do telão ("Ligar telão" / "Telão no ar · 00:42") | `Top.svelte` (`toggleOutput`, "clique de novo", `tempoNoAr`); `utils/aliancaSaidaMenuLogica.ts` | Novo `AliancaTelaoPilula.svelte` sobre `criarMaquinaDaSaida` (`aliancaSaidaMenuLogica.ts:60`), que já tem o estado `semResposta`. Desligar exige confirmação num segundo botão ("Desligar mesmo"), com os tempos da máquina: 1 s inerte, 3 s de janela, 0,8 s de trava. O "clique de novo" de `Top.svelte:31-54` (1,8 s, sem inércia) morre com o arquivo. Tabela de estados na seção 5, fatia 1, passo 3. |
| Páginas do menu | `activePage` `settings`, `stage`, `draw` nas três colunas | Ocupam o corpo inteiro; o topo fica; o segmentado fica sem seleção; volta clicando em Mostrar ou Editar. `stage` = "Telas e monitor de retorno"; `draw` = "Ferramentas da saída". |

### 2.3 Mostrar

| Protótipo | Hoje | Vira |
|---|---|---|
| Faixa AO VIVO ("· telão ligado" / "· horário do culto") | não existe; `outputDisplay` e `sirvoRoteiro.iniciado_em/encerrado_em` existem | Novo `utils/aliancaAoVivoLogica.ts` (puro) + faixa. Fatia 1: acende com o telão ligado (dado real). O segundo motivo depende da pergunta 9. |
| Seletor de local e dia | `components/show/SeletorDeCulto.svelte` + `utils/aliancaSeletorLogica.ts` | Os dois botões do cabeçalho na forma final já na fatia 1; os popovers ficam os de hoje, com uma linha "＋ Culto avulso" no fim do de dia (fatia 1, passo 7). Lista de locais com bolinha e grade de dias em 3 colunas (resposta P6): fatia 4. `ProjectStrip.svelte`, as abas de agenda e a árvore de pastas de `Projects.svelte` são apagados: pastas de projeto acabam. |
| Blocos, item NO AR | `components/show/ProjectContentList.svelte` | Novo `AliancaRoteiro.svelte` com marcação própria (cabeçalho de bloco, linha de item, selo NO AR). De `ProjectContentList` fica só a lógica (ordem, seleção, arrastar, rastros do Sirvo). |
| Etiqueta NOVO | não existe | Novo `utils/aliancaNovoNoCulto.ts`. Depende da pergunta 10; até lá a etiqueta não aparece. |
| Bloco ao vivo (bolinha, regressivo, botão do relógio; popover −5/−1/+1/+5 e "Segure pra encerrar o bloco") | `components/show/SirvoConduzir.svelte`, `SirvoBlocoConduzir.svelte`, `SirvoSegurar.svelte` | Lógicas ficam (inércia de 3 s, segurar, Desfazer de 30 s). Novo `AliancaBlocoVivo.svelte`. Editar título, mover e criar bloco: pergunta 11. |
| "＋ Adicionar ao roteiro · Ctrl+K" | `components/quicksearch/QuickSearch.svelte` (Ctrl+G/F8) + `utils/aliancaQuickSearchLogica.ts` | Novo `AliancaSpotlight.svelte` sobre `utils/search.ts` e a busca de versículo. Enter = fim do bloco atual (`porShowNoFim`, `utils/aliancaBiblioteca.ts:26`); Shift+Enter = no ar; Esc fecha. O QuickSearch antigo, Ctrl+G e F8 morrem na mesma fatia. Ctrl+K está livre (`ctrlKeys` em `utils/shortcuts.ts:37` não tem `k`); conferir `preventDefaults` e o comportamento dentro de campo de texto. |
| Centro: cabeçalho (item, "depois: …", "AO VIVO · a igreja vê este item", dica) + grade | `components/show/Show.svelte` → `Slides.svelte`; `ShowHeader.svelte`; `components/slide/Layouts.svelte` | Novo `AliancaCentroCabecalho.svelte`, na fatia 1. A grade continua sendo a de `Show.svelte` → `Slides.svelte` (o slide é o próprio conteúdo), mas hoje ela tem número fixo de colunas (`Slides.svelte:565`, `$slidesOptions.columns`): na fatia 1 passa a preencher como o protótipo, `auto-fill minmax(180px, 1fr)` (fatia 1, passo 8). O interior do cartão segue o do app (D14). Rodapé `Layouts` e `ShowTools` saem de Mostrar na fatia 1 (P4); o destino final é a pergunta 7. |
| No ar: tela em proporção real + faixa de ícones colada (sobreposição F3, texto F2, fundo F1, áudio F4, "Segure pra limpar tudo · Esc") | `components/output/preview/Preview.svelte`, `MultiOutputs.svelte`, `PreviewOutputs.svelte`, `ClearButtons.svelte`, `getOutputResolution` | `Preview.svelte` continua montado como motor, com `escondida` sempre ligada (já é montado fora de qualquer `{#if}` em `MainLayout.svelte:113`, e `.main.escondida` é `display: none`, `Preview.svelte:316`). Não há extração. Ele não é um motor sem estado: `autoChange` e `activeClear` (`Preview.svelte:181-207`) são dele, `ClearButtons` e os painéis de ferramenta só existem com a página em `show` (`:288-312`), e a prévia escondida continua desenhando. Novos `AliancaNoAr.svelte` e `AliancaCamadas.svelte`, ao lado: `AliancaCamadas` não usa aquele estado, deriva o que precisa dos mesmos stores (`utils/aliancaCamadasLogica.ts`) e chama `components/output/clear.ts` (fatia 1, passo 5). "Limpar tudo" no botão é de segurar; Esc limpa na hora. |
| 2ª tela com abas, recolhível | `PreviewOutputs.svelte` + `MultiOutputs` | Novo `AliancaOutrasTelas.svelte`: uma aba por saída habilitada. |
| Controles do vídeo no ar | `components/output/tools/MediaControls.svelte` dentro do `Preview` | Fatia 7: barra sobre a parte de baixo da tela principal do "No ar" (pausar, avançar, volume, tempo), só com vídeo ou áudio tocando; aparece ao passar o mouse, com barrinha fina de progresso sempre visível (resposta P9). |
| Mensagem pro palco | não existe escrita (`utils/aliancaSirvo.ts:73,255,326` só leem `mensagem_palco`) | Fatia 8, com função nova no Sirvo (seção 6). Até lá o lugar fica vazio e o chat ocupa o espaço. |
| Chat ocupando o resto | `components/main/SirvoChat.svelte` + `utils/aliancaSirvoChat*.ts` | Lógica fica; marcação na forma do protótipo, `flex: 1` (mínimo 140 px), sempre aberto. |

### 2.4 Editar

| Protótipo | Hoje | Vira |
|---|---|---|
| Esquerda: slides do item + seletor do item ("No roteiro" / "Aberto da biblioteca") + "＋ Slide" | `components/edit/Navigation.svelte` + `edit/Slides.svelte`; `components/input/FloatingInputs.svelte` | Novo `AliancaItemEditando.svelte` (roteiro + até 5 avulsos em memória) e miniaturas com selos EDITADO e NO AR. De `edit/Slides.svelte` fica a lógica. "＋ Slide" fixo no pé. `Navigation.svelte` é apagado. |
| Centro: o slide grande | `components/edit/Editor.svelte` | Fica como motor (o slide em edição é o conteúdo). Sai o autofechar da gaveta. |
| Direita: propriedades (Texto, Caixa, Fundo, Transição, "Aplicar em todos", "Salvar como modelo") | `components/edit/EditTools.svelte` + `MediaTools`, `AudioTools`, `EffectTools` | Marcação nova na ordem do protótipo; os campos continuam os de `EditTools`. O ramo "organizado só no Preparar" vira o único. |
| Editar slide no ar é livre; selos NO AR / EDITADO; o telão só troca ao mandar | Já existe: `utils/aliancaFoto.ts` + `aliancaFotoLogica.ts`; `components/output/Output.svelte:175` lê a foto; a posição é resolvida em `components/helpers/OutputHelper.ts:361,408`; `helpers/output.ts:118-119,176-179,592-599` tira a foto; `remoteTalk.ts:136` e `stageTalk.ts:129` também passam por ela; `show/Slides.svelte:298,351` calcula o "mudou" | Reaproveitar. Novo: selos e a faixa "O telão ainda mostra a versão anterior" + "Mandar pro ar". Limite: `podeTerFoto` (`aliancaFotoLogica.ts:22`) só cobre show, e só o slide; o fundo segue ao vivo (pergunta 6). |
| Botão direito no slide: Mandar pro ar (todas as telas), Mandar só para ‹saída›, Duplicar, Excluir | `components/context/contextMenus.ts`, `menuClick.ts`; `setOutput(type, data, toggle, outputId)` | Itens novos na fatia 6. "Monitor de retorno": pergunta 5. |
| Sem roteiro e sem No ar | — | `Preview` segue montado e escondido. Teclado: nenhuma tecla mexe no telão, exceto Esc, que limpa sempre (resposta P2). |

### 2.5 Biblioteca

| Protótipo | Hoje | Vira |
|---|---|---|
| Faixa de ponta a ponta, por baixo do roteiro e do centro, nos dois modos | `components/drawer/Drawer.svelte` dentro do centro; abre/fecha; autofecha no editor | Novo `AliancaBibliotecaPainel.svelte`. Sem estado fechado. `Drawer.svelte`, `drawerOpenedInEdit`, `autoclosed` e `utils/aliancaGavetaAutoabrir.ts` morrem. |
| Árvore única, uma pasta aberta (Shows, Mídia, Áudio, Bíblia, Sobreposições, Modelos) | 9 abas (`DrawerTabIds`) em `components/drawer/LibraryTabs.svelte` + `drawer/navigation/*Tabs.svelte` | Novo `AliancaArvore.svelte` lendo `activeDrawerTab` e `drawerTabsData[*].activeSubTab`. Além das seis do protótipo, entram como pastas (resposta P7): Funções (ações, temporizadores, variáveis, gatilhos), Calendário, e câmeras e NDI como filhos de Mídia. Metrônomo sai. O resto: pergunta 12. `LibraryTabs.svelte` e `AliancaAbasLaterais.svelte` apagados. Aba sem nó: na carga é saneada sem faixa (dado salvo antigo); em uso chama `falhaAlta` (fatia 1, passo 6). O painel Info (`drawer/info/Info.svelte`) sai e não tem lugar no protótipo (P5). |
| Chips, busca, linhas com "＋ roteiro", grade para mídia | `drawer/Content.svelte` → `pages/Shows.svelte`, `media/Media.svelte`; `components/main/AliancaBiblioteca.svelte` + `utils/aliancaBibliotecaLogica.ts`; `drawer/media/AliancaFiltros.svelte`; pastas de mídia da F7 | Linhas e cartões com marcação nova; de `Content.svelte` e filhos fica a lógica de listar e filtrar. Pastas da F7 = filhos de "Mídia". "＋ Novo" (música, colar letra, apresentação) no cabeçalho da biblioteca e no spotlight. |
| Botão direito: Editar / ＋ Adicionar ao roteiro / Mostrar agora (sem pôr no roteiro) | `contextMenus.ts`; `gavetaNaoToca()` em `utils/aliancaModo.ts:18` (28 arquivos chamam) | Itens novos na fatia 6. A partir dela o clique simples na biblioteca nunca vai ao ar, em nenhum dos dois modos (`gavetaNaoToca` passa a valer sempre). Antes disso a regra de hoje fica, declarada (fatia 1, comportamento P2). |

### 2.6 O que é novo e o que é motor, por região

| Região | Marcação nova | Só lógica reaproveitada | Antigo que continua visível |
|---|---|---|---|
| Topo | tudo | `aliancaSaidaMenuLogica`, `aliancaPilulaLogica`, `Clock` | nada |
| Roteiro | cabeçalho, seletor, blocos, itens, bloco vivo | `ProjectContentList` (ordem, arrastar), `Sirvo*Conduzir`, `aliancaSeletorLogica` | nada |
| Centro (Mostrar) | cabeçalho | `Show.svelte` | a grade de slides (conteúdo) |
| No ar | tela, camadas, outras telas, chat | `Preview` escondido, `clear.ts`, `aliancaSirvoChat*` | nada |
| Biblioteca | painel, árvore, chips, linhas, cartões | `Content.svelte` e filhos | nada na forma; até a fatia 6, o gesto de clique é o de hoje |
| Editar (fatia 3) | coluna de slides, seletor do item, propriedades, selos, faixa de pendência | `Editor.svelte`, `EditTools`, `aliancaFoto*` | o slide em edição (conteúdo) |
| Páginas do menu (fatia 4) | moldura da página no corpo | `Settings`, `StageLayout`, `draw/Slide` e suas abas | o conteúdo das Configurações do FreeShow, dentro do tema |

### 2.7 Destino da pilha antiga

| Peça | Destino |
|---|---|
| Prova do Culto (`scripts/prova-culto/`) | Fica, re-apontada (seção 4). |
| `utils/aliancaFalha.ts`, `FaixaDeFalha.svelte` | Ficam. A guarda `aliancaFalhaGuarda.test.ts` é reapontada (lê arquivos que somem). |
| `aliancaSemClassicoGuarda.test.ts` | Cresce: reprova `MainLayout`, `PrepararBarra`, `LibraryTabs`, `TopButton`, `data-modo`, as duas flags e, depois da fatia 2, `modoAlianca` e `criarPorModo`. A lista `PERMITIDAS` (que copia a linha `test:layout` do `package.json`) é regravada. |
| Anteparo de 700 ms (`AnteparoDeModo.svelte`, `criarDecisorDeGesto`, `ANTEPARO_MS` em `aliancaPilulaLogica.ts:4`) | Fica, generalizado: vale para toda chegada em Mostrar. |
| `criarPorModo`, `valorPorModo`, `aliancaPorModoLogica.ts`, `aliancaLayoutEstado.ts`, `aliancaDrawerTabsLogica.ts` | Morrem na fatia 2. `iniciarLayoutAlianca` (`startup.ts:26`) também saneia a pasta de mídia ao voltar ao Culto: essa parte ganha dono novo em `aliancaTela.ts`. |
| `aliancaMoldura*.ts` (barra da 1b) | A barra morre na fatia 1. `aliancaMolduraEscritores.json` e seu teste viram a guarda de escritores classificados (fatia 2). |
| `aliancaTopScriptGuarda.test.ts`, `aliancaGavetaAutoabrir.ts` e teste | Morrem na fatia 1. |
| Modo foco (`components/show/focus/FocusMode.svelte`) | Sai de vez na fatia 1: componente apagado, nada o monta. O store `focusMode` fica (47 arquivos o leem, quase todos de upstream) e nenhum código o liga (hoje só existem `focusMode.set(false)`); guarda reprova `focusMode.set(true)`. |
| Ctrl+T (`togglePanels`, `utils/common.ts:193`, atalho em `shortcuts.ts:59`) | Sai de vez na fatia 1, com o export `fecharTudoManual` (`utils/aliancaLayoutEstado.ts:34`; o arquivo e `valorPorModo` ficam até a fatia 2). |
| `Timeline type="project"` e `special.projectTimelineActive`; `Tipbar`; `Guide` (`components/guide/`) | Sem lugar no protótipo: deixam de ser montados na fatia 1. `Tipbar` e a linha do tempo do projeto eram montados por `MainLayout.svelte:161-175`; o `Guide` é montado por `App.svelte:91` (junto de `QuickSearch`, `:87`), então sair exige editar `App.svelte`. `quick_start_guide` (`menuClick.ts:230`) passa a chamar `falhaAlta`, e `popups/Initialize.svelte:31` deixa de ligar `guideActive` (fatia 1, passo 10). |
| `customActionActivation("show_opened")` (`MainLayout.svelte:42`) | É ação configurada pelo usuário: `AliancaTela` continua disparando, com teste. |
| `ProfileChangerMenu`, `ProfileSelector` | `AliancaTela` continua montando o seletor de perfil (pergunta 13 decide o resto). |
| `SirvoAviso.svelte`, `SirvoProjetoFaixa.svelte`, `AliancaNovo.svelte`, `drawer/AliancaMarcacoes.svelte` | `SirvoProjetoFaixa` fica dentro do roteiro novo. `SirvoAviso` vai, provisoriamente, para uma linha fixa no topo do roteiro (pergunta 14; D12). `AliancaNovo` e `AliancaMarcacoes` dependem da pergunta 10 e não aparecem até lá (D8). |
| F3–F8b (#12–#18): o que hoje diz "no Preparar" | Decidido por critério escrito, na fatia 2 (seção 5, regras A–D). |
| Commits `3b57e21`, `22741bd`, `a264fc1` | Ficam. |

## 3. Quem pode trocar de tela (achado 1)

Hoje "nenhuma tecla mexe no telão" depende de `modoAlianca`, que só o operador escreve. O desenho da v2 passava essa decisão para `activePage`, que tem 78 escritas em 38 arquivos, várias sem ninguém na cabine ter pedido. A v3 fecha assim:

- `tela` é derivada de `activePage`, mas `activePage` em `stores.ts` vira fachada: `set` chamado de fora da porta é um pedido. Se o pedido não muda a classe da tela (`show`→`show`, `settings`→`stage`), passa. Se muda, é recusado e chama `falhaAlta("troca-de-tela-recusada")`. Fora da janela principal a fachada é um `writable` comum.
- A porta é `trocarTela(destino, gesto)` em `utils/aliancaTela.ts`. Só os chamadores classificados como gesto a importam. Toda chegada em Mostrar arma o anteparo antes de escrever.
- Página fora da lista (`scripture`, `calendar`, `reflow`, ou valor novo que o upstream acrescente a `TopViews`, `src/types/Tabs.ts:65`): a escrita é recusada, a tela fica onde estava e a faixa de falha acende com o nome da página até o operador dispensar. Não existe "voltar para show".
- Se um efeito colateral legítimo acender a faixa no uso normal, a correção é tirar a escrita na origem. Nunca calar a faixa.

Conferido no código, contra a revisão: o desfazer (`components/helpers/history.ts:205`) não alterna entre `show` e `edit` (há um `if` que não faz nada nesse caso); ele só navega de e para as páginas do menu. `components/actions/apiHelper.ts:696` só escreve `show` se a página não for `edit`. O risco real desses dois é sair de uma página do menu para Mostrar sem gesto.

Classificação das 78 escritas (base: `utils/aliancaMolduraEscritores.json`, que passa a guardar a classe de cada uma):

| Classe | Arquivo (escritas) | Destino |
|---|---|---|
| Gesto → porta | `components/context/menuClick.ts` (13: 7 "editar", 4 para páginas, 2 "abrir em Mostrar") | "Editar" do botão direito é o segundo gesto permitido. Os dois que chegam em Mostrar passam pelo anteparo. |
| Gesto → porta | `utils/aliancaBiblioteca.ts:74` (1), `utils/aliancaPilula.ts:103` (1) | "Editar" da biblioteca; chips que levam a Mostrar (já armam o anteparo). |
| Gesto → porta (página) | `StatusIndicator` (1), `popups/OutputSelector` (1), `SelectStageLayout` (1), `SelectStyle` (1), `TemplateInfo` (2), `TemplateStyleOverrides` (1), `MetadataDisplay` (1), `settings/tabs/Outputs` (1), `settings/tabs/Styles` (2), `stage/StageLayout` (1), `drawer/info/ScriptureInfo` (2), `edit/tools/SlideStyle` (2) | Botões que abrem uma página do menu ou o editor de um modelo. Passam pela porta; os que vão para Editar não precisam de anteparo. |
| Gesto, morre com o arquivo | `TopButton` (1), `PrepararMenu` (2), `SirvoIndicador` (1), `Top.svelte` (2), `edit/Navigation` (1), `settings/SettingsTabs` (2), `preview/MultiOutputs` (1), `utils/aliancaMoldura.ts` (3) | Apagados ou substituídos nas fatias 1, 3 e 4. O que os substitui usa a porta. |
| Gesto, morre com o QuickSearch | `components/quicksearch/quicksearch.ts` (14) | Fatia 5. Até lá passam pela porta, com anteparo quando chegam em Mostrar. |
| Atalho de troca | `utils/shortcuts.ts:72,78` (Ctrl+Shift+T alterna `show`↔`edit`) | Deixa de trocar de tela: troca de tela não tem atalho. Dentro de Editar continua alternando a edição de texto. |
| Esc que sai do editor | `utils/shortcuts.ts:145` | Sai. Em Editar, Esc é o pânico que limpa (P2); a mesma tecla não pode também trocar de tela. Sair de Editar é só pelo segmentado. Ver pergunta 3. |
| Duplo clique no slide | `components/slide/Slide.svelte:215` | Pergunta 4 (recomendação: não abre o editor). |
| Colateral → recusado | `components/show/Slides.svelte:376` (criar slide leva ao editor), `inputs/HiddenInput.svelte:85`, `edit/scripts/edit.ts:86` (abrir a gaveta levava a `show`; a biblioteca agora existe em Editar, a escrita é tirada), `drawer/audio/AudioMeter.svelte:149`, `converters/project.ts:145`, `popups/CleaningUtility` (1), `popups/ResetAll` (1), `settings/tabs/Connection.svelte:150`, `components/guide/guideSteps.ts` (5), `components/helpers/history.ts:205` | Não trocam a tela. No desfazer a navegação é tirada na origem (desfazer nunca navega). Os demais são recusados com `falhaAlta` se tentarem. |
| Remota → recusada | `components/actions/apiHelper.ts:696` (API e celular), `IPC/responsesMain.ts:195` (processo principal) | A ação pedida acontece; a troca de tela não. `falhaAlta` se tentar. |

As 3 linhas restantes que um grep simples encontra (total 81 em 40 arquivos) são comentários: `menuClick.ts:1383`, `popups/DeleteDuplicatedShows.svelte:115`, `popups/Import.svelte:106`.

## 4. A Prova do Culto na v3

### 4.1 Gravações e divergências

- `baseline/slice0-base.json` continua juiz. Mudam os seletores dos roteiros (`data-regiao` / `data-acao`). 17 arquivos de `scripts/` citam `modoAlianca` (11 em `scripts/prova-culto`, 3 em `aparencia`, e `fvb-guarda.mjs`, `fvb-guarda.test.mjs`, `fvb-manifesto.json`): todos são re-apontados na fatia em que deixam de valer.
- `esperado.json` tem hoje 30 entradas. Teto por fatia, valendo para entradas novas: na fatia 1 o teto é por causa, não por entrada (ela troca todo o DOM da janela principal): até 6 causas, cada uma com uma frase e quantas entradas precisar, todas de estrutura de tela (DOM, seletor, sinais de painel), nenhuma em fluxo de `outputs`; fatia 2 zero (ela é invisível: divergência nova é defeito), e ela remove as entradas que perderam o sentido (`E06`–`E09`, `A11`–`A15`, `t16-dom-*`); fatia 3 até 6; demais até 4 cada. Divergência em `outputs` é sempre zero. Estourar o teto para a fatia.
- Baseline só é regravado no fim de fatia aprovada. Rodada limpa: `get(falhas)` vazio no fim de toda gravação.

### 4.2 Provas novas

| Prova | O que afirma | Fatia |
|---|---|---|
| Fidelidade | Prints lado a lado, região por região, aprovados pelo André na cabine. Referência da aprovação: o board `Tela-luz-1080.dc.html`, com conteúdo de 1920×1080; régua: `Tela-luz.dc.html`, com conteúdo de 1440×900. A prova fixa o tamanho do conteúdo (o `main`), não o da janela. `leiaute-spec.json` é gerado por script a partir das cópias anotadas com `data-regiao`, abertas via CDP (nunca transcrito à mão; a anotação é conferida byte a byte contra o original), e `medidas.mjs` compara as caixas das regiões com tolerância de 1 px, em escala 1 (que é a da cabine). As medidas são auxiliares; quem aprova é o olho. Lista de prints e de diferenças na seção 5, fatia 1. | 1, 3, 4 |
| Desempenho do vidro | Quadros perdidos na janela de saída com vídeo no ar, com e sem desfoque e luz ambiente, na máquina da cabine, com a janela principal maximizada a 1920×1080 e as saídas reais ligadas (seção 5, fatia 1, passo 1). | 1 |
| Tema não vaza | Todo seletor do bloco de tema começa por `body[data-tema="luz"]`; só `aliancaTema.ts` escreve `data-tema`; `fva-saida.mjs` com diferença zero. Substitui `test:fv`, `test:fvb` e `test:fvs`, que dependem dos marcadores `FVB:INICIO/FIM` de `MainLayout.svelte` e do bloco FV. | 1 |
| O Espaço não muda de dono | Em Mostrar e em Editar: Ctrl+Z, Esc-Esc, pedido da API, pedido do celular e mensagem do processo principal não mudam o que o Espaço faz em seguida. | 2 |
| Chegada em Mostrar | Por todo caminho classificado como gesto, o gesto que começa nos 700 ms seguintes é engolido. | 2 |
| Saída cega para a tela | No processo de saída `tela` é sempre `mostrar`, nenhuma escrita em `activePage` acontece e nada assina `activePage` para decidir o que renderiza (38 arquivos do fecho citam `activePage`; a prova lista cada um). | 2 |
| Editar | Nenhuma tecla em Editar escreve em `outputs`, exceto Esc; editar o slide no ar não muda o hash da saída; "Mandar pro ar" muda. | 3 |
| Popover consome a tecla | Com popover, menu de contexto ou spotlight aberto, Esc e Enter são consumidos na captura e não chegam a `previewShortcuts` (hoje `App.svelte`, `Preview.svelte` e `QuickSearch.svelte` têm cada um o seu `svelte:window on:keydown`, e `Preview.svelte:58` deixa F1–F24 passar mesmo com o cursor num campo). Um teste por popover: menu do app, pílula Sirvo, pílula do telão, bloco, seletores, botão direito, spotlight. | 1 (os que já existirem), 4, 5, 6 |
| Upstream não some calado | Lista dos arquivos de upstream apagados com o SHA do último merge; se um merge trouxer mudança num deles, o teste reprova e alguém lê o que entrou. Um merge do upstream por fatia fechada, nunca no meio de fatia. | 1 |

### 4.3 Âncora da saída

Hoje `ancora.mjs` tem 13 exceções e 6 arquivos em `NOVOS_NO_FECHO` (âncora `6d96af4`; o juiz responde "fecho de 588 arquivos", que é o fecho na âncora; no HEAD são 594, os 588 mais os 6 novos). `Preview.svelte`, `App.svelte`, `MainLayout.svelte`, `Top.svelte`, `Drawer.svelte`, `LibraryTabs.svelte` e `TopButton.svelte` estão fora do fecho: a fatia 1 mexe pouco nele.

O juiz já trata arquivo apagado: um arquivo do fecho da âncora que some precisa de exceção (o SHA é ignorado quando o arquivo não existe); um arquivo de `NOVOS_NO_FECHO` que some tem a entrada retirada.

**Fatia 1 (âncora continua em `6d96af4`):**

| Arquivo do fecho | Motivo novo |
|---|---|
| `utils/aliancaTema.ts` (exceção nova; o SHA muda duas vezes: commits 3 e 10) | Commit 3: escreve `luz` enquanto a bancada `telaNova` está ligada. Commit 10: `luz` sempre; saem `aliancaVisual` e a leitura do tema do FreeShow. Continua só escrevendo `data-tema` na janela principal (`iniciarTemaAlianca` sai cedo com `currentWindow`). |
| `utils/aliancaTemaLogica.ts` (exceção nova) | Lógica pura do tema; sem store. |
| `utils/save.ts`, `utils/updateSettings.ts` (SHA novo; commit 3) | Gravam e carregam a chave nova `aliancaTela`. `resized` e `drawer` seguem como estão até a fatia 2. A saída não lê a chave nova. |
| `utils/aliancaTelaEstado.ts` (novo no fecho) | Só cria `writable` (`aliancaTela` e, até o commit 10, `telaNova`); ninguém da saída os assina. |
| `stores.ts` (SHA novo; commit 11) | `activePage` passa por `guardarPagina`; fora da janela principal ela devolve o valor sem olhar, e o `writable` por baixo é o mesmo. |
| `utils/aliancaPaginaGuarda.ts` (novo no fecho; commit 11) | Função pura; importa só `svelte/store` e `aliancaFalha`; nada assina. |
| `utils/common.ts` (SHA novo; commit 12) | `togglePanels` sai, com o `import` de `fecharTudoManual`; só a janela principal o chamava. |
| `utils/shortcuts.ts` (SHA novo; commits 10 e 12) | Commit 10: saem `voltarDaPagina`, três ramos do Esc do Preparar, a abertura da gaveta do Ctrl+1..8 e `projectTimelineActive` de `isTimelineActive`. Commit 12: sai o atalho `t`. Atalho só roda na janela principal. |
| `utils/aliancaLayoutEstado.ts` (SHA novo em `NOVOS_NO_FECHO`; commit 12) | Sai o export `fecharTudoManual` (linha 34); `valorPorModo` e `iniciarLayoutAlianca` ficam iguais. |
| `utils/startup.ts` (SHA novo; commit 10) | `iniciarMolduraAlianca` sai de `startupMain`. |
| `utils/aliancaMoldura.ts`, `utils/aliancaMolduraLogica.ts` (saem de `NOVOS_NO_FECHO` no commit 10) | Deixam o fecho quando `startup.ts` e `shortcuts.ts` param de importá-los, e o juiz reprova entrada de `NOVOS_NO_FECHO` que não está no fecho. Os arquivos são apagados no commit 12, com `PrepararBarra`, que ainda os importa. |
| `components/context/menuClick.ts` (SHA novo; commit 10) | `quick_start_guide` passa a chamar `falhaAlta`; só roda na janela principal. `contextMenus.ts` não precisa mudar. |
| `components/main/popups/Initialize.svelte` (exceção nova; commit 10) | Sai `guideActive.set(true)` (linha 31): o guia deixa de existir. O popup só abre na janela principal. |
| `components/main/popups/Shortcuts.svelte` (SHA novo; commit 12, se tocado) | Sai a linha do Ctrl+T da lista de atalhos. |

`utils/aliancaEditorLogica.ts`, `components/output/clear.ts`, `components/system/Clock.svelte` e `values/tabs.ts` estão no fecho e **não** são tocados na fatia 1. Fora do fecho (livres): `App.svelte`, `MainLayout.svelte`, `Preview.svelte`, `ClearButtons.svelte`, `MultiOutputs.svelte`, `Show.svelte`, `show/Slides.svelte`, `slide/Slide.svelte`, `Drawer.svelte`, `edit/Navigation.svelte`, `Editor.svelte`, `EditTools.svelte`, `quicksearch/*`, `aliancaSaidaMenuLogica.ts`, `aliancaPilula*.ts`. Qualquer outro arquivo que o juiz acusar para o commit: entra na tabela com motivo, ou a mudança é desfeita.

**Fatia 2:** a troca de `modoAlianca` toca 15 arquivos do fecho (`components/context/menuClick.ts`, `components/drawer/Card.svelte`, `components/edit/ItemAddMenu.svelte`, `components/edit/editbox/EditboxLines.svelte`, `components/helpers/dropActions.ts`, `stores.ts`, `utils/aliancaAbasEditor.ts`, `aliancaBibliotecaEstado.ts`, `aliancaDividir.ts`, `aliancaLayoutEstado.ts`, `aliancaModo.ts`, `aliancaMoldura.ts`, `aliancaPorModoLogica.ts`, `aliancaTema.ts`, `shortcuts.ts`), mais `save.ts`, `updateSettings.ts`, `common.ts`, `startup.ts`, `components/helpers/history.ts` e o novo `utils/aliancaTela.ts`. O argumento de hoje ("na saída `modoAlianca` nunca muda") deixa de existir e é trocado pela prova "saída cega para a tela".

**Recomendação: re-ancorar no fim da fatia 2 em vez de empilhar exceções.** Com mais de 30 entradas o juiz deixa de julgar. Procedimento: durante a fatia 2 cada arquivo acima entra como exceção com o motivo (aparece no diff do PR e é revisado ali); o último commit da fatia move `ancora.txt` para si mesmo e esvazia `EXCECOES` e `NOVOS_NO_FECHO`. Condições para mover: `fva-saida.mjs` com diferença zero, seções A e B batendo com o baseline, e a prova "saída cega" verde. A branch não pode sofrer rebase nem squash (o juiz reprova se o SHA da âncora sumir).

### 4.4 Guardas que leem arquivos que somem

| Guarda ou script | Lê | Destino |
|---|---|---|
| `aliancaFalhaGuarda.test.ts`, `aliancaPilulaGuarda.test.ts`, `aliancaProvaCultoGuarda.test.ts`, `aliancaTeclasGuarda.test.ts`, `aliancaBibliotecaGuarda.test.ts`, `aliancaEscritaAtrasadaGuarda.test.ts` | `MainLayout`, `Top`, `Drawer`, `LibraryTabs` ou `PrepararBarra` como texto | Reapontadas para `AliancaTela`, `AliancaTopo` e `AliancaBibliotecaPainel` no commit 10 da fatia 1 (a troca), com teste de mutação. |
| `aliancaMolduraEscritores.test.ts` | lista de escritores | Reescrita na fatia 2 (classes da seção 3). Na fatia 1 o JSON é regravado pelas escritas que somem. |
| `aliancaTopScriptGuarda.test.ts`, `aliancaGavetaAutoabrir.test.ts`, `aliancaMoldura.test.ts`, `aliancaMolduraLogica.test.ts` | peças apagadas | Morrem. |
| `scripts/fv-guarda.mjs`, `fvb-guarda.mjs`, `fvb-guarda.test.mjs`, `fvs-guarda.test.mjs`, `fv-manifesto.json`, `fvb-manifesto.json` | bloco FV e marcadores FVB | Morrem com `test:fv`, `test:fvb`, `test:fvs` no commit 2 da fatia 1 (são portões de PR que reprovam arquivo novo fora da lista branca deles); entra a prova "tema não vaza". |
| `scripts/prova-culto/roteiro.mjs`, `compararLogica.mjs`, `escrita-atrasada.mjs` | nomes de arquivos e seletores antigos | Reapontados. |
| `package.json:61` (`test:layout`, 17 testes por nome) e a cópia em `PERMITIDAS` | lista de testes | Regravada no mesmo commit que mata ou cria cada teste. |

## 5. Fatias

Base: branch `feat/layout-v2-1` a partir de `feat/layout-f1b` (`091f4cd`). Condição de merge de toda fatia: `test:unit` e `test:svelte` sem piorar o piso, `test:layout` verde, âncora verde, rodada limpa, provas da fatia verdes, guardas mordendo (mutação). Critério de pronto é outro, dito em cada fatia.

### Fatia 1: a tela do protótipo, no app, em Mostrar

Revisada em 17/nov contra `revisao-fatia1-v3.md` (cada achado tem destino no fim desta seção). Fatos conferidos em `091f4cd`.

#### Alvo, referência e como a tela cresce

- **Tamanho-alvo:** cabine, 1920×1080, escala do Windows 100%.
- **Referência de aprovação:** `bancada\leiaute-v2-prototipos\Tela-luz-1080.dc.html`, o board a 1920×1080 feito por quem coordena (esquerda 280, direita 330, biblioteca 260, como no 1440; o centro absorve a sobra). `Tela-luz.dc.html` (1440×900) continua sendo a régua de `medidas.mjs`. **Não codar antes de o André aprovar o board 1080.**
- **Largura:** esquerda e direita são fixas em px (valor guardado em `aliancaTela`; inicial 280 e 330 em qualquer resolução, nunca proporcional). O centro fica com o resto.
- **Altura:** topo 56 px e biblioteca fixos em px (inicial 260). A faixa de cima (roteiro | centro) fica com o resto. A coluna direita vai do topo ao pé.
- **Limites:** esquerda 200–460, direita 260–460, biblioteca 140–560. Além deles, `prender()` em `utils/aliancaTelaLogica.ts` nunca deixa o centro com menos de 480 px de largura nem a faixa de cima com menos de 240 px de altura. No arrasto, quem para é a divisória arrastada. Quando a janela encolhe, cede primeiro a esquerda, depois a direita (largura) e a biblioteca (altura), cada uma até o seu mínimo. Teste unitário com conteúdo de 1920×1080, 1920×976 e 1440×900.
- **Conteúdo, não janela.** "Conteúdo" é o `main` de `App.svelte:79`. A barra de menus do Windows mora dentro da página (`App.svelte:75-77`, 25 px, `MENU_BAR_HEIGHT` em `utils/common.ts:17`) e o título nativo fica fora dela (`src/electron/utils/windowOptions.ts:26`, `titleBarStyle: "default"`). Toda prova fixa o tamanho do conteúdo: `Emulation.setDeviceMetricsOverride` com `deviceScaleFactor: 1` e viewport de 1920×1105 (conteúdo 1920×1080) ou 1440×925 (conteúdo 1440×900); o print recorta o retângulo do `main`.
- **Na cabine o conteúdo é mais baixo que o board:** 1080 − 48 (barra de tarefas) − título nativo (cerca de 31; o passo 1 mede com `outerHeight − innerHeight` e escreve o número no PR) − 25 (barra de menus) ≈ 976 px. Roteiro e centro absorvem a diferença; nenhuma outra medida muda. O teste de limites cobre 1920×976.

#### Ordem dos commits

**A troca da montagem vai para o commit 10, depois de a tela nova estar inteira.** Motivo: a exigência é que nenhum commit deixe o app sem teclado da saída, sem Configurações ou sem como abrir um show. Com a troca no começo, mesmo com `<Preview escondida />` montado desde o primeiro dia, o app ficaria sem roteiro e sem biblioteca por quatro commits (revisão B2). Com a troca no fim, os commits 2 a 9 são o app de hoje, intacto, mais código novo que ninguém monta; o commit 10 é um diff pequeno, que um `git revert` desfaz sozinho; e o antigo só é apagado (commit 12) depois de a Prova do Culto ter rodado na tela nova.

**Bancada de desenvolvimento (commits 3 a 9).** Para ver e provar a tela nova antes da troca:

- `utils/aliancaTelaEstado.ts` exporta `telaNova = writable(false)`.
- `App.svelte` monta `{#if import.meta.env.DEV && $telaNova}<AliancaTela />{:else}<MainLayout />{/if}`. Fora de dev a condição é sempre falsa e o ramo some do build (mesmo molde do gancho de `utils/request.ts:5`).
- `utils/aliancaTema.ts` escreve `data-tema="luz"` enquanto `telaNova` for verdadeiro; fora disso, a regra de hoje.
- `scripts/prova-culto/lib.mjs` ganha `ligarTelaNova(j)`, que importa os módulos pelo mesmo caminho que os roteiros já usam (`import(U("utils/…"))`, como em `t1b-editor-teclas.mjs:216`): `telaNova.set(true)` e `_pararMolduraAlianca()` (`utils/aliancaMoldura.ts:125`, que só funciona em dev), porque a guarda da moldura antiga devolveria `draw` no Preparar.
- Isto não é flag de produto: não existe no build, não é gravado em lugar nenhum e é apagado no commit 10. A guarda `aliancaSemClassicoGuarda.test.ts` passa a reprovar `telaNova` a partir dali.

**Vale em todo commit:** `test:unit`, `test:svelte`, `test:layout` e a âncora verdes, e a fumaça `scripts/prova-culto/vivo.mjs` (nova, commit 3) verde: abre um show pelo roteiro, seta para a direita muda `outputs`, Esc limpa, F1 limpa o fundo, Configurações abre e volta. Até o commit 9 ela roda no esqueleto antigo e, com `ligarTelaNova`, no novo (no novo, só os passos que a tela já tem; a lista de passos pulados diminui a cada commit e chega a zero no 9). Do commit 10 em diante roda só no novo.

Um PR, commits nesta ordem:

1. **Medição do vidro (só script e resultado, nenhum código do app).** Na máquina da cabine, janela principal maximizada a 1920×1080, saídas reais ligadas, vídeo 1080p tocando por 60 s. `scripts/prova-culto/vidro.mjs` injeta por CDP, na janela principal do app de hoje, uma camada fixa com `pointer-events: none` que reproduz os painéis do board 1080 (mesmas posições e tamanhos), em três montagens: sem efeito; painéis `rgba(19,19,21,.62)` com `backdrop-filter: blur(22px) saturate(150%)`; o mesmo mais os dois gradientes radiais da luz ambiente. Em cada uma lê, na janela de saída, `getVideoPlaybackQuality().droppedVideoFrames` do vídeo no ar (critério) e a contagem de quadros de `requestAnimationFrame` com intervalo maior que 25 ms (informativa). Respeitar `disableHardwareAcceleration` como estiver na máquina (`src/electron/index.ts:66-71`; as janelas são `transparent: true`, `windowOptions.ts:13,44,73`). Passa se a montagem com efeito não perder mais quadros que a sem efeito (margem de 2 em 3.600). Se não passar: painel opaco `#131315` para todos, e a luz ambiente só fica se passar sozinha. O resultado, a altura do título nativo e a altura real do conteúdo vão escritos no PR.
2. **Tema, só acrescentando.** Bloco novo `/* LUZ:INICIO */ … /* LUZ:FIM */` em `public/global.css`, todo seletor começando por `body[data-tema="luz"]`. Archivo variável em `public/fonts` com a OFL: os dois arquivos são entregues por quem coordena em `bancada\leiaute-v2-prototipos\fontes\` (o executor não baixa nem escolhe a fonte; se a pasta não existir, para e pede). Ninguém escreve `luz` ainda: o app fica idêntico. `test:fv`, `test:fvb` e `test:fvs` morrem aqui (são portões de PR que reprovam qualquer arquivo novo fora da lista branca deles), com `scripts/fv-guarda*.mjs`, `fvb-guarda*.mjs`, `fvs-guarda*.mjs` e os dois manifestos; entra a parte estática da prova "tema não vaza". `test:layout` e `PERMITIDAS` regravados no mesmo commit. A leitura de `aliancaVisual` sai no commit 10; o bloco FV (que fica inerte a partir dali, por só casar com `data-tema="padrao"`) e a aba Tema saem no 12.
3. **Esqueleto, topo, motor e bancada.**
   - `AliancaTela.svelte`, `AliancaDivisoria.svelte`, `utils/aliancaTelaLogica.ts`, `utils/aliancaTelaEstado.ts` (`{ esq, dir, bib }`, chave `aliancaTela` gravada por `save.ts` e lida por `updateSettings.ts`; `resized` e `drawer` continuam sendo gravados e lidos como hoje até a fatia 2, porque peças de upstream ainda usam `resized`, mas a tela nova não os lê). Cada região leva `data-regiao`: `topo`, `roteiro`, `centro`, `no-ar`, `biblioteca`, `corpo-pagina`.
   - **Motor, montado desde este commit e fora de qualquer `{#if}`:** `<Preview escondida />` com o valor literal (é ele que tem o `svelte:window on:keydown` de `Preview.svelte:43-124,261` e os temporizadores de slide, `:218-227`); `FaixaDeFalha`; `AnteparoDeModo`; `ProfileChangerMenu` na mesma condição de `MainLayout.svelte:171-173`; e o disparo de `customActionActivation("show_opened")` copiado de `MainLayout.svelte:36-44`, com teste. Não são montados: `Tipbar`, `Timeline type="project"`, `FocusMode`, `AliancaAbasLaterais`, `.clockArea`.
   - Painéis translúcidos e luz ambiente conforme o resultado do passo 1 (seção 2.1): a luz ambiente é um elemento decorativo de `AliancaTela`, com `pointer-events: none`, que acende quando há fundo no ar (`!isOutCleared("background")`).
   - `AliancaTopo.svelte` na forma final: marca com menu do app, pílula Sirvo, segmentado, relógio (`Clock`), pílula do telão. O relógio no topo aparece também em Editar (hoje `MainLayout.svelte:151` o esconde no Preparar); é o que o protótipo mostra.
   - **Segmentado:** Mostrar escreve `armarAnteparo()`, página `show`, modo `culto`, nessa ordem (a de `irAoCulto`, `utils/aliancaPilula.ts:101`); Editar escreve página `edit` e modo `preparar`. Aparece marcado Mostrar quando a página é `show`, Editar quando é `edit`, nenhum nas páginas do menu. O corpo é escolhido só pela página.
   - **Anteparo:** `AnteparoDeModo.svelte:16-17` troca os seletores `.top.panel` e `firstElementChild` por `[data-regiao="topo"]` e `[data-acao="segmentado"]`. A regra é a de hoje (engole o gesto sobre o topo, fora do segmentado); generalizar é da fatia 2.
   - **Pílula do telão** (`AliancaTelaoPilula.svelte`): usa `criarMaquinaDaSaida` de `utils/aliancaSaidaMenuLogica.ts:60`, ligada como em `PrepararMenu.svelte:24-32`. Em Mostrar passa `noAr: false, desenho: false` (hoje, no Culto, o botão liga com conteúdo carregado); em Editar passa os valores reais (regra de hoje do Preparar). Estado → o que a pílula mostra: `desligado` e `trava` "Ligar telão"; `desligadoNoAr` e `desligadoDesenho` "Ligar telão" desabilitada, com o rótulo de `ROTULOS` na dica; `ligando` "Ligando…"; `ligado` "Telão no ar · mm:ss" (o cronômetro de `Top.svelte:83-112` vem para cá); `perguntando` e `armado` abrem um popover ancorado na pílula com "Desligar o telão?" e o botão "Desligar mesmo" (inerte enquanto `perguntando`); `desligando` "Desligando…"; `semResposta` "O telão não respondeu", em vermelho, até o mundo mudar; `semTela` "Sem tela de saída", e o clique abre Configurações na aba `display_settings`. Os textos de `ROTULOS` que dizem "pelo Culto" e "botão do Culto" passam a dizer "em Mostrar". Os tempos são os da máquina, medidos na 1a: 1 s inerte, 3 s de janela, 0,8 s de trava. O "clique de novo" de `Top.svelte:31-54` (1,8 s, sem inércia) morre com o arquivo. Ctrl+O continua como está (`shortcuts.ts:57`).
   - **Pílula Sirvo** (`AliancaSirvoPilula.svelte`): a função `calcular` e o tipo `Visual` saem de `SirvoIndicador.svelte` para `utils/aliancaSirvoPilulaLogica.ts`, sem mudar, com teste. A pílula mostra a bolinha na cor de `visual.tom` e a palavra "Sirvo"; `visual.texto` e `visual.dica` vão para a dica (`dicaSegura`). O clique faz o que o indicador faz hoje: abre Configurações na aba de conexão quando `visual.clicavel`. Não há popover nesta fatia.
   - **Menu do app** (`AliancaMenuApp.svelte`), cinco itens: Configurações, Telas e monitor de retorno e Ferramentas da saída escrevem a página (`settings`, `stage`, `draw`); Importar faz `activePopup.set("import")`; "Atalhos · Ajuda · Sobre" faz `activePopup.set("shortcuts")`. O "Sobre" segue alcançável pela barra de menus do Windows, que fica nesta fatia.
   - Entram aqui também: `vivo.mjs`; os dois protótipos copiados para `aplicar/leiaute-v2/` já com `data-regiao` nas mesmas seis regiões, e `scripts/prova-culto/anotacao.test.mjs`, que tira os atributos `data-regiao` da cópia e exige igualdade byte a byte com o original (SHA-256 do original gravado no teste); `medidas.mjs`, que gera `leiaute-spec.json` (caixa de cada região, nos dois tamanhos de conteúdo) abrindo a cópia anotada por CDP; `aplicar/AliancaShow Mostrar.dc.html` e `aplicar/Especificacao Tema AliancaShow.dc.html` vão para `aplicar/superados/`, com uma linha no `aplicar/README.md`.
4. **Páginas do menu.** Com a página em `settings`, `stage` ou `draw`, o corpo inteiro (`data-regiao="corpo-pagina"`) mostra as peças atuais em três colunas, sem acabamento: `SettingsTabs` | `Settings` | `SettingsTools`; `StageLayouts` | `StageLayout` | `StageTools` (a terceira só com `$activeStage.id`); `DrawTabs` | `draw/Slide` | `DrawSettings`. Larguras: as de `esq` e `dir`. O topo fica; volta-se clicando em Mostrar ou Editar.
5. **Coluna No ar na forma final.** `AliancaNoAr.svelte` desenha a saída principal com `output/preview/PreviewOutput.svelte` (o mesmo de `MultiOutputs.svelte:161`), na proporção de `getOutputResolution`. `AliancaOutrasTelas.svelte`: uma aba por saída habilitada, recolhível. Chat (`SirvoChat`, lógica intacta) com `flex: 1` e mínimo de 140 px.
   - **`AliancaCamadas.svelte` e o estado do `Preview`.** O `Preview` tem estado próprio: `autoChange` e `activeClear` (`Preview.svelte:181-207`) escolhem qual painel de ferramenta abre sob os botões de limpar, e `ClearButtons`, `MediaControls`, `tools/Show`, `Overlay`, `Audio`, `NextTimer`, `TimerControls` e `SpotifyController` só existem com a página em `show` (`Preview.svelte:288-312`). `AliancaCamadas` **não lê nem escreve esse estado**: o protótipo não tem painel de ferramenta, só os quatro ícones e o "limpar tudo". O que ela precisa sai dos mesmos stores, por `utils/aliancaCamadasLogica.ts` (puro, novo), com as expressões de `ClearButtons.svelte:17-19,67,80-83`: fundo no ar, texto no ar, sobreposição ou efeito no ar, áudio tocando, tudo limpo. Clique em cada ícone = o mesmo que F1, F2, F3 e F4 em `previewShortcuts` (`shortcuts.ts:350`): respeita `outLocked`, chama `clearBackground`, `clearSlide`, `setOutput("overlays", [])` com `setOutput("effects", [])`, ou `clearAudio(…)`, e grava `timelineRecordingAction`. "Limpar tudo" é de segurar e chama `clearAll(true)`; Esc continua limpando na hora pelo `Preview`. Dentro do `Preview` escondido, `ClearButtons` segue vivo em Mostrar e mantém o que faz sozinho (zerar `outputCache`, `ClearButtons.svelte:24-32`). O que fica sem mouse por causa disso está em P6.
   - **Custo da prévia escondida:** com vídeo no ar por 60 s, medir os quadros perdidos na saída com e sem o desenho de `MultiOutputs.svelte:161` (mesmo critério do passo 1). Se passar da margem, `Preview` ganha a prop `semMiniatura`, que envolve só aquele `<PreviewOutput>`; as reações de script de `MultiOutputs` e `PreviewOutputs` continuam.
6. **Biblioteca de ponta a ponta.** `AliancaBibliotecaPainel.svelte`, `AliancaArvore.svelte`, chips, busca, linhas com "＋ roteiro", grade de mídia em `repeat(auto-fill, minmax(150px, 1fr))` com `gap: 8px` (`Tela-luz.dc.html:313`).
   - **Classes-gancho:** a raiz do painel mantém a classe `drawer` e o campo de busca mantém `search edit drawer_search`, porque sete pontos de upstream as consultam (`drawer/pages/Shows.svelte:122,230`, `drawer/bible/Scripture.svelte:832`, `edit/editbox/Editbox.svelte:152`, `edit/tools/BoxStyle.svelte:61,65,94`).
   - **Teclado que hoje mora em `Drawer.svelte:165-222`** passa para um `svelte:window on:keydown` do painel, com o mesmo efeito: Ctrl+F foca a busca (salvo popup `show` aberto ou `shouldOpenReplace()`); Enter na busca, na pasta Shows, com resultado: abre o primeiro e, em página `show`, o põe no projeto (mesma entrada de histórico); Ctrl+Enter na busca manda o primeiro resultado ao ar, atrás de `teclaIgnorada()` (a Prova do Culto confere que o efeito em `outputs` é o de hoje); Esc com a busca vazia a recolhe; `activeTriggerFunction === "drawer_search"` foca a busca. O painel liga `searchValue` e `firstMatch` a `Content` como `Drawer.svelte:332`. Morrem, por não existir mais gaveta fechada: Ctrl+D abrindo e fechando a gaveta, e a troca para a aba Shows do Ctrl+F com a gaveta fechada.
   - **Árvore:** têm nó `shows`, `media`, `audio`, `overlays`, `templates`, `scripture`, `calendar`, `functions`, mais câmeras e NDI como filhos de Mídia. Não têm nó: metrônomo, e os da pergunta 12 (efeitos, vídeos online, mixer, playlists, microfones). **Saneamento na carga, sem faixa:** ao montar, se `activeDrawerTab` não tem nó vira `shows`, e se o `activeSubTab` de uma aba não tem nó vira `all` (é dado salvo antigo, não falha). **Em uso:** escrita que chegue depois disso apontando para aba ou sub-aba sem nó chama `falhaAlta("arvore-sem-no", nome)`, e a árvore volta ao último nó válido. Ctrl+1..8 (`shortcuts.ts:202-210`) continua trocando a aba; a linha `:208`, que abria a gaveta, sai no commit 10.
   - **Sai o painel Info** (`drawer/info/Info.svelte`, com os botões de informações e opções de `Drawer.svelte:280-294`): quebra conhecida P5.
7. **Roteiro em blocos.** `AliancaRoteiro.svelte`: cabeçalho com os botões de local e dia, faixa AO VIVO, itens com selo NO AR, bloco ao vivo (`AliancaBlocoVivo.svelte`), "＋ Adicionar ao roteiro".
   - **AO VIVO:** `utils/aliancaAoVivoLogica.ts` devolve aceso quando `$outputDisplay` é verdadeiro (o mesmo store da pílula); texto "AO VIVO · telão ligado". Nada mais acende a faixa nesta fatia.
   - **Local e dia:** os dois botões na forma final; os popovers são os de `SeletorDeCulto.svelte` hoje (lista). O de dia ganha uma última linha "＋ Culto avulso", que cria o projeto como o `newProject` de `menuClick.ts:910` (`history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: "project" } })`), com `parent` = a pasta da agenda escolhida, ou `"/"` em Todos. A grade de dias em três colunas é da fatia 4.
   - **Avisos do Sirvo (provisório, pergunta 14):** `SirvoProjetoFaixa` ("Montar os blocos aqui?", "ordem nova: Aplicar") continua no topo da lista, onde já está (`ProjectContentList.svelte:302`). `SirvoAviso` ("o roteiro mudou") ganha um lugar de altura fixa (36 px, uma linha) entre o cabeçalho e a lista, reservado mesmo vazio, para que a chegada de um aviso não empurre os itens debaixo do mouse; o clique na linha abre o conteúdo inteiro de hoje num popover.
   - "＋ Adicionar ao roteiro" faz `quickSearchActive.set(true)`.
   - **De onde vem a lógica:** a montagem da árvore de cultos e das agendas (`Projects.svelte:40-150`, `ABAS`, `CHAVE_ABA`) vai para `utils/aliancaRoteiroLogica.ts` (puro, com teste) e alimenta `SeletorDeCulto` como hoje (`Projects.svelte:439`). Ordem, seleção, arrastar e rastros do Sirvo vêm de `ProjectContentList.svelte`. `Projects.svelte:434` tem seis ouvintes de janela e `ProjectContentList` tem os seus: o PR lista cada um e diz para onde foi (mantido com o mesmo efeito, ou morto, com o motivo); nenhum some sem linha na lista.
   - **Sem culto aberto** (`activeProject` nulo): a coluna mostra o cabeçalho com os dois botões e a frase "Nenhum culto aberto. Escolha o dia acima." Não há lista de projetos, recentes nem opções de projeto. Modelo de projeto (`editingProjectTemplate`) fica sem acesso (P11).
8. **Centro de Mostrar.** `AliancaCentroCabecalho.svelte`: nome do item aberto, "depois: ‹próximo item do projeto›", "AO VIVO · a igreja vê este item" quando o telão está ligado e o show aberto está em `noAr().ids` (`utils/aliancaModo.ts:128`), e a dica do protótipo (`dicaCentro`). Abaixo, `Show.svelte`.
   - **Grade como no protótipo** (`repeat(auto-fill, minmax(180px, 1fr))`, `gap: 12px`, `padding: 16px`, `Tela-luz.dc.html:230-231`): `colunasDaGrade(largura) = max(1, floor((largura − 20) / 192))` em `aliancaTelaLogica.ts`, com `largura` = `clientWidth` do centro. `Show.svelte` e `show/Slides.svelte` ganham a prop opcional `colunas` (padrão `null`); com ela, `Slides.svelte` usa esse número no lugar de `$slidesOptions.columns` nas linhas 92, 565 e 574, e a grade recebe a classe `auto` (`.grid.auto { padding: 10px }` e `.grid.auto :global(.main) { padding: 6px }`), o que dá a mesma geometria do protótipo. `slide/Slide.svelte` não é tocado; `slidesOptions.columns` não é escrito. A 1920 isso dá 6 colunas (centro de cerca de 1270 px).
   - `Show.svelte` deixa de montar `Layouts` (linha 95) quando recebe `colunas`. Modo de vista continua pelo botão direito (`menuClick.ts:1140-1152`); leiautes do show ficam sem acesso (P4).
9. **Editar provisório (declarado: D1).** Com a página em `edit`, as mesmas três colunas e a biblioteca embaixo, com as peças de hoje, sem acabamento:
   - esquerda: `edit/Navigation.svelte`;
   - centro: `edit/Editor.svelte`;
   - direita: a mesma escolha de `MainLayout.svelte:118-131` (`MediaTools`, `AudioTools`, `EffectTools` ou `EditTools`, conforme `$activeEdit.type`, sem a condição de `focusMode`) e, abaixo, quando o item aberto é um show, um `<details>` fechado "Ferramentas do show" com `ShowTools`. Sem "No ar" e sem chat (o protótipo não tem em Editar); o `Preview` segue montado e escondido.
   - `previaEscondida` (`utils/aliancaEditorLogica.ts:22`) fica sem chamador; não apagar (arquivo do fecho, sai na fatia 3).
10. **A troca.** `App.svelte:94` passa a montar `<AliancaTela />` sempre; saem de `App.svelte` o `import` de `MainLayout`, o `<Guide />` da linha 91 com o seu `import`, e a bancada (`telaNova` e o `{#if}` de dev). `QuickSearch` (linha 87), `Toast`, `StatusIndicator`, `Recorder` e `ProgressPanel` ficam. `aliancaTema.ts` passa a escrever `luz` sempre na janela principal e perde `aliancaVisual` e a leitura do tema do FreeShow. `startup.ts:72` perde `iniciarMolduraAlianca()`. Em `shortcuts.ts` saem o `import` de `voltarDaPagina` (linha 31) e três ramos do Esc do Preparar: `voltarDaGaveta`, `voltarDoEditor` e `voltarDaMoldura` (linhas 133-135 e 144-146), e a linha 208 (Ctrl+1..8 abrindo a gaveta); o resto da regra de teclado é o de hoje. **Duas armadilhas de teclado saem neste mesmo commit:** (a) `popups/Initialize.svelte:31` faz `guideActive.set(true)` na primeira abertura e, sem o `Guide` montado, ninguém o desligaria: o `Preview` ignora toda tecla enquanto `guideActive` é verdadeiro (`Preview.svelte:45`); a linha 31 sai, e `quick_start_guide` (`menuClick.ts:230`) passa a chamar `falhaAlta` em vez de escrever o store; (b) `isTimelineActive()` (`shortcuts.ts:443-447`) perde o `|| get(special).projectTimelineActive`: a linha do tempo do projeto deixa de ser montada, e com esse valor salvo como verdadeiro o Espaço não avançaria o slide. Teste para as duas. Guardas e roteiros da Prova são reapontados para a tela montada (seção 4.4; `cdp.mjs:25` e `aparencia/fva-lib.mjs:14` trocam `.top.panel` e `.clockArea` por `data-regiao`). A Prova do Culto inteira roda aqui.
11. **Guarda de páginas.** Onde intercepta: no `set` e no `update` de `activePage`. `stores.ts:53` vira `activePage = guardarPagina(writable("show"), () => get(currentWindow) === null)`, com `guardarPagina` em `utils/aliancaPaginaGuarda.ts` (novo; importa só `svelte/store` e `aliancaFalha`). Fora da janela principal devolve o valor sem olhar. Na principal: `show`, `edit`, `settings`, `stage` e `draw` passam; qualquer outro valor **não é escrito** (a tela fica onde estava, sem piscar) e chama `falhaAlta("pagina-sem-lugar", valor)`, que acende a `FaixaDeFalha` com o nome da página até o operador dispensar. Não existe "voltar para show". Entre os commits 10 e 11, o ramo final do corpo de `AliancaTela` cobre o caso: página fora da lista mostra o corpo vazio com "Página sem lugar: ‹nome›" e chama `falhaAlta`; depois do 11 esse ramo vira inalcançável e fica, com teste.
12. **Apagar o antigo.** `MainLayout`, `Top`, `TopButton`, `LibraryTabs`, `Drawer`, `AliancaAbasLaterais`, `PrepararBarra`, `PrepararMenu`, `PrepararPilula`, `AliancaModo`, `SirvoIndicador`, `ProjectStrip`, as abas de agenda e a árvore de pastas de `Projects.svelte`, `FocusMode`, `components/guide/`, `Tipbar`, `utils/aliancaMoldura.ts` e `aliancaMolduraLogica.ts`, `utils/aliancaGavetaAutoabrir.ts`, `aliancaTopScriptGuarda.test.ts`; o bloco FV de `global.css`; a aba Tema (`SettingsTabs.svelte:9`); as flags `aliancaVisual` e `aliancaSeletorCompacto`; Ctrl+T (`togglePanels`, `common.ts:190-209`, o atalho `t` em `shortcuts.ts:59` e o export `fecharTudoManual` de `utils/aliancaLayoutEstado.ts:34`; `valorPorModo` fica até a fatia 2); as fontes sem uso depois do tema (conferir por grep: Inter, SpaceGrotesk, CMGSans, JetBrainsMono). **Antes de fechar o commit:** grep pela importação de cada arquivo apagado e por `drawer.set`, `drawer.update`, `resized.set`, `resized.update`, `drawerOpenedInEdit` e `autoclosed`; o resultado vai no PR. As escritas em `drawer` que ficam em upstream (`slide/Reference.svelte:49,59`, `slide/views/DynamicEvents.svelte:97`, `Timer.svelte:92`, `Variable.svelte:24`, `drawer/audio/AudioMeter.svelte:153`, `edit/scripts/edit.ts:113`, `edit/Editor.svelte:56-58`) não são tocadas: escrevem num store que ninguém mais lê, e ele morre na fatia 2. A barra de dicas e a linha do tempo do projeto não têm entrada de menu: a primeira só era montada em `MainLayout.svelte:175` e o botão da segunda vivia em `Projects.svelte:506`; somem com eles.
13. **Provas e baseline.** Fidelidade, "popover consome a tecla" (menu do app, pílula do telão, seletores, bloco), "upstream não some calado", parte dinâmica de "tema não vaza" (`fva-saida.mjs` com diferença zero), mutação das guardas, `esperado.json` e baseline regravados (seção 4.1).

`modoAlianca` não muda de regra nesta fatia.

#### Prints da prova de fidelidade (lista fixa)

Dados: o perfil da Prova (`scripts/prova-culto/perfil`), com um culto de pelo menos três blocos e uma música de pelo menos oito slides aberta. O board é levado a cada estado por cliques gravados em `scripts/prova-culto/fidelidade.mjs`. Cada print sai inteiro e recortado nas cinco regiões (`topo`, `roteiro`, `centro`, `no-ar`, `biblioteca`).

| Print | Conteúdo | Estado no app | Estado no board |
|---|---|---|---|
| F1 | 1920×1080 | Mostrar, telão desligado, nada no ar, pasta Shows, outras telas recolhidas | o mesmo, em `Tela-luz-1080` |
| F2 | 1920×1080 | Mostrar, telão ligado, slide 2 da música no ar, um bloco ao vivo, outras telas abertas | o mesmo |
| F3 | 1920×1080 | como F2, com a pasta Mídia aberta (grade) | o mesmo |
| F4 | 1440×900 | como F2 | o mesmo, em `Tela-luz` (é a régua de `medidas.mjs`, tolerância de 1 px nas caixas das regiões) |

#### Diferenças declaradas (imagem). Lista fechada

Vale para o que se vê nos prints F1–F4 e nas telas alcançáveis pelo topo. Qualquer diferença de estrutura fora desta tabela é defeito. "Print" é a imagem "é isto que se espera ver", anexada ao PR com o mesmo número.

| # | Região | O que difere do protótipo | Por quê | Resolve em | Print |
|---|---|---|---|---|---|
| D1 | Tela de Editar inteira | As peças de hoje (`Navigation`, `Editor`, `EditTools` e irmãs, `ShowTools` recolhido) nas três colunas, sem a forma do protótipo; entradas flutuantes do editor (`FloatingInputs`) continuam | Editar na forma final é a fatia 3 | Fatia 3 (flutuantes: fatia 9) | sim |
| D2 | Popovers do bloco ao vivo, do local, do dia e da pílula do telão | Conteúdo e forma de hoje, dentro do tema. A pílula Sirvo não tem popover | Popovers finais são a fatia 4 | Fatia 4 | sim, um por popover |
| D3 | Corpo, nas páginas Configurações, Telas e Ferramentas da saída | Peças atuais em três colunas, sem acabamento | Páginas finais são a fatia 4 | Fatia 4 | sim, um por página |
| D6 | No ar | Sem a barra de controles de vídeo sobre a tela | Fatia própria | Fatia 7 | não (ausência; F2 mostra) |
| D7 | No ar | Sem a caixa "Mensagem pro palco"; o chat ocupa o lugar | Depende de função nova no Sirvo | Fatia 8 | não (F2 mostra) |
| D8 | Roteiro | Sem etiqueta NOVO; a faixa AO VIVO só diz "· telão ligado" | Perguntas 9 e 10 abertas | Quando forem respondidas | não (F2 mostra) |
| D10 | Acima do topo | Barra de menus do Windows, 25 px, dentro da janela | A decisão é da fatia 4 (pergunta 8) | Fatia 4 | sim (janela inteira) |
| D11 | Acima da barra de menus | Título nativo da janela, cerca de 31 px (número medido no passo 1) | Idem | Fatia 4 | o mesmo print de D10 |
| D12 | Roteiro, entre o cabeçalho e a lista | Linha fixa de 36 px para o aviso "o roteiro mudou" (vazia quando não há aviso) e, no topo da lista, a faixa do Sirvo do projeto quando houver | Lugar provisório dos avisos do Sirvo (pergunta 14) | Quando a 14 for respondida | sim, com e sem aviso |
| D13 | Biblioteca, árvore | Pastas a mais que o protótipo: Funções, Calendário, câmeras e NDI em Mídia (resposta P7). Sem as da pergunta 12 | P7 decidida; 12 aberta | Pergunta 12 | sim |
| D14 | Centro, dentro de cada cartão de slide | O cartão é o de `Slide.svelte` (rótulo, número, ícones), não o botão do protótipo. Colunas, vão e margens são iguais | O slide é o conteúdo do app | Fatia 9 | sim (F2 já serve) |
| D15 | Sobre o conteúdo, só quando há o que mostrar | `StatusIndicator`, `ProgressPanel` e `Recorder` flutuam como hoje (`App.svelte:89-92`) | Fora do esqueleto; não foram redesenhados | Fatia 9 | não (condicional) |
| D16 | Todos os painéis | Só se a medição do passo 1 reprovar: painel opaco `#131315` e, se for o caso, sem luz ambiente | Desempenho da saída vem antes | Não resolve (decisão da medição) | sim, se acontecer |

#### Comportamentos provisórios e quebras conhecidas (não é imagem). Lista fechada

Cada item tem um roteiro de clique no PR; quem aprova confere pelo roteiro, não por print.

| # | O que acontece na fatia 1 | Resolve em |
|---|---|---|
| P1 (era D4) | "＋ Adicionar ao roteiro" abre a busca atual (`QuickSearch`); Ctrl+G e F8 continuam | Fatia 5 |
| P2 (era D5) | Clique simples na biblioteca, em Mostrar, ainda vai ao ar como hoje no Culto; o botão direito é o menu atual | Fatia 6 |
| P3 (era D9) | Estados cruzados de hoje continuam: editor aberto por duplo clique ou botão direito com o teclado vivo (página `edit`, modo `culto`), e página `show` com modo `preparar` (Ctrl+Shift+T, "abrir em Mostrar" do botão direito). O segmentado marca pela página | Fatia 2 |
| P4 | Mostrar sem `ShowTools` e sem o rodapé `Layouts`. Grupos, notas, metadados e mídia do show: só em Editar, em "Ferramentas do show". Trocar o leiaute do show: sem acesso. Zoom da grade: automático | Fatia 3 (pergunta 7) |
| P5 | Biblioteca sem painel Info: ficam sem acesso as informações de show, mídia, áudio e modelo, as opções da Bíblia de `ScriptureInfo`, e as informações de calendário e de funções | Pergunta 17 |
| P6 | Sem mouse para o que vivia na prévia antiga: ações do slide no ar, ferramenta de áudio, temporizador do próximo slide e limpar esse temporizador, controle de timers, Spotify, medidor de áudio, Restaurar saída, tela cheia da prévia, travar saída. O teclado segue igual | Fatia 7 (pergunta 16) |
| P7 | Pílula Sirvo: o clique abre Configurações na conexão; o texto de estado ("baixando 2 de 5", "1 arquivo falhou") só aparece na dica | Fatia 4 |
| P8 | Pílula do telão em Editar não liga com conteúdo ou desenho carregado (regra de hoje do Preparar) | Fatia 2 |
| P9 | Avisos do Sirvo no topo do roteiro, no lugar provisório de D12 | Pergunta 14 |
| P10 | Esc em Editar não volta mais do editor, da gaveta nem das páginas; continua sem limpar o telão (regra de hoje do Preparar) | Fatia 2 (pergunta 3) |
| P11 | Somem: Ctrl+T, Ctrl+D da gaveta, modo foco, guia de primeiros passos, barra de dicas, linha do tempo do projeto, aba Tema, pastas de projeto, lista de projetos recentes, opções de projeto, modelo de projeto, avatares de quem está na nuvem (`Top.svelte:115-130`) | Não voltam (avatares: pergunta 13) |
| P12 | Página `scripture`, `calendar` ou `reflow`: recusada, com a faixa acesa | Não volta (pergunta 15) |
| P13 | Em Editar não há chat nem os avisos que a barra do Preparar mostrava (chips "roteiro mudou", chat e "desenho ativo", e a pílula de pendências "conferir / sem letra"): `PrepararBarra` e `PrepararPilula` morrem e o protótipo não tem esses elementos em Editar | Fatia 3 |

**Pronto quando:** na cabine, a 1920×1080 e 100% de escala, com a janela maximizada, o André compara o app com o board `Tela-luz-1080.dc.html` lado a lado, mais os prints F1–F4, e não acha diferença de estrutura em Mostrar fora de D1–D16; e confere P1–P13 pelos roteiros de clique. **Não vai a culto** antes da fatia 2 (por causa de P3).

#### Destino de cada achado da revisão

A1: passos 8 e 9. A2: passos 8 e 9, P4. A3: passo 6, P5. A4: passo 6. A5: passo 6. A6: passo 7, D12, P9. A7: passo 11 e tabela 4.3. A8: passo 3. A9: passo 3. A10: passo 7. A11: passo 7. A12: passo 2. B1 e B2: ordem dos commits. B3: passo 2. B4: passo 12. B5: passo 10. C1: D10–D15, P4, P5. C2: passo 8. C3: coluna Print e lista P. C4: lista de prints. C5: passo 3. C6: seção 4.1. E1, E6, E7: seção 4.3. E2: passo 5. E3: passo 3. E4: passo 10 e seção 2.7. E5: passos 3 e 12. F1: "Pronto quando". F2, F3, F5: "Alvo, referência e como a tela cresce". F4: board 1080 e passo 8. F6: passo 1. F7: perguntar ao André depois do primeiro print a 1920; não muda a execução.

### Fatia 2: uma regra só (invisível, de propósito)

Nenhum pixel muda. O PR diz isso na primeira linha.

1. `utils/aliancaTela.ts`, fachada de `activePage`, porta `trocarTela`, classificação da seção 3, guarda de escritores classificados.
2. Troca de `modoAlianca`: 211 ocorrências em 70 arquivos no repositório; 167 em 53 arquivos de `src/frontend` (45 sem contar testes); 17 arquivos em `scripts/`. Cada uso recebe uma sentença pela regra abaixo, numa tabela no PR:
   - **A.** Protege a saída (tecla ou gesto que não pode ir ao ar): vira "`tela` ≠ `mostrar`". Esc fica fora: limpa sempre.
   - **B.** É forma ou organização do editor (propriedades organizadas, abas do editor, fontes, linha do tempo e notas fora do editor): vira "sempre". Só existe um editor.
   - **C.** Existia para manter dois leiautes separados (estado por modo, abas laterais, gaveta que reabre): apaga.
   - **D.** É gesto da biblioteca (`gavetaNaoToca`): fica "`tela` ≠ `mostrar`" até a fatia 6, quando vira "sempre".
   - Uso que não cabe em A–D para a fatia e vira pergunta. Não existe "caso a caso".
3. `criarPorModo`, `valorPorModo`, `aliancaLayoutEstado`, `aliancaPorModoLogica` saem; `drawer`, `resized`, `activeDrawerTab` e `drawerTabsData` voltam a `writable` simples; `save.ts:172,173,186` e `updateSettings.ts:338,339,352` perdem o `.culto`. O saneamento da pasta de mídia de `iniciarLayoutAlianca` ganha dono em `aliancaTela.ts`; `aliancaAbasEditor.ts:26` deixa de usar `valorPorModo`.
4. Provas "o Espaço não muda de dono", "chegada em Mostrar", "saída cega para a tela"; os 17 scripts re-apontados; entradas mortas do `esperado.json` removidas.
5. Re-ancoragem (seção 4.3).

**Pronto quando:** as provas acima passam e a comparação A/A de aparência com a fatia 1 dá diferença zero.

### Fatia 3: Editar na forma final

`AliancaItemEditando`, coluna de slides com selos, propriedades na ordem do protótipo, faixa de pendência com "Mandar pro ar", "＋ Slide", nota do slide. Prova "Editar". **Pronto quando:** lado a lado em Editar sem diferença de estrutura, fora o botão direito (fatia 6). A partir daqui a v2 pode ir a um ensaio (pergunta 2).

### Fatia 4: menu do app, páginas e popovers

Páginas do menu na forma final; popovers da pílula Sirvo, da pílula do telão, do bloco ao vivo, do seletor de local e de dia (com "＋ Culto avulso"); `MenuBar` conforme a pergunta 8; `src/electron/utils/menuTemplate.ts` se a barra sair. Prova "popover consome a tecla" para cada um.

### Fatia 5: spotlight Ctrl+K

`AliancaSpotlight`. Enter = zero escritas em `outputs`; Shift+Enter = uma; Esc fecha sem limpar o telão. QuickSearch, Ctrl+G e F8 morrem; `aliancaQuickSearchLogica` vira a lista branca do spotlight.

### Fatia 6: botão direito

Slide: Mandar pro ar, Mandar só para ‹saída› (escreve só naquela saída), Duplicar, Excluir. Biblioteca: Editar, ＋ Adicionar ao roteiro, Mostrar agora. Clique simples na biblioteca deixa de ir ao ar nos dois modos (seção C da Prova reescrita: clique simples = zero `outputs`; Mostrar agora = uma escrita).

### Fatia 7: controles de vídeo na tela do No ar

Barra sobre a tela principal (resposta P9), reaproveitando a lógica de `MediaControls`. Prova: a barra não desloca nem cobre a faixa de camadas; nenhum clique nela alcança o slide por baixo.

### Fatia 8: mensagem pro palco

Seção 6. Prova: enviar não desloca nenhum alvo de clique; nenhum teste chama o Sirvo de produção.

### Fatia 9: fecho

Passada de fidelidade região por região, `components/input/FloatingInputs.svelte` → barras fixas, diálogos no tema, cada quebra da seção 7 com `falhaAlta` + teste, baseline regravado, janela mínima.

### Destino dos PRs (decidido, P1)

Fechar #12–#27 menos o #20, com ponteiro "substituído pelo leiaute v2"; as branches ficam. O #20 entra sozinho na `main`. A v2 nasce em cima da pilha (77 commits à frente de `origin/main`, que está em `fac4554`, merge do #11) e no fim a `main` avança até o topo da v2 sem squash. O que roda no domingo enquanto isso: pergunta 2.

## 6. Mensagem pro palco (decidido, P3)

- O Sirvo já tem `enviar_stage_message(p_event, p_texto, p_minutos default 3)` em `servir\supabase\migrations\0079_ponte_show_leitura.sql:110`: texto de até 120 caracteres, validade de 1 a 60 minutos com padrão de 3, uma mensagem viva por igreja (a nova encerra a anterior). Ela exige login (`auth.uid()` + `pode_conduzir_roteiro()`).
- O Show não tem usuário: fala com chave de dispositivo. Precisa de função nova no Sirvo pelo caminho da chave, no molde das `show_*` da migration 0081: `show_enviar_mensagem_palco(p_chave, p_event, p_texto, p_minutos default 3)` e `show_limpar_mensagem_palco(p_chave, p_event)`, passando por `private.show_escrita(p_chave, p_event, false)`. Isso herda as travas que já existem: a chave precisa ter "conduz" ligado, 60 escritas por minuto, culto da igreja da chave e dentro da janela do Show.
- Mesmas validações da função atual. `stage_messages.autor_id` aceita nulo (`0050_stage_message.sql:33`); a migration acrescenta `dispositivo_id` para registrar a origem. Conferir como a régia mostra mensagem sem autor.
- A função devolve a mensagem (`id`, `texto`, `ate`); o Show a entrega na hora ao mesmo caminho que hoje lê `mensagem_palco` (`utils/aliancaSirvo.ts:326`), sem esperar a próxima consulta.
- Migration nova no repositório do Sirvo (a última no disco é a 0083; conferir o número contra o banco na hora). Staging primeiro; produção só com aprovação do André; migration antes do push do Show.
- No Show: duas entradas novas em `FuncaoDeEscrita` (`utils/aliancaSirvo.ts:569`). Com chave só de leitura a caixa aparece desligada, com o motivo escrito. Padrão de 3 minutos.

## 7. Riscos e o que não tem lugar no novo

1. Páginas `scripture` (`components/bible/BiblePage.svelte`), `calendar`, `reflow`: recusadas com faixa acesa (seção 3). A Bíblia de uso corrente fica na árvore e no spotlight (pergunta 15).
2. Extras da prévia que somem com o `Preview` escondido: `ShowActions`, `tools/Audio`, `NextTimer`, `TimerControls`, `SpotifyController`, `AudioMeter`, Restaurar saída, tela cheia, travar saída. `MediaControls` volta na fatia 7. Os demais: pergunta 16.
3. `components/show/ShowTools.svelte` e `slide/Layouts.svelte`: saem de Mostrar na fatia 1 (`ShowTools` fica em Editar, `Layouts` sem acesso: P4); destino final na pergunta 7.
4. Foto só cobre slide de show (pergunta 6).
5. Esc duas vezes em Editar pode limpar o telão sem querer (pergunta 3).
6. Altura: a cabine é 1920×1080 a 100%, mas o conteúdo útil tem cerca de 976 px de altura (barra de tarefas, título nativo e barra de menus). Roteiro e centro absorvem; os mínimos do centro estão na fatia 1.
7. Perfis (`ProfileSelector`, só leitura, `settingsDisabled`) e avatares de `cloudUsers` (pergunta 13).
8. Merges do upstream: apagar `MainLayout`, `Top`, `TopButton`, `LibraryTabs`, `Drawer` gera conflito modificar/apagar a cada merge, e o que o upstream acrescentar neles sumiria calado. Coberto pela prova "upstream não some calado".
9. Duas prévias renderizando na fatia 1 (a escondida e a nova): medir (fatia 1, passo 5).
10. A fatia 1 é grande. Commits separados na ordem dada; se a medição do passo 1 falhar, o resto segue com painel opaco, sem replanejar.
11. Sirvo de produção: nenhum teste chama `pedirAoSirvo`.
12. Entre a fatia 1 e a 6 a biblioteca em Mostrar ainda manda ao ar com clique simples (P2), embora a linha já mostre "＋ roteiro". É o comportamento de hoje no Culto, mas agora com a biblioteca sempre aberta.
13. Painel Info da biblioteca some na fatia 1 sem substituto (P5, pergunta 17).
14. Aviso do Sirvo no topo do roteiro: se crescer, empurra itens debaixo do mouse; por isso o lugar dele tem altura fixa (fatia 1, passo 7).

## 8. Perguntas ao André

Só o que não está decidido. Cada uma com a recomendação e a fatia que ela trava.

1. **(Respondida: 1920×1080 a 100%, ver o fim do documento.) Qual é a tela da cabine (resolução e escala do Windows) e em que máquina eu meço o desfoque e você aprova os prints?** Recomendação: medir e aprovar na máquina da cabine; se ela for menor que 1440×900, o protótipo precisa de um ajuste antes de eu começar. *Trava a fatia 1.*
2. **O que roda no domingo enquanto a v2 não fecha?** Recomendação: a `main` de hoje. A v2 só vai a culto depois das fatias 1 a 3 aprovadas e de um ensaio. *Trava a fatia 1.*
3. **Esc em Editar limpa o telão (você decidiu). Mas quem está digitando aperta Esc para sair da caixa de texto; um segundo Esc limparia o telão sem querer.** Recomendação: o Esc que fechou ou desselecionou algo segura por 700 ms o Esc seguinte. *Trava a fatia 2.*
4. **Duplo clique num slide em Mostrar, durante o culto: o que faz?** Hoje abre o editor. Recomendação: não abre; editar é pelo botão direito ou pelo segmentado. *Trava a fatia 2.*
5. **"Mandar só para Monitor de retorno".** Exemplo: você clica com o botão direito no slide 3 e escolhe "Mandar só para Monitor de retorno". O telão e a transmissão continuam no slide 2. O que o pastor vê no retorno: o slide 3 no lugar do "slide atual"? Hoje o retorno sempre copia o telão, não dá para mandar um slide só para ele. Recomendação: tirar esse item do menu e deixar só Telão e Transmissão. *Trava a fatia 6.*
6. **Selo EDITADO para o que não é música.** O congelamento só existe para slide de música ou apresentação; fundo, sobreposição, modelo e versículo no ar mudam na hora em que você edita. Recomendação: manter assim e mostrar o aviso "muda no telão na hora" em vez do selo EDITADO. *Trava a fatia 3.*
7. **Ferramentas do show (grupos, notas, metadados, mídia do show, modos de vista e zoom) e a barra de leiautes embaixo da grade: onde ficam?** Recomendação: grupos, notas, metadados e mídia nas propriedades de Editar; vista e zoom no cabeçalho do centro; a barra de leiautes sai. *Trava a fatia 3.*
8. **Barra de menus do Windows (Arquivo, Editar…): sai?** Recomendação: sai, junto com o guia de primeiros passos e a barra de dicas. Ctrl+S, Ctrl+Z e Ctrl+E continuam como atalhos; Exportar e Histórico entram no menu do app, abaixo de Importar. *Trava a fatia 4.*
9. **AO VIVO acende com o telão ligado. Acende também pelo horário?** Recomendação: também quando o Sirvo marca o culto como iniciado e não encerrado; horário da agenda não entra (não dá para adivinhar atraso). *Trava a etiqueta, não a fatia 1.*
10. **Etiqueta NOVO: vale para o que entrou no roteiro com o AO VIVO aceso? Some quando?** Recomendação: sim; some quando o item vai ao ar ou quando o culto encerra. *Trava a etiqueta.*
11. **Editar título, mover e criar bloco do roteiro pelo Show: fica?** O protótipo só mostra tempo e encerrar. Recomendação: fica, pelo botão direito no bloco. *Trava a fatia 4.*
12. **Efeitos, vídeos online, mixer, playlists e microfones: viram pastas da árvore ou saem?** Recomendação: viram pastas (Efeitos na raiz; vídeos online em Mídia; os outros três em Áudio). *Não trava a fatia 1: sem resposta, os nós não aparecem (D13); aba salva que aponte para eles é saneada na carga, e só uma escrita em uso acende a faixa.*
13. **Perfis de acesso e avatares de quem está conectado na nuvem: continuam?** Recomendação: perfis ficam, dentro de Configurações; avatares saem. *Trava a fatia 4.*
14. **Avisos do Sirvo ("o roteiro mudou", "ordem nova: Aplicar", "Montar os blocos aqui?"): onde aparecem?** Recomendação: dentro do roteiro, no topo da lista, porque é lá que a pessoa age. *Não trava a fatia 1: ela já aplica a recomendação como provisória e declarada (D12, P9).*
15. **Bíblia: a pasta na árvore e o versículo pelo Ctrl+K cobrem o domingo (pregador pede versículo na hora)?** A tela cheia de Bíblia deixa de existir. Recomendação: sim, cobre. *Trava a fatia 5.*
16. **Controles que somem com a prévia antiga: temporizador do próximo slide, controle de timers, medidor de áudio, travar saída, Restaurar saída, tela cheia, Spotify.** Recomendação: travar saída e Restaurar saída vão para o popover da pílula do telão; medidor de áudio e timers ficam junto dos controles de vídeo; Spotify sai. *Trava a fatia 7.*
17. **Painel de informações da biblioteca (informações do show, da mídia, do áudio e do modelo; opções da Bíblia; calendário; funções): o que volta, e onde?** O protótipo não tem esse painel e a fatia 1 o tira (P5). Recomendação: as opções da Bíblia vão para o cabeçalho da pasta Bíblia; o resto fica nas propriedades de Editar. *Trava a fatia 3.*

Pendentes já registrados: resolução real do telão; alertas (carro, Kids) depois.

## 9. O que foi corrigido da v2 (conferido em `091f4cd`)

| A v2 dizia | O código diz |
|---|---|
| `modoAlianca` em 75 arquivos, 239 referências | 70 arquivos, 211 ocorrências no repositório; 53 arquivos e 167 ocorrências em `src/frontend`; 17 arquivos em `scripts/`. |
| 81 escritores de `activePage` | 78 escritas em 38 arquivos (`aliancaMolduraEscritores.json`); o grep de 81 em 40 conta 3 linhas comentadas. Não há escrita literal de `draw` nem `scripture` (a guarda proíbe); eles só chegam por argumento dinâmico. |
| `MainLayout.svelte` em `components/main/` | Está em `src/frontend/MainLayout.svelte`. |
| `Preview.svelte` não pode desmontar, extrair `AliancaSaidaMotor` | Já fica sempre montado, tem a prop `escondida` e ela é `display: none`. Sem extração. Ele está fora do fecho da saída. |
| Âncora: 2 exceções (`stores.ts`, `helpers/output.ts`) | 15 arquivos do fecho citam `modoAlianca`, mais os de persistência; lista na seção 4.3. `helpers/output.ts` não precisa mudar. |
| `aliancaFalhaGuarda.test.ts` fica igual | Lê arquivo que some; é reapontada. Inventário na seção 4.4. |
| Tokens "mapeados nas variáveis do FreeShow" em `global.css` | `global.css` é carregado por todas as janelas; os tokens ficam sob `body[data-tema="luz"]`, que só a janela principal escreve. |
| `SirvoConduzir`, `SirvoBlocoConduzir`, `SirvoSegurar`, `SirvoProjetoFaixa` sem pasta | `components/show/`. `AliancaBiblioteca.svelte` está em `components/main/`; `FloatingInputs.svelte` em `components/input/` (há outro em `src/server/remote/components/`). |
| `aliancaSeletorCompacto` em `Projects.svelte` | Também em `components/show/ProjectList.svelte:68`. |
| Guarda de páginas "fica em `show`" | Recusa a escrita, fica onde estava, faixa acesa. |
| Modo foco: sem destino | 47 arquivos citam `focusMode`; nada o liga hoje. Sai de vez. |
| Desfazer troca Mostrar ↔ Editar (dito pela revisão) | Não troca (`history.ts:203-205`); só navega de e para páginas do menu. |
| Mensagem pro palco "sem caminho de escrita" | O Sirvo tem a escrita com login; falta a função pelo caminho da chave (seção 6). |

Perguntas da v2 resolvidas sem perguntar: 2 (teclado em Editar: nada mexe no telão, Esc limpa; resposta P2), 3 (mensagem: pelo Sirvo, 3 minutos; seção 6), 10 (páginas ocupam o corpo, volta pelo segmentado; o protótipo e a 2.2), 12 (desligar o telão pede confirmação; rodada 2), 13 (clique simples na biblioteca não vai ao ar; o protótipo tem "＋ roteiro" e "Mostrar agora"), 20 (botão de limpar tudo é de segurar, Esc limpa na hora; o protótipo e a rodada 2), 21 (Ctrl+G e F8 morrem; regra "sem modo antigo"), 22 (popover, menu de contexto, aviso e diálogo continuam; o protótipo tem todos), 23 (`aliancaVisual` sai; regra 5), 24 (só o escuro Luz de Projeção, a aba Tema sai; `Tela-luz` é o visual aprovado). Respondidas pelo André em 17/nov: 1, 2, 3, 6, 7, 9. A 4 foi reescrita com exemplo (pergunta 5 acima).

## Respostas do André (17/nov, depois da v3)

- **P1 (tela da cabine):** Full HD, 1920×1080. Escala do Windows: 100% (confirmado) → área útil 1920×1080. A prova de fidelidade mede em 1920×1080 E em 1440×900 (protótipo); as larguras do protótipo são o ponto de partida, sobrando espaço para o centro.
- **P2 (o que roda no domingo):** hoje a igreja usa o ProPresenter. O AliançaShow ainda não é usado em culto, e a versão do Pedro não é nem será usada: só esta versão (a v2) entra em uso, quando estiver pronta. Não existe outra versão do AliançaShow nem "rede de segurança" dentro dele — mais um motivo para nada de fallback/modo antigo. A v2 vai a culto quando as fatias 1–3 estiverem prontas e ensaiadas.
- **Board 1920×1080 aprovado** ("excelente o espaço"). André aumentou a coluna da direita no protótipo: as larguras/alturas das divisórias TÊM que persistir ao fechar e abrir o app (resized/drawer salvos), já na fatia 1.
- **Mídia de emergência (fora do roteiro):** coberto por botão direito na biblioteca (linha ou miniatura de mídia) → "Mostrar agora (sem pôr no roteiro)". Manter na fatia 6; até lá, o clique simples em Mostrar ainda vai ao ar (comportamento provisório declarado).
- **Perguntas 3–16 da v3:** André foi dormir sem responder. Autorizado a seguir noite adentro ("noite muito produtiva"); usar as RECOMENDAÇÕES do plano como decisão provisória, listadas no PR para ele confirmar/vetar de manhã.

## Respostas do André às perguntas 3–16 (17/nov, noite) — DECISÕES

- **3 (Esc):** ok — o Esc que fechou algo segura o seguinte por 700 ms.
- **4 (duplo clique em slide no Mostrar):** NÃO faz nada. Ele considera bug do ProPresenter: gente clica 2× e o vídeo dispara 2×. Estender: duplo clique nunca dispara a ação 2× (clique repetido no mesmo item em <400 ms é engolido).
- **5 (retorno):** o monitor de retorno tem template próprio (FreeShow já tem). Não é "mandar especial", é um MODO: um botão ao lado de "mensagem pro palco" que liga "só retorno" — enquanto ligado, o que eu mando vai para o retorno e NÃO para o telão (ex.: letra que a banda precisa ver antes da igreja). Desligar volta ao normal. Tirar "Mandar só para Monitor de retorno" do menu de contexto.
- **6 (editar fundo/sobreposição no ar):** "faz o que achar melhor" → recomendação: muda na hora com aviso.
- **7:** concorda (grupos/notas/mídia → propriedades do Editar; vista/zoom → cabeçalho; barra de leiautes sai).
- **8:** concorda (barra de menus do Windows sai; Exportar/Histórico → menu do app).
- **9 (AO VIVO):** acende quando o telão está soltando alguma coisa (saída ligada com conteúdo). Sirvo "iniciado" NÃO acende.
- **10 (NOVO):** mantém como recomendado.
- **11 (blocos pelo Show):** continua, botão direito no bloco.
- **12:** concorda (viram pastas da árvore).
- **13:** sim (perfis → Configurações; avatares saem).
- **14:** sim (avisos do Sirvo no topo do roteiro).
- **15 (Bíblia):** na árvore + Ctrl+K, E manter a navegação de Bíblia do FreeShow (livro/capítulo/versículo) dentro do painel da biblioteca — ele acha que funciona bem.
- **16:** travar saída fica (ele gosta) no popover da pílula do telão; medidor/timers junto dos controles de vídeo; Spotify: ele gostaria de manter se não for complexo (o FreeShow já tem SpotifyController) → manter onde der, baixa prioridade.
- **Decisões técnicas do coordenador para a Fatia 1:** board 1080 aprovado; a montagem de dev `import.meta.env.DEV && $telaNova` nos commits 3–9 é aceita SÓ porque some no commit 10 do mesmo PR (nunca é entregue); Archivo vem do pacote `@fontsource-variable/archivo` (OFL) via `npm pack`, copiado para `public/fonts/`.
- **Sirvo, mensagem pro palco (17/nov noite):** branch `feat/show-mensagem-palco` (do `feat/show-f2`), commit `b438937`, pushada; migration `0093_show_mensagem_palco.sql` (0084–0092 já usados por outras branches no staging) aplicada SÓ no staging e testada. Contrato: `show_enviar_mensagem_palco(p_chave, p_event, p_texto, p_minutos=3) → {id, texto, ate}` (POST RPC), `show_limpar_mensagem_palco(p_chave, p_event) → void`. App: régia mostra "AliançaShow" como autor quando vem do dispositivo. tsc/build não rodados (worktree sem node_modules) — conferir pelo preview da Vercel. Produção: aguarda aprovação do André.
- **18/nov (manhã) — André APROVOU as 7 exceções da âncora da fatia 4** ("eu aprovo, vamos seguir") e mandou seguir as fatias 5→9 sem parar; checkpoint de testes manuais quando ele voltar. Teste 1 dele (instalador fatias 1–3): pontos 1–4, 6–10 ok; X limpar-tudo não respondia (exigia segurar) → vira 1 clique; seta da pílula discreta; "Restaurar" renomeado "Voltar o que foi limpo" (ele gostou do recurso); busca ganha ＋ e ▶ (▶ = roteiro + 1º slide no ar); Configurações precisam de Salvar e Fechar.
