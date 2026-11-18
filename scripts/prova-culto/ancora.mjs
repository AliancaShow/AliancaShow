// Ancora da janela de saida (revisao C14): nenhum arquivo do FECHO DE IMPORTS de `MainOutput.svelte` pode mudar entre a ancora (a base da
// pilha de layout) e o HEAD, salvo os da lista de excecoes abaixo, cada uma com motivo. A lista tem SHA TRAVADO: crescer exige mudar este
// arquivo (aparece no diff, com o motivo).
//
//   node scripts/prova-culto/ancora.mjs           (usa scripts/prova-culto/ancora.txt)
//   node scripts/prova-culto/ancora.mjs <sha>
//
// Reprova se: o SHA da ancora nao existe (rebase/squash apaga SHA de branch local), o fecho vem vazio, ou a lista de excecoes mudou sem o SHA.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, posix } from "node:path"
import { fileURLToPath } from "node:url"

const ENTRADA = "src/frontend/MainOutput.svelte"

/** excecoes: arquivo do fecho que a pilha de layout PODE mudar, e por que a saida continua igual */
export const EXCECOES = {
    "src/frontend/utils/aliancaTela.ts": {
        "motivo": "revisao da fatia 2 (achado 2): `tecladoLivre` passa de `tela === mostrar` para `tela !== editar` (o teclado da saida vive nas paginas do menu). Na saida `tela` e sempre `mostrar` (derivada com currentWindow !== null), entao o resultado e o mesmo de antes",
        "sha": "fd746e6f21ff4c7fc67a9ab5e9dd1e0bfb405bf5aa9867e9fd2f7a6fa70bdd47"
    },
    "src/frontend/utils/aliancaModo.ts": {
        "motivo": "revisao da fatia 2 (achado 2) + fatia 3: `tecladoPodeMexerNaSaida(alvo, tecla)` consulta `tecladoVivo(tela, campoDeTexto, tecla)` (em Editar so o Esc passa) e a marca de tecla em curso nao conta o Esc; na saida a tela e `mostrar` e a funcao devolve true como antes",
        "sha": "78f5a520f89be3540ccfede738033a357fe3904e25aea8db3fd29aba99d0c4e6"
    },
    "src/frontend/utils/aliancaBibliotecaEstado.ts": {
        "motivo": "revisao da fatia 2 (achado 2.1): so zera a biblioteca ao chegar em Mostrar vindo de Editar; assinante da `tela` so montado pela janela principal (iniciarEstadoDaBiblioteca nao roda na saida)",
        "sha": "cd5ff071b766caf8aa58acb27731a66a6ff64d3fe5860e7eb422816363d0f116"
    },
    "src/frontend/utils/aliancaBibliotecaLogica.ts": {
        "motivo": "revisao da fatia 2 (achado 2.1): acrescenta a funcao pura `chegadaZeraBiblioteca`; nada existente muda",
        "sha": "10ec435d1bdc5038f1ea231691ed4210e0d1551528d59f6cb85e6f97a69f2dbd"
    },
    "src/electron/index.ts": {
        "motivo": "fatia 4 (decisao 8 do Andre, aprovada 18/nov): so `createMain` (janela principal) troca `frame/autoHideMenuBar` por `titleBarStyle: hidden` + `titleBarOverlay`, e `setGlobalMenu` zera o menu no Windows tambem em dev. A criacao da janela de saida nao muda",
        "sha": "bf96cef8c00bec3e925bd74935e159bba906200eb46851c534480c123b640616"
    },
    "src/electron/IPC/responsesMain.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): novo canal `TOGGLE_DEVTOOLS` (sem efeito em producao; em dev abre o DevTools da janela principal). Nenhuma resposta existente muda",
        "sha": "62f8168f7d46315cc4b98e581b3b16b5556719700e55ac1c260518f0493e61fd"
    },
    "src/types/IPC/Main.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): tipo do canal novo `TOGGLE_DEVTOOLS`; so acrescenta",
        "sha": "1183d05780e63eb48a15dad507fbd8d607c1286e20bcb957cb98a0f82fe5b1dd"
    },
    "src/electron/utils/menuTemplate.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): tira `quick_start_guide` do menu (macOS); nada da saida usa",
        "sha": "9ffaa005809bbc29f23e7e8777b840462f2dc40d570f9b85388611c6cc0c787f"
    },
    "src/frontend/components/context/contextMenus.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): apaga os layouts `file/edit/view/help` da barra de menus que saiu (MenuBar.svelte apagado); nenhum outro layout muda",
        "sha": "f9b1c63342f5be2693e494f4c64ab4cdaa86aab7bd1a2babd2b67d57a5c0befa"
    },
    "src/frontend/utils/common.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): apaga a constante `MENU_BAR_HEIGHT` (sem mais usos); nada mais muda",
        "sha": "e40aca15f3713ae101ff0475ca64d173adda3db2db857eed917a796282330746"
    },
    "src/frontend/components/main/popups/Initialize.svelte": {
        "motivo": "fatia 4 (aprovada 18/nov): tira o paragrafo de dicas do FreeShow do primeiro uso; o popup so abre na janela principal",
        "sha": "d8ea6859563eb19ea94aa9c71de9cf7fc102fd02aa84e1eadf98cdd815b3c31c"
    },
    "src/frontend/components/helpers/output.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): ponto unico do desvio em setOutput; recusa o que nao e letra; expiracao de sobreposicao em semDesvio. Modo desligado: identico",
        "sha": "fb2140b8a4aa083b61f946213fe8eea9eb15714d106f0842b90618ac60a9bf50"
    },
    "src/frontend/components/helpers/OutputHelper.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): setas leem a posicao do retorno no modo; automacao roda na janela propria. Modo desligado: identico",
        "sha": "fd6a3a23df26a58c5975b013524df739cc31fce0c5d0fc6a803c1877dedc3d4b"
    },
    "src/frontend/components/helpers/showActions.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): updateOut/checkActionTrigger retornam cedo no modo; playPdf recusa antes de limpar o fundo. Modo desligado: identico",
        "sha": "5b4be1ecb0288b49fb356bb8f17c69cb80397a95c1cd40b0b07e372c365d7585"
    },
    "src/frontend/components/output/clear.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): limpezas parciais de sobreposicao/efeito fora do desvio. Modo desligado: identico",
        "sha": "ff53361a099d57d8b6bd20c5b0c9bbabc41e4e72669940efe991b4b96bd18855"
    },
    "src/frontend/components/actions/apiHelper.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): API/celular nao limpa o telao antes de enviar no modo; repetir/mudo em semDesvio; audio recusado no modo. Modo desligado: identico",
        "sha": "ee4ba33f1e44e552cc1dddc3ad87a26ff35796ef6ab5395cedebf86f4a54fb78"
    },
    "src/frontend/components/context/menuClick.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): midia nao limpa o telao antes de enviar no modo. Modo desligado: identico",
        "sha": "dcdd1aadf3852a18ea71a23329a020bb37c4ceb1a870d17aa0f291dcbd86c877"
    },
    "src/frontend/utils/shortcuts.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): togglePlayingMedia recusa no modo (Espaco/seta nao mexem no video do telao); playFolder herda a janela de automacao. Modo desligado: identico",
        "sha": "15c2507c81735c878439449294e47379f903e6455988fa3f04a876c8fd9f3de5"
    },
    "src/frontend/components/media/video/videoPlayer.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): fim de video de pasta abre iniciarAutomacao() em try/finally; com o modo desligado devolve null e nada muda",
        "sha": "fbce2acdc357ef958d2d3b003ca5c9f3a1fb28091b7fc8c4d28cce0ece3ce036"
    },
    "src/frontend/components/timeline/ShowTimeline.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): linha do tempo move o telao como automacao (iniciarAutomacao em try/finally); modo desligado: identico",
        "sha": "3025cd53ccf5f3b4e5d5c230214fc6862a3af1fe4b124ca19573fefb3e367b9c"
    },
    "src/frontend/components/timeline/TimelinePlayback.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): video da linha do tempo move o telao como automacao (iniciarAutomacao em try/finally); modo desligado: identico",
        "sha": "fb5b607e4f98f7623a7b710cc3199d22477e8dcd29933acdbec6544c2401b3c2"
    }
}

