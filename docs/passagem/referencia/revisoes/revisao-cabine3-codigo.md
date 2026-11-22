# Revisão cética — PR #41 `feat/cabine-3` (C4: Configurações e propriedades do Editar no tema Luz)

Base `origin/feat/cabine-2` → `origin/feat/cabine-3` (cb18899). Leitura por `git show`/`git diff`; **nada foi executado** (nem testes, nem Electron). Os números de linha são do arquivo no HEAD do PR.

## Veredito

**Não mesclar como está. Dois bloqueios (1 e 2), o resto é conserto pequeno.**

A pele (CSS) está bem isolada e a A9 não foi tocada. O problema está no que o PR chama de "casca": o mapa das telas põe uma ação que move o telão a um clique, sem trava, e o "N alterações não salvas / Descartar" promete mais do que cumpre (conta só parte das lojas, e desfaz só parte do que conta). Os interruptores de rede novos são seguros para a janela do telão, mas derrubam transmissão ao vivo sem a trava que o "Habilitada" tem.

## Achados

### 1. ALTA — Mapa das telas: um clique move o telão, sem confirmação, sem desfazer, inclusive para cima da tela da cabine
`src/frontend/components/settings/AliancaMapaTelas.svelte:27-40` (função `mover`) e `:51` (o botão).

- Cenário A (culto): operador abre Telas e saídas para conferir algo, clica na tela "2"/"Cabine" do mapa achando que está selecionando. A saída escolhida (por padrão a primeira habilitada = o telão) ganha `bounds`+`screen` da outra tela e recebe `UPDATE_BOUNDS` na hora. O telão some do projetor.
- Cenário B: o alvo é a tela interna ("Cabine"). A saída é `alwaysOnTop` por padrão: a janela de saída cobre a interface do operador, que fica sem ver o app para desfazer.
- Cenário C: o alvo já é de outra saída (retorno). Não há checagem de ocupação: duas saídas empilhadas na mesma tela.
- Cenário D: saída só de rede (`invisible`, NDI). O mapa aparece igual (a seção "Janela" some, o mapa não) e o clique troca o `bounds` da saída, isto é, a resolução e a posição do que vai por NDI/RTMP.
- Agravantes: `toggleOutputs([id], { state: true })` (linha 37) **liga** a janela mesmo que as saídas estivessem desligadas (`outputDisplay` falso); `bounds`/`screen` não estão em `CHAVES_DE_SAIDA`, então **Descartar não desfaz**; não há guarda de `boundsLocked` (o cadeado do popup "Tela de saída" é ignorado aqui).
- As telas do mapa são vizinhas das linhas de "Todas as saídas" (que só selecionam) e têm a mesma cara de botão neutro: é exatamente "destrutivo herdando o pixel do seguro".
- Correção: o mapa só mostra (sem clique), ou o clique abre o popup `choose_screen` que já existe. Se for manter o mover direto: gesto contínuo ou confirmação com nome da saída e da tela, recusar tela interna e tela ocupada, respeitar `boundsLocked`, não mover saída `invisible`, não forçar `state: true`, e oferecer "voltar para a tela anterior". Recusar durante culto no ar.

### 2. ALTA — "N alterações não salvas" não conta `special`, `theme`, `dataPath` nem o resto das saídas; a contagem diz 0 com coisa pendente
`src/frontend/utils/aliancaConfigRascunho.ts:33-56` (lista de lojas) e `aliancaConfigRascunhoLogica.ts:8` (`CHAVES_DE_SAIDA`).

