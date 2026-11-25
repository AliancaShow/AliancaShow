// Andre, 25/nov ("soltar a Biblia mais rapido"): em Mostrar o DUPLO CLIQUE num versiculo vai ao ar; o clique simples so previa; em Editar o duplo
// clique nao manda nada. Contra o Show de dev (CDP), perfil de prova. Cliques REAIS (localizar + clicarEm).
//   node scripts/prova-culto/t19-biblia-duplo.mjs
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await esperar(600)
const noAr = () => j.ev(`return Object.values(get(S.outputs)).filter(o=>!o.stageOutput).some(o=>!!o.out?.slide)`)
const limpar = () => j.ev(`S.outLocked.set(false); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); await esp(400); return 1`)
async function abrirBiblia() {
    await j.ev(`let e=document.querySelector('[data-acao=arvore]'); while(e){ if(e.scrollTop) e.scrollTop=0; e=e.parentElement } await esp(200); return 1`)
    const a = await localizar(j, `[...document.querySelectorAll('[data-acao=arvore] button')].find(b=>b.innerText.includes("Bíblia"))`)
    ok("a Biblia existe na arvore", a.ok, a.motivo)
    if (a.ok) await clicarEm(j, a.x, a.y)
    for (let t = 0; t < 20 && !(await j.ev(`return !!document.querySelector('[data-regiao=biblioteca] .verse')`)); t++) await esperar(500)
}
const versiculo = (i) => localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .verse')[${i}]`)

try {
    await j.ev(`MODO("culto"); await esp(600); return 1`)
    await limpar()
    await abrirBiblia()
    let v = await versiculo(1)
    ok("versiculo visivel", v.ok, v.motivo)
    await clicarEm(j, v.x, v.y, 1)
    await esperar(1200)
    ok("A clique simples num versiculo: nada no ar", !(await noAr()))
    v = await versiculo(2)
    await clicarEm(j, v.x, v.y, 1)
    await clicarEm(j, v.x, v.y, 2)
    await esperar(1500)
    ok("B duplo clique num versiculo vai ao ar", await noAr())
    const sel = await j.ev(`return document.querySelectorAll('[data-regiao=biblioteca] .verse')[2]?.classList.contains("isActive")`)
    ok("B o versiculo do duplo clique e o selecionado", sel)
    await limpar()

    // C: em Editar o duplo clique nao manda ao ar
    await j.ev(`MODO("preparar"); await esp(800); return 1`)
    await limpar()
    await abrirBiblia()
    v = await versiculo(1)
    if (v.ok) {
        await clicarEm(j, v.x, v.y, 1)
        await clicarEm(j, v.x, v.y, 2)
        await esperar(1200)
    }
    ok("C em Editar o duplo clique nao manda ao ar", v.ok && !(await noAr()), v.motivo)
} catch (e) {
    ok("sem excecao", false, String(e?.stack || e))
} finally {
    await limpar().catch(() => {})
    await j.ev(`MODO("culto"); return 1`).catch(() => {})
    await j.enviar("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
    console.log(falhas.length ? `\nT19: ${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nT19: tudo ok")
    process.exit(falhas.length ? 1 : 0)
}
