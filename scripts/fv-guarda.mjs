// Guarda da FV-A (laranja e fontes do Preparar). Portao do PR, nao parte do `npm test`.
//
//   npm run test:fv -- 8abf346 HEAD      (compara dois commits)
//   npm run test:fv -- 8abf346           (compara a base com a arvore de trabalho)
//
// A promessa que ela prova: SEM o atributo `data-tema` no <body> (tema proprio, janela de saida, miniatura), o CSS e a
// marcacao de todo componente sao identicos aos da base, byte a byte. Todo `var(--token, F)` do manifesto vale F.
//
//   G1  so entram arquivos conhecidos: os do manifesto, o bloco FV de global.css, startup.ts (1 linha), os arquivos novos.
//   G2  textual: o arquivo do head, com cada `var(--token, F)` do manifesto trocado por F (parenteses balanceados, nao
//       regex), tem de ser IGUAL byte a byte ao da base. Cobre <script>, marcacao, <style> e o style inline de Top.svelte.
//
// Falha, e nao passa calada, quando: o manifesto esta vazio, a contagem de arquivos nao bate, nenhuma comparacao foi feita
// (refs iguais) ou um token do manifesto aparece sem fallback.
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const MARCA_INICIO = "/* FV:INICIO */"
export const MARCA_FIM = "/* FV:FIM */"
const GLOBAL = "public/global.css"
const STARTUP = "src/frontend/utils/startup.ts"
const PACKAGE = "package.json"

// arquivos novos que a fatia pode criar (nao existem na base)
const NOVOS_PERMITIDOS = [/^src\/frontend\/utils\/aliancaTema(Logica)?(\.test)?\.ts$/, /^src\/frontend\/utils\/aliancaVisualEscopo\.test\.ts$/, /^public\/fonts\/(Inter|SpaceGrotesk)-(Variable\.woff2|OFL\.txt)$/, /^scripts\/fv-guarda(\.test)?\.mjs$/, /^scripts\/fv-manifesto\.json$/]

const unificar = (t) => t.replace(/\r\n/g, "\n")

/** Troca cada `var(--token, F)` (token do manifesto) por F. Devolve { texto, semFallback }. */
export function resolverTokens(texto, tokens) {
    const nomes = [...tokens].sort((a, b) => b.length - a.length)
    const semFallback = []
    let atual = texto
    for (let volta = 0; volta < 20; volta++) {
        let saida = ""
        let i = 0
        let mudou = false
        while (i < atual.length) {
            const ini = atual.indexOf("var(", i)
            if (ini < 0) {
                saida += atual.slice(i)
                break
            }
            saida += atual.slice(i, ini)
            // acha o fecha-parenteses do var( com contagem de profundidade
            let prof = 0
            let fim = -1
            for (let k = ini + 3; k < atual.length; k++) {
                if (atual[k] === "(") prof++
                else if (atual[k] === ")") {
                    prof--
                    if (prof === 0) {
                        fim = k
                        break
                    }
                }
            }
            if (fim < 0) {
                saida += atual.slice(ini)
                break
            }
            const interior = atual.slice(ini + 4, fim)
            const m = interior.match(/^\s*(--[a-z0-9-]+)\s*(,|$)/i)
            const token = m && nomes.find((n) => n === m[1])
            if (token) {
                if (m[2] !== ",") {
                    semFallback.push(token)
                    saida += atual.slice(ini, fim + 1)
                } else {
                    const corte = interior.indexOf(",")
                    saida += interior.slice(corte + 1).replace(/^\s+/, "")
                    mudou = true
                }
                i = fim + 1
            } else {
                // var() que nao e do manifesto: mantem, mas ainda precisa olhar o que tem dentro
                saida += atual.slice(ini, ini + 4)
                i = ini + 4
            }
        }
        atual = saida
        if (!mudou) break
    }
    return { texto: atual, semFallback }
}

const contar = (texto, trecho) => (trecho ? texto.split(trecho).length - 1 : 0)