- A maior parte de Geral, Outros e Arquivos grava em `special` (`updateSpecial`, 5 usos em General, 3 em Other, 3 em Files). `special` não está na foto. Mudar essas opções deixa o cabeçalho em branco e o Descartar apagado, enquanto na mesma página outras chaves contam. O operador conclui "não mudei nada" e fecha.
- Idem para tudo de saída fora de `name/color/style/stageOutput`: `alwaysOnTop`, `ndiData` (nome/grupo NDI), `rtmpData.destinations`, `webrtcData`, `blackmagicData`, `cropping`, `bounds`. O PR declara ligar/desligar como "vale na hora", mas URL de destino RTMP e nome NDI são configuração pura, ficam não salvas e invisíveis.
- Correção: ou a contagem vira honesta ("há alterações não salvas", ligada ao `saved` do app, sem número), ou a foto cobre todas as lojas que as abas escrevem. Um Descartar que só desfaz um subconjunto precisa dizer qual.

### 3. ALTA — Descartar não desfaz criar/apagar saída, mas conta, e o aviso fica preso
`aliancaConfigRascunho.ts:111-122`.

- `mudancasDaLoja` conta chave nova/apagada (uma saída criada = 1 alteração). O laço do Descartar percorre só `foto.outputs` e pula `if (!a[id]) continue`: saída nova não é removida, saída apagada não volta.
- Cenário: "Nova saída" → "1 alteração não salva" → Descartar → aviso "Alterações descartadas", contagem continua 1, botão continua aceso, a saída nova continua existindo (e com janela aberta, se habilitada). Clicar de novo repete para sempre.
- Correção: tirar a criação/remoção da contagem (é "vale na hora", como o ligar/desligar) ou tratá-la de verdade. E o texto do aviso deve sair do resultado real (recontar e dizer "N não puderam ser desfeitas").

### 4. MÉDIA — Descartar devolve a loja mas não refaz o efeito colateral
`aliancaConfigRascunho.ts:123` (`todas[nome].set(clone(foto[nome]))`) e `:117`.

- `language`: a aba chama `setLanguage` (carrega o dicionário); o Descartar só escreve a loja. A interface fica no idioma novo, a loja no antigo, e o próximo Salvar grava o antigo.
- `style` da saída: `updateOutput("style")` chama `refreshOut`; o Descartar não. O telão pode ficar com o estilo descartado até o próximo slide.
- `disabledServers`/`ports`/`remotePassword`/`maxConnections`: ligar um servidor passa pelo popup de conexão; devolver a loja não garante que o servidor pare/volte. Não verifiquei quem reage à loja; precisa de prova no app.
- `styles`/`profiles` usam `history(...)`: o Descartar passa por fora do desfazer (Ctrl+Z depois de Descartar reaplica coisa "descartada").
- Correção: Descartar chama os mesmos caminhos das abas (`setLanguage`, `refreshOut`) ou essas lojas saem do rascunho.

### 5. MÉDIA — Fechar com alterações pendentes não avisa, e reabrir zera a contagem sem ter salvo
`src/frontend/components/main/AliancaCorpoPagina.svelte:29-32` (`fechar`) e `:63-65` (`iniciarRascunho` no `onMount`).

- Fechar sai direto. As mudanças continuam valendo ao vivo e não salvas (não se perdem na hora; perdem-se se o app cair antes do próximo salvar).
- Ao reabrir Configurações a foto é tirada de novo: contagem 0 e Descartar apagado, com o disco atrasado. A promessa "desfaz o que mudou desde a última vez que salvou" (title do botão, linha 85) é falsa nesse caso: desfaz desde a última vez que **abriu a página**.
- O autosave também dispara `statusIndicator === "saved"` e zera a foto (linha 62): alterações deixam de ser descartáveis sozinhas, sem o operador ter clicado em Salvar.
- A foto no "saved" é do estado no momento da confirmação, não do momento do `save()`: o que mudar nesse intervalo é dado como salvo sem estar no disco.
- Correção: decidir o contrato (ver perguntas). No mínimo, a foto sobrevive ao fechar/reabrir (só zera em "saved") e o Fechar mostra o que fica pendente.

