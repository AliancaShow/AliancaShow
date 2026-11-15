// Guarda da FV-S (seletor compacto de agenda e de culto no painel "Cultos"). Portao do PR, nao parte do `npm test`.
//
//   npm run test:fvs                      (cadeia: teste de mutacao, guarda da FV-B fbbb205..c6c2085 e esta, c6c2085..HEAD)
//   node scripts/fvs-guarda.mjs c6c2085 HEAD
//
// A promessa que ela prova: o UNICO arquivo existente que muda e `show/Projects.svelte`, e so em TRES pares declarados.
// Desfeitos os pares (depois -> antes), o arquivo e IGUAL byte a byte ao da base. O ramo `{:else}` do par da faixa e o
// markup antigo VERBATIM: o `depois` nao e digitado no manifesto, e CONSTRUIDO aqui (prefixo + `antes` recuado 4 espacos +
// sufixo), e o prefixo e o sufixo tem SHA fixo neste script (revisao-seletor.md, I4/C4). Quem altera o `{:else}` reprova
// mesmo atualizando o manifesto.
//
// Tambem prova, por texto, o que o plano promete do arquivo NOVO (revisao-seletor.md, I4.3):
//   - sem <svelte:window|body|document> (nenhuma linha roda no Culto com o popover fechado);
//   - sem `:global(`; sem importar shortcuts/showActions/output/OutputHelper; sem escrever em `outputs`;
//   - todo addEventListener esta dentro de funcao e tem o removeEventListener correspondente;
//   - so `show/Projects.svelte` importa o componente; nenhum arquivo da janela de saida o importa;
//   - a logica pura nao importa store nenhum.
//
// Falha, e nao passa calada, quando: o manifesto esta vazio, nenhuma comparacao foi feita (refs iguais) ou falta um par.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const PROJECTS = "src/frontend/components/show/Projects.svelte"
const PACKAGE = "package.json"
const COMPONENTE = "src/frontend/components/show/SeletorDeCulto.svelte"
const LOGICA = "src/frontend/utils/aliancaSeletorLogica.ts"

// arquivos novos que a fatia pode criar (nao existem na base)
export const NOVOS_PERMITIDOS = [/^src\/frontend\/utils\/aliancaSeletor(Logica)?(\.test)?\.ts$/, /^src\/frontend\/utils\/aliancaSeletorGuarda\.test\.ts$/, /^src\/frontend\/components\/show\/SeletorDeCulto\.svelte$/, /^scripts\/fvs-guarda(\.test)?\.mjs$/, /^scripts\/fvs-manifesto\.json$/]
// quem pode importar o .svelte novo
export const IMPORTADORES_PERMITIDOS = [/^src\/frontend\/components\/show\/Projects\.svelte$/]

const unificar = (t) => t.replace(/\r\n/g, "\n")
export const sha = (t) => createHash("sha256").update(unificar(t), "utf8").digest("hex")
const contar = (texto, trecho) => (trecho ? texto.split(trecho).length - 1 : 0)

