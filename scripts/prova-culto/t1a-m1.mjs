// M1 (1a): mede quanto o store `outputDisplay` leva para virar true depois de um clique real em #output_window_button (app a frio).
// Uso (app recem aberto por restaurar.sh + reiniciar.sh): node scripts/prova-culto/t1a-m1.mjs   -> imprime { ligarMs, desligarMs }.
// Depois liga e desliga pelo mesmo botao (dois cliques, o 2o entre 1 s e 1,8 s). Nada escreve no Sirvo.
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"
import { PREPARAR_SAIDA } from "./saidaLib.mjs"

const j = await abrir("principal")
await j.ev(PREPARAR_SAIDA)
await j.ev(`S.modoAlianca.set("culto"); S.activePage.set("show"); await esp(800); return 1`)
await j.ev(`window.__m1=[]; S.outputDisplay.subscribe(v=>window.__m1.push([performance.now(),v])); return 1`)
const btn = await localizar(j, `document.querySelector("#output_window_button")`)
if (!btn.ok) {
    console.error("m1: botao da saida nao esta livre: " + btn.motivo)
    process.exit(1)
}
const t0 = await j.ev(`window.__m1.length=0; window.__t0=performance.now(); return window.__t0`)
await clicarEm(j, btn.x, btn.y)
let ligar = null
for (let i = 0; i < 100 && ligar === null; i++) {
    await esperar(100)
    ligar = await j.ev(`const e=window.__m1.find(x=>x[1]===true); return e? e[0]-window.__t0 : null`)
}
console.log("ligarMs", ligar)
if (ligar === null) process.exit(1)
await esperar(1200)
await j.ev(`window.__m1.length=0; window.__t0=performance.now(); return 1`)
await clicarEm(j, btn.x, btn.y) // 1o clique: pergunta
await esperar(1000)
const btn2 = await localizar(j, `document.querySelector("#output_window_button")`)
await clicarEm(j, btn2.x, btn2.y) // 2o clique: desliga
let desligar = null
for (let i = 0; i < 100 && desligar === null; i++) {
    await esperar(100)
    desligar = await j.ev(`const e=window.__m1.find(x=>x[1]===false); return e? e[0]-window.__t0 - 1000 : null`)
}
console.log("desligarMs(aprox, contado do 1o clique menos 1 s de espera)", desligar)
j.fechar()