### 6. MÉDIA — Interruptores de RTMP/WebRTC/NDI não têm a trava de transmissão que o "Habilitada" tem
`src/frontend/components/settings/tabs/Outputs.svelte:328-333` (`alternarRede`), `:379`, `:413`, `:442-443`.

- Sobre a pergunta (b): **a janela do telão não cai.** `SET_VALUE` de `ndi`/`webrtc`/`rtmp` vai para `OutputValues.ts:11-29`, que só cria/para o emissor e alterna o canal de captura (`CaptureLifecycle.ts:33-40`, `updateCaptureToggles` → `stopChannel`). Nenhum `CREATE`/`REMOVE` de janela. O `transparent` (que recria a janela) não é tocado pelos interruptores novos.
- O risco real: o "Habilitada" fica bloqueado com `isStreaming` (linha 343); os interruptores novos não. Desligar "Enviar esta saída por RTMP" durante a transmissão chama `stopChannel(id, "rtmp")` com `rtmpData.streaming` ainda `true`: a live cai (ou fica com o ffmpeg vivo sem quadros) e a interface continua dizendo "transmitindo". Um clique, sem confirmação, dentro de uma seção que o operador abriu só para olhar.
- NDI: desligar derruba a fonte no vMix/OBS de quem estiver recebendo; religar recria o emissor (receptores precisam reconectar).
- Blackmagic: desligar manda `SET_VALUE blackmagic` com a saída inteira para `initializeSender` (`bmdTalk.ts:47`), que não tem ramo de "desligar" visível no começo da função; e `forcedResolution` (posto ao escolher o modo) fica na saída depois de desligar. Não verifiquei até o fim; precisa de teste com placa.
- Ligar Blackmagic numa saída com janela dispara a auto-seleção de placa e `forcedResolution` (`Outputs.svelte:309-313`, `:271`): muda a resolução de render do telão no meio do culto.
- Correção: `disabled` nos interruptores enquanto `isStreaming` (igual ao da linha 343) e confirmação para desligar com saída no ar; ao desligar Blackmagic, limpar `forcedResolution`.

### 7. MÉDIA — "Renomear" do menu de contexto da aba de saída ficou mudo
`src/frontend/components/settings/tabs/OutputsTabs.svelte:169-176`.

- O `HiddenInput id={"output_" + tab.id}` foi removido. O menu de contexto continua oferecendo `GROUP_rename_recolor` (`contextMenus.ts:416-417`) e `menuClick.ts:243-246` faz `activeRename.set("output_" + id)`: ninguém escuta. Clicar em Renomear não faz nada, calado. `addOutput`/duplicar também deixam `activeRename` preso em `output_<id>` (`helpers/output.ts:986`, `:1031`).
- A cor da saída também saiu da aba (o `.color` foi removido), mas "recolorir" segue no menu e `color` segue em `CHAVES_DE_SAIDA`: muda algo que não aparece em lugar nenhum desta tela.
- Fere "sem modo antigo: quebrar alto". Correção: tirar renomear/recolorir do menu dessas abas (o campo Nome já existe) ou fazer o Renomear focar o campo Nome; limpar o `activeRename` na criação.

### 8. MÉDIA — A pele também caiu em "Monitor de retorno" e "Ferramentas da saída", sem declarar nem provar
`AliancaCorpoPagina.svelte:79` (`class="corpoPagina luz-pele"` para as três páginas).

- O PR diz que a classe foi posta em "Configurações, painel do Editar, popups". A casca é compartilhada com `stage` e `draw`: os campos de StageTools/DrawSettings mudaram de pele junto. Não há print nem checagem na t13 para essas duas páginas. `stage/tools/BoxStyle` e `ItemStyle` usam o `EditValues` remodelado (cabeçalhos `.luz-sec`), então o painel do editor de palco mudou de estrutura também.
- Correção: ou restringir (`class:luz-pele={pagina === "settings"}`), ou assumir, tirar print e incluir na fumaça.

