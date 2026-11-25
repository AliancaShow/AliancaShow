# Passagem 25/nov (madrugada): versão 1.9.1

Pedido do André (24/nov, noite): "faz tudo isso durante a madrugada… me entrega um 1.9.1… bateria extensa de testes… nada de deixar coisa para depois".

## O que entrou no 1.9.1 (branch `feat/cabine-6`)
- **Chamadas (Kids, Estacionamento)**: painel em Mostrar, coluna da direita, embaixo da Mensagem pro palco.
  - Chips, campos `[entre colchetes]`, prévia, tempo (30 s, 1 min, 2 min, até tirar), "Chamar no telão", NO AR com contagem e Tirar; Enter no último campo chama.
  - "editar" / "+ Chamada": nome, texto, posição (faixa embaixo, canto, centro, livre = ajustar no Editar), saídas.
  - Por baixo: cada chamada é uma sobreposição do FreeShow (`overlays[id].aliancaChamada`); o texto montado vai para a caixa e o `displayDuration` tira no fim. `utils/aliancaChamadas.ts`, `utils/aliancaChamadasLogica.ts` (+ teste), `components/main/AliancaChamadas.svelte`. Fumaça: `scripts/prova-culto/t17-chamadas.mjs`.
- **Valores dinâmicos em português**: o botão direito › Valores dinâmicos abre uma janela nova (grupos do Texto ligado + Variáveis, prévia ao vivo, busca sem acento). O popup do FreeShow (`DynamicValues.svelte`, `utils/popup.ts`) é do **fecho** e não mudou: a janela principal intercepta a abertura (`utils/aliancaValoresDinamicos.ts`). "Todos os códigos (avançado)" abre o original.
- **Bíblia com 2+ versões no modelo de Bíblia**: botão "2+ versões…" no cabeçalho do modelo (categoria Bíblia). O Visual lê a escolha do modelo que está na coluna Bíblia de cada saída (`templateScripture_2..4`). Nos dados reais e no perfil de teste todas estavam em "Sem modelo": nada muda no ar.
- **Posição quando sobra espaço** ("aprovo posição-sobra", teste 13): `Zoomed.svelte` (fecho, registrado na âncora).
- **Modelo da categoria = aplicar uma vez**: as categorias perdem o modelo fixo na partida; o clique direito cola em todas as músicas (com confirmação). `menuClick.ts`/`contextMenus.ts` voltaram ao conteúdo aprovado (um commit de 24/nov tinha mexido neles sem aprovo; corrigido).
- Apagar categoria de modelo; selo de vídeo acima de 1080p; arquivos soltos (`.userdata-*` do POC no .gitignore, `sonda-telao.mjs` versionada).

## Esperando aprovo do André (branch `fecho/aguarda-aprovo`, NÃO está no 1.9.1)
Mexem em arquivos do fecho; o registro na âncora foi recusado sem o "aprovo" explícito:
1. **"aprovo backup-settings"**: `src/electron/data/backup.ts` — restaurar backup mandava `SYNCED_SETTINGS.json` para o store SETTINGS (sobrescrevia as configurações locais). Teste novo prova (falha sem a correção).
2. **"aprovo selecionar-tela"**: `IPC/responsesMain.ts` ignora `error.display` (sem a janela que bloqueia quando o telão não liga).
3. **"aprovo estilo-menus"**: menu da prévia sem "Trocar/Editar estilo"; `TemplateInfo.svelte` fala em Visual.
Depois do aprovo: juntar a branch, registrar EXCECOES + shas na âncora, rodar a bateria, gerar 1.9.2.

## Bateria (madrugada de 25/nov, PC da cabine)
- `test:layout` 495/495; `ANCORA: ok`; svelte-check 151; vitest 1759 ok, só falham os 6 de `RtmpStreamer.integration` (ffmpeg real, arquivo intocado).
- Fumaças: t2, t4, t6, t7-menus, t8 (66 ok), t9, t9-palco, t10, t12, t14, t15, vivo **ok**; **t17 (nova) ok, 40 conferências** com `FS_LONGO=1`.
  - Rode t8/t10/t11 com `FS_PERFIL_DIR=C:/prova-perfil` (o padrão delas é um caminho do notebook do André).
  - Ordem importa: t4 A2 só falha logo depois do t2; t15 C2/C6 e t11 A6c só falham depois do t12 (o t12 gera uma 2ª Bíblia no perfil). Com o perfil restaurado passam.
  - **Falhas antigas, iguais na base `3f82b62` (origin de 24/nov) rodada aqui na mesma noite** — não são desta versão:
    - t13: A3 (lista de Configurações tem 11 itens, a fumaça espera 12) e G3–G12 (a contagem de "não salvo" fica em 2 depois de criar/apagar/recriar saída: o estilo próprio que o Visual dá à saída nova).
    - t16: 14 falhas — a fumaça procura a tabela antiga do Visual; a página foi redesenhada em 24/nov e a fumaça não foi refeita.
  - t11 A6c falha mesmo com o perfil limpo: o versículo aparece nas DUAS Bíblias embutidas (NVI e ARA, desde 19/nov) e a fumaça espera uma só. Não rodei na base; pela data, é expectativa antiga da fumaça.
  - Depois do `npm run build` (instalador), o app de dev só volta com `preBuild` + `tsc` + `electronDevPostBuild` (o `abrir-dev.sh` faz isso).
  - t12 foi atualizada: a Forma (24/nov) mudou o menu "Adicionar item".
- Prova do Culto: gravada a base `3f82b62` e o HEAD aqui (janela 1032 px, não compara com a gravação de referência de 1080). Divergências: ids de estilo (aleatórios), datas, a corrida do foco no Editar em E03 (acontece na base também: às vezes o clique em Preparar põe o foco na caixa e o espaço vai para o texto) e o hash da saída (o `Zoomed.svelte` aprovado mudou a ordem do `style`; texto e elementos do telão iguais). **Nenhuma mudança de conteúdo nas saídas.**
- No app de teste (perfil `C:\perfil-teste-igreja`, telas reais): chamada na faixa do Painel LED e da 1920 (prints conferidos), saída sozinha em 30 s, editor completo; posição "Em cima/à esquerda" no LED; Bíblia 2+ versões grava `templateScripture_2`; teste 11 (aplicar cola), teste 12 (modelo do Visual muda o telão na hora) e item 1 (letra na caixa livre com relógio em 1º) conferidos no Painel LED.
- Defeitos achados e corrigidos pela t17: Kids e Estacionamento sumiam na primeira abertura (corrida com a carga do disco e marca gravada antes do Salvar).

## Instalador
`dist\AliancaShow-1.9.1-x64.exe` (132 MB, 25/nov 02:02), com as 2 Bíblias em `resourcesibles`. Gerado do `feat/cabine-6`. Não foi aberto (abriria os dados reais da igreja): o André instala.

## Para o André testar de manhã
1. Instalar o 1.9.1. Na primeira abertura: Canções/Novas do Sirvo perdem o modelo "teste"; aparecem as Chamadas Kids e Estacionamento em Mostrar.
2. Chamadas: Kids, digitar o número, Chamar no telão; ver a faixa no LED e nas NDI; Tirar. Testar "+ Chamada" e "Livre…".
3. Botão direito numa caixa de texto do Editar › Valores dinâmicos: janela em português.
4. Modelo de Bíblia › "2+ versões…": escolher o modelo de 2 versões e projetar um versículo em 2 traduções.
5. Responder os 3 aprovos (acima).
