// T3a: janela de saida com slide no ar, principal em Culto e em Preparar. node fva-saida.mjs <dir> <pref>
import { abrir, abrirShow, esperar, clicarSel, ID } from "./fva-lib.mjs"
import { janela } from "../cdp.mjs"
import { writeFileSync } from "node:fs"
const [, , dir, pref] = process.argv
async function foto(s, arq) {
    for (let t = 0; t < 6; t++) {
        await s.enviar("Page.bringToFront", {})
        await esperar(700)
        const r = await Promise.race([s.enviar("Page.captureScreenshot", { format: "png" }), new Promise((r) => setTimeout(() => r(null), 5000))])
        if (r?.result?.data) {
            writeFileSync(arq, Buffer.from(r.result.data, "base64"))
            return
        }
    }
    throw new Error("sem print da saida")
}
const j = await abrir()
await abrirShow(j, ID, 0, "culto", true)
await j.ev(`T.trocarTela("show", "segmentado"); return 1`)
const aberta = await j.ev(`return get(S.outputDisplay)`).catch(() => null)
let s
try {
    s = await janela("saida")
} catch {
    await clicarSel(j, `document.querySelector("#output_window_button")`, "abrir saida")
    await esperar(5000)
    s = await janela("saida")
}
for (const modo of ["culto", "preparar"]) {
    await j.ev(`MODO(${JSON.stringify(modo)}); const sh=get(S.showsCache)["${ID}"]; O.setOutput("slide",{id:"${ID}",layout:sh.settings.activeLayout,index:1,projectIndex:0}); return 1`)
    await esperar(2500)
    const info = await s.avaliar(`return JSON.stringify({ds:{...document.body.dataset}, sec:getComputedStyle(document.body).getPropertyValue("--secondary"), ff:getComputedStyle(document.body).fontFamily, w:innerWidth,h:innerHeight, htmlsz: document.body.innerHTML.length})`)
    console.log(modo, info)
    await foto(s, `${dir}/${pref}saida-${modo}.png`)
    const dump = await s.avaliar(`return document.body.innerHTML.replace(/svelte-[a-z0-9]+/g,"").replace(/(zoom|picker|id)_[0-9a-f]{6,}/g,"$1_X")`)
    writeFileSync(`${dir}/${pref}saida-${modo}.html`, dump)
}
await j.ev(`MODO("culto"); S.outputs.update(a=>{a.default.out={};return a}); return 1`)
j.fechar()
s.fechar()