### 9. BAIXA — `EditValues` fora de `.luz-pele` fica sem cabeçalho estilizado
`src/frontend/components/edit/tools/EditValues.svelte` (bloco `<style>`, ~464-490): o CSS antigo de `.title` foi apagado e o novo (`.luz-sec`) só existe sob `body[data-tema="luz"] .luz-pele` (`public/global.css:640+`). Hoje todos os usos que encontrei (Editar, palco) estão dentro de uma casca com a classe; qualquer uso futuro fora dela (ou popup que não passe por `Popup.svelte`) aparece cru. Vale uma guarda estática.

### 10. BAIXA — Recontagem clona todas as lojas sincronizadas a cada mudança
`aliancaConfigRascunho.ts:58-63`: `lerAgora()` clona ~50 lojas (inclui `styles`, `scriptures`, `actions`, `effects`, `audioRouting`) e faz `JSON.stringify` de tudo, a cada 150 ms de mudança em qualquer delas ou em `outputs`. `outputs` muda a cada slide que vai ao ar. Com Configurações aberta durante o culto, cada passagem de slide dispara clone + serialização de tudo. Provavelmente poucos ms, mas é trabalho na thread da interface no pior momento. Correção: assinar `outputs` com comparação da vista reduzida antes de recontar; clonar só a loja que avisou.

### 11. BAIXA — `Identificar telas` e o mapa leem as telas uma vez
`AliancaMapaTelas.svelte:15-17`: `GET_DISPLAYS` só no `onMount`. Ligar/desligar o projetor com a página aberta deixa o mapa velho, e o clique (achado 1) move para limites que não existem mais. `ocupaATela` casa por `screen` (id do sistema), que no Windows pode mudar ao reconectar: nenhuma tela marcada, sem aviso.

## O que conferi e está certo

- **(d) CSS não alcança saída nem stage.** Todo o bloco C4 de `public/global.css` começa por `body[data-tema="luz"] .luz-pele` (conferi por grep; a guarda `aliancaPeleLuzGuarda.test.ts` cobre o mesmo). `data-tema` só é escrito em `utils/aliancaTema.ts:16`, com `if (get(currentWindow)) return` na linha 21. `Title.svelte` (pode estar no fecho da saída) ganhou só a classe `luz-sec`, que sem o atributo no `body` não casa com nada. As telas de stage/remote servidas por rede são outros bundles e não foram tocadas pelo diff.
- **(e) A9 segue resolvida.** O diff não toca `Editor.svelte:44`, `AliancaItemEditando.svelte:34` nem `aliancaEditarLogica.ts`. O Fechar continua indo por `trocarTela("edit", "voltar-de-pagina")`. `configSecao` é loja nova e separada; `settingsTab` não muda de tipo. Não há prova nova: vale a fumaça t11 (o PR diz verde; não rodei).
- **(b) janela do telão**: ver achado 6, primeiro item.
- O "Habilitada" continua bloqueado quando é a única saída ativa (linha 343); a mudança de `{#if ...}` para `{#if currentOutput}` só passou a mostrar a chave desabilitada.

## (f) Fidelidade ao board e desvios

Declarados no PR, todos coerentes com o código:
- Painel do Editar por blocos (vista / Mais / Avançado) em vez das abas Texto/Item/Slide/Filtros: decisão de produto, não de código. É o maior desvio visual da prancha; precisa do "sim" do dono.
- Régua numérica (slider com − e ＋) não feita.
- "Livre"/"Cabine" no mapa (`aliancaSaidasLogica.ts:41`).
- "Tela de saída" mostra `1920x1080` (`Outputs.svelte:326`, vem do FreeShow).

