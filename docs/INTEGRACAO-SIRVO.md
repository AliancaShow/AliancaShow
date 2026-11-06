# Integração Sirvo ⇄ AliançaShow — desenho para revisão

> **Status:** proposta para o Pedro revisar. Nada do lado do Show foi codado.
> Do lado do Sirvo, a primeira parte (operações por intenção e o registro de
> mudanças) está em produção desde 06/nov/2026, e **a leitura pelo Show (F0a)
> também** — o §5.1 é o contrato que já responde de verdade.
> Tudo aqui pode mudar com a sua revisão — é para isso que vem antes do código.
> Referências de código são da branch `cultos-e-remote`.
> As decisões de produto já tomadas pelo André estão no §13; o que falta
> confirmar com você está no §14.

## 1. O que queremos

Hoje o roteiro do culto mora no Sirvo (celular da produção, régia na TV da sala
de vídeo) e o projeto do culto mora no AliançaShow. Os dois são montados à mão,
separados, e não se falam. Queremos:

1. **O roteiro do Sirvo vira, sozinho, o projeto do culto no Show** — cada bloco
   do roteiro com seu timer.
2. **Músicas escolhidas no Sirvo a partir da lista real do Show** — acabar com
   a versão errada da música.
3. **Os dois lados mexem no roteiro durante o culto** — a produção no celular,
   ao lado do palco, e o operador do Show, na sala de vídeo (às vezes a produção
   não está atenta, ou não está). Duração, ordem, avançar bloco: tudo igual no
   Show, na TV da régia e nos celulares.
4. **Toda mudança é sinalizada** — se encurtam o sermão em 10 minutos, ninguém
   pode descobrir pelo relógio.
5. **Mensagem da produção no Retorno** (o layout de palco que você criou).
6. **Chat do culto dentro do Show**, para o operador responder a produção.
7. **Material da semana entra pelo Sirvo** e cai na pasta do culto no Show.

## 2. A regra central

**O banco do Sirvo é a fonte única e o árbitro do roteiro. O Show é uma cópia
que pede mudanças ao Sirvo — nunca aplica na própria cópia primeiro.**

- Não há fusão de duas versões nem "última escrita vence": toda mudança vai ao
  Sirvo, o Sirvo aceita ou recusa, e todo mundo (Show incluído) atualiza a
  partir do que ficou lá.
- **Passar slide, tocar música e o timer correndo continuam 100% locais no
  Show.** A integração não fica no caminho do "próximo". Se a internet cair, o
  culto segue.

Por que assim: o Sirvo já tem várias telas mexendo no mesmo roteiro ao vivo, e
já apanhamos de conflito (um toque duplo encerrou um culto em 5 segundos em
09/ago). Um árbitro só é o que nos deixou consertar isso.

## 3. O que já existe no Sirvo (em produção)

Cada mudança expressa a **intenção**, não o estado final — assim duas pessoas
mexendo ao mesmo tempo não apagam o trabalho uma da outra:

| Operação | Função (RPC no Supabase) | Devolve | Conflito |
|---|---|---|---|
| Mudar duração | `ajustar_duracao_bloco(p_bloco, p_base, p_novo)` | `{duracao, rev}` | Soma a diferença (`novo − base`): a régia dá +2 e o celular +1 ao mesmo tempo → +3. |
| Reordenar | `mover_bloco(p_bloco, p_depois_de)` | `rev` | "Mover X para depois de Y" (`null` = topo). Recusa pôr bloco antes do que já passou, ou mover bloco que já passou. |
| Iniciar / encerrar o culto | `iniciar_roteiro(p_event)`, `encerrar_roteiro(p_event)` | a hora gravada | Idempotentes. |
| Reabrir o culto | `reabrir_roteiro(p_event)` | — | Idempotente. |
| Mensagem no palco | `enviar_stage_message(p_event, p_texto, p_minutos)`, `limpar_stage_message(p_event)` | — | — |

(Existe também `reiniciar_roteiro`, que apaga todas as conclusões do culto. Ele
**não** entra na lista do Show.)

Por baixo:

- **Hora do banco.** Toda marca de tempo (bloco concluído, início do culto) é o
  `now()` do Postgres, nunca o relógio do aparelho.
