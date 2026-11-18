// Fatia 2, fumaca das duas travas de gesto, contra o Show de dev (CDP, FS_CDP_PORTA). Teclas e cliques REAIS, nunca force.
//   1. Esc que tira o foco de um campo de texto segura o Esc seguinte (700 ms): o telao NAO limpa; passados os 700 ms o Esc limpa;
//   2. duplo clique real num slide de Mostrar: um unico slide no ar e o dblclick nao faz nada.
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")
try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); T.trocarTela("show","segmentado"); S.outputs.update(a=>{a.default.out={};return a}); const {loadShows}=await import(U("components/helpers/setShow")); await loadShows(["impulso_aos_teus_pes"]); S.activeShow.set({id:"impulso_aos_teus_pes",type:"show"}); await esp(900); return 1`)
    const noAr = () => j.ev(`return get(S.outputs).default?.out?.slide?.index ?? null`)
    // 1. Esc com foco em campo
    { const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[1]`); await clicarEm(j, a.x, a.y) }
    await esperar(500)
    ok("slide no ar antes do Esc", (await noAr()) !== null, String(await noAr()))
    await j.ev(`const c=document.querySelector('[data-regiao="biblioteca"] input'); c?.focus(); return !!c`)
    await esperar(200)
    await tecla(j, "Escape")
    await esperar(150)
    await tecla(j, "Escape")
    await esperar(400)
    ok("o segundo Esc (150 ms depois do que tirou o foco) NAO limpou o telao", (await noAr()) !== null, String(await noAr()))
    await esperar(900)
    await tecla(j, "Escape")
    await esperar(500)
    ok("passados os 700 ms o Esc limpa", (await noAr()) === null, String(await noAr()))
    // 2. duplo clique no slide
    await j.ev(`S.outputs.update(a=>{a.default.out={};return a}); window.__n=0; const o=get(S.outputs); return 1`)
    const { x, y } = await localizar(j, `document.querySelectorAll("#showArea .slide")[2]`)
    await j.ev(`window.__escritas=0; S.outputs.subscribe(()=>window.__escritas++); return 1`)
    const a0 = await j.ev(`return window.__escritas`)
    await clicarEm(j, x, y, 1)
    await esperar(600)
    const simples = (await j.ev(`return window.__escritas`)) - a0
    await j.ev(`S.outputs.update(a=>{a.default.out={};return a}); return 1`)
    await esperar(300)
    const antes = await j.ev(`return window.__escritas`)
    await clicarEm(j, x, y, 1)
    await esperar(90)
    await clicarEm(j, x, y, 2)
    await esperar(600)
    const depois = await j.ev(`return window.__escritas`)
    ok("duplo clique no slide: um slide no ar, uma unica escrita em outputs", (await noAr()) === 1 && depois - antes === simples, `idx=${await noAr()} escritas duplo=${depois - antes} simples=${simples}`)
} catch (e) {
    console.log("FALHA excecao", e.message)
    falhas.push("excecao")
}
await j.fechar?.()
process.exit(falhas.length ? 1 : 0)