Não declarados:
- Pele em Monitor de retorno e Ferramentas da saída (achado 8).
- Ícones de tipo (HDMI/NDI/Blackmagic/WebRTC) e a cor saíram das abas de saída; a informação foi para "Todas as saídas". Renomear na aba morreu (achado 7).
- As ferramentas da página desceram de coluna lateral para o pé (`SettingsTools.svelte`), declarado só de passagem.
- A dica do mapa diz "a tela clara é a que esta saída ocupa", mas a tela marcada é **vermelha** (`AliancaMapaTelas.svelte:58` vs `:123-126`). E vermelho, na casa, é "no ar": aqui marca só "selecionada".
- O ponto vermelho "no ar" das abas e da lista usa `$outputDisplay` (janelas de saída ligadas), não "há conteúdo no ar". Toda saída habilitada fica vermelha com o telão ligado e vazio (`OutputsTabs.svelte:154`, `AliancaMapaTelas.svelte:42`).

## (g) Os testes provam o quê

- `aliancaConfigRascunhoLogica.test.ts`: só a lógica pura de contar. Não há teste do `descartarAlteracoes` (o que fala com as lojas), que é onde estão os achados 3 e 4. O caso "saída criada depois da foto" está testado na contagem ("inclusive entrada nova e apagada") e não no desfazer: o teste confirma metade do defeito.
- `t13` C1-C6: prova Descartar/Salvar com **uma** chave (`labelsDisabled`), que por acaso é das lojas cobertas. Não tenta nenhuma opção de `special`, nenhuma de saída, nem criar saída e descartar. Teria reprovado em qualquer uma.
- `t13` D: nenhum clique no mapa, nenhum clique nos interruptores de rede. A "saída nova" é escrita direto na loja com `enabled: false`, então nenhum IPC roda. As duas superfícies de risco do PR (mover e ligar/desligar) têm **zero** prova de comportamento.
- `t13` F: se não houver janela de saída aberta, imprime uma linha e **passa**. Deveria falhar ("não provei"). Sem ela, (d) fica só na guarda estática, que é boa mas é texto.
- `aliancaPeleLuzGuarda`: boa (fecho da saída, seletores, tokens). Só procura a string `luz-pele` nos arquivos do fecho; não pegaria alguém escrevendo `data-tema` na saída, mas isso a `aliancaTemaNaoVazaGuarda` anterior cobre.
- `aliancaSaidasLogica.test.ts`: rótulos e resumos, puro. Bom, irrelevante para o risco.
- A t13 clica em Salvar de verdade no perfil de dev (grava em disco) e mexe em `outputs` do perfil; aceitável em dev, vale saber.
- Falhas herdadas declaradas (t8-midia `L`, `RtmpStreamer`, `aliancaToqueGuarda`): não conferi se são mesmo iguais na base.

## Perguntar ao dono

1. O mapa das telas deve **mover** a saída com um clique, ou só mostrar e abrir o popup "Tela de saída"? Se mover: pode durante culto no ar? Pode para a tela da cabine?
2. "Descartar" é para ser o quê: desfazer tudo desde o último salvar (inclusive o que vale na hora), ou só as opções "de papel"? Hoje é um subconjunto que o operador não tem como adivinhar.
3. Fechar Configurações com alterações não salvas: avisa, salva sozinho, ou segue calado como hoje?
4. Com autosave ligado o "N alterações não salvas" some sozinho. Faz sentido manter o contador, ou basta "salvo / não salvo"?
5. Interruptores de NDI/RTMP/WebRTC/Blackmagic dentro da seção: ficam, com trava durante transmissão? Ou ligar/desligar envio continua só no fluxo de criação?
6. Painel do Editar por blocos em vez das abas do board: aprovado como definitivo ou é dívida para a próxima fase?
7. Régua numérica: entra nesta rodada ou fica para depois?
8. Vermelho na tela selecionada do mapa e nos pontos das abas: vermelho é só "no ar" ou pode marcar seleção?
9. Renomear/recolorir pela aba da saída: tirar do menu, ou religar?
10. Monitor de retorno e Ferramentas da saída devem receber a pele agora (já receberam) ou só na C5?