- **`events.roteiro_rev`** sobe a cada mudança de duração, título, ordem,
  bloco criado/apagado, bloco concluído/desfeito e estado do culto. Serve para
  **ordenar e avisar**, não para recusar escrita (recusar por versão faria um
  "avançar" do Show derrubar o ±1 da produção). Nota, responsável e cor do bloco
  e a mensagem de palco ainda não sobem o `rev` — vamos incluir antes da F0a,
  para o aviso de tempo real cobrir tudo que o Show mostra.
- **`roteiro_mudancas`**: histórico de quem mudou o quê, com antes/depois. É
  daí que sai o aviso "O roteiro mudou: Ana mudou Louvor 20 → 25 min (+5)", que
  já aparece na régia e nos celulares. O Show mostraria o mesmo aviso.

Os erros vêm em português, prontos para mostrar ao operador ("Esse bloco já
passou — não dá pra mover.").

## 4. Como o Show se conecta (em produção desde 06/nov)

- **Só conexões de saída.** O Show chama o Sirvo; nada abre porta no
  computador da igreja.
- **Uma chave, e nenhuma conta.** O admin gera a chave no Sirvo (Perfil →
  AliançaShow), dá um nome a ela ("Sala de vídeo") e o operador cola no Show.
  A chave aparece uma vez só; o Sirvo guarda apenas o hash. Perdeu, revoga e
  gera outra.
- **A chave vai em toda chamada, no corpo de um POST.** Não existe sessão para
  renovar nem usuário do dispositivo: o Show chama, com a chave pública do
  projeto (`apikey`, a mesma que o app web usa), as funções `show_*`, passando
  `p_chave` como argumento. Chamada por GET é recusada — com GET a chave
  andaria na URL e ficaria em log.
- **Cercado no banco.** Sem login, o Show não lê tabela nenhuma; o que ele
  enxerga é exatamente o que as funções `show_*` devolvem, e só da igreja da
  chave. Revogar corta na chamada seguinte.
- **Chave no processo principal do Electron**, guardada com `safeStorage`, e
  falando com o renderer por IPC. Isso é um padrão novo no repo — hoje o
  Firebase roda no renderer (`aliancaRemote.ts:74,113`) —, mas tem precedente:
  o REST do Planning Center roda no main (`Main.PCO_LIVE_GET`,
  `pcoLiveSync.ts:247`). O motivo: o renderer exibe texto de fora, e a chave
  não deve morar onde texto de fora é renderizado.
- **Tempo real por pergunta curta.** Sem sessão não há canal privado; o Show
  pergunta `show_rev` (resposta de ~100 bytes) e só busca o roteiro quando o
  `rev` muda (§5.3).
- **Indicador visível** "Sirvo: conectado / caído" no Show.

## 5. O contrato (proposta v0)

Funções novas que o Sirvo cria para o Show. Nomes e formatos são propostas —
se algo atrapalhar do seu lado, muda agora.

### 5.1 Ler (em produção)

Todas: `POST {URL do projeto}/rest/v1/rpc/<função>`, cabeçalhos `apikey` e
`Content-Type: application/json`, corpo JSON com os argumentos. Erros vêm como
`{ "code", "message" }`: `42501` = chave inválida ou revogada (ou GET);
`P0002` = culto que não existe ou não é da igreja da chave.

**`show_cultos({ p_chave })`** → os cultos que o Show pode abrir: o que está no
ar, os de hoje (mesmo encerrados, que dá para reabrir) e os próximos 14 dias.

```json
[{ "event_id": "uuid", "titulo": "Culto de Domingo",
   "comeca_em": "2026-11-08T21:00:00+00:00", "no_ar": false, "encerrado": false, "rev": 12 }]
```

**`show_rev({ p_chave, p_event })`** → a pergunta de cada poucos segundos.

```json
{ "rev": 42, "agora_servidor": "2026-11-08T21:41:07.120+00:00",
  "msg_id": "uuid-ou-null", "msg_ate": "2026-11-08T21:46:00+00:00" }
```

`msg_id`/`msg_ate` existem porque a mensagem de palco é da igreja (não do
culto) e vencer não muda o `rev`: se o `msg_id` mudou, busque o roteiro.

**`show_roteiro({ p_chave, p_event })`** → tudo que o Show precisa:

```json
{
  "event_id": "uuid", "titulo": "Culto de Domingo", "rev": 42,
  "agora_servidor": "2026-11-08T21:41:07.120+00:00",
  "comeca_em": "2026-11-08T21:00:00+00:00",
  "iniciado_em": "2026-11-08T21:02:10.381522+00:00",
  "encerrado_em": null,
  "bloco_no_ar": "uuid-do-bloco",
  "fim_previsto": "2026-11-08T22:40:00+00:00",
  "fim_planejado": "2026-11-08T22:35:00+00:00",
  "blocos": [
    { "id": "uuid", "ordem": 0, "titulo": "Abertura", "tipo": "Abertura", "cor": "#C8A15A",
      "duracao_min": 5, "estado": "concluido",
      "inicio_previsto": "…", "fim_previsto": "…",
      "concluido_em": "2026-11-08T21:08:40.120933+00:00",
      "responsavel": "Pr. João", "nota": "…", "link": "…" }
  ],
  "mensagem_palco": { "id": "uuid", "texto": "Estende mais 5 min", "ate": "2026-11-08T21:46:00+00:00" },
  "mudancas": [ { "rev": 42, "tipo": "duracao", "bloco_id": "uuid", "bloco_titulo": "Palavra",
                  "antes": 35, "depois": 40, "autor": "Ana", "em": "…" } ]
}
```

- `estado` de cada bloco: `concluido`, `no_ar`, `a_seguir` (culto iniciado) ou
  `planejado` (culto não iniciado). `bloco_no_ar` é `null` antes de iniciar e
  depois de encerrar.
- **Os horários `_previsto` não andam com o relógio** — só mudam quando o
  `rev` muda. A conta é a do Sirvo: o primeiro bloco começa em `iniciado_em`
  (ou `comeca_em`); cada bloco começa onde o anterior terminou; bloco concluído
  termina no `concluido_em`; os outros, no início + duração.
- **O que anda com o relógio o Show soma, a cada segundo:**
  `estouro = max(0, agora − fim_previsto do bloco no ar)`, somado ao fim do
  bloco no ar e ao início/fim de todos os blocos depois dele (e ao
  `fim_previsto` do culto). Timer do bloco = `fim_previsto − agora` (negativo =
  estourou). `agora` = relógio do PC corrigido por
  `desvio = agora_servidor − agora_local`.
- **Carimbos são texto opaco.** `concluido_em` vem com microssegundos; quando o
  Show precisar devolver um carimbo (F2), devolve a string que recebeu.
- `mudancas` traz as últimas 20 que importam ao operador (edição de nota,
  responsável, cor etc. sobe o `rev` mas não entra aqui); o Show guarda a
  última `rev` que viu e mostra como aviso o que for mais novo.
- `mensagem_palco` é `null` quando não há mensagem viva; o Show tira da tela
  sozinho quando passa do `ate`.
- `itens` (músicas) entra na fase das músicas (§8).

### 5.2 Escrever

*(F2 — ainda não existe. Toda função de escrita também leva `p_chave`, omitida na tabela.)*

**Toda escrita do Show leva `p_pedido` (um uuid gerado no Show).** Se a
resposta se perder e o Show reenviar depois de reconectar, o Sirvo reconhece o
pedido e responde `"ja_estava"` em vez de aplicar de novo — senão um "+5"
reenviado viraria "+10".

| Função | Faz |
|---|---|
| `show_concluir_bloco(p_pedido, p_bloco)` | Avança: conclui o bloco X. Exige culto no ar e X = o bloco no ar; senão recusa com mensagem. Concluir um bloco já concluído responde `"ja_estava"`. |
| `show_desfazer_conclusao(p_pedido, p_bloco, p_concluido_em)` | Desfaz só se o carimbo ainda for aquele (ninguém concluiu de novo). |
| `show_ajustar_duracao(p_pedido, p_bloco, p_base, p_novo)` | ± por diferença (mesma regra do §3). |
| `show_mover_bloco(p_pedido, p_bloco, p_depois_de)` | Reordenar. |
| `show_iniciar(p_pedido, p_event)` / `show_encerrar(...)` / `show_reabrir(...)` | Culto. |
| `show_mensagem_palco(p_pedido, p_event, p_texto, p_minutos)` / `show_limpar_mensagem(...)` | Retorno. |

São embrulhos das funções do §3 com o `p_pedido` e a posse do computador (§5.4).
Sempre o id **do bloco**, nunca "o atual": se o Show reenviar um "avançar" depois
de reconectar, com o id isso vira "já estava"; sem o id, encerraria o bloco
seguinte.

### 5.3 Ouvir

`show_rev` a cada **2 s** com o culto no ar (ou até 1 h antes dele) e a cada
**30 s** fora disso. Quando `rev` ou `msg_id` mudar, chame `show_roteiro`.
Na reconexão, chame `show_roteiro` direto. Um PC no culto dá ~1.800 chamadas
por hora, todas minúsculas — cabe folgado.

### 5.4 Um computador edita por culto

No molde do seu `controle/dono`, mas no banco do Sirvo, conferido e renovado
**dentro de cada função de escrita do Show**, com a hora do banco (não do PC —
hoje o dono do Firebase é decidido com o `Date.now()` de cada PC,
`aliancaControle.ts:117`). Um segundo Show aberto vê, mas não edita, até o
primeiro sumir por 2 min 30 s. A trava vale só entre Shows: os celulares da
produção continuam editando.

## 6. Culto → projeto no Show

- **O projeto fica onde o Remote procura**: pasta `<Agenda>/<AAAA>/<MM-mês>`,
  nome começando por `DD` (`agendas.ts:45-62`). O que liga o projeto ao Sirvo é
  `sirvoEventId` no projeto, nunca o nome — renomear o culto não cria projeto
  novo.
- **Qual agenda:** o Sirvo ainda não separa Aliança / Impulso / Extra. Na v1
  todo culto vindo do Sirvo vai para a agenda Aliança; quando precisar, o Sirvo
  ganha o campo.
- **Bloco → seção.** A seção ganha id `sirvo_<uuid-do-bloco>` e guarda os dados
  do Sirvo em `data.sirvo` (o `data` da seção já é salvo; não mexemos em
  `data.settings`). Proposta: preencher `data.time` com o início planejado do
  bloco, que já aparece na seção e no valor dinâmico `project_section_time`.
- **Música mantém o id do show na biblioteca** (é assim que a navegação casa o
  item, `OutputHelper.ts:233-243`) e leva a ligação com o Sirvo em
  `data.sirvoId`.
- **Nota do bloco NÃO vai em `notes` da seção.** Fora do modo foco, seção com
  `notes` vira uma parada a mais no "próximo" (`OutputHelper.ts:191`). Vai em
  `data.sirvo`.
- **Só as seções vindas do Sirvo ficam travadas.** Hoje `sectionsLocked` trava
  todas as seções do projeto (nome, horário, notas, arrastar, "nova seção"), e
  o operador desliga num botão. Proposta (André já aprovou): o `isLocked` passa
  a olhar `data.sirvo`, e o operador continua criando e mexendo nas seções dele.
  A trava protege contra engano; a garantia continua sendo o §2.
- **Antes do culto:** o projeto é montado e atualizado sozinho a cada mudança.
- **Durante o culto:**
  - **Timer, âncoras e estado do culto aplicam na hora**, sempre — inclusive
    duração do bloco no ar (é o caso do sermão encurtado).
  - **Só a estrutura do projeto (`shows[]`)** espera, quando a mudança mexe
    antes do item no ar ou nele: fica pendente com um selo "ordem nova" e entra
    na próxima troca de item, ou quando o operador aperta "aplicar". Nunca troca
    o chão debaixo do slide no ar.
  - Se o bloco no ar foi apagado no Sirvo, ou o culto foi encerrado/reaberto, o
    Show avisa e pede ação ao operador em vez de decidir sozinho.
  - Ao reescrever `shows[]`, recalcular **pela identidade do item** tudo que
    guarda posição: `activeShow.index`, `activeFocus.index`,
    `outputs[].out.slide.projectIndex` (`output.ts:104`), `played`
    (`OutputHelper.ts:163-166`) e o que o Remote publica por posição
    (`estado.itens`/`itemAtual`, `aliancaControle.ts:216,227`). O comando
    `abrir` do Remote é por **índice** e vale 30 s (`aliancaControle.ts:153`):
    um toque no celular feito antes da reescrita abriria o item errado. Por
    isso o `abrir` passa a mandar **o id do item junto com o índice**, e o Show
    confere antes de abrir (André já aprovou).
  - Trava "aplicando do Sirvo": mudança no store que a própria ponte causou
    nunca vira pedido de volta ao Sirvo (senão laço).
- **Item que o operador pôs à mão fica**, preso à seção anterior, e nunca vira
  pedido ao Sirvo. O Sirvo não apaga o que não criou.
- **Operador mexendo no Show** (± duração, arrastar bloco, avançar) vira
  chamada às funções do §5.2. O Show só muda a cópia dele quando a resposta (ou
  o próximo `show_roteiro`) chega.

## 7. Timer e Retorno

- **Timer do bloco:** recalculado a cada segundo a partir das âncoras do
  `show_roteiro` (§5.1), como o `pco_live` faz (`pcoLiveSync.ts`), mas aplicando o
  desvio do relógio (o `pco_live` usa `Date.now()` cru, `:140`). Com
  **overflow ligado** (opção que todo timer do Show já tem), o bloco que estoura
  aparece como `−1:23`, igual ao Sirvo.
- **Tipo novo `sirvo_live`, sem mexer no `pco_live`.** O `pco_live` é código do
  FreeShow original; generalizá-lo complicaria cada atualização que você trouxer
  de lá, e hoje ele só liga com o Planning Center configurado
  (`pcoLiveSync.ts:68`). O tipo novo entra em `Timers.svelte:27`,
  `timers.ts:101`, `timerTick.ts:240` e no `getCurrentTimerValue` do palco
  (`src/server/common/util/time.ts:77`). Ele tem um id fixo, para qualquer layout
  poder mostrá-lo.
- **A ponte nunca cria nem edita layout de palco.** O layout é do Show e pode
  mudar com o tempo. A ponte só publica **valores com nome fixo**, e qualquer
  layout mostra os que quiser:

  | Nome | O que é |
  |---|---|
  | timer `sirvo_live` | tempo do bloco no ar (regressivo, com overflow) |
  | variável `sirvo_bloco` | título do bloco no ar |
  | variável `sirvo_proximo` | título do próximo bloco |
  | variável `sirvo_mensagem` | mensagem da produção (vazia quando não há; some no `ate`) |
  | variável `sirvo_fim` | hora projetada do fim do culto |

  Os nomes são proposta — se já houver convenção de nomes de variável no Show,
  seguimos a sua.
- **Texto do Sirvo no palco só pelo item de variável** (que escapa o texto,
  `Variable.svelte:15`) — **nunca** por `{variable_…}` dentro de uma caixa de
  texto, que passa por `{@html}` (`Textbox.svelte:500`).
- O layout "Retorno" é criado pelo Show (hoje em instalação nova,
  `createData.ts:41`); a gente sugere incluir nele o timer e a variável de
  mensagem, mas a ponte funciona com qualquer layout.

## 8. Músicas

- A biblioteca já foi limpa das duplicadas. Mas ela **vai continuar mudando**:
  o André quer revisar letras contra referências da internet, músicas são
  renomeadas, versões são juntadas. O catálogo no Sirvo não pode ser uma foto
  tirada uma vez — tem que acompanhar.
- **Estender o catálogo que você já publica** (`publicarCatalogo`, hoje só
  `nome`), em vez de criar outro: id, nome, categoria, primeira linha da letra,
  artista/tom quando houver, **data de modificação**.
- **Sincronia contínua, por diferença:** o Show envia ao Sirvo
  (`show_publicar_catalogo(p_itens)`) só o que mudou desde a última vez,
  usando a data de modificação. O Sirvo guarda pelo **id** da música, então
  renomear ou corrigir letra não quebra nada.
- **Música removida não some calada.** Ela vai como "removida" — ou "juntada
  com X", quando duas versões viram uma. O roteiro que apontava para ela troca
  sozinho para X, ou aparece marcado "esta música não existe mais" para alguém
  escolher outra.
- No Sirvo, cada bloco ganha a lista de músicas (`show_id` + ordem). No Show,
  música que não existe naquele PC aparece como item visível "não existe neste
  computador" — nunca pulada em silêncio.

## 9. Chat e material (fases finais)

- **Chat:** o canal do culto no Sirvo, dentro do Show, falando como a conta
  "Sala de vídeo" (rótulo "Sala de vídeo · operador: Fulano"). Texto do chat é
  texto de fora: nunca em `{@html}`.
- **Material da semana:** o Sirvo guarda em armazenamento próprio (Cloudflare
  R2) e entrega um link temporário; o Show baixa para a pasta do culto com as
  mesmas travas que entraram agora no `baixarParaPasta` (pasta Online, nome
  gerado, host fixo — o host do Sirvo entra na lista). Aqui vamos conversar
  sobre o futuro do Remote.

## 10. Sem internet

O Show segue projetando e o timer conta pelo último estado conhecido. Editar o
roteiro fica bloqueado, com aviso ("sem conexão com o Sirvo"). Na volta: busca o
roteiro atual e mostra o que mudou desde a última `rev` vista.

## 11. O que o Show nunca faz

- Ler ou escrever tabela do Sirvo direto (só as funções da lista — e o Sirvo
  recusa o resto de qualquer jeito).
- Mudar a própria cópia do roteiro antes de o Sirvo aceitar.
- Mexer em item que não veio do Sirvo.
- Guardar a chave no renderer ou em arquivo sem `safeStorage`.
- Mostrar texto vindo do Sirvo (nota, chat, nome de música, mensagem) por
  `{@html}` ou por `{variable_…}` em caixa de texto.

## 12. Fases — quem faz o quê

| Fase | Entrega | Sirvo | Show |
|---|---|---|---|
| **F1** ✅ | Operações por intenção, histórico, aviso de mudança, relógio do servidor | feito | — |
| **F0a** (Sirvo ✅) | Show conectado, **só leitura**: timer do bloco + mensagem no Retorno | ✅ chave, `show_cultos`, `show_rev`, `show_roteiro` (em produção 06/nov) | chave no main, timer, Retorno |
| **F0b** | Montar/atualizar o projeto a partir do roteiro (§6) | — | ponte |
| **F2** | Show edita: avançar, ±, reordenar, culto, Retorno | funções `show_*`, posse por culto | botões → funções |
| **F3** | Músicas | catálogo sincronizado, músicas por bloco | catálogo estendido e contínuo, itens no projeto |
| **F4** | Chat no Show | chat pela chave do dispositivo | painel de chat |
| **F5** | Material pelo Sirvo | armazenamento + link temporário | download para a pasta do culto |

Cada fase é útil sozinha. A F0a já substitui o que fazíamos com o ProPresenter
(o timer do bloco no palco).

Como nas correções de segurança: a gente faz a parte do Sirvo, faz a do Show em
branch e manda PR para você revisar.

## 13. Decisões já tomadas (André, 06/nov)

1. **Arquivo novo:** a ponte do Sirvo vai num arquivo novo (`aliancaSirvo.ts` +
   um módulo no processo principal), ao lado do `aliancaControle`, sem mexer no
   Firebase.
2. **Só as seções do Sirvo travadas** (`isLocked` olha `data.sirvo`).
3. **Timer novo `sirvo_live`**, sem mexer no `pco_live` (§7).
4. **Biblioteca já limpa; catálogo sincronizado continuamente**, com removidas e
   juntadas avisadas (§8).
5. **`abrir` do Remote manda o id do item junto com o índice** (§6).
6. **A ponte não toca no layout de palco** — só publica timer e variáveis com
   nome fixo (§7).

## 14. O que queremos confirmar com você

1. **Chave no processo principal:** algum problema em rodar as chamadas ao
   Sirvo no main, falando com a tela por IPC (como o REST do Planning Center
   já faz)?
2. **Nomes das variáveis** do §7: há convenção no Show que a gente deva seguir?
3. **Qualquer coisa** daqui que esbarre em algo do FreeShow que a gente não viu.
