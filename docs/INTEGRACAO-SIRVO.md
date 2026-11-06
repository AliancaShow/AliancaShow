# Integração Sirvo ⇄ AliançaShow — desenho para revisão

> **Status:** proposta para o Pedro revisar. Nada do lado do Show foi codado.
> Do lado do Sirvo, a primeira parte (operações por intenção e o registro de
> mudanças) está em produção desde 06/nov/2026.
> Tudo aqui pode mudar com a sua revisão — é para isso que vem antes do código.
> Referências de código são da branch `cultos-e-remote`.

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

## 4. Como o Show se conecta (proposta)

- **Só conexões de saída.** O Show chama o Sirvo; nada abre porta no
  computador da igreja.
- **Conta de dispositivo "Sala de vídeo".** Uma conta do Sirvo que não é de
  nenhuma pessoa, marcada como dispositivo (não aparece em escalas, listas nem
  avisos), com permissão de conduzir o roteiro, **sem** ser admin.
- **Chave do dispositivo.** O admin do Sirvo gera a chave uma vez, numa tela de
  configurações. O operador cola no Show. O Show troca a chave por uma sessão
  numa rota do Sirvo e repete a troca antes de a sessão vencer (~1 h; um culto
  de 2 h passa disso). Revogar = apagar a chave no Sirvo; a sessão já emitida
  morre em até 1 h.
- **O que a conta pode fazer é cercado no banco do Sirvo**, não só "por
  combinação": ela só chama as funções da lista (§5) e não lê tabela nenhuma
  direto, nem pelo tempo real. (Fizemos a mesma cerca para os agentes de IA que
  se conectam ao Sirvo.)
- **Sessão no processo principal do Electron**, guardada com `safeStorage`, e
  falando com o renderer por IPC. Isso é um padrão novo no repo — hoje o
  Firebase roda no renderer (`aliancaRemote.ts:74,113`) —, mas tem precedente:
  o REST do Planning Center roda no main (`Main.PCO_LIVE_GET`,
  `pcoLiveSync.ts:247`). O motivo: o renderer exibe texto de fora, e a chave
  não deve morar onde texto de fora é renderizado.
- **Tempo real por Broadcast.** Quando o `rev` de um culto muda, o banco
  publica num canal privado da igreja só "o culto X mudou, rev N". O Show busca
  o roteiro pela função. O evento é só um "vá buscar"; se se perder, a busca
  periódica e a reconexão pegam o atraso. Ninguém consegue publicar nesse canal
  além do próprio banco.
- **Indicador visível** "Sirvo: conectado / caído" no Show.

## 5. O contrato (proposta v0)

Funções novas que o Sirvo cria para o Show. Nomes e formatos são propostas —
se algo atrapalhar do seu lado, muda agora.

### 5.1 Ler

**`cultos_do_show()`** → os cultos que o Show pode abrir: o que está no ar e
os próximos.

```json
[{ "event_id": "uuid", "titulo": "Culto de Domingo",
   "comeca_em": "2026-11-08T13:00:00Z", "no_ar": false, "encerrado": false, "rev": 12 }]
```

**`roteiro_do_culto(p_event)`** → tudo que o Show precisa, **já calculado no
servidor**, para o Show não reescrever (e divergir de) a conta de horários do
Sirvo:

```json
{
  "event_id": "uuid",
  "rev": 42,
  "agora_servidor": "2026-11-08T13:41:07.120Z",
  "comeca_em": "2026-11-08T13:00:00Z",
  "iniciado_em": "2026-11-08T13:02:10.381522Z",
  "encerrado_em": null,
  "bloco_no_ar": "uuid-do-bloco",
  "fim_projetado": "2026-11-08T14:40:00Z",
  "desvio_min": 3,
  "blocos": [
    { "id": "uuid", "ordem": 0, "titulo": "Abertura", "tipo": "Abertura", "cor": "#C8A15A",
      "duracao_min": 5, "inicio_projetado": "…", "fim_projetado": "…",
      "concluido_em": "2026-11-08T13:08:40.120933Z",
      "responsavel": "Pr. João", "nota": "…", "link": "…",
      "itens": [ { "show_id": "id-da-musica-no-show", "ordem": 0 } ] }
  ],
  "mensagem_palco": { "texto": "Estende mais 5 min", "ate": "2026-11-08T13:46:00Z" },
  "mudancas": [ { "rev": 42, "tipo": "duracao", "bloco_id": "uuid", "bloco_titulo": "Palavra",
                  "antes": 35, "depois": 40, "autor": "Ana", "em": "…" } ]
}
```

- `bloco_no_ar` é `null` antes de iniciar e depois de encerrar. Ele é o
  primeiro bloco ainda não concluído; o início dele é o `concluido_em` do bloco
  anterior (ou `iniciado_em`, se for o primeiro).
- `agora_servidor` serve para corrigir o relógio do PC
  (`desvio = agora_servidor − agora_local`). O Sirvo web já faz isso desde 06/nov.
- **Carimbos são texto opaco.** `concluido_em` vem com microssegundos; o Show
  devolve exatamente a string que recebeu (não passa por `Date`).
- `mudancas` traz as últimas; o Show guarda a última `rev` que viu e mostra como
  aviso o que for mais novo.
- `itens` só existe a partir da fase das músicas (§8).

### 5.2 Escrever

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