/** os tres pares, com o prefixo e o sufixo FIXOS por SHA. recuo = quantos espacos entram em cada linha nao vazia do `antes` */
export const PARES_FIXOS = {
    importacao: { recuo: 0, prefixo: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", sufixo: "192f927c68aa5348a20b1e361f75dfdc184e127a64fb29bce0d232d9ef596a8b" },
    faixa: { recuo: 4, prefixo: "f7d9145d00ba4847d9bf20c3745fad63dcb7335bd1cb22c2a6e912488c38b747", sufixo: "3cb13232d8bb6e57d4ef8f0821d8791e7194a6b01459b382f0c9c380bde199b6" },
    interruptor: { recuo: 0, prefixo: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", sufixo: "7a74e0413f578e0f13df03cd28ff5019b607366a7ec41063fa5d352469dd534e" }
}

/** `antes` com `recuo` espacos a mais em cada linha nao vazia */
export function recuar(texto, recuo) {
    const pad = " ".repeat(recuo)
    return unificar(texto)
        .split("\n")
        .map((l) => (l.trim() ? pad + l : l))
        .join("\n")
}

/** o `depois` esperado de um par: prefixo + antes recuado + sufixo */
export const construirDepois = (p) => unificar(p.prefixo) + recuar(p.antes, p.recuo) + unificar(p.sufixo)

const IMPORTA_PROIBIDO = /from\s+["'][^"']*(shortcuts|showActions|output\/|\/output|OutputHelper|helpers\/output)[^"']*["']/
const ESCREVE_SAIDA = /\boutputs\.(set|update)\b|outputSlideCache|\bclearAll\b/

/** checagens de texto do componente novo; devolve lista de erros */
export function checarComponente(nome, texto) {
    const erros = []
    const t = unificar(texto)
    if (/<svelte:(window|body|document)/.test(t)) erros.push(`${nome}: <svelte:window|body|document> proibido (ficaria ligado com o popover fechado)`)
    if (/:global\(/.test(t)) erros.push(`${nome}: :global( proibido`)
    if (IMPORTA_PROIBIDO.test(t)) erros.push(`${nome}: importa shortcuts/showActions/output/OutputHelper`)
    if (ESCREVE_SAIDA.test(t)) erros.push(`${nome}: mexe em outputs/outputSlideCache/clearAll`)
    const linhas = t.split("\n")
    // ouvinte so DENTRO de funcao: linha de `addEventListener` com recuo de corpo de funcao (>= 8 espacos)
    linhas.forEach((l, i) => {
        if (/addEventListener\(/.test(l) && !/removeEventListener\(/.test(l) && !/^\s{8,}/.test(l)) erros.push(`${nome}: addEventListener fora de funcao (linha ${i + 1})`)
    })
    const adds = (t.match(/[^e]addEventListener\(/g) || []).length
    const rems = (t.match(/removeEventListener\(/g) || []).length
    if (adds !== rems) erros.push(`${nome}: ${adds} addEventListener contra ${rems} removeEventListener`)
    return erros
}

export function checarLogica(nome, texto) {
    const erros = []
    const t = unificar(texto)
    if (/from\s+["'][^"']*stores["']/.test(t)) erros.push(`${nome}: a logica pura nao importa stores`)
    if (/\.subscribe\(/.test(t)) erros.push(`${nome}: a logica pura nao assina store`)
    if (/new Date\(\s*["'`]|toISOString\(/.test(t)) erros.push(`${nome}: new Date(string) e toISOString() proibidos (fuso)`)
    return erros
}

/**
 * @param {{ manifesto: any, alterados: {caminho:string,status:string}[], base: Record<string,string|null>, head: Record<string,string|null> }} e
 * @returns {string[]} erros (vazio = passou)
 */
export function verificar({ manifesto, alterados, base, head, fixos = PARES_FIXOS }) {
    const erros = []
    const arquivos = manifesto?.arquivos || []
    if (!arquivos.length) erros.push("manifesto vazio")
    if (arquivos.length !== 1 || arquivos[0].arquivo !== PROJECTS) erros.push(`o manifesto tem de ter exatamente ${PROJECTS}`)
    const alteradosCaminhos = alterados.map((a) => a.caminho)

    if (!alteradosCaminhos.includes(PROJECTS)) erros.push(`${PROJECTS}: esta no manifesto mas nao foi alterado`)
    for (const { caminho, status } of alterados) {
        if (caminho === PACKAGE) continue
        if (status === "M" && caminho !== PROJECTS) erros.push(`${caminho}: arquivo existente alterado fora do manifesto`)
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
        let texto = unificar(h)
        const pares = a.pares || []
        const ids = pares.map((p) => p.id).sort()
        const esperados = Object.keys(fixos).sort()
        if (JSON.stringify(ids) !== JSON.stringify(esperados)) erros.push(`${f}: os pares do manifesto sao [${ids}], esperados [${esperados}]`)
        for (const p of pares) {
            const fixo = fixos[p.id]
            if (!fixo) {
                erros.push(`${f}: par desconhecido "${p.id}"`)
                continue
            }
            if (sha(p.prefixo) !== fixo.prefixo) erros.push(`${f}: o prefixo do par ${p.id} difere do fixado no script`)
            if (sha(p.sufixo) !== fixo.sufixo) erros.push(`${f}: o sufixo do par ${p.id} difere do fixado no script`)
            if (p.recuo !== fixo.recuo) erros.push(`${f}: o recuo do par ${p.id} difere do fixado no script`)
            const antes = unificar(p.antes)
            const depois = construirDepois({ ...p, recuo: fixo.recuo })
            const na = contar(unificar(b), antes)
            const nd = contar(texto, depois)
            if (na !== 1) erros.push(`${f}: "antes" do par ${p.id} ocorre ${na}x na base (esperado 1): ${antes.slice(0, 50)}`)
            if (nd !== 1) erros.push(`${f}: "depois" (construido) do par ${p.id} ocorre ${nd}x no head (esperado 1): ${depois.slice(0, 50)}`)
            texto = texto.split(depois).join(antes)
        }
        if (sha(texto) !== sha(b)) erros.push(`${f}: desfeitos os pares, difere da base (algo alem do declarado mudou)`)
    }
    if (arquivos.length && comparados !== arquivos.length) erros.push(`comparou ${comparados} arquivos, o manifesto tem ${arquivos.length}`)
    if (arquivos.length && comparados === 0) erros.push("nenhuma comparacao feita (refs iguais?)")

    // os outros arquivos
    const novosSvelte = alterados.filter((a) => a.status === "A" && a.caminho.endsWith(".svelte")).map((a) => a.caminho)
    for (const { caminho, status } of alterados) {
        if (caminho === PROJECTS) {
            if (status !== "M") erros.push(`${caminho}: status ${status} (so modificacao e permitida)`)
            continue
        }
        if (caminho === PACKAGE) {
            const h = unificar(head[PACKAGE] ?? "")
            const sem = h
                .split("\n")
                .filter((l) => !/"test:fvs"/.test(l))
                .join("\n")
            const igual = (x, y) => x.replace(/,(\s*\n\s*[}\]])/g, "$1") === y.replace(/,(\s*\n\s*[}\]])/g, "$1")
            if (!igual(sem, unificar(base[PACKAGE] ?? ""))) erros.push(`${PACKAGE}: so a linha test:fvs pode mudar`)
            continue
        }
        if (status === "A" && NOVOS_PERMITIDOS.some((r) => r.test(caminho))) continue
        erros.push(`${caminho}: arquivo fora da lista permitida (status ${status})`)
    }

    // arquivos novos: texto
    if (head[COMPONENTE]) erros.push(...checarComponente(COMPONENTE, head[COMPONENTE]))
    if (head[LOGICA]) erros.push(...checarLogica(LOGICA, head[LOGICA]))

    // .svelte novo so e importado por Projects.svelte, e nunca pela saida
    for (const nova of novosSvelte) {
        const nome = nova
            .split("/")
            .pop()
            .replace(/\.svelte$/, "")
        for (const [caminho, conteudo] of Object.entries(head)) {
            if (conteudo == null || caminho === nova || !/\.(svelte|ts|js)$/.test(caminho)) continue
            if (new RegExp(`import[^\\n]*\\/${nome}\\.svelte["']`).test(unificar(conteudo)) && !IMPORTADORES_PERMITIDOS.some((r) => r.test(caminho))) erros.push(`${caminho}: importa ${nome}.svelte (so Projects.svelte pode)`)
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
    return JSON.parse(readFileSync(new URL("./fvs-manifesto.json", import.meta.url), "utf8"))
}

/** todos os .svelte/.ts do head (para a regra de importadores): quando comparando commits, le do git */
function todosDoHead(headRef) {
    const lista = headRef ? git(["ls-tree", "-r", "--name-only", headRef, "src/frontend"]) : git(["ls-files", "src/frontend"])
    const saida = {}
    for (const c of lista.split("\n").filter((x) => /\.(svelte|ts)$/.test(x))) saida[c] = headRef ? gitBlob(headRef, c) : existsSync(c) ? readFileSync(c, "utf8") : null
    return saida
}

export function rodar(baseRef, headRef) {
    const manifesto = carregarManifesto()
    const { alterados, base, head } = coletar(baseRef, headRef)
    for (const f of manifesto.arquivos.map((a) => a.arquivo)) {
        if (!(f in base)) {
            base[f] = gitBlob(baseRef, f)
            head[f] = headRef ? gitBlob(headRef, f) : existsSync(f) ? readFileSync(f, "utf8") : null
        }
    }
    // a varredura de importadores olha o head inteiro (nao so o que mudou)
    const todos = todosDoHead(headRef)
    for (const [c, t] of Object.entries(todos)) if (!(c in head)) head[c] = t
    return { erros: verificar({ manifesto, alterados, base, head }), manifesto, alterados, base, head }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const [baseRef, headRef] = process.argv.slice(2)
    if (!baseRef) {
        console.error("uso: node scripts/fvs-guarda.mjs <base-sha> [head]")
        process.exit(2)
    }
    const { erros, alterados } = rodar(baseRef, headRef)
    if (erros.length) {
        console.error(`FVS: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`FVS: ok (${alterados.length} arquivos alterados)`)
}
