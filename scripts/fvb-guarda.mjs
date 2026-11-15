// Guarda da FV-B (barra Culto | Biblioteca, aba Biblioteca, "+ Novo", "✎ Editar"). Portao do PR, nao parte do `npm test`.
//
//   npm run test:fvb -- fbbb205 HEAD     (compara dois commits)
//   npm run test:fvb -- fbbb205          (compara a base com a arvore de trabalho)
//
// A promessa que ela prova: tirados os BLOCOS MARCADOS (FVB:INICIO/FVB:FIM) e desfeitos os PARES antes/depois do manifesto,
// cada arquivo existente tem de ser IGUAL byte a byte ao da base. Texto, nao compilador.
//
// Fecha os furos que a revisao achou (revisao-fvb.md, B2/C3):
//   - cada bloco tem o SHA-256 do CONTEUDO no manifesto, e a QUANTIDADE de blocos por arquivo tambem;
//   - cada bloco e balanceado ({#if/{#each/{#key abertos e fechados DENTRO dele);
//   - bloco de marcacao comeca por `{#if $modoAlianca === "preparar"`; bloco de script/ts so tem linhas `import`;
//   - bloco no <style> de arquivo existente e proibido;
//   - arquivo novo so se casar com a lista branca; .svelte novo so e importado por MainLayout/AliancaAbasLaterais.
//
// Falha, e nao passa calada, quando: o manifesto esta vazio, a contagem de arquivos nao bate, nenhuma comparacao foi feita
// (refs iguais) ou um marcador esta sem par.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const MARCA_HTML_INICIO = "<!-- FVB:INICIO -->"
export const MARCA_HTML_FIM = "<!-- FVB:FIM -->"
export const MARCA_TS_INICIO = "// FVB:INICIO"
export const MARCA_TS_FIM = "// FVB:FIM"
const PACKAGE = "package.json"
const COMECO_DA_MARCACAO = '{#if $modoAlianca === "preparar"'

// arquivos novos que a fatia pode criar (nao existem na base)
const NOVOS_PERMITIDOS = [/^src\/frontend\/utils\/aliancaBiblioteca(Logica|Estado)?(\.test)?\.ts$/, /^src\/frontend\/utils\/aliancaBibliotecaGuarda\.test\.ts$/, /^src\/frontend\/components\/main\/Alianca(AbasLaterais|Biblioteca|Novo)\.svelte$/, /^scripts\/fvb-guarda(\.test)?\.mjs$/, /^scripts\/fvb-manifesto\.json$/]
// quem pode importar um .svelte novo
const IMPORTADORES_PERMITIDOS = [/^src\/frontend\/MainLayout\.svelte$/, /^src\/frontend\/components\/main\/AliancaAbasLaterais\.svelte$/]

const unificar = (t) => t.replace(/\r\n/g, "\n")
export const sha = (t) => createHash("sha256").update(unificar(t), "utf8").digest("hex")

/**
 * Acha os blocos marcados. Marcador em linha propria. Devolve { blocos, resto, erros }:
 * `resto` = o texto sem os blocos (da linha do INICIO ate a quebra depois do FIM).
 */
export function separarBlocos(texto) {
    const linhas = unificar(texto).split("\n")
    const erros = []
    const blocos = []
    const resto = []
    let atual = null
    const ehIni = (l) => l.trim() === MARCA_HTML_INICIO || l.trim() === MARCA_TS_INICIO
    const ehFim = (l) => l.trim() === MARCA_HTML_FIM || l.trim() === MARCA_TS_FIM
    linhas.forEach((l, i) => {
        if (ehIni(l)) {
            if (atual) erros.push(`marcador INICIO aninhado na linha ${i + 1}`)
            else atual = { inicio: i + 1, linhas: [], html: l.trim() === MARCA_HTML_INICIO }
            return
        }
        if (ehFim(l)) {
            if (!atual) erros.push(`marcador FIM sem INICIO na linha ${i + 1}`)
            else {
                if ((l.trim() === MARCA_HTML_FIM) !== atual.html) erros.push(`INICIO (linha ${atual.inicio}) e FIM (linha ${i + 1}) de estilos diferentes`)
                blocos.push({ inicio: atual.inicio, fim: i + 1, conteudo: atual.linhas.join("\n"), html: atual.html })
                atual = null
            }
            return
        }
        if (atual) atual.linhas.push(l)
        else resto.push(l)
    })
    if (atual) erros.push(`marcador INICIO sem FIM (linha ${atual.inicio})`)
    // um marcador com texto junto na mesma linha nao conta como marcador: acusa
    linhas.forEach((l, i) => {
        if (/FVB:(INICIO|FIM)/.test(l) && !ehIni(l) && !ehFim(l)) erros.push(`FVB:INICIO/FIM fora de linha propria (linha ${i + 1})`)
    })
    return { blocos, resto: resto.join("\n"), erros }
}

