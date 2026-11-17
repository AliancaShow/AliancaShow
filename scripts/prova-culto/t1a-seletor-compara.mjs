// T-1a-2: compara os retangulos do seletor Culto | Preparar medidos no HEAD e na referencia (../ref-f0c), cada um por `t1a-barra.mjs`
// (T1A_TAG=head|ref). Sai com 1 se divergirem em qualquer modo.
import { readFileSync } from "node:fs"
const ler = (t) => JSON.parse(readFileSync(`../gravacoes/t1a-seletor-${t}.json`, "utf8"))
const h = ler("head")
const r = ler("ref")
let ruim = false
for (const m of ["culto", "preparar"]) {
    const igual = JSON.stringify(h[m]) === JSON.stringify(r[m])
    console.log(`${igual ? "ok   " : "FALHA"} seletor no modo ${m}: head ${h[m]} | ref ${r[m]}`)
    if (!igual) ruim = true
}
process.exit(ruim ? 1 : 0)
