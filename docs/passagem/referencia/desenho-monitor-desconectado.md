# Desenho: saída presa ao monitor e "monitor desconectado" (cabine 6, 23/nov)

Aprovo do André: **"aprovo monitor-desconectado"** (23/nov, PC da igreja). Achados que motivam: `testes-igreja-23nov/achados-monitores-23nov.md`.

## Problema
A saída com janela guarda **coordenadas soltas da área de trabalho** (`bounds`) e, às vezes, o número do monitor (`screen`).
- Trocar a ordem dos monitores no Windows muda as coordenadas, e a janela fica no lugar antigo, ou seja, em cima de outro monitor. Visto: o Retorno vazando do LED para o retorno; o LED em cima do canto do retorno.
- Desconectar um monitor faz o Windows puxar os outros para o lugar dele. A janela da saída cai no monitor vizinho. Visto: o Retorno foi para o monitor do LED.
- Com `screen` salvo e inexistente (o 3010161637 do Retorno), `resolveOutputBounds` cai nas coordenadas soltas, sem avisar.

Os testes mostraram que **o número do Electron (`Display.id`) é estável**: 5 trocas de ordem e desconectar/reconectar não o mudaram.

## Regra nova
1. Toda saída com janela (não `invisible`) pode ter `aliancaMonitor = { id, nome, dx, dy }`: o monitor (número do Electron e nome do aparelho, só para mostrar) e a posição da janela **dentro** dele. O tamanho continua em `bounds.width/height`.
2. Abrir/reposicionar (processo principal, `resolveOutputBounds`):
   - com `aliancaMonitor` e o monitor ligado: `x = monitor.x + dx`, `y = monitor.y + dy`, tamanho de `bounds`. Trocar a ordem no Windows não tira mais a janela do monitor.
   - com `aliancaMonitor` e o monitor **não** ligado: **DESCONECTADO**.
   - sem `aliancaMonitor`, com `screen` salvo e ligado: como hoje (a janela ocupa o monitor inteiro).
   - sem `aliancaMonitor`, com `screen` salvo e **não** ligado: **DESCONECTADO** (hoje cai calado nas coordenadas soltas).
   - sem `aliancaMonitor` e sem `screen` (o LED antigo, configs velhas): como hoje, mais um **aviso laranja fixo** "Painel LED: escolha o monitor desta saída em Configurações › Saídas". Não dá para adivinhar o monitor de uma config antiga sem risco.
3. DESCONECTADO: a janela **não abre** (ou é escondida, se estava aberta), **nada da configuração é mudado** e aparece o **aviso vermelho fixo** "Retorno: monitor T27C310 desconectado". A saída continua ligada (o estado do botão do telão não muda).
4. Quando o Windows anuncia monitor ligado/mudado (`display-added`/`display-metrics-changed`, que já chamam `restoreAllOutputBounds`), quem estava DESCONECTADO e agora resolve **volta sozinho**: reaparece no lugar e o aviso vira "Retorno: monitor T27C310 de volta" (some em 5 s). Pedido do André: "fica aguardando voltar".
5. Quem grava `aliancaMonitor` é a **janela principal**, só em **gesto do operador**:
   - mapa das telas (`AliancaMapaTelas.svelte`): escolheu a tela, então `{ id: tela.id, nome: tela.label, dx: 0, dy: 0 }`;
   - mudança de `bounds` de uma saída com janela vinda do operador (popup "Tela de saída", valores à mão, arrastar a janela): um vigia novo (`aliancaMonitorVigia.ts`, fora do fecho) lê as telas na hora (`GET_DISPLAYS`), acha o monitor que contém o **canto superior esquerdo** da janela e grava `{ id, nome, dx, dy }`;
   - **nunca na partida** nem a partir de MOVE vindo do processo principal por reposicionamento automático. Senão o vigia "carimbaria" o monitor errado de uma config antiga (o LED em cima do retorno).
6. O mapa mostra o **nome** de cada monitor abaixo do número, e uma saída com `aliancaMonitor` ocupa a tela do monitor dela mesmo sem cobrir a tela toda (o LED 896×320 deixa de aparecer como "2 Livre"). Uma saída DESCONECTADA aparece na lista "Todas as saídas" como "monitor desconectado".

