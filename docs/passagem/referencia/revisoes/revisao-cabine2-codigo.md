# Revisão cética — PR #40 `feat/cabine-2` (base `feat/cabine-1a`), cabeça `23ee6c5`

Revisão só de leitura (git). **Não rodei** vitest, svelte-check, a âncora nem as fumaças: tudo abaixo vem da leitura do código e dos roteiros de teste. O que é do 1b (Stagebox, Textbox, MensagemPalco, âncora) entrou por merge e ficou fora desta revisão.

## Veredito

**Não instalar na cabine antes de corrigir 1, 2, 3 e 4.** O caminho mais perigoso (clique em mídia, clique duplo, reinício de vídeo, saída travada, arquivo sumido) está bem feito e bem provado na t12 (tempo do vídeo medido antes e depois). Os problemas estão em volta dele: a tarja do só retorno pode dizer a coisa errada e dar alarme falso, o Ctrl+K passou a depender de todas as Bíblias carregarem, e a árvore C6 deixou sub-abas sem lugar e sem aviso. O `index.html` é gambiarra de teste indo para produção (inclusive para a janela de saída).

## Achados

### 1. ALTA — a tarja de recusa mostra o tipo da PRIMEIRA recusa da sessão, não o da atual
- `src/frontend/components/main/AliancaNoAr.svelte:32-35` lê `aviso.mensagem`; `src/frontend/utils/aliancaFalha.ts:44` só soma `vezes` e mantém a mensagem antiga (`{ ...novo[i], vezes: +1 }`).
- Cenário: só retorno ligado; às 19h10 alguém clica num vídeo ("Não foi ao ar: mídia"). Às 19h40 clica num áudio: a tarja pisca e diz de novo "Não foi ao ar: **mídia**". O board promete "outra recusa troca o nome"; aqui nunca troca.
- A t12 não vê: chama `recusarNoModo("mídia")` uma vez só (`t12-cabine2.mjs:115`).
- Correção (sem tocar o fecho): quem manda ao ar na janela principal (MediaCard, ▶, Spotlight) grava "última tentativa" (nome + tipo) num store da janela principal antes de chamar `setOutput`; a recusa é síncrona, então a tarja casa "contador subiu" com essa tentativa. Isso também entrega o **nome do item** do board. Se não der, a tarja deve dizer só "Não foi ao ar" (sem tipo) — nunca um tipo possivelmente errado. Teste: duas recusas de tipos diferentes, a segunda tem de mostrar o segundo.

### 2. MÉDIA — alarme falso de recusa ao voltar para Mostrar
- `AliancaNoAr.svelte:30-38`: `vistas` nasce 0 a cada montagem; `falhas` nunca esvazia; `AliancaTela.svelte:133` desmonta o NoAr em Editar.
- Cenário: só retorno ligado, houve uma recusa há 20 min. Operador vai a Editar e volta: a tarja pisca e mostra "Não foi ao ar: mídia" por 5 s sem ninguém ter clicado em nada.
- Correção: `vistas` começa com o contador atual (`get(falhas)…vezes ?? 0`) na montagem. Teste de fumaça: recusa → Editar → Mostrar → tarja segue "SÓ RETORNO".
- Derivado: com o NoAr desmontado (Editar) uma recusa não aparece em lugar nenhum, porque `FaixaDeFalha.svelte:7` agora a filtra. Conferir se algum caminho manda ao ar a partir de Editar; se houver, é recusa calada.

### 3. MÉDIA — D1: o Ctrl+K inteiro espera TODAS as Bíblias, e o teste não prova o texto que foi ao ar
- `src/frontend/utils/aliancaSpotlight.ts:199` (`Promise.all` sem prazo) + `AliancaSpotlight.svelte:134` (a primeira pintura — versículo, músicas e ações — faz `await buscarVersiculo`).
- Cenário A: 3 Bíblias .fsb de vários MB; primeira busca "Sl 23" do culto: nada pinta (nem as músicas) até as 3 abrirem. Antes abria 1. Cenário B: uma entrada de Bíblia por API/coleção que não responde sem internet → a seção fica presa.
- Cenário C (não provado): ↓ + Enter na 2ª Bíblia troca a aba e pede "tocar" em seguida (`irParaOVersiculo`, :215-222); o `Scripture.svelte` troca de Bíblia com `setTimeout(10)` + carga e abre a referência com `setTimeout(200)`. A t12 só confere `activeSubTab === "ara"` (`t12-cabine2.mjs:242`), **não** que o texto no telão é o da ARA. As Bíblias do teste têm ~500 bytes; as reais não.
- Correção: resolver a Bíblia em uso primeiro e pintar; as outras entram depois, cada uma com prazo (~1,5 s → linha "não carregou"). Na t12, afirmar o texto do slide que foi ao ar ("de tal maneira") e repetir com um .fsb de tamanho real.
- 0 Bíblias (aviso alto) e 1 Bíblia (igual a antes): corretos pela leitura.