/**
 * arquivos que ENTRARAM no fecho de imports da saida depois da ancora (arquivo novo, ou um que ja existia e passou a ser importado por alguem do fecho).
 * Todo arquivo de fecho(HEAD) menos fecho(ancora) tem de estar aqui. `sha` = SHA-256 do conteudo no HEAD com CRLF trocado por LF.
 */
export const NOVOS_NO_FECHO = {
    "src/frontend/utils/aliancaTecladoLogica.ts": {
        "motivo": "revisao da fatia 2 (achado 2) + fatia 3: funcao pura `tecladoVivo(tela, campo, tecla)`, importada por aliancaModo.ts; em `mostrar` devolve true (o terceiro argumento so muda o ramo `editar`, que a saida nunca tem)",
        "sha": "ef3200817fe6961538c62f2b685672b5395f8ce47575c20731a9d2e2f27fb057"
    },
    "src/frontend/utils/aliancaSoRetorno.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): arquivo novo: estado do modo, ponto de desvio, janela de automacao, recusarNoModo; output.ts o importa",
        "sha": "277556209cdaed9a0daf779564f94d3dec590e84ee305558b9b04d7c857f7221"
    },
    "src/frontend/utils/aliancaSoRetornoLogica.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): arquivo novo: parte pura (aceitaNoModo, oQueRecusou, motivoDaRecusa)",
        "sha": "cbf854f6e38498cb2214baae2898e72394de0ee07d1ad1b5974780c49fd5274d"
    }
}

