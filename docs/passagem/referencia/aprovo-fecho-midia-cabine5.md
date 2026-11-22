# Pedido de "aprovo": mídia (cabine-5)

Nada disto foi aplicado ainda. Os arquivos abaixo estão no **fecho da janela de saída**. Só mexo neles depois que você escrever "aprovo …".

---

## 1. "Apagar do computador" (vai para a Lixeira)

**Motivo.** O app não tem como mandar um arquivo qualquer para a Lixeira. O único canal de apagar que existe (`ALIANCA_APAGAR`) só aceita a pasta Online e apaga de vez.

**Guarda.** Quem decide é o processo principal, não a tela:
- Ele abre uma **caixa de confirmação nativa do Windows** com o nome e a pasta do arquivo. Sem o clique em "Apagar", nada acontece.
- Só aceita um arquivo que existe, que não é pasta e que é vídeo ou imagem.
- Depois do `shell.trashItem`, confere que o arquivo saiu do lugar. Se não saiu, avisa alto.

### `src/types/IPC/Main.ts` (+2 linhas)
```diff
     ALIANCA_APAGAR = "ALIANCA_APAGAR",
+    ALIANCA_LIXEIRA = "ALIANCA_LIXEIRA",
 ...
     [Main.ALIANCA_APAGAR]: { caminho: string }
+    [Main.ALIANCA_LIXEIRA]: { caminho: string }
```

### `src/electron/IPC/responsesMain.ts` (+1 import, +1 linha, +1 função de ~25 linhas)
```diff
-import { app, desktopCapturer, screen, shell, systemPreferences } from "electron"
+import { app, desktopCapturer, dialog, screen, shell, systemPreferences } from "electron"
+import fs from "fs"
 ...
     [Main.ALIANCA_APAGAR]: (data) => apagarDaPastaOnline(data.caminho),
+    [Main.ALIANCA_LIXEIRA]: (data) => mandarParaLixeira(data.caminho),
 ...
+// cabine-5: "Apagar do computador" da biblioteca de midia. Quem decide e o processo principal (caixa nativa), nao a tela.
+const MIDIA = /\.(mp4|mov|mkv|avi|webm|m4v|mpg|mpeg|wmv|ogv|flv|3gp|jpg|jpeg|png|gif|webp|bmp|svg|tif|tiff|jfif|avif|heic)$/i
+async function mandarParaLixeira(caminho: string): Promise<{ ok: boolean; mensagem: string }> {
+    const alvo = path.resolve(caminho || "")
+    const st = fs.statSync(alvo, { throwIfNoEntry: false })
+    if (!st || !st.isFile() || !MIDIA.test(alvo)) return { ok: false, mensagem: "Recusado: não é um vídeo ou imagem que exista: " + caminho }
+    const opcoes: Electron.MessageBoxOptions = { type: "warning", buttons: ["Apagar (vai para a Lixeira)", "Cancelar"], defaultId: 1, cancelId: 1, title: "Apagar do computador", message: `Mandar "${path.basename(alvo)}" para a Lixeira?`, detail: path.dirname(alvo) }
+    const janela = getMainWindow()
+    const r = janela ? await dialog.showMessageBox(janela, opcoes) : await dialog.showMessageBox(opcoes)
+    if (r.response !== 0) return { ok: false, mensagem: "" }
+    try {
+        await shell.trashItem(alvo)
+    } catch (e) {
+        return { ok: false, mensagem: "A Lixeira não aceitou o arquivo (rede/OneDrive?): " + caminho }
+    }
+    if (fs.existsSync(alvo)) return { ok: false, mensagem: "O arquivo continua no lugar depois da Lixeira: " + caminho }
+    return { ok: true, mensagem: "" }
+}
```

**Do lado da tela (arquivos livres):**
- item "Apagar do computador" no botão direito da mídia, só no Preparar;
- se der `ok`, a mídia sai da biblioteca;
- se falhar, aparece a faixa de falha.

**Âncora:** `Main.ts` e `responsesMain.ts` já estão em EXCECOES. Atualizo o sha dos dois e o motivo ("cabine-5: Lixeira da biblioteca de mídia") e recalculo o SHA_EXCECOES.

---

## 2. Arquivo sumido: não tocar outro arquivo no lugar e avisar alto

**Hoje.** Quando o arquivo não existe, `locateMediaFile` procura **outro arquivo com o mesmo nome** nas pastas do disco e toca esse, sem avisar. Se não acha nada, não toca e também não avisa.

### Parte A: sem mexer no fecho (já posso fazer)
- Desligar a opção que já existe, **"Localizar automaticamente mídia que sumiu"** (`special.autoLocateMedia = false`). Ela também aparece no painel de informações da mídia, e você pode religar ali.
- Avisar alto no clique do cartão: já está feito, o cartão OFFLINE diz "Arquivo não encontrado".
- Avisar alto quando um item do roteiro aponta para um arquivo que não existe (`VideoShow.svelte`, livre).

### Parte B: com "aprovo", 1 linha em `videoPlayer.ts` (fecho)
Cobre todos os outros jeitos de tocar: atalho, próxima mídia, API.
```diff
                 const located = await locateMediaFile(audioPath)
                 if (!located) {
                     this.isStarting.delete(ref)
+                    newToast("Arquivo não encontrado (offline): " + audioPath)
                     return false
                 }
```
Atualizo a âncora do `videoPlayer.ts` do mesmo jeito.

---

## 3. Prova do Culto: declarar as divergências novas no `esperado.json`

Gravei com `FS_VIEWPORT=1920x1080`. Não há nenhuma divergência nos fluxos da saída. Além das 38 de sempre (`midia/sub`), aparecem **12 novas**:
- 11 delas no passo **C01-aba-midia**;
- 1 no passo **E02-vai-preparar**.

Todas ficam em `principal.canais` e vêm da biblioteca nova:
- **`MAIN:READ_FOLDER` (4):** a raiz da Mídia não lê mais a pasta do disco. No lugar disso, a migração lê a pasta uma vez, com `depth: 30`.
- **`OUTPUT:MEDIA` (8):** a migração grava as tags novas (`alianca:bib` e a categoria) no `media` de f1 e v1. O app sempre manda esse store inteiro para a janela de saída, que recebe o mesmo objeto com mais tags e não muda o que mostra. Três dessas 8 são `info` de y.mp4, que agora viaja no mesmo envio.

Com "aprovo 3", declaro essas 12 no `esperado.json`, com o motivo "cabine-5: biblioteca de mídia (migração)", e recalculo o que a âncora pede.

---

**Para aprovar, escreva por exemplo:** "aprovo 1", "aprovo 2B", "aprovo 1 e 2B" ou "aprovo só a parte A".
