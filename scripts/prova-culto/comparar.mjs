// Compara duas gravacoes da prova do Culto e imprime a PRIMEIRA divergencia (passo, fluxo, 5 eventos em volta). Sai com 1 se houver.
//
//   node scripts/prova-culto/comparar.mjs <A.json> <B.json> [--esperado esperado.json] [--ruido ruido.json] [--sem-ruido] [--aprender C.json ...]
//
// --aprender   lista os caminhos que variam entre A, B e as demais (A/A/A) como padroes candidatos para ruido.json (revisao manual).
// Cabecalhos incompativeis (roteiro, janela, escala, perfil) reprovam com mensagem clara: gravacoes de maquinas diferentes nao se comparam.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"
import { difPng } from "./png.mjs"
import { achatar, comparar, conferirCabecalhos, contexto, validarEsperado, validarRuido } from "./compararLogica.mjs"

const AQUI = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (n) => args.includes("--" + n)
const valor = (n) => (args.includes("--" + n) ? args[args.indexOf("--" + n) + 1] : null)
const arquivos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && ["esperado", "ruido"].includes(args[i - 1].slice(2))))
const ler = (f) => JSON.parse(readFileSync(f, "utf8"))

const FLAGS_CONHECIDAS = ["esperado", "ruido", "sem-ruido", "aprender", "so-comuns", "pixel", "tolerancia-px"]
for (const a of args) {
    if (a.startsWith("--") && !FLAGS_CONHECIDAS.includes(a.slice(2))) {
        console.error(`flag desconhecida: ${a}`)
        process.exit(2)
    }
}

if (arquivos.length < 2) {
    console.error("uso: comparar.mjs <A.json> <B.json> [--esperado f] [--ruido f]")
    process.exit(2)
}
const [fa, fb, ...resto] = arquivos
const A = ler(fa)
const B = ler(fb)

// cabecalhos
const ca = A.cabecalho
const cb = B.cabecalho
for (const c of [ca, cb]) {
    if (c.layout !== undefined && c.layout !== "novo") {
        console.error("gravacao do leiaute classico: nao existe mais")
        process.exit(2)
    }
}
// --so-comuns: compara so os passos que existem nas duas (gravacao parcial, ex.: --secoes A) contra o baseline inteiro
if (flag("so-comuns")) {
    const ids = new Set(B.passos.map((p) => p.id))
    A.passos = A.passos.filter((p) => ids.has(p.id))
    const idsA = new Set(A.passos.map((p) => p.id))
    B.passos = B.passos.filter((p) => idsA.has(p.id))
}
const arqEsperado = valor("esperado") || null
const esperado = arqEsperado ? ler(arqEsperado) : []
const incompativeis = conferirCabecalhos(ca, cb, esperado)
if (incompativeis.length) {
    console.error("GRAVACOES NAO COMPARAVEIS:\n  - " + incompativeis.join("\n  - "))
    process.exit(2)
}
if (A.violacoes?.length || B.violacoes?.length) {
    console.error("GRAVACAO COM VIOLACAO (regra C1): " + [...(A.violacoes || []), ...(B.violacoes || [])].join("; "))
    process.exit(2)
}

if (flag("aprender")) {
    const todos = [A, B, ...resto.map(ler)].map(achatar)
    const chaves = new Set(todos.flatMap((m) => [...m.keys()]))
    const variam = [...chaves].filter((k) => new Set(todos.map((m) => JSON.stringify(m.has(k) ? m.get(k) : "<ausente>"))).size > 1)
    console.log(JSON.stringify({ variam: variam.length, chaves: variam }, null, 1))
    process.exit(0)
}

// pixel: o que a saida MOSTRA (print de cada passo, quando gravado com --pixel). Tolerancia = o pior do A/A medido, passada em --tolerancia-px
let pixelFalhou = false
if (flag("pixel")) {
    const tol = Number(valor("tolerancia-px") || 0)
    const dA = dirname(fa)
    const dB = dirname(fb)
    let comparados = 0
    for (const p of A.passos) {
        const pa = join(dA, `${ca.rotulo}-${p.id}.png`)
        const pb = join(dB, `${cb.rotulo}-${p.id}.png`)
        if (!existsSync(pa) || !existsSync(pb)) continue
        comparados++
        const d = difPng(pa, pb, 8)
        if (d.n < 0 || d.n > tol) {
            pixelFalhou = true
            console.error(`PIXEL: passo ${p.id}: ${d.n < 0 ? "dimensoes diferentes " + d.dim : d.n + " pixels diferentes (tolerancia " + tol + ") caixa " + d.caixa}`)
        }
    }
    if (!comparados) {
        console.error("PIXEL: nenhum par de prints encontrado (gravou com --pixel?)")
        pixelFalhou = true
    } else console.log(`pixel: ${comparados} prints comparados`)
}

const ruido = flag("sem-ruido") ? { padroes: [] } : ler(valor("ruido") || join(AQUI, "ruido.json"))
const errosEsq = validarEsperado(esperado)
if (errosEsq.length) {
    console.error("ESPERADO INVALIDO:\n  - " + errosEsq.join("\n  - "))
    process.exit(2)
}
const r = comparar(A, B, { ruido, esperado })
if (r.erros.length) {
    console.error("RUIDO INVALIDO:\n  - " + r.erros.join("\n  - "))
    process.exit(2)
}
console.log(`comparadas ${achatar(A).size} chaves; mascaradas ${r.mascarados}; divergencias ${r.divergencias.length} (nao declaradas ${r.naoDeclaradas.length}); itens declarados que nao ocorreram ${r.fantasmas.length}`)
let falhou = pixelFalhou
if (r.naoDeclaradas.length) {
    falhou = true
    const d = r.naoDeclaradas[0]
    console.error(`\nPRIMEIRA DIVERGENCIA: passo ${d.passo}  fluxo ${d.fluxo}  caminho ${d.caminho}\n  de   ${JSON.stringify(d.de).slice(0, 300)}\n  para ${JSON.stringify(d.para).slice(0, 300)}`)
    console.error("  eventos em volta (A):\n    " + contexto(A, d).join("\n    "))
    console.error("  eventos em volta (B):\n    " + contexto(B, d).join("\n    "))
    const outras = r.naoDeclaradas.slice(1, 8).map((x) => `${x.passo} ${x.fluxo} ${x.caminho}`)
    if (outras.length) console.error(`  outras (${r.naoDeclaradas.length - 1}): ${outras.join(" | ")}`)
}
for (const f of r.fantasmas) {
    falhou = true
    console.error(`ITEM DECLARADO QUE NAO OCORREU: ${f.id || ""} passo ${f.passo} ${f.fluxo} ${f.caminho}`)
}
if (!falhou) console.log("IGUAL (salvo o declarado)")
process.exit(falhou ? 1 : 0)
