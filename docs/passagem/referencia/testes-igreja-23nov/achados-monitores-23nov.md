# Monitores na cabine — testes de 23/nov (sonda + app)

Sonda: `sonda.cjs` (eventos do Electron + WMI), log bruto em `eventos.jsonl`; posições das janelas do app em `janelas.jsonl`.

## Monitores (nome do aparelho → número do Electron)
| Monitor | Uso | Número | Resolução |
|---|---|---|---|
| E2241 | cabine (principal) | 3717067799 | 1920×1080 |
| T27C310 | retorno | 662987242 | 1920×1080 |
| NOVA HD CARD | LED | 2307139946 | 1024×768 |

## O que foi testado e o que aconteceu
| Ação | Número dos monitores | Posições | O app |
|---|---|---|---|
| Trocar a ordem no Windows (5 vezes) | **não mudou** | trocam de x | não acompanha: as janelas ficam nas coordenadas antigas; o Retorno passou a vazar do LED para o retorno |
| "Desconectar esta tela" (retorno) no Windows | o T27C310 some | **o Windows puxa o LED para o lugar dele** (x=3840 → 1920) | o Retorno foi parar **no monitor do LED** (relato do André) |
| Reconectar pelo Windows | **volta com o mesmo número** (662987242) | volta ao lugar | o Retorno voltou para a tela certa sem reiniciar (só porque as coordenadas voltaram a coincidir) |

## Conclusões
1. O número do Electron identifica bem o monitor: sobreviveu a 5 trocas de ordem e a desconectar/reconectar.
2. O que quebra é a saída guardar **coordenadas soltas da área de trabalho**: qualquer troca de ordem ou monitor desligado põe a janela no monitor errado (o Retorno em cima do LED; o LED em cima do retorno).
3. O AliançaShow numera as telas da esquerda para a direita; o Windows numera pela ordem de conexão (1 cabine, 2 retorno, 3 LED). O RustDesk segue a posição, como o AliançaShow. Os números nunca vão bater: o mapa precisa mostrar o **nome** do monitor.
4. O número velho do Retorno salvo em 22/11 (3010161637) **não foi reproduzido** com troca de ordem nem com desconectar. Candidatos ainda não testados: trocar o cabo de porta, mudar resolução, AMD Software, Win+P, reiniciar.

## Não testado (fica para outro dia)
Cabo físico, botão de energia do monitor, resolução do LED, AMD Software, Win+P, reinício.
