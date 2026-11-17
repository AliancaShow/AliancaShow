// Prints da rodada de ajustes da 1b (16/nov). Cliques REAIS, nunca force. Chips por injecao de store (nada escreve no Sirvo).
//   node scripts/prova-culto/t1b-ajustes-prints.mjs pilula <arquivo.png>   : barra do Preparar com os chips de roteiro e chat
//   node scripts/prova-culto/t1b-ajustes-prints.mjs sem-chip <arquivo.png> : a mesma barra sem chip (a pilula volta)
//   node scripts/prova-culto/t1b-ajustes-prints.mjs monitor <arquivo.png>  : o item "Monitor de retorno" em Configuracoes (sem reticencias)
import { writeFileSync } from "node:fs"
import { abrir, clicarEm, esperar, injetarChips, irParaModo, localizar, prepararCulto, recarregar, relato } from "./t1aLib.mjs"

const [modo, arquivo] = process.argv.slice(2)
const r = relato("t1b-ajustes-prints")
const j = await abrir("principal")
await recarregar(j)
await prepararCulto(j)
await irParaModo(j, "Preparar")
const foto = async (clip) => {
    const x = (await j.enviar("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 } })).result
    writeFileSync(arquivo, Buffer.from(x.data, "base64"))
    console.log("print", arquivo)
}
if (modo === "pilula" || modo === "sem-chip") {
    // pilula "tudo pronto": sem item para conferir, sem letra faltando e sem nada na fila
    await j.ev(`S.activeProject.set(null); const M=await import(U("utils/aliancaSirvoMaterial")); M.sirvoMaterialEstado.update(e=>({...e,habilitado:true,naFila:0,falhas:[]})); await esp(500); return 1`)
    if (modo === "pilula") await injetarChips(j)
    await esperar(700)
    const b = await j.ev(`const p=document.querySelector(".prepararBarra .pilula"); const c=[...document.querySelectorAll(".prepararBarra [data-chip]")].map(x=>x.dataset.chip); return {pilula:p?p.innerText.trim():null, chips:c}`)
    console.log("estado", JSON.stringify(b))
    if (modo === "pilula") r.ok("com chip de roteiro e chat o tudo pronto nao esta no DOM", b.pilula === null && b.chips.length === 2, JSON.stringify(b))
    else r.ok("sem chip o tudo pronto volta", b.pilula === "tudo pronto ✓" && b.chips.length === 0, JSON.stringify(b))
    await foto({ x: 0, y: 0, width: 1365, height: 120 })
} else if (modo === "monitor") {
    await j.ev(`S.activePage.set("settings"); await esp(700); return 1`)
    const bt = await localizar(j, `[...document.querySelectorAll("button")].find(b=>b.innerText.trim()==="Monitor de retorno")`)
    r.ok("o item 'Monitor de retorno' existe em Configuracoes", bt.ok, bt.motivo || "")
    const ret = await j.ev(`const b=[...document.querySelectorAll("button")].find(b=>b.innerText.trim()==="Monitor de retorno"); const p=b.querySelector("p"); const R=b.getBoundingClientRect(); return {x:R.x,y:R.y,w:R.width,h:R.height, cortado:p.scrollWidth>p.clientWidth||b.scrollWidth>b.clientWidth, texto:p.innerText}`)
    console.log("item", JSON.stringify(ret))
    r.ok("o texto do item cabe inteiro, sem reticencias", ret.cortado === false && ret.texto === "Monitor de retorno", JSON.stringify(ret))
    const top = await j.ev(`return Math.max(0, ${ret.y} - 160)`)
    await foto({ x: 0, y: top, width: 420, height: ret.y - top + ret.h + 40 })
}
r.fim?.()
j.fechar()
