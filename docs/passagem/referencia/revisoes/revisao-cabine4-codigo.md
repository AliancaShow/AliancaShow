# Revisão cética — PR #42 (feat/cabine-4 sobre feat/cabine-3)

Lido por `git diff origin/feat/cabine-3...origin/feat/cabine-4` (HEAD `a0677ea`) e pelo código vizinho na mesma ref. Nada foi rodado nem editado. Linhas referem-se à ref `origin/feat/cabine-4`.

## Veredito

**Não mesclar ainda. Corrigir 1, 2, 3 e 5 antes; o resto pode ir em seguida.**

- Spotify: o caso feliz funciona (vídeo de frente / áudio da gaveta entra, Spotify tocando, fade). Mas o gatilho é mais frágil do que a descrição diz: depende de um estado do Spotify que só é atualizado enquanto a página `show` está aberta, não enxerga despausar/desmutar, e o "na hora" na prática são mais de 3 s de música por cima do vídeo.
- Editar: nenhum campo sumiu (o mapa só reorganiza; campo desconhecido cai em Avançado). Os problemas são de comportamento: bloco que fecha sozinho no meio do arrasto, estado guardado misturado entre painéis diferentes, e a mudança atinge 10 usos do `EditValues`, não só o Editar de texto.
- Temporizadores: não é perda de função (ver achado 12), mas a fumaça t9 ficou mais fraca.
- As fumaças A1–A5 da t14 injetam entradas falsas nos stores; nenhuma passa pelo `VideoPlayer.start`/`AudioPlayer.start` reais. Os achados 1–4 não seriam pegos por elas.
- Os prints `depois-imagem.png` / `c4-depois-*.png` parecem anteriores aos commits `c0b377a`/`b5ee145`: mostram "X (%) • 2.6 px" (unidade dobrada e pontinho na Posição), que o código atual deveria ter eliminado. Pedir prints novos do HEAD.

---

## Spotify

### 1. ALTA — O gatilho depende de `spotifyState`, que só é atualizado com a página `show` aberta
`src/frontend/utils/aliancaSpotifyComSom.ts:20`, `components/output/preview/Preview.svelte:288-312`, `SpotifyController.svelte:31-36`

`deveParaOSpotify` exige `spotifyState.isPlaying`. Quem alimenta esse store é `initSpotifyManager()`, chamado só no `onMount` do `SpotifyController`, que mora dentro de `{#if $activePage === "show"}` no `Preview`. Fora de `show` (Editar, Palco, Configurações) o `onDestroy` para a consulta e o estado congela.

Cenário: operador está no Editar acertando um slide; alguém dá play no Spotify pelo celular/app; um vídeo com som vai ao ar (atalho, Sirvo, controle remoto). `spotifyState.isPlaying` ainda é o valor velho (`false` ou `null`) → não há fade. E a borda já foi consumida (`anterior = agora`), então não tenta de novo.

Mesmo dentro de `show` a consulta é a cada 1 s (3 s depois de 5 min parado): play no Spotify menos de 1 s antes do vídeo também escapa.

Correção: não filtrar pelo store. Na borda de subida chamar `fadePause()` direto — ele já consulta o estado fresco (`SPOTIFY_GET_STATE`) e desiste sozinho se não estiver tocando. Manter só o filtro `emFade`.

### 2. ALTA — Despausar e desmutar um vídeo não disparam; e o desmute dispara depois, em hora errada
`aliancaSpotifyComSom.ts:16,38`, `aliancaSpotifyComSomLogica.ts:15`, `videoPlayer.ts:385-440, 613-620`

O observador só acorda quando `playingVideos` é reescrito. `VideoPlayer.play`, `pause` e `toggleMute` mexem direto no elemento de áudio e não tocam no store. Além disso a regra não olha `paused`.

