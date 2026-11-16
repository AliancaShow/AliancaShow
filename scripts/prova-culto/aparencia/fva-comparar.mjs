// Portao de aparencia do Culto: compara duas rodadas de fva-estados.mjs (referencia A e HEAD B).
//   node fva-comparar.mjs <dirA> <prefA> <dirB> <prefB> [--esperado esperado.json] [--cores]
// Sai com 0 (igual, salvo o declarado em itens `dom`), 1 (reprovou: rect, cor, sig nao declarado, px acima da tolerancia, fantasma, estado
// faltando ou sobrando, saida ligada) ou 2 (uso, flag desconhecida, esperado invalido). Nos estados do Preparar so mede e imprime.
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { difPng } from "./fva-lib.mjs"
import { ESTADOS_APARENCIA, ESTADOS_CULTO, compararAparencia, mascaraDePixel } from "./fvaLogica.mjs"
import { validarEsperado } from "../compararLogica.mjs"

const args = process.argv.slice(2)
const FLAGS = ["esperado", "cores"]
const posicionais = []
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
        if (!FLAGS.includes(args[i].slice(2))) {
            console.error(`flag desconhecida: ${args[i]}`)
            process.exit(2)
        }
        if (args[i] === "--esperado") i++
    } else posicionais.push(args[i])
}
if (posicionais.length !== 4) {
    console.error("uso: fva-comparar.mjs <dirA> <prefA> <dirB> <prefB> [--esperado f] [--cores]")
    process.exit(2)
}
const [dA, pA, dB, pB] = posicionais
const AQUI = dirname(fileURLToPath(import.meta.url))
const arqEsperado = args.includes("--esperado") ? args[args.indexOf("--esperado") + 1] : join(AQUI, "..", "esperado.json")
let esperado
try {
    esperado = JSON.parse(readFileSync(arqEsperado, "utf8"))
} catch (e) {
    console.error(`esperado ilegivel (${arqEsperado}): ${e.message}`)
    process.exit(2)
}
const errosEsq = validarEsperado(esperado)
if (errosEsq.length) {
    console.error("ESPERADO INVALIDO:\n  - " + errosEsq.join("\n  - "))
    process.exit(2)
}

const lado = (dir, pref) => {
    const estados = {}
    for (const e of ESTADOS_APARENCIA) if (existsSync(`${dir}/${pref}${e}.json`)) estados[e] = JSON.parse(readFileSync(`${dir}/${pref}${e}.json`, "utf8"))
    const cab = `${dir}/${pref}cabecalho.json`
    return { cabecalho: existsSync(cab) ? JSON.parse(readFileSync(cab, "utf8")) : { outputDisplay: null, commit: "?" }, estados }
}
const A = lado(dA, pA)
const B = lado(dB, pB)
// o cabecalho TEM de existir: sem ele nao ha como saber se a saida estava ligada
for (const [n, d, p, G] of [
    ["A", dA, pA, A],
    ["B", dB, pB, B]
])
    if (!existsSync(`${d}/${p}cabecalho.json`)) {
        console.error(`o lado ${n} nao tem ${p}cabecalho.json (gravado por fva-estados.mjs)`)
        process.exit(2)
    }

// pixel: mascara = elementos que a varredura pula, nos dois lados
const px = {}
for (const e of ESTADOS_APARENCIA) {
    if (!A.estados[e] || !B.estados[e]) continue
    const pa = `${dA}/${pA}${e}.png`
    const pb = `${dB}/${pB}${e}.png`
    if (!existsSync(pa) || !existsSync(pb)) continue
    const d = difPng(pa, pb, 2, [...mascaraDePixel(A.estados[e]), ...mascaraDePixel(B.estados[e])])
    px[e] = d.n < 0 ? 1e9 : d.n
    if (d.caixa) A.estados[e].caixaPx = d.caixa
}
const r = compararAparencia(A, B, esperado, { px })

console.log(`A: ${A.cabecalho.commit}  B: ${B.cabecalho.commit}`)
const tot = { dom: 0, declarados: 0, rect: 0, cor: 0, estilo: 0, contagem: 0, px: 0 }
for (const e of ESTADOS_APARENCIA) {
    const x = r.porEstado[e]
    if (!x) {
        console.log(`${e.padEnd(28)} (nao comparado)`)
        continue
    }
    const culto = ESTADOS_CULTO.includes(e)
    for (const k of Object.keys(tot)) tot[k] += culto ? (x[k] > 0 && k === "px" ? x[k] : x[k] || 0) : 0
    console.log(`${e.padEnd(28)} ${culto ? "" : "[sem portao] "}dom=${x.dom} declarados=${x.declarados} rect=${x.rect} cor=${x.cor} estilo=${x.estilo} contagem=${x.contagem} px=${x.px}${A.estados[e].caixaPx ? " caixa=" + A.estados[e].caixaPx : ""}`)
    if (args.includes("--cores")) for (const v of r.reprovas.filter((z) => z.estado === e && z.tipo === "cor").slice(0, 12)) console.log("    " + v.detalhe)
}
console.log("TOTAL (estados do Culto)", JSON.stringify(tot))
for (const v of r.reprovas) console.error(`REPROVADO ${v.estado} [${v.tipo}] ${v.detalhe}`)
for (const f of r.fantasmas) console.error(`ITEM DOM QUE NAO OCORREU: ${f.item.id || ""} no estado ${f.estado} (${f.item.seletor} ${f.item.atributo})`)
const falhou = r.reprovas.length > 0 || r.fantasmas.length > 0
console.log(falhou ? `REPROVOU: ${r.reprovas.length} reprovacao(oes), ${r.fantasmas.length} fantasma(s)` : "IGUAL (salvo o declarado)")
process.exit(falhou ? 1 : 0)