export const SHA_EXCECOES = "beb5312889d57c7333b7f23596dd301cef27fa6a9c7be21f11be78a7699ba103"
export const SHA_NOVOS = "ed7662101256d7f316c003d314dc25396bce5032913ea3e844943f0184ac93f3"
export const shaDasExcecoes = () => createHash("sha256").update(JSON.stringify(EXCECOES), "utf8").digest("hex")
export const shaDosNovos = () => createHash("sha256").update(JSON.stringify(NOVOS_NO_FECHO), "utf8").digest("hex")
/** SHA-256 do texto com CRLF trocado por LF (o checkout do Windows nao pode mudar o sha) */
export const shaDoTexto = (txt) => createHash("sha256").update(String(txt).replace(/\r\n/g, "\n"), "utf8").digest("hex")

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] })
const lerNoRef = (ref, caminho) => {
    try {
        return git(["show", `${ref}:${caminho}`])
    } catch {
        return null
    }
}

const IMPORT = /(?:import\s+(?:[^'";]*?\s+from\s+)?|import\(\s*|export\s+[^'";]*?\s+from\s+)["']([^"']+)["']/g

/** resolve um import relativo para um arquivo que existe no ref; devolve caminho ou null */
export function resolver(deArquivo, alvo, existe) {
    if (!alvo.startsWith(".")) return null
    const base = posix.normalize(posix.join(posix.dirname(deArquivo), alvo))
    for (const c of [base, base + ".ts", base + ".js", base + ".svelte", base + "/index.ts", base + "/index.js"]) if (existe(c)) return c
    return null
}

/** le varios arquivos de um ref de uma vez (git cat-file --batch: um processo so). devolve { caminho: texto|null } */
export function lerLote(ref, caminhos) {
    const saida = {}
    if (!caminhos.length) return saida
    const buf = execFileSync("git", ["cat-file", "--batch"], { input: caminhos.map((c) => `${ref}:${c}`).join("\n") + "\n", maxBuffer: 1024 * 1024 * 1024 })
    let p = 0
    for (const c of caminhos) {
        const fim = buf.indexOf(10, p)
        const cab = buf.toString("utf8", p, fim)
        p = fim + 1
        if (cab.endsWith(" missing")) {
            saida[c] = null
            continue
        }
        const tam = Number(cab.split(" ")[2])
        saida[c] = buf.toString("utf8", p, p + tam)
        p += tam + 1
    }
    return saida
}

/** o mesmo fecho, mas lendo em lote por nivel (rapido em repositorio grande) */
export function fechoDoRef(entrada, ref) {
    const cache = {}
    const ler = (cs) => {
        const falta = cs.filter((c) => !(c in cache))
        Object.assign(cache, lerLote(ref, falta))
    }
    const vistos = new Set()
    let nivel = [entrada]
    while (nivel.length) {
        ler(nivel)
        const proximos = new Set()
        const candidatos = []
        const pares = []
        for (const f of nivel) {
            if (vistos.has(f) || cache[f] == null) continue
            vistos.add(f)
            for (const m of cache[f].matchAll(IMPORT)) {
                if (!m[1].startsWith(".")) continue
                const base = posix.normalize(posix.join(posix.dirname(f), m[1]))
                const cs = [base, base + ".ts", base + ".js", base + ".svelte", base + "/index.ts", base + "/index.js"]
                candidatos.push(...cs)
                pares.push(cs)
            }
        }
        ler(candidatos)
        for (const cs of pares) {
            const r = cs.find((c) => cache[c] != null)
            if (r && !vistos.has(r)) proximos.add(r)
        }
        nivel = [...proximos]
    }
    return vistos
}

/** fecho de imports a partir da entrada, lendo do ref dado. leitor(caminho) => texto | null */
export function fecho(entrada, leitor) {
    const vistos = new Set()
    const fila = [entrada]
    while (fila.length) {
        const f = fila.pop()
        if (vistos.has(f)) continue
        const texto = leitor(f)
        if (texto == null) continue
        vistos.add(f)
        for (const m of texto.matchAll(IMPORT)) {
            const r = resolver(f, m[1], (c) => leitor(c) != null)
            if (r && !vistos.has(r)) fila.push(r)
        }
    }
    return vistos
}

/**
 * fechoDaAncora / fechoDoHead: conjuntos de arquivos; alterados: arquivos que mudaram entre a ancora e o HEAD;
 * shaAtual(caminho): SHA do conteudo no HEAD (ou null se o arquivo nao existe).
 */
export function verificar({ fechoDaAncora, fechoDoHead = null, alterados, excecoes = EXCECOES, novos = NOVOS_NO_FECHO, shaExcecoes = SHA_EXCECOES, shaNovos = SHA_NOVOS, shaAtual = () => null }) {
    const erros = []
    if (!fechoDaAncora.size) erros.push("o fecho de imports de MainOutput.svelte veio vazio")
    if (shaDasExcecoes() !== shaExcecoes && excecoes === EXCECOES) erros.push(`a lista de excecoes mudou (sha ${shaDasExcecoes()} != ${shaExcecoes}): atualize SHA_EXCECOES junto com o motivo`)
    if (shaDosNovos() !== shaNovos && novos === NOVOS_NO_FECHO) erros.push(`a lista NOVOS_NO_FECHO mudou (sha ${shaDosNovos()} != ${shaNovos}): atualize SHA_NOVOS junto com o motivo`)
    for (const a of alterados) if (fechoDaAncora.has(a) && !(a in excecoes)) erros.push(`${a}: arquivo da janela de saida mudou desde a ancora e nao esta na lista de excecoes`)
    // diferenca de conjuntos: tudo que entrou no fecho precisa de motivo (existisse ou nao na ancora)
    if (fechoDoHead) for (const n of fechoDoHead) if (!fechoDaAncora.has(n) && !(n in novos)) erros.push(`${n}: arquivo NOVO no fecho da janela de saida (nao estava no fecho da ancora) e nao esta em NOVOS_NO_FECHO`)
    if (fechoDoHead) for (const n of Object.keys(novos)) if (fechoDaAncora.has(n) || !fechoDoHead.has(n)) erros.push(`${n}: esta em NOVOS_NO_FECHO mas nao e um arquivo que entrou no fecho`)
    // trava de conteudo: mudar o arquivo sem atualizar o sha (e reler o motivo) reprova
    for (const [lista, nome] of [
        [excecoes, "EXCECOES"],
        [novos, "NOVOS_NO_FECHO"]
    ]) {
        for (const [caminho, e] of Object.entries(lista)) {
            const atual = shaAtual(caminho)
            if (atual === null) continue
            if (atual !== e.sha) erros.push(`${caminho}: o conteudo mudou (sha ${atual}) e ${nome} guarda ${e.sha}: releia o motivo e atualize o sha`)
        }
    }
    return erros
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const aqui = dirname(fileURLToPath(import.meta.url))
    const ancora = process.argv[2] || readFileSync(join(aqui, "ancora.txt"), "utf8").trim()
    try {
        git(["cat-file", "-e", `${ancora}^{commit}`])
    } catch {
        console.error(`ANCORA: o commit ${ancora} nao existe mais (rebase/squash?). Regrave scripts/prova-culto/ancora.txt com a base real da pilha.`)
        process.exit(1)
    }
    const f = fechoDoRef(ENTRADA, ancora)
    const alterados = git(["diff", "--name-only", "--no-renames", ancora, "HEAD"]).split("\n").filter(Boolean)
    const fHead = fechoDoRef(ENTRADA, "HEAD")
    const erros = verificar({ fechoDaAncora: f, fechoDoHead: fHead, alterados, shaAtual: (c) => (lerNoRef("HEAD", c) === null ? null : shaDoTexto(lerNoRef("HEAD", c))) })
    if (erros.length) {
        console.error(`ANCORA: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`ANCORA: ok (fecho de ${f.size} arquivos; ${alterados.filter((a) => f.has(a)).length} alterados, todos na lista de excecoes; ${[...fHead].filter((n) => !f.has(n)).length} novos no fecho, todos em NOVOS_NO_FECHO)`)
}