### 4. MÉDIA — `public/index.html:20-23`: gambiarra de teste em produção
- `src/electron/index.ts:249` carrega `public/index.html` em produção, e é o mesmo HTML de todas as janelas (principal, **saída**, exportação). O próprio comentário diz "(dev)".
- Dano funcional pequeno (buffer de 4000 entradas), mas é andaime da prova dentro do que a janela de saída carrega, entrou num commit de "fix de fumaça" e muda o HTML sem aprovação.
- Correção: tirar do HTML; a prova injeta por CDP (`Page.addScriptToEvaluateOnNewDocument` antes do reload) ou deixa de depender do resource timing em `lib.mjs:16`.

### 5. MÉDIA — C6: sub-aba vazia ou inválida cai na PRIMEIRA categoria/pasta, não em "tudo"
- `src/frontend/components/drawer/navigation/NavigationSections.svelte:26-29`: com `active` vazio (ou apontando para categoria apagada) escolhe `flat[0]`. Antes `flat[0]` era "Tudo"; agora (`ShowsTabs.svelte` seções só com categorias, `MediaTabs.svelte` só com pastas) é a primeira categoria em ordem alfabética.
- Cenário: perfil novo/máquina nova, ou o operador apaga a categoria que estava aberta → a lista de Shows fica filtrada numa categoria sem ninguém ter pedido; música "sumiu".
- Correção: prop de padrão (`"all"`) para Shows e Mídia; teste de lógica com sub-aba vazia e com categoria apagada.

### 6. MÉDIA — C6: Modelos e Calendário perderam as sub-abas sem aviso e podem ficar presos
- `AliancaArvore.svelte:85` só mostra sub-abas de Funções e Sobreposições; `aliancaArvoreLogica.ts:57-62` só saneia `templates/unlabeled` e `media/pasta:raiz`.
- Cenário: quem salvou Modelos numa categoria, ou Calendário em "Agendar ação", abre a versão nova com a lista filtrada e **nenhum** controle para sair. Somem também "Nova categoria" de modelos e "Importar calendário". Fere a regra "o que não tem lugar quebra alto".
- Correção mínima: sanear na carga `templates → all` e `calendar → event` para qualquer sub-aba sem linha. O resto é pergunta ao dono (abaixo).
- O comentário de `AliancaArvore.svelte:21` ("Efeitos de Sobreposições vira all") está velho: o código não faz isso.

### 7. BAIXA — trava GLOBAL de clique repetido foi de 400 para 700 ms
- `src/frontend/utils/aliancaToqueLogica.ts:10`. A decisão 1 pede 0,7 s para o clique em vídeo já no ar; a B1 dizia "manter a trava de 400 ms". A constante global vale para slides, versículos, roteiro e botões das regiões em Mostrar. O cartão já tem a trava própria (`TRAVA_CARTAO_MS`). Mudança de contrato além do pedido → pergunta ao dono.

### 8. BAIXA — a pilha de transporte só reserva o 1º cartão
- `AliancaTransporte.svelte:138-139, 207-214`. Spotify tocando (60 px) + vídeo entra → 124 px: Outras telas, Mensagem pro palco (botão Enviar) e chat descem 64 px no meio do culto. Temporizador (36 px) + vídeo: 40 px. O board aceita a pilha crescer; registro porque o critério "nada se desloca" da C3 não vale aqui.

### 9. BAIXA — o estado visual "trava" quase nunca aparece e engana na recusa
- `aliancaMidiaCartaoLogica.ts:30-35` ("ar" vence "trava") + `MediaCard.svelte:192`. No clique que vai ao ar o cartão já vira "ar"; a barra enchendo do board só aparece quando o envio **não** foi ao ar (só retorno recusou), justamente sugerindo "valeu".
- Correção: armar a trava só depois de saber que não houve recusa, ou mostrar a barra também no estado "ar".

