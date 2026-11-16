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
    "src/frontend/stores.ts": "0b: fachada por modo de drawer/resized/activeDrawerTab/drawerTabsData; na saida `modoAlianca` nunca muda e a fachada se comporta como writable (vitest da fachada 'no processo de saida')",
    "src/frontend/utils/request.ts": "0a: gancho de IPC dentro de import.meta.env.DEV (some do build)",
    "src/frontend/IPC/main.ts": "0a: gancho de IPC dentro de import.meta.env.DEV (some do build)",
    "src/frontend/utils/save.ts": "0b: o disco grava drawer/drawerTabsData/resized do lado `.culto`; na saida `modoAlianca` e sempre o Culto, entao `.culto` e o mesmo store que ela ja via",
    "src/frontend/utils/updateSettings.ts": "0b: carregar drawer/drawerTabsData/resized escreve no lado `.culto`; na saida `modoAlianca` e sempre o Culto, entao e o mesmo `set` de antes",
    "src/frontend/utils/common.ts": "0b: togglePanels guarda o 'fechei tudo' por modo (valorPorModo); so o atalho `t` da janela principal chama, e no Culto equivale a variavel unica de antes",
    "src/frontend/utils/startup.ts": "0b: iniciarLayoutAlianca() roda em startupMain (a saida sai antes, por startupOutput) e ainda tem guarda de currentWindow",
    "src/frontend/utils/aliancaAbasEditor.ts": "0b: a aba de antes do editor vira valorPorModo; iniciarAbasDoEditor so roda em startupMain (nunca na saida)"
}
export const SHA_EXCECOES = "baf71af012946e6fa5ba44729cbd38b113d3968bc4434fc41a58c214ee719a6b"
export const shaDasExcecoes = () => createHash("sha256").update(JSON.stringify(EXCECOES), "utf8").digest("hex")

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

export function verificar({ fechoDaAncora, alterados, excecoes = EXCECOES, shaExcecoes = SHA_EXCECOES }) {
    const erros = []
    if (!fechoDaAncora.size) erros.push("o fecho de imports de MainOutput.svelte veio vazio")
    if (shaDasExcecoes() !== shaExcecoes && excecoes === EXCECOES) erros.push(`a lista de excecoes mudou (sha ${shaDasExcecoes()} != ${shaExcecoes}): atualize SHA_EXCECOES junto com o motivo`)
    for (const a of alterados) if (fechoDaAncora.has(a) && !(a in excecoes)) erros.push(`${a}: arquivo da janela de saida mudou desde a ancora e nao esta na lista de excecoes`)
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
    const erros = verificar({ fechoDaAncora: f, alterados })
    if (erros.length) {
        console.error(`ANCORA: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`ANCORA: ok (fecho de ${f.size} arquivos; ${alterados.filter((a) => f.has(a)).length} alterados, todos na lista de excecoes)`)
}