## Onde muda
| Arquivo | Fecho? | O quê |
|---|---|---|
| `src/electron/output/helpers/OutputVisibility.ts` | **sim (aprovado)** | `resolveOutputBounds` usa a lógica nova e devolve `null` para DESCONECTADO; `toggleOutput` não mostra a janela e avisa |
| `src/electron/output/aliancaMonitorLogica.ts` (novo) | entra no fecho (novo) | função pura `resolverMonitor(saida, telas)`, com testes |
| `src/electron/output/aliancaMonitorSaida.ts` (novo) | entra no fecho (novo) | registro por saída, estado DESCONECTADO, escutadores de monitor próprios, canais |
| `src/types/aliancaMonitorCanais.ts` (novo) | entra no fecho (novo) | canal `ALIANCA_MONITOR_SAIDA` e tipo do aviso |
| `src/frontend/utils/aliancaMonitorVigia.ts` (novo) | não | grava `aliancaMonitor` nos gestos do operador; liga o canal aos avisos |
| `src/frontend/components/settings/AliancaMapaTelas.svelte` | não | grava `aliancaMonitor` ao escolher a tela; mostra o nome |
| `src/frontend/utils/aliancaSaidasLogica.ts` | não | ocupação pelo `aliancaMonitor`; resumo "monitor desconectado" |

O tipo `Output` (`src/types/Output.ts`, fecho) **não** muda: o campo é lido com um tipo local.

## Testes
- vitest de `resolverMonitor`: os 5 casos da regra 2, troca de ordem, monitor sumido e de volta, DPI (escala 1 aqui; `dx/dy` em pixels lógicos, como `bounds`).
- vitest do vigia: carimba só em gesto do operador; nunca na partida; nunca em MOVE automático.
- fumaça t13 com telas reais: escolher o monitor no mapa, trocar a ordem no Windows, desconectar/reconectar (o André faz os gestos).
- `ANCORA: ok` com as exceções registradas; Prova do Culto 0 divergência em outputs.

## Revisão cética (23/nov) e o que mudou no desenho
Revisor independente, lendo o código. Achados e decisões:
1. **Bloqueio: o processo principal não sabia da escolha nova.** Ele guarda uma cópia da saída feita na criação da janela (`OutputLifecycle.ts:88`), e `UPDATE_BOUNDS` não atualiza `screen` nem `aliancaMonitor`. → `aliancaMonitorSaida.ts` mantém um **registro por saída** (screen, aliancaMonitor, tamanho, ligada). Ele é preenchido por `toggleOutput` e pela janela principal pelo canal `ALIANCA_MONITOR_REGISTRO`, a cada mudança. `resolveOutputBounds` lê o registro.
2. **Bloqueio: nada reabria a janela depois de escolher o monitor de novo.** → Chegou registro novo: reavalia aquela saída na hora (mostra ou esconde).
3. **Bloqueio: DESCONECTADO não pode desligar o botão.** → `toggleOutput` ganha um ramo próprio antes do de hoje: esconde, avisa e devolve `true`, inclusive com `force`/`boundsLocked`. Desligar a saída limpa o "ligada" do registro, para não voltar sozinha uma saída desligada.
4. **Conflito `screen` × `aliancaMonitor`.** → Regra simplificada pelo próprio código: `screen` salvo = **monitor inteiro** (o mapa e "Tela de saída" gravam o `screen`); `screen` vazio + `aliancaMonitor` = **janela de tamanho próprio dentro do monitor** (o popup de valores à mão apaga o `screen`, `ChangeOutputValues.svelte:40`). O `screen` sempre manda; não há preferência calada.
5. **`OutputLifecycle.ts` não precisa mudar.** As janelas nascem escondidas. `resolveOutputBounds` continua devolvendo um retângulo; para DESCONECTADO devolve os limites atuais, sem mover. Mostrar e esconder ficam em `toggleOutput` e nos escutadores de monitor próprios do módulo novo, que escondem na hora no `display-removed`. **Fecho alterado: só `OutputVisibility.ts`, mais arquivos novos.**
6. **Gesto do operador × reposição automática.** A reposição automática não manda MOVE (`restoreAllOutputBounds` não chama `toApp`). O vigia ignora a carga inicial e trocas de perfil, só carimba quando os limites de uma saída que já existia mudam, espera 600 ms (o popup grava a cada tecla) e, se o canto da janela não cai em monitor nenhum, não carimba e avisa.
7. **Na próxima abertura o Retorno vai aparecer DESCONECTADO** (screen 3010161637 inexistente) até ser escolhido no mapa. Isso é esperado e foi combinado com o André. Antes de instalar, escolher o Retorno no mapa.
8. **O "Desfazer" do mapa** também guarda e restaura o `aliancaMonitor`.
9. Escala diferente da gravada: aviso. Usa-se o canto superior esquerdo (documentado).
10. Prévia/espelho de uma saída DESCONECTADA mostra "desligada". Fica anotado; o aviso vermelho diz o motivo.