- Vídeo que entra **pausado** (não mudo): conta como "com som" e derruba o Spotify sem nada tocando (falso positivo). Depois o operador religa o Spotify, dá play no vídeo: a chave já está em `anterior`, não há borda → os dois tocam juntos (falso negativo).
- Fundo mudo em repetição no ar + Spotify. Operador tira o mudo: nada acontece. Minutos depois qualquer escrita em `playingVideos` (outro vídeo, ganho de replay, congelar) faz a "olhada" ver a chave como nova → fade do Spotify num momento sem relação com nada.

Correção: `play`, `pause` e `toggleMute` precisam avisar (um `playingVideos.update(a => a)` ou chamada direta ao observador), e a chave só deve entrar quando `!paused && !muted && volume > 0` (o `VideoPlayer.isAudible` já tem essa conta, linha 622). Como o vídeo nasce pausado e só toca ~220 ms depois (`delayMs`), o gatilho certo é o `play`, não o `push`.

### 3. MÉDIA — "Na hora" são mais de 3 s de Spotify por cima do vídeo
`SpotifyManager.ts:186-193`

`fadePause` usa `Math.max(audio_fade_duration, 3)` s em 60 passos, cada um com uma ida ao processo principal + 50 ms; a própria t14 comenta que "a duração real passa dos 3 s". O áudio do vídeo entra em ~220 ms e sobe em 800 ms. Resultado: a música fica audível durante a abertura do vídeo. O dono pediu "parar na hora (com fade)".

Correção: fade curto próprio para este caminho (ex.: 600–800 ms, ~10 passos), sem mexer no botão manual. Perguntar ao dono a duração.

### 4. MÉDIA — Chave por caminho + espera de 80 ms podem engolir a reexibição do mesmo vídeo
`aliancaSpotifyComSomLogica.ts:19`, `aliancaSpotifyComSom.ts:31-36`, `videoPlayer.ts:113-116`

Vídeo terminou congelado no último quadro (segue em `playingVideos`, a chave `v:caminho` fica no conjunto porque `ended` só é verdade no fim forçado; congelar pausa antes). Operador religa o Spotify. Clica no mesmo vídeo de novo: `stop` (síncrono, áudio pausado não tem fade) + `push` novo. Se o `canplay` vier em menos de 80 ms (arquivo local em cache), a espera funde as duas escritas, a chave nunca "saiu" e não há borda → vídeo e Spotify juntos.

Correção: identidade pela instância (o próprio elemento `audio`, num `WeakSet`), não pelo caminho. E tratar `congelado` como "sem som".

### 5. MÉDIA — A guarda "só a janela principal" não guarda
`App.svelte:28`, `utils/startup.ts:47`

`currentWindow` nasce `null` em **toda** janela e só vira `"output"` quando chega a mensagem `STARTUP`. O `$:` roda na primeira passada com `null`, então a janela de saída também chama `iniciarSpotifyParaComSom()` (e `App.svelte` passa a importar `SpotifyManager` estaticamente em toda janela — a frase do PR "nenhum arquivo do fecho da saída foi tocado" merece conferência). Hoje é inofensivo porque lá `spotifyState` é `null`; se o achado 1 for corrigido como sugerido, a janela de saída passa a mandar comando ao Spotify.

Correção: chamar de dentro de `startupMain()` (que já é "só a principal"), não por reativo no `App.svelte`.

### 6. BAIXA/perguntar — O que conta como "com som"
`aliancaSpotifyComSomLogica.ts:20-23`

- Todo item de `playingAudio` não-microfone dispara, inclusive **efeitos sonoros** (`type: "effect"`, `playMultiple`): uma vinheta de 1 s mata a música ambiente.
- Vídeo sem faixa de áudio mas não marcado como mudo (ex.: arrastado como "frente", ou item de vídeo dentro do slide: `output.ts:305` usa `muted: item.muted`, que por padrão é `false`, com repetição ligada) derruba o Spotify. Os fundos vindos da gaveta como "fundo" e os de slide (`showActions.ts:387`, `muted !== false`) nascem mudos — esses estão certos.
- Volume da mídia em 0 conta como "com som".
- Metrônomo (`playingMetronome`) não dispara.

