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
export const EXCECOES = {}

/**
 * arquivos que ENTRARAM no fecho de imports da saida depois da ancora (arquivo novo, ou um que ja existia e passou a ser importado por alguem do fecho).
 * Todo arquivo de fecho(HEAD) menos fecho(ancora) tem de estar aqui. `sha` = SHA-256 do conteudo no HEAD com CRLF trocado por LF.
 */
export const NOVOS_NO_FECHO = {}

export const SHA_EXCECOES = "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
export const SHA_NOVOS = "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
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
