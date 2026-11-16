// node fva-comparar.mjs <dirA> <prefA> <dirB> <prefB> [--cores]
import { readFileSync, readdirSync } from "node:fs"
import { difPng } from "./fva-lib.mjs"
const [, , dA, pA, dB, pB, ...flags] = process.argv
const nomes = readdirSync(dA)
    .filter((f) => f.startsWith(pA) && f.endsWith(".json"))
    .map((f) => f.slice(pA.length, -5))
let tot = { dom: 0, rect: 0, cor: 0, px: 0 }
for (const n of nomes) {
    const A = JSON.parse(readFileSync(`${dA}/${pA}${n}.json`)),
        B = JSON.parse(readFileSync(`${dB}/${pB}${n}.json`))
    let dom = 0,
        rect = 0,
        cor = 0
    const pares = new Map()
    const ex = []
    const k = Math.min(A.els.length, B.els.length)
    if (A.els.length !== B.els.length) dom += Math.abs(A.els.length - B.els.length)
    for (let i = 0; i < k; i++) {
        const a = A.els[i],
            b = B.els[i]
        if (a.sig !== b.sig) {
            dom++
            if (ex.length < 3) ex.push(a.sig.slice(0, 120) + "  >>  " + b.sig.slice(0, 120))
        }
        if (a.rect.join() !== b.rect.join()) {
            rect++
            if (ex.length < 3) ex.push("rect " + a.tag + " " + a.rect + " >> " + b.rect)
        }
        for (const p of Object.keys(a.cor))
            if (a.cor[p] !== b.cor[p]) {
                cor++
                const key = p + " | " + a.cor[p] + " -> " + b.cor[p]
                pares.set(key, (pares.get(key) || 0) + 1)
            }
    }
    const px = difPng(`${dA}/${pA}${n}.png`, `${dB}/${pB}${n}.png`, 2, [[0, 676, 1365, 28]])
    tot.dom += dom
    tot.rect += rect
    tot.cor += cor
    tot.px += px.n > 0 ? px.n : 0
    console.log(`${n.padEnd(28)} dom=${dom} rect=${rect} cor=${cor} px=${px.n}${px.caixa ? " caixa=" + px.caixa : ""} vars=${A.vars.sec}->${B.vars.sec} ds=${JSON.stringify(B.ds)}`)
    for (const e of ex) console.log("    ! " + e)
    if (flags.includes("--cores")) {
        for (const [k2, v] of [...pares].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log("    " + v + "x " + k2)
    }
}
console.log("TOTAL", JSON.stringify(tot))