### 7. BAIXA — Casos conferidos e que estão certos
Prévia/miniatura da gaveta e vídeo no Editar não passam por `playingVideos` (usam `<video muted>` próprio) → não disparam. Vídeo só em saída de retorno é ignorado; em saída secundária normal dispara. Áudio pausado→retomado e próxima faixa de playlist disparam de novo (id novo). Microfone não dispara. Recarga com vídeo no ar: `anterior` vazio gera borda, mas `spotifyState` ainda é `null` → não dispara (sorte, não desenho). Corrida com fade em curso: a borda é descartada, mas o fade em curso termina em pausa, então o resultado é o certo.

---

## Editar

### 8. ALTA — Bloco que "liga recurso" fecha sozinho no meio do arrasto
`EditValues.svelte:274`

`return aberto && !(expandAutoValue && !mudou)`. Nos blocos Contorno, Sombra, Lista, Acordes, Rolagem (texto) e Borda/Sombra (caixa), se os valores voltam ao padrão o bloco deixa de contar como aberto e desmonta.

Cenário: Contorno aberto, cor preta padrão; operador arrasta a régua da largura até 0 → `mudou` vira `false` → o bloco some debaixo do mouse com o arrasto em curso. Mesmo com Borda (largura 0) e Lista (desmarcar "Lista" fecha o bloco na hora). Antes o bloco ficava aberto (`openedSections`). Clicar de novo reaplica o valor-base (10 px), ou seja, não dá para deixar em 0 com o bloco aberto.

Correção: guardar "aberto nesta sessão" por bloco (como o antigo `openedSections`) e só aplicar a regra `expandAutoValue && !mudou` ao estado vindo do armazenamento, não ao bloco que o operador abriu agora.

### 9. MÉDIA — A mudança atinge os 10 usos do `EditValues`, e 8 deles dividem a mesma chave de armazenamento
`EditValues.svelte:273,293,300` (`chaveDoBloco(escopo || type, …)`), `aliancaBlocosLogica.ts:10`

Só `edit/tools/BoxStyle` passa `escopo`; `edit/tools/ItemStyle` passa `type="item"`. `MediaTools` (2 instâncias), `AudioTools`, `EffectTools` (uma por efeito), `SlideFilters`, `stage/tools/BoxStyle` e `stage/tools/ItemStyle` caem em `"x|<id da seção>"` (sem `escopo` e sem `type`, o prefixo é `x`). Consequências:
- recolher "Filtros" na mídia recolhe a seção de mesmo id no palco e em todo efeito;
- em `EffectTools`, recolher uma seção de um efeito recolhe a de todos;
- overlay/template (sem `agrupar`) e show (com `agrupar`) usam chaves de formato diferente no mesmo escopo, então o mesmo bloco tem dois estados conforme o que se edita.

Além disso esses painéis (mídia, áudio, efeitos, filtros de slide, palco) trocaram `InputRow` + `MaterialNumberInput` pelo miolo novo sem aparecer em nenhum print nem na t14. Pedir print de cada um (palco e mídia principalmente).

Correção: passar `escopo` explícito em todos os usos (`"midia"`, `"midia-filtros"`, `"palco-caixa"`, `"efeito"`…).

### 10. MÉDIA — Régua aparece em campo que nunca pediu régua
`aliancaCampoNumeroLogica.ts:37-43`, `EditValues.svelte:463`

`temRegua` só desliga com `showSlider === false`; `undefined` + `min`/`max` definidos = régua. Como `min` tem padrão 0, basta o campo ter `max`. Efeito visível no print: Posição (X, Y, Largura, Altura, `min -200 / max 200`, sem `showSlider`) virou 4 linhas com régua de −200 a 200 em vez de 2 linhas de 2 campos. Arrastar régua de posição joga a caixa para fora da tela com um toque; e o painel ficou mais comprido justamente no bloco mais usado. Idem "raio da linha" (`max: 100`), "captions.showtime".