Canal Broadcast privado `roteiro:<church_id>`, evento `mudou`, payload
`{ "event_id": "uuid", "rev": 43 }`. Nada de conteúdo no evento — só o aviso
para buscar. A sessão do Show precisa ser reaplicada ao canal a cada troca de
sessão.

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
- **`sectionsLocked`** trava todas as seções do projeto (nome, horário, notas,
  arrastar, "nova seção"), não os itens, e o operador desliga num botão. Serve
  de proteção contra engano, não de garantia — a garantia é o §2: o que vale é o
  Sirvo.
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
    um toque no celular feito antes da reescrita abriria o item errado — ver
    pergunta 5.
  - Trava "aplicando do Sirvo": mudança no store que a própria ponte causou
    nunca vira pedido de volta ao Sirvo (senão laço).
- **Item que o operador pôs à mão fica**, preso à seção anterior, e nunca vira
  pedido ao Sirvo. O Sirvo não apaga o que não criou.
- **Operador mexendo no Show** (± duração, arrastar bloco, avançar) vira
  chamada às funções do §5.2. O Show só muda a cópia dele quando a resposta (ou
  o Broadcast) chega.

## 7. Timer e Retorno

- **Timer do bloco:** recalculado a cada segundo a partir das âncoras do
  `roteiro_do_culto`, como o `pco_live` faz (`pcoLiveSync.ts`), mas aplicando o
  desvio do relógio (o `pco_live` usa `Date.now()` cru, `:140`). Com
  **overflow ligado** (opção que todo timer do Show já tem), o bloco que estoura
  aparece como `−1:23`, igual ao Sirvo. Um tipo novo (`sirvo_live`) precisa
  entrar em `Timers.svelte:27`, `timers.ts:101`, `timerTick.ts:240` e no
  `getCurrentTimerValue` do palco (`src/server/common/util/time.ts:77`) — ver
  pergunta 3.
- **Mensagem da produção** (`mensagem_palco`) vai para uma variável de texto,
  mostrada no palco pelo **item de variável** (que escapa o texto,
  `Variable.svelte:15`) — **nunca** por `{variable_…}` dentro de uma caixa de
  texto, que passa por `{@html}` (`Textbox.svelte:500`). Some no `ate`.
- O layout "Retorno" só é criado em instalação nova (`createData.ts:41`) e não
  tem timer nem mensagem: no PC da igreja ele precisa ser editado uma vez (ou a
  ponte cria o item ao conectar — pergunta 6).

## 8. Músicas

- **Primeiro, limpar a biblioteca com você.** Há duplicadas (parecem vir do
  import do ProPresenter). Sem isso, o seletor do Sirvo mostra três "Oceanos" e
  o problema da versão errada só muda de lugar.
- **Estender o catálogo que você já publica** (`publicarCatalogo`, hoje só
  `nome`), em vez de criar outro: id, nome, categoria, primeira linha da letra,
  artista/tom quando houver, data de modificação. O Show envia ao Sirvo por uma
  função `show_publicar_catalogo(p_itens)`.
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
- Guardar a sessão ou a chave no renderer ou em arquivo sem `safeStorage`.
- Mostrar texto vindo do Sirvo (nota, chat, nome de música, mensagem) por
  `{@html}` ou por `{variable_…}` em caixa de texto.

## 12. Fases — quem faz o quê

| Fase | Entrega | Sirvo | Show |
|---|---|---|---|
| **F1** ✅ | Operações por intenção, histórico, aviso de mudança, relógio do servidor | feito | — |
| **F0a** | Show conectado, **só leitura**: timer do bloco + mensagem no Retorno | conta do dispositivo, chave, cercas, `cultos_do_show`, `roteiro_do_culto`, Broadcast | sessão no main, timer, Retorno |
| **F0b** | Montar/atualizar o projeto a partir do roteiro (§6) | — | ponte |
| **F2** | Show edita: avançar, ±, reordenar, culto, Retorno | funções `show_*`, posse por culto | botões → funções |
| **F3** | Músicas | catálogo, músicas por bloco | limpeza da biblioteca, catálogo estendido, itens no projeto |
| **F4** | Chat no Show | chat para a conta do dispositivo | painel de chat |
| **F5** | Material pelo Sirvo | armazenamento + link temporário | download para a pasta do culto |

Cada fase é útil sozinha. A F0a já substitui o que fazíamos com o ProPresenter
(o timer do bloco no palco).

Como nas correções de segurança: a gente faz a parte do Sirvo, faz a do Show em
branch e manda PR para você revisar.

## 13. Perguntas para você

1. **Arquivo novo ou reaproveitar?** Propomos a ponte do Sirvo num arquivo novo
   (`aliancaSirvo.ts` + um módulo no main), ao lado do `aliancaControle`, sem
   mexer no Firebase. Faz sentido, ou prefere outro arranjo?
2. **Seções travadas só as do Sirvo.** Hoje `sectionsLocked` trava todas. Topa
   que o `isLocked` passe a olhar `data.sirvo`, para o operador continuar
   criando as dele?
3. **Timer:** tipo novo `sirvo_live` (toca os 4 lugares do §7) ou generalizar o
   `pco_live` (que hoje só liga com o Planning Center configurado,
   `pcoLiveSync.ts:68`)?
4. **Biblioteca:** as duplicadas vêm mesmo do import do ProPresenter? Quanto
   trabalho é limpar?
5. **Comando `abrir` do Remote:** dá para ele passar a mandar o id do item junto
   com o índice, e o Show conferir antes de abrir? Senão, um toque no celular no
   meio de uma reescrita abre o item errado.
6. **Retorno no PC da igreja:** você edita o layout uma vez à mão, ou prefere que
   a ponte crie os itens (timer + variável) ao conectar?
7. **Sessão no processo principal:** algum problema com o Broadcast e as
   chamadas rodando no main e falando com a tela por IPC?