/** Tira o bloco FV de global.css. Devolve null se os marcadores nao estiverem em ordem e uma vez so. */
export function tirarBlocoFv(css) {
    const a = css.indexOf(MARCA_INICIO)
    const b = css.indexOf(MARCA_FIM)
    if (a < 0 || b < 0 || b < a || css.indexOf(MARCA_INICIO, a + 1) >= 0 || css.indexOf(MARCA_FIM, b + 1) >= 0) return null
    const antes = css.slice(0, a).replace(/\n+$/, "\n")
    const depois = css.slice(b + MARCA_FIM.length).replace(/^\n+/, "")
    return antes + depois
}

/**
 * @param {{ manifesto: any, alterados: {caminho:string,status:string}[], base: Record<string,string|null>, head: Record<string,string|null> }} e
 * @returns {string[]} erros (vazio = passou)
 */
export function verificar({ manifesto, alterados, base, head }) {
    const erros = []
    const entradas = manifesto?.entradas || []
    const tokens = manifesto?.tokens || []
    if (!entradas.length) erros.push("manifesto vazio")
    if (!tokens.length) erros.push("manifesto sem tokens")
    const doManifesto = [...new Set(entradas.map((e) => e.arquivo))]
    const svelteAlterados = alterados.filter((a) => a.caminho.endsWith(".svelte")).map((a) => a.caminho)

    // contagem: os .svelte alterados sao exatamente os do manifesto
    for (const f of doManifesto) if (!svelteAlterados.includes(f)) erros.push(`${f}: esta no manifesto mas nao foi alterado`)
    for (const f of svelteAlterados) if (!doManifesto.includes(f)) erros.push(`${f}: .svelte alterado fora do manifesto`)

    let comparados = 0
    for (const f of doManifesto) {
        const b = base[f]
        const h = head[f]
        if (b == null || h == null) {
            erros.push(`${f}: nao existe na base ou no head`)
            continue
        }
        const { texto, semFallback } = resolverTokens(unificar(h), tokens)
        comparados++
        for (const t of semFallback) erros.push(`${f}: ${t} usado sem fallback`)
        if (texto !== unificar(b)) erros.push(`${f}: com os fallbacks resolvidos, difere da base (algo alem de var(--token, valor-antigo) mudou)`)
        for (const e of entradas.filter((x) => x.arquivo === f)) {
            const na = contar(unificar(b), e.antes)
            const nd = contar(unificar(h), e.depois)
            if (na !== e.ocorrencias) erros.push(`${f}: "antes" do manifesto ocorre ${na}x na base (esperado ${e.ocorrencias}): ${e.antes.slice(0, 50)}`)
            if (nd !== e.ocorrencias) erros.push(`${f}: "depois" do manifesto ocorre ${nd}x no head (esperado ${e.ocorrencias}): ${e.depois.slice(0, 50)}`)
        }
    }
    if (doManifesto.length && comparados !== doManifesto.length) erros.push(`comparou ${comparados} arquivos, o manifesto tem ${doManifesto.length}`)
    if (doManifesto.length && comparados === 0) erros.push("nenhuma comparacao feita (refs iguais?)")

    // os outros arquivos
    for (const { caminho, status } of alterados) {
        if (caminho.endsWith(".svelte")) {
            if (status !== "M") erros.push(`${caminho}: status ${status} (so modificacao e permitida)`)
            continue
        }
        if (caminho === GLOBAL) {
            const b = base[GLOBAL]
            const h = head[GLOBAL]
            if (b == null || h == null) {
                erros.push(`${GLOBAL}: ausente`)
                continue
            }
            const sem = tirarBlocoFv(unificar(h))
            if (sem == null) erros.push(`${GLOBAL}: marcadores FV:INICIO/FV:FIM ausentes, fora de ordem ou repetidos`)
            else if (sem.trimEnd() !== unificar(b).trimEnd()) erros.push(`${GLOBAL}: ha mudanca fora do bloco FV:INICIO/FV:FIM`)
            continue
        }
        if (caminho === STARTUP) {
            const h = unificar(head[STARTUP] ?? "")
            const sem = h
                .split("\n")
                .filter((l) => !/iniciarTemaAlianca|FV-A:/.test(l))
                .join("\n")
            if (sem !== unificar(base[STARTUP] ?? "")) erros.push(`${STARTUP}: so as linhas de iniciarTemaAlianca podem mudar`)
            continue
        }
        if (caminho === PACKAGE) {
            const h = unificar(head[PACKAGE] ?? "")
            const sem = h
                .split("\n")
                .filter((l) => !/"test:fv"/.test(l))
                .join("\n")
            // tolera a virgula da linha anterior
            const igual = (x, y) => x.replace(/,(\s*\n\s*[}\]])/g, "$1") === y.replace(/,(\s*\n\s*[}\]])/g, "$1")
            if (!igual(sem, unificar(base[PACKAGE] ?? ""))) erros.push(`${PACKAGE}: so a linha test:fv pode mudar`)
            continue
        }
        if (status === "A" && NOVOS_PERMITIDOS.some((r) => r.test(caminho))) continue
        erros.push(`${caminho}: arquivo fora da lista permitida (status ${status})`)
    }
    return erros
}