Correção: régua só com `showSlider === true`. Perguntar ao dono se quer régua em Posição.

### 11. MÉDIA — Regra "rótulo dentro do campo" não fecha com o resto do miolo; hierarquia de Mais/Avançado achatada
`global.css` (bloco `.luz-num`), prints `c4-depois-texto.png`, `c4-depois-mais.png`

- Só o número é componente novo. Seletor de fonte, dropdown, cor, checkbox e as pastilhas B/I/U continuam sendo os `Material*` com a pele antiga. No print: "Cor do plano de fundo" é uma caixa vazia de altura diferente; "Texto em linha única" é checkbox solto sem moldura; o campo de cor ao lado da fonte tem outra altura. O pedido era "padrão visual único" — está mais perto, não está único.
- `MAIS` e `AVANÇADO` (cabeçalhos de grupo) têm o mesmo desenho e o mesmo recuo dos blocos filhos (`LISTA`, `CONTORNO`…). No print, `AVANÇADO` parece mais um filho de `MAIS`. Falta recuo ou peso diferente.
- A régua tem posição fixa (`right: 52px; width: 84px`) e o rótulo pode ocupar a largura toda (`max-width: calc(100% - 20px)`): rótulo comprido em painel estreito passa por baixo da régua. Com keyframe ligado entra um 3º botão em `.dir` (66 px) e a régua continua a 52 px → sobrepõe. Hoje a timeline está desligada no Editar, então é latente.
- Imagem (`depois-imagem.png`): sobra um vão vazio entre "Encaixe" e "Avançado" (linhas cujos campos estão `hidden` continuam gerando `.luz-lin` com margem).

### 12. BAIXA — t9 / Temporizadores: não é perda de função, mas a fumaça enfraqueceu
`scripts/prova-culto/t9.mjs:21-23`, `values/tabs.ts`, `aliancaArvoreLogica.ts:20-27`, `drawer/navigation/FunctionsTabs.svelte:68-74`

Não existe aba de gaveta `timers` neste fork (`drawerTabs` só tem shows, media, audio, overlays, templates, scripture, calendar, functions). Os temporizadores moram em **Ferramentas → Funções → sub-aba "Temporizadores"** (`id: "timer"`); `functions` está em `SUBABAS_NA_ARVORE`, e `slide/views/Timer.svelte:88` já abre por esse caminho. O teste antigo escrevia numa aba que nunca teve nó.

Porém: a t9 agora abre `functions` sem escolher a sub-aba `timer`, então "com a aba de temporizadores aberta" pode estar testando a sub-aba Ações. Correção: `setDrawerTabData("functions", "timer")` antes da amostra. E conferir a olho que a árvore C6 mostra "Temporizadores" sob Funções (some se `getAccess("timers").global === "none"`).

### 13. BAIXA — "Voltar ao padrão" novo no cabeçalho da Fonte
`EditValues.svelte:309` (`semReset` agora exclui `g === "vista"`)

O bloco Fonte (seção `default` na vista) ganhou botão de redefinir que antes não existia: um clique volta família, cor, tamanho, negrito etc. de uma vez, sem confirmação, ao lado da seta de recolher. Há desfazer, mas é ação destrutiva nova num alvo pequeno. Perguntar se é desejado.

### 14. BAIXA — Pontinho "mudou do padrão" usa `input.value`, não o padrão da seção
`EditValues.svelte:361-365, 463`

`padraoDe` devolve `Number(input.value)` (e `Number("")` = 0, não "sem padrão"). O cabeçalho usa `isDefaultValue` com `section.defaultValues`. Hoje não diverge em campo numérico (só Alinhamento tem `defaultValues`), mas são duas fontes de verdade. O pontinho tem 5×5 px, dentro do `<label>`, e reescreve o valor com um clique.

### 15. BAIXA — Campo de número: detalhes
`AliancaCampoNumero.svelte`, `aliancaCampoNumeroLogica.ts`

