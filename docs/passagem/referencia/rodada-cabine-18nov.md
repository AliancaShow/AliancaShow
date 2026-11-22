# Rodada da cabine — 18/nov (1º teste do instalador fatias 1–9, `2d62837`, na máquina da igreja)

Prints do André: `C:\Users\andre.zagato\AppData\Local\Temp\claude\a6bb97b8981c65a0\b73d947e-f26f-4ce0-979e-1c4e061fe267\images\` (9–19.png).

OK: abertura sem scroll (1), topo/mouse (2), telão após ajuste em Configurações (3), setas só no retorno (8), desligar só retorno (10), Esc/X (13), pílula (14), Configurações tem Salvar/Fechar (16), larguras persistem (17), Spotify funciona (18).

## A — defeitos (consertar já)
- A1 (4) Saída NDI nova não vira aba na 2ª tela abaixo do No ar. Toda saída habilitada (telão, NDI, retorno…) tem que aparecer como aba.
- A2 (6) Mensagem pro palco: chega no Sirvo (régia mostra), mas NÃO aparece em nenhum layout de palco do Show — nem com o item "Mensagem palco" adicionado ao template. A mensagem do Sirvo tem que alimentar o item de mensagem do layout de palco (o mesmo que o FreeShow usa).
- A3 (6) Ao Enviar, o texto some do campo e vira "no palco 'teste'" escondido embaixo. Quer: o texto FICA no campo, destacado como "no palco · 2:41", até expirar ou Limpar.
- A4 (7) Só retorno ligado: no template PALAVRA o retorno mostra a própria tela de retorno dentro dela (recursão — item "saída atual" apontando para o retorno; era o R7) e o texto não aparece. Item "saída atual"/"texto do slide" no retorno tem que mostrar o que o modo mandou.
- A5 (7) Pré-visualização do layout de palco na aba Retorno (abaixo do No ar) calcula o tamanho do texto desproporcional (img 17 vs 18: no retorno real fica certo). A miniatura tem que escalar como a saída real.
- A6 (11) Ctrl+K não lista versículo (música funciona). Descobrir por quê (Bíblia não importada? só busca na Bíblia "ativa"? perfil da igreja) — se for falta de Bíblia, a busca tem que dizer isso alto ("nenhuma Bíblia instalada"), não ficar calada.
- A7 (15) O vídeo continua tocando na área central (prévia do item aberto) depois de parado no ar. A área central NUNCA toca vídeo: mostra quadro parado (thumb) — só a saída toca.
- A8 (20) Seletor de dia mostra só 1 culto; Configurações › Sirvo lista os próximos cultos. O seletor tem que listar os mesmos.
- A9 (img 12) "Falha interna do AliançaShow: editar-tipo-desconhecido" ao abrir Configurações a partir do Editar (mais de 1×).
- A10 (img 16) Cabeçalho sobreposto no Preparar/biblioteca: "AO VIVO · telão no ar", "BIBLIOTECA", "ROTEIRO 1 item", "Todos/Sex 13/nov", "+ Adicionar ao roteiro" empilhados uns sobre os outros (apareceu depois de Configurações a partir do Editar).
- A11 (19) Tirar "Mostrar agora (sem pôr no roteiro)" do menu de mídia — o ▶ já faz isso.

## B — decisões de comportamento do André (aplicar)
- B1 (12) Mídia (vídeo/imagem): CLIQUE SIMPLES manda ao ar (como no ProPresenter). Manter a trava de clique repetido <400 ms (não dispara 2×). Shows/letras continuam como estão.
- B2 (9) Recusa do só retorno: hoje toast no canto, "disfarçado". Vai para o CENTRO-TOPO, logo abaixo de Mostrar/Editar, visível.
- B3 (18) Spotify: botão de fade vira ícone de crossfade (duas setas cruzadas) e fica SEMPRE visível (ou em posição fixa) — hoje aparece no play e empurra os 3 controles.
- B4 (5) "(Primária)" na faixa: é o nome da saída que a faixa controla quando há >1 saída. Renomear/explicar ou esconder quando óbvio.

## C — desenho (protótipo antes do código, para o André aprovar)
- C1 (12, img 9) Grade de mídia: gap entre cartões; cartão = thumb + nome ABAIXO dentro do cartão + engrenagem alinhada ao nome; ＋ roteiro como botão no canto inferior DENTRO do thumb; duração do vídeo em overlay no canto superior do thumb.
- C2 (5, img 10) Faixa de transporte do No ar: espremida. Redesenhar com respiro (talvez 2 linhas, ou cartão por mídia tocando com nome + botões).
- C3 (9, img 19) Faixa "SÓ RETORNO" no topo da coluna: feia, texto demais, aglomerado. Redesenhar enxuta.
- C4 (16) Configurações e propriedades do Editar ainda no visual antigo do FreeShow (fontes, botões, cores) — "feio de doer". Levar para o tema Luz.
- C5 (img 11) Menu "＋ adicionar item" do Editar (Caixa de texto/Mídia/Câmera/Temporizador/Relógio/Mais) parece do modo antigo. Redesenhar no Luz.

## Decisões do André sobre o board (18/nov, v2 de https://claude.ai/artifact/2Er51qSDCojmDDeXu2PYjf — `leiaute-v2-prototipos\Rodada-cabine-C1-C5.html`)
APROVADAS para código: C1, C2 (v2 compacta, 60 px), C3 (tarja única no lugar do cabeçalho; recusa na própria tarja), C4, C5 (opção A), C6.
1. Clique em vídeo JÁ no ar: REINICIA, mas com trava — um 2º clique em até 0,7 s é ignorado (anti duplo-clique).
2. Crossfade: trocar pelas duas rampas cruzadas sem seta (`i-xf2` do board).
3. "Ferramentas" (Modelos, Funções, Calendário) aprovado, nome serve.
4. Sobreposições vai para DENTRO de Ferramentas (o povo não usa no começo; repensar se crescer). → raízes: Shows, Mídia, Bíblia, Ferramentas.
5. "Sem etiqueta" → filtro "Sem categoria · N" no cabeçalho da lista.
6. Entradas = 1 linha só, com filtro de tipo na lista.
7. "Online" (YouTube/Vimeo) entra DENTRO de Mídia.
B2 (recusa no centro-topo) foi SUBSTITUÍDO pela C3: recusa aparece na tarja. B3/B4 cobertos pela C2.

## Pedido extra (18/nov, depois do teste da Bíblia na cabine — funcionou com os .fsb)
- D1 Ctrl+K, versículo: listar 1 resultado POR BÍBLIA INSTALADA (ex.: Rm 8:28 NVI e Rm 8:28 ARA), com trecho do texto. O 1º é a Bíblia em uso/preferida (Enter direto continua igual); ↓ ou clique escolhe a outra.