const contar = (texto, trecho) => (trecho ? texto.split(trecho).length - 1 : 0)

/** {#if/{#each/{#key abertos e fechados dentro do bloco */
export function balanceado(conteudo) {
    const abre = (conteudo.match(/\{#(if|each|key|await)\b/g) || []).length
    const fecha = (conteudo.match(/\{\/(if|each|key|await)\}/g) || []).length
    return abre === fecha
}

/** o bloco obedece ao tipo dele? (devolve lista de erros) */
export function formaDoBloco(bloco, arquivo) {
    const erros = []
    const nome = `${arquivo} (bloco da linha ${bloco.inicio})`
    const util = bloco.conteudo.split("\n").filter((l) => l.trim())
    if (!util.length) {
        erros.push(`${nome}: bloco vazio`)
        return erros
    }
    if (!balanceado(bloco.conteudo)) erros.push(`${nome}: bloco desbalanceado ({#if/{#each/{#key sem fechar ou fechando o que e de fora)`)
    if (/^\s*\$:/m.test(bloco.conteudo)) erros.push(`${nome}: bloco marcado nao pode ter \`$:\` (rodaria no Culto)`)
    if (arquivo.endsWith(".svelte")) {
        if (bloco.html) {
            if (!util[0].trim().startsWith(COMECO_DA_MARCACAO)) erros.push(`${nome}: bloco de marcacao tem de comecar por ${COMECO_DA_MARCACAO}`)
            // o {#if} de abertura tem de fechar so no fim
            if (!util[util.length - 1].trim().startsWith("{/if}")) erros.push(`${nome}: bloco de marcacao tem de terminar em {/if}`)
        } else {
            for (const l of util) if (!/^import\s/.test(l.trim())) erros.push(`${nome}: bloco de <script> so pode ter linhas import (achei: ${l.trim().slice(0, 50)})`)
        }
    } else {
        if (bloco.html) erros.push(`${nome}: marcador de HTML em arquivo que nao e .svelte`)
        for (const l of util) if (!/^import\s/.test(l.trim())) erros.push(`${nome}: bloco de .ts so pode ter linhas import (achei: ${l.trim().slice(0, 50)})`)
    }
    return erros
}

/** a posicao (numero de linha, 1-based) do <style de um .svelte, ou Infinity */
function linhaDoStyle(texto) {
    const linhas = unificar(texto).split("\n")
    const i = linhas.findIndex((l) => /^<style[\s>]/.test(l))
    return i < 0 ? Infinity : i + 1
}

/**
 * @param {{ manifesto: any, alterados: {caminho:string,status:string}[], base: Record<string,string|null>, head: Record<string,string|null> }} e
 * @returns {string[]} erros (vazio = passou)
 */
export function verificar({ manifesto, alterados, base, head }) {
    const erros = []
    const arquivos = manifesto?.arquivos || []
    if (!arquivos.length) erros.push("manifesto vazio")
    const doManifesto = arquivos.map((a) => a.arquivo)
    const alteradosCaminhos = alterados.map((a) => a.caminho)

    // contagem: os arquivos existentes alterados (fora package.json) sao exatamente os do manifesto
    for (const f of doManifesto) if (!alteradosCaminhos.includes(f)) erros.push(`${f}: esta no manifesto mas nao foi alterado`)
    for (const { caminho, status } of alterados) {
        if (caminho === PACKAGE) continue
        if (status === "M" && !doManifesto.includes(caminho)) erros.push(`${caminho}: arquivo existente alterado fora do manifesto`)
    }

    let comparados = 0
    for (const a of arquivos) {
        const f = a.arquivo
        const b = base[f]
        const h = head[f]
        if (b == null || h == null) {
            erros.push(`${f}: nao existe na base ou no head`)
            continue
        }
        comparados++
        const { blocos, resto, erros: eSep } = separarBlocos(h)
        erros.push(...eSep.map((e) => `${f}: ${e}`))
        const esperados = a.blocos || []
        if (blocos.length !== esperados.length) erros.push(`${f}: ${blocos.length} bloco(s) marcado(s), o manifesto espera ${esperados.length}`)
        const linhaStyle = f.endsWith(".svelte") ? linhaDoStyle(h) : Infinity
        blocos.forEach((bl, i) => {
            erros.push(...formaDoBloco(bl, f))
            if (bl.inicio > linhaStyle) erros.push(`${f}: bloco marcado dentro do <style> (linha ${bl.inicio})`)
            const esp = esperados[i]
            if (esp && esp.sha !== sha(bl.conteudo)) erros.push(`${f}: o conteudo do bloco ${i + 1} (linha ${bl.inicio}) difere do manifesto`)
        })
        // desfaz os pares
        let texto = resto
        for (const p of a.pares || []) {
            const na = contar(unificar(b), p.antes)
            const nd = contar(texto, p.depois)
            if (na !== 1) erros.push(`${f}: "antes" do manifesto ocorre ${na}x na base (esperado 1): ${p.antes.slice(0, 50)}`)
            if (nd !== 1) erros.push(`${f}: "depois" do manifesto ocorre ${nd}x no head (esperado 1): ${p.depois.slice(0, 50)}`)
            texto = texto.split(p.depois).join(p.antes)
        }
        if (sha(texto) !== sha(b)) erros.push(`${f}: tirados os blocos e desfeitos os pares, difere da base (algo alem do declarado mudou)`)
    }
    if (doManifesto.length && comparados !== doManifesto.length) erros.push(`comparou ${comparados} arquivos, o manifesto tem ${doManifesto.length}`)
    if (doManifesto.length && comparados === 0) erros.push("nenhuma comparacao feita (refs iguais?)")

    // os outros arquivos
    const novosSvelte = alterados.filter((a) => a.status === "A" && a.caminho.endsWith(".svelte")).map((a) => a.caminho)
    for (const { caminho, status } of alterados) {
        if (doManifesto.includes(caminho)) {
            if (status !== "M") erros.push(`${caminho}: status ${status} (so modificacao e permitida)`)
            continue
        }
        if (caminho === PACKAGE) {
            const h = unificar(head[PACKAGE] ?? "")
            const sem = h
                .split("\n")
                .filter((l) => !/"test:fvb"/.test(l))
                .join("\n")
            const igual = (x, y) => x.replace(/,(\s*\n\s*[}\]])/g, "$1") === y.replace(/,(\s*\n\s*[}\]])/g, "$1")
            if (!igual(sem, unificar(base[PACKAGE] ?? ""))) erros.push(`${PACKAGE}: so a linha test:fvb pode mudar`)
            continue
        }
        if (status === "A" && NOVOS_PERMITIDOS.some((r) => r.test(caminho))) continue
        erros.push(`${caminho}: arquivo fora da lista permitida (status ${status})`)
    }

    // .svelte novo so e importado pelos dois permitidos
    for (const nova of novosSvelte) {
        const nome = nova
            .split("/")
            .pop()
            .replace(/\.svelte$/, "")
        for (const [caminho, conteudo] of Object.entries(head)) {
            if (conteudo == null || caminho === nova || !/\.(svelte|ts|js)$/.test(caminho)) continue
            if (new RegExp(`import[^\\n]*\\/${nome}\\.svelte["']`).test(unificar(conteudo)) && !IMPORTADORES_PERMITIDOS.some((r) => r.test(caminho))) erros.push(`${caminho}: importa ${nome}.svelte (so MainLayout e AliancaAbasLaterais podem)`)
        }
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

export function carregarManifesto() {
    return JSON.parse(readFileSync(new URL("./fvb-manifesto.json", import.meta.url), "utf8"))
}

export function rodar(baseRef, headRef) {
    const manifesto = carregarManifesto()
    const { alterados, base, head } = coletar(baseRef, headRef)
    // arquivos do manifesto que nao mudaram nao aparecem no diff: entram mesmo assim para a comparacao falhar alto
    for (const f of manifesto.arquivos.map((a) => a.arquivo)) {
        if (!(f in base)) {
            base[f] = gitBlob(baseRef, f)
            head[f] = headRef ? gitBlob(headRef, f) : existsSync(f) ? readFileSync(f, "utf8") : null
        }
    }
    return { erros: verificar({ manifesto, alterados, base, head }), manifesto, alterados, base, head }
}

/** grava os SHAs dos blocos no manifesto a partir da arvore de trabalho (uma vez, depois de escrever o codigo) */
export function gerarShas(baseRef) {
    const manifesto = carregarManifesto()
    for (const a of manifesto.arquivos) {
        const h = existsSync(a.arquivo) ? readFileSync(a.arquivo, "utf8") : ""
        const { blocos } = separarBlocos(h)
        a.blocos = blocos.map((b) => ({ sha: sha(b.conteudo) }))
    }
    manifesto.base = baseRef
    writeFileSync(new URL("./fvb-manifesto.json", import.meta.url), JSON.stringify(manifesto, null, 4) + "\n")
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const [baseRef, headRef] = process.argv.slice(2)
    if (!baseRef) {
        console.error("uso: node scripts/fvb-guarda.mjs <base-sha> [head] | --gerar <base-sha>")
        process.exit(2)
    }
    if (baseRef === "--gerar") {
        gerarShas(headRef)
        console.log("FVB: shas gravados no manifesto")
        process.exit(0)
    }
    const { erros, alterados } = rodar(baseRef, headRef)
    if (erros.length) {
        console.error(`FVB: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`FVB: ok (${alterados.length} arquivos alterados)`)
}