- Régua emite `change` a cada passo do arrasto → uma entrada de histórico por passo. Já era assim no `MaterialNumberInput`; não piorou, mas agora há régua em muito mais campo (achado 10).
- `blur` confirma o digitado. Digitar e clicar em outra caixa do slide: se a seleção trocar antes do `blur`, o valor vai para a caixa nova. Comportamento herdado; vale um teste manual.
- Esc não descarta o digitado. Campo vazio volta ao valor anterior (não há como "limpar para automático").
- `lerNumero("010")` = 8 (octal legado do `new Function` em modo frouxo). Herdado.
- Valores mistos com várias caixas selecionadas: mostra o da primeira, sem indicação de misto. Herdado (`getValue` só lê `item`).
- `hideWhenZero`, `padLength`, `currentProgress` são aceitos e ignorados. Nenhuma definição de `edit/values` ou do palco os usa hoje (conferido por grep) — sem perda.
- Sem limites absurdos: `prender` respeita `min`/`max`; NaN não chega ao componente (`getValue` troca por padrão).

### 16. BAIXA — Persistência em `localStorage`
`aliancaBlocosEstado.ts`

Leitura e escrita com `try/catch`, JSON inválido vira `{}`, valores não booleanos são descartados — certo. Ressalvas: nunca limpa (cresce só até o nº finito de blocos — aceitável); não entra em backup/exportação/sincronização de configuração nem no "restaurar padrões"; em dev (`localhost`) e em produção (`file://`) são armazenamentos diferentes; escreve uma vez à toa ao carregar o módulo. Padrão já usado no app (`AliancaRoteiro`, `aliancaSirvo`), então é coerente.

### 17. Conferido — nenhum controle sumiu
Comparando seções antes/depois: `mapaDeBlocos` só move `text`/`lines` de Mais para a vista e renomeia; `mapaDeGrupos` manda para Avançado qualquer seção/campo não citado. Texto: Fonte, Alinhamento, Texto, Linhas | Mais: Lista, Contorno, Sombra, Acordes | Avançado: Rolagem, Especiais, CSS. Caixa: Posição | Mais: Fundo da caixa | Avançado: Transformar, Borda, Sombra, Filtros, CSS. Mídia: Arquivo (src, encaixe, mudo, repetir, velocidade) | Avançado: Mistura e espelho, Recorte, Filtros. Câmera, temporizador, relógio: sem mapa → todas as seções como blocos, `default/align/position` travados abertos. O `{#each}` com chave não tem colisão (`grupo:id` é único; seção partida nunca aparece duas vezes no mesmo grupo). O que mudou é alcance: Mais/Avançado continuam a 2 cliques e, por 8, alguns blocos fecham sozinhos.

---

## Perguntar ao dono

1. Fade automático do Spotify: quanto tempo? Hoje são 3 s+ (o do botão manual). "Na hora" sugere ~0,7 s.
2. Efeito sonoro curto / vinheta da gaveta de áudio deve parar o Spotify? E o metrônomo?
3. Vídeo de frente **sem faixa de áudio** (ou com volume 0) deve parar o Spotify? Hoje para.
4. Quando o vídeo com som termina, o Spotify deve voltar sozinho? Hoje não volta (e não foi pedido) — só confirmar.
5. Vídeo que entra pausado: parar o Spotify ao entrar ou só quando der play?
6. Régua em X / Y / Largura / Altura (−200 a 200, uma linha por campo): quer mesmo, ou voltam a ser 2 por linha sem régua?
7. Botão "voltar ao padrão" no cabeçalho de Fonte (redefine fonte, cor e tamanho de uma vez): manter?
8. Os painéis de mídia, áudio, efeitos, filtros do slide e do **palco** também mudaram de miolo nesta PR. Era a intenção? Faltam prints deles.
9. Recolher um bloco deve valer por tipo de caixa (como está) ou igual para tudo?