// ---------- git ----------
const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
const gitBlob = (ref, caminho) => {
    try {
        return execFileSync("git", ["show", `${ref}:${caminho}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })
    } catch {
        return null
    }
}

/** base = sha; headRef = commit ou null (arvore de trabalho, com arquivos novos nao rastreados). */
export function coletar(baseRef, headRef) {
    const alterados = []
    const linhas = git(["diff", "--name-status", "--no-renames", baseRef, ...(headRef ? [headRef] : [])])
        .split("\n")
        .filter(Boolean)
    for (const l of linhas) {
        const [status, caminho] = l.split("\t")
        alterados.push({ caminho, status: status[0] })
    }
    if (!headRef) {
        for (const c of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) if (!alterados.some((a) => a.caminho === c)) alterados.push({ caminho: c, status: "A" })
    }
    const base = {}
    const head = {}
    for (const { caminho } of alterados) {
        base[caminho] = gitBlob(baseRef, caminho)
        head[caminho] = headRef ? gitBlob(headRef, caminho) : existsSync(caminho) ? readFileSync(caminho, "utf8") : null
    }
    return { alterados, base, head }
}

export function rodar(baseRef, headRef) {
    const manifesto = JSON.parse(readFileSync(new URL("./fv-manifesto.json", import.meta.url), "utf8"))
    const { alterados, base, head } = coletar(baseRef, headRef)
    // arquivos do manifesto que nao mudaram nao aparecem no diff: entram mesmo assim para a comparacao falhar alto
    for (const f of new Set(manifesto.entradas.map((e) => e.arquivo))) {
        if (!(f in base)) {
            base[f] = gitBlob(baseRef, f)
            head[f] = headRef ? gitBlob(headRef, f) : existsSync(f) ? readFileSync(f, "utf8") : null
        }
    }
    if (!(GLOBAL in base)) {
        base[GLOBAL] = gitBlob(baseRef, GLOBAL)
        head[GLOBAL] = headRef ? gitBlob(headRef, GLOBAL) : readFileSync(GLOBAL, "utf8")
    }
    return { erros: verificar({ manifesto, alterados, base, head }), manifesto, alterados, base, head }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const [baseRef, headRef] = process.argv.slice(2)
    if (!baseRef) {
        console.error("uso: node scripts/fv-guarda.mjs <base-sha> [head]")
        process.exit(2)
    }
    const { erros, alterados } = rodar(baseRef, headRef)
    if (erros.length) {
        console.error(`FV: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`FV: ok (${alterados.length} arquivos alterados, guardas G1 e G2)`)
}
