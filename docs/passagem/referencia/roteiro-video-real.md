# Roteiro do teste real do vídeo — na cabine (24/nov)

O teste de 23/nov mediu o **POC** (programinha de prova com vídeos gerados). Este mede o **AliançaShow de verdade** (com a fatia A: prévias por captura, cartão no centro) tocando os **vídeos do acervo** nas saídas reais da cabine. O número decide se o motor de vídeo único (F2/F3 em `desenho-motor-de-saida.md`) ainda é preciso.

Tempo: ~15 min, **sem culto**. O vídeo aparece no **Painel LED** e nas saídas NDI enquanto mede (60 s por cena) e some sozinho no fim de cada cena.

## Antes
1. Feche o AliançaShow instalado, o ProPresenter e o OBS (distorcem a medição do decodificador). Se o OBS precisar ficar aberto para ver o NDI, anote.
2. Abra o app de dev **no perfil de teste** (nunca os dados da igreja): `bash /c/perfil-teste-igreja/abrir-dev.sh` e espere a janela.
3. No app: Visual valendo como no culto, saídas ligadas (Painel LED, Retorno, NDI). Nada no ar.

## Cenas (PowerShell, na pasta `C:\AliancaShow-dev`)
Cada linha é uma cena de 60 s. Rodar uma de cada vez; não mexer no mouse durante a medição.

```
node scripts/prova-culto/medir-video.mjs --rotulo fundo-1080 --video "C:\Users\midias alianca\Documents\ACERVO ALIANCA\01 FUNDOS\Agape 2021\bg004.mp4"
node scripts/prova-culto/medir-video.mjs --rotulo fundo-1080-letra --letra --video "C:\Users\midias alianca\Documents\ACERVO ALIANCA\01 FUNDOS\Agape 2021\bg004.mp4"
node scripts/prova-culto/medir-video.mjs --rotulo contagem-led --video "C:\Users\midias alianca\Documents\ACERVO ALIANCA\02 ABERTURAS E CONTADORES\CONTAGEM TELAO_V1.mp4"
node scripts/prova-culto/medir-video.mjs --rotulo estresse-4k --video "C:\AliancaShow-dev\scripts\poc-video-unico\media\test_4k.mp4"
node scripts/prova-culto/medir-video.mjs --rotulo estresse-4k-letra --letra --video "C:\AliancaShow-dev\scripts\poc-video-unico\media\test_4k.mp4"
```

- `--letra`: troca o slide de uma música do roteiro a cada 3 s durante o vídeo (a disputa que o POC b3 apontou).
- Os vídeos do acervo já estão em 1080p ou menos (conferido com ffprobe em 24/nov). O 4K é o arquivo de estresse do POC: mostra a folga.
- Resultados em `resultados-video\<rotulo>.json`.

## O que olhar
Cada cena imprime, por saída: quadros, **perdidos (%)**, intervalo entre quadros e desvio, "travadas" (quadro que demorou 2,5× o normal); e a placa: **decodificador %** só do app e de todos os programas.

| Passa | Atenção | Reprova |
|---|---|---|
| ≤ 1% perdido em todas as saídas, decodificador < 70% | 1–5% perdido ou decodificador 70–90% | > 5% perdido, ou decodificador ≥ 90% |

- **Saídas NDI são janelas invisíveis:** o Windows segura o relógio de quadros delas, então intervalo/desvio/travadas ali não valem; vale o **perdidos**.
- "janela principal: 0 vídeo(s) decodificando arquivo" é o esperado (as prévias vêm por captura da janela do telão).
- Cada saída com vídeo decodifica o arquivo uma vez (hoje 2: Painel LED e NDI-FullScreen; a NDI-Alpha não mostra fundo). O motor de vídeo único levaria isso a 1.

## Depois
Guarde a pasta `resultados-video\` (ou mande os JSON aqui). Com os números: se tudo passa em 1080p, o motor vira melhoria e não urgência; se o 1080 com letra já perde quadros, o motor sobe de prioridade.
