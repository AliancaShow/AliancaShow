// T7 (prototipo descartavel, revisao C7): o painel largo so com CSS. Roda DEPOIS das gravacoes. Criterios MEDIDOS aqui:
//   (2) section.drawer vai da borda esquerda a direita da .row e a base das colunas coincide com o topo dele (+-1 px);
//   (3) arrastar a alca da gaveta (mouse real) muda a altura (store) e o layout continua coerente.
// O criterio (1) (roteiro A-C sob o CSS, telao igual ao baseline) e a execucao `rodar.mjs --css prototipo-painel-largo.css --secoes A,B,C`.
// NAO medidos: (4) rolagem da grade, (5) soltar midia num slide, (6) menu de contexto sob o cursor, (7) consumidores de `.center`.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { abrir, esperar } from "./lib.mjs"
const AQUI = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(AQUI, "prototipo-painel-largo.css"), "utf8")
const j = await abrir("principal")
await j.ev(`MODO("culto"); T.trocarTela("show", "segmentado"); S.drawer.set({height:300,stored:null}); await esp(600)`)
await j.ev(`const s=document.createElement("style"); s.id="__t7"; s.textContent=${JSON.stringify(css)}; document.head.appendChild(s); await esp(500); return 1`)
const medir = () =>
    j
        .ev(
            `const q=(s)=>document.querySelector(s); const r=(e)=>{const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,r:b.right,b:b.bottom,w:b.width,h:b.height}}
    const row=r(q(".column > .row")), d=r(q("section.drawer")), l=r(q("#leftPanel")), rt=r(q("#rightPanel")), pc=r(q(".pageContent"))
    return JSON.stringify({row,d,l,rt,pc})`
        )
        .then(JSON.parse)
const g = await medir()
const ok = (c, m) => (console.log((c ? "OK   " : "FALHA ") + m), c)
let falhas = 0
const crit = (c, m) => {
    if (!ok(c, m)) falhas++
}
crit(Math.abs(g.d.x - g.row.x) <= 1 && Math.abs(g.d.r - g.row.r) <= 1, `(2) gaveta de ponta a ponta: gaveta ${g.d.x}..${g.d.r} x linha ${g.row.x}..${g.row.r}`)
crit(Math.abs(g.l.b - g.d.y) <= 14 && Math.abs(g.rt.b - g.d.y) <= 14 && Math.abs(g.pc.b - g.d.y) <= 14, `(2) base das colunas e do conteudo encosta no topo da gaveta (vao <= 12 px do gap): ${g.l.b}, ${g.pc.b}, ${g.rt.b} x ${g.d.y}`)
await j.foto(join(AQUI, "gravacoes", "t7-painel-largo.png")).catch(() => {})
// (3) arrasta a alca da gaveta: borda de cima da gaveta (Resizeable top)
const h0 = await j.ev(`return get(S.drawer).height`)
const alca = await j.ev(`const b=document.querySelector("section.drawer").getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+2}`)
await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: alca.x, y: alca.y })
await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: alca.x, y: alca.y, button: "left", clickCount: 1 })
for (const dy of [-20, -60, -100]) await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: alca.x, y: alca.y + dy, button: "left" })
await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: alca.x, y: alca.y - 100, button: "left", clickCount: 1 })
await esperar(500)
const h1 = await j.ev(`return get(S.drawer).height`)
const g2 = await medir()
crit(h1 > h0 + 40, `(3) arrastar a alca da gaveta: altura ${h0} -> ${h1}`)
crit(Math.abs(g2.d.x - g2.row.x) <= 1 && Math.abs(g2.d.r - g2.row.r) <= 1, "(3) depois do arrasto a gaveta continua de ponta a ponta")
await j.ev(`document.getElementById("__t7")?.remove(); S.drawer.set({height:300,stored:null}); return 1`)
j.fechar()
console.log(falhas ? `\n${falhas} criterio(s) FALHARAM: decisao do Andre (plano B nao e decidido pelo Sonnet)` : "\ncriterios (2) e (3) passaram")
process.exit(falhas ? 1 : 0)