### 10. BAIXA — modo lista não tem zona segura
- `MediaCard.svelte:161-173, 327`: fora da grade o clique em qualquer ponto da linha (inclusive o nome) manda ao ar em Mostrar. O board só desenhou a grade.

### 11. BAIXA — Ctrl+↑/↓ com duas árvores montadas
- `NavigationSections.svelte:50-71`: com Áudio aberto há dois `NavigationSections` (Mídia e Áudio) ouvindo a janela; o de Mídia (ativo `__fora__`) grava o id de uma pasta de mídia como sub-aba de **áudio** (`setSubTab` usa `$activeDrawerTab`). O de Áudio corrige em seguida; fica um pisca. Correção: o de Mídia ignora teclado quando `active === "__fora__"`.

### 12. BAIXA — itens do board não feitos e não declarados
- "↻" ao lado da duração em vídeo em repetição (C1) não existe em `MediaCard.svelte`.
- Contador na raiz Mídia (declarado só em parte).
- Timers de `MediaCard.svelte:63-69, 181-184` sem `onDestroy` (inofensivo em Svelte 3; limpar por higiene). NoAr, Transporte e TransporteVideo limpam certo.

### 13. Testes
- Provam de verdade: t12 C1 (2º clique em 150 ms não reinicia, clique após a trava reinicia, medido por `currentTime`), ＋ de 38 px, C3 posições nos 3 estados, C5 teclado.
- Fracos/tautológicos: `t12-cabine2.mjs:171` ("Entradas… filtro de tipo") afirma só que existe algum botão na biblioteca — passa sempre; `t7-menus.mjs:178` D2c virou "continua no ar" (um no-op passa; a t12 cobre); `aliancaMidiaCartaoLogica.test.ts:55-58` e `aliancaTarjaLogica.test.ts:12-14` conferem constantes contra elas mesmas.
- Mudanças de contrato nas fumaças (t7 D2c, t9 E, t10 A): todas justificadas pelas decisões de 18/nov. Faltam: recusa por clique real com 2 tipos (achado 1), remontagem (2), texto no ar na 2ª Bíblia (3), sub-aba vazia (5).

## Desvios declarados pelo executor

| Desvio | Julgamento |
|---|---|
| C3 mostra o TIPO, não o nome | **Corrigir** — dá para ter o nome sem tocar `setOutput` (achado 1); e hoje nem o tipo é confiável |
| C1 imagem já no ar não faz nada | **Aceitável** (nunca limpa; coerente com a decisão 1) |
| C2 "nada tocando" reservando 60 px | **Aceitável**, avisar o dono do custo fixo de 60 px e do achado 8 |
| Spotify sem volume | **Perguntar** (o board põe volume na linha 2; `setVolume` existe no SpotifyManager, é barato) |
| C6 só Shows com contador; Funções/Sobreposições com sub-abas | Contador: **corrigir depois** (board diz "sempre"). Sub-abas: **aceitável e necessário**, mas deixa Modelos/Calendário incoerentes (achado 6) → **perguntar** |
| C5 ícones do app | **Aceitável** |

## Perguntar ao dono

1. Recusa na tarja: aprova gravar o nome do item pelo lado da janela principal (sem tocar o fecho)? Se preferir mexer no fecho (`falhaAlta` atualizar a mensagem / `setOutput` passar o nome), precisa de exceção na âncora.
2. Trava global de 700 ms para tudo em Mostrar (slides, versículos, roteiro), ou 700 só no cartão de mídia e 400 no resto, como estava na B1?
3. Modelos e Calendário: mostram as sub-abas quando abertos (como Funções/Sobreposições) ou as categorias de modelo, "Agendar ação" e "Importar calendário" saem de vez?
4. Ctrl+K: escolher a outra Bíblia com ↓ passa a ser a "em uso" (a próxima busca abre nela com Enter direto). É isso, ou a preferida é fixa?
5. Pilha de transporte: aceita que o 2º cartão empurre Mensagem pro palco e chat 64 px, ou reserva mais altura?
6. Spotify: quer volume no cartão?
7. Modo lista da mídia: clique na linha inteira vai ao ar em Mostrar — mantém, ou o modo lista sai?
