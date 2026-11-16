// Juiz por invariantes da secao H (Preparar). Sai com 1 em violacao e 2 em gravacao invalida.
//   node scripts/prova-culto/invariantes.mjs <gravacao.json>
import { readFileSync } from "node:fs"
import { invariantes } from "./invariantesLogica.mjs"

const arq = process.argv[2]
if (!arq || arq.startsWith("--")) {
    console.error("uso: invariantes.mjs <gravacao.json>")
    process.exit(2)
}
let g
try {
    g = JSON.parse(readFileSync(arq, "utf8"))
} catch (e) {
    console.error("gravacao ilegivel: " + e.message)
    process.exit(2)
}
const { erros, violacoes } = invariantes(g)
if (erros.length) {
    console.error("GRAVACAO INVALIDA:\n  - " + erros.join("\n  - "))
    process.exit(2)
}
const n = g.passos.filter((p) => p.secao === "H").length
if (violacoes.length) {
    console.error(`INVARIANTES VIOLADAS (${violacoes.length}) em ${n} passos:`)
    for (const v of violacoes) console.error(`  - passo ${v.passo} regra ${v.regra}: ${v.detalhe}`)
    process.exit(1)
}
console.log(`INVARIANTES: ok (${n} passos da secao H, zero outputs, zero canal de saida, telao igual)`)
