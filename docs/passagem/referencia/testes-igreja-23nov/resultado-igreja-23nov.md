# Teste no PC da igreja — 23/nov (feat/cabine-6, c182fe2, 1.8.0)

Máquina: Radeon RX 580 (driver 31.0.21925.1001), Node 24.19, Electron do clone.

## Monitores (escala do Windows)
| Monitor | Posição | Resolução | Escala |
|---|---|---|---|
| DISPLAY1 (principal) | 0,0 | 1920×1080 | 100% |
| DISPLAY2 (LED) | 1920,0 | 1024×768 | 100% |
| DISPLAY3 (retorno) | 2944,0 | 1920×1080 | 100% |

## POC do vídeo único (30 s medidos, 8 s de aquecimento)
| Variante | Decodificador % méd/máx | 3D % | CPU % (1 núcleo) | Quadros perdidos |
|---|---|---|---|---|
| a 4K (como o app faz hoje) | **96 / 100,5** | 20,3 | 38,6 | **263–280 de ~585 por janela (≈47%)** |
| b2 4K (vídeo único, copiado) | 36,5 / 48,7 | 6,2 | 19,1 | 0 |
| c 4K (espelho por captura) | 37,7 / 48,7 | 14,8 | 36,0 | 0 (OUT1 com 60 intervalos >50 ms) |
| a 1080 | 61,8 / 99,8 | 7,6 | 29,1 | 0 (≈25 intervalos >50 ms por janela; atraso de até 16 quadros entre janelas) |
| b2 1080 | 15,3 / 33,2 | 4,6 | 17,9 | 0 |
| b3 4K (motor de produção, arquivo) | 29,4 / 33,8 | 7,1 | 18,8 | 0 de 900 (draw 0,12 ms; 0 longtasks) |

Leitura:
- `a:4k` reproduz o travamento do culto: o decodificador satura (~100%) e cada janela perde quase metade dos quadros.
- `b2`/`b3` no 4K: 0 perdidos, decodificador entre 30 e 37%, CPU pela metade. **Na RX 580 o motor de vídeo único vale a pena.**
- No `a:1080` não se perdem quadros, mas o decodificador chega a 99,8% de pico e as janelas ficam até 16 quadros (~0,5 s) fora de sincronia entre si. No b2 o atraso fica em 0–1 quadro.
- b3: a captura funciona na janela visível, oculta e fora da tela; a janela do LED nasce 896×320 sempre no topo. A tabela "Queda" saiu vazia (este run não incluiu `test=crash`).

Arquivos brutos: `poc-results\` (JSONs e capturas do b3).

## Fumaças (perfil de prova C:\prova-perfil)
14 de 15 OK: vivo, t2, t4, t6, t7-menus, t8, t9, t9-palco, t10, t12, t13, t14, t15, t16 (passo 1).
t11: só o A6c falha (já conhecido: com ARA e NVI instaladas, espera 1 versículo e vem 2; o defeito é do teste).
ANCORA: ok. Dados reais intactos (hash antes/depois).
