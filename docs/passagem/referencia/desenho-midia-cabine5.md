# Desenho: biblioteca de mídia (cabine-5, 19/nov)

## Decisões do André (19/nov)
- A mídia **não é copiada**. O app só registra onde o arquivo está. Se o arquivo sumir do disco, a mídia aparece como **offline**.
- Importar manda a mídia para a **raiz**. Ela só vai para uma categoria interna quando o André arrasta.
- As pastas do Windows somem da árvore (ACERVO ALIANCA, OneDrive BACKGROUNDS, Imagens, Vídeos…).
- **Migração:** cada uma das 9 pastas do disco vira uma categoria interna com os arquivos dela. São 983 arquivos, contando as subpastas.
- **Categorias:** só um nível. As subpastas do disco são achatadas dentro da categoria-mãe.
- **Arrastar uma PASTA do Explorer:** cria uma categoria com o nome da pasta e os arquivos dela.
- **Duas formas de apagar:** "Tirar da biblioteca" (o arquivo fica no disco) e "Apagar do computador" (vai para a Lixeira do Windows, com confirmação).

## Modelo
- **Biblioteca:** os caminhos marcados no store `media` (`media.json`, local da máquina) com `aliancaBib: true`. O campo é gravado como `any`, porque `Show.ts` está no fecho.
- **Categoria:** é a pasta-etiqueta que já existe (F7, `mediaTags` com `aliancaPasta`). Quem pertence a ela continua sendo definido pela etiqueta.
- **Raiz "Mídia"** (aba `all`): o que está na biblioteca e não tem categoria. Deixa de ler o disco: não chama mais `READ_FOLDER` nas `mediaFolders`.
- **Categoria** (`pasta:<id>`): os membros pela etiqueta, como hoje. A diferença é que um arquivo inexistente **aparece como offline**, em vez de ser filtrado.
- **Ficam como estão:** Favoritos, Do Sirvo, Online e Entradas.
- **`mediaFolders`:** continuam no store, sem apagar dados do usuário. Só deixam de aparecer na árvore. O "＋ pasta" do computador sai.

## Migração (uma vez, marcada em `special.aliancaBibMigrada`)
Para cada `mediaFolder`:
1. Cria (ou reaproveita, pelo nome) uma pasta-etiqueta com o nome da pasta.
2. Lê a pasta recursivamente e marca cada vídeo ou imagem com `aliancaBib` e com a etiqueta da categoria.
3. Áudio não entra, porque tem a aba Áudio própria.

A camada e o fim da categoria precisam reproduzir o comportamento de hoje. `mediaType` "background" vira camada fundo. Sem tipo vale ⚠ **A CONFERIR**, porque o padrão de hoje pode não ser igual a `PASTA_NOVA`.

Se uma mídia já está numa categoria, a categoria dela não muda.

## Importar
- **"＋ Importar mídia"** no fim da árvore de Mídia: abre o `Main.OPEN_FILE` com `multiple: true` e filtro de vídeo e imagem. Os arquivos escolhidos entram na raiz.
- **Soltar arquivos do Explorer na grade de mídia:**
  - com a raiz aberta, entram na raiz;
  - com uma categoria aberta, entram nessa categoria;
  - uma pasta solta vira categoria nova com o nome dela, lida recursivamente.
  - O caminho vem de `webUtils.getPathForFile` (preload).
  - O tratamento é feito em `Media.svelte`, que está livre. O `dropActions.ts` está no fecho, então não mexo nele.

## Offline
- Na carga da lista, o app confere se o arquivo existe (`Main.FILE_INFO`, que já é usado).
- **Cartão offline:** cinza, com o selo "offline" e o caminho no título.
- **Clique num cartão offline:** não vai ao ar. Mostra um aviso visível: "arquivo não encontrado: <caminho>".
- **Menu de um cartão offline:** "Tirar da biblioteca". O "Localizar arquivo…" fica para depois.

## Apagar
- **Menu do cartão de mídia:** dois itens novos no fim, escondidos no Culto, como o `alianca_mover`.
  - **"Tirar da biblioteca":** tira o `aliancaBib` e a etiqueta de categoria, e mantém o resto de `media[path]` (filtros, ajuste). Entra no histórico (Ctrl+Z).
  - **"Apagar do computador":** pede confirmação, com o nome e "vai para a Lixeira". Chama um IPC novo, `Main.ALIANCA_LIXEIRA`, com `shell.trashItem`. Depois tira da biblioteca.
    - O IPC exige mexer em `src/types/IPC/Main.ts` e `src/electron/IPC/responsesMain.ts`, os dois **no fecho**, o que pede o "aprovo" do André.
    - **Guarda no main:** só aceita um caminho registrado na biblioteca, ou dentro de uma `mediaFolder`.
- **Shows e roteiros:** quem usa a mídia continua apontando para o mesmo caminho. Tirar da biblioteca não mexe neles. Apagar do computador deixa a mídia offline neles.

## Arquivos
- **Livres:** `MediaTabs.svelte`, `Media.svelte`, `MediaCard.svelte`, `aliancaMenusBiblioteca.ts`, `aliancaMenusBibliotecaLayouts.ts` e os novos `utils/aliancaBibliotecaMidia.ts` (+ `Logica.ts` e teste).
- **No fecho, pedem "aprovo":** `Main.ts` e `responsesMain.ts` (Lixeira).
- **Evitar:**
  - `aliancaPastasMidia*.ts`: a lógica nova fica num arquivo novo e só chama as funções existentes;
  - `dropActions.ts`, `clipboard.ts`, `Show.ts`.
