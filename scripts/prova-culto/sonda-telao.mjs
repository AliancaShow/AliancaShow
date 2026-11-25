// Sonda (22/nov): como o telao LED (896x320) desenha o fundo e o modelo da Biblia, e qual proporcao o editor usa.
//   FS_PERFIL_DIR=/c/prova-perfil-telao; node scripts/prova-culto/sonda-telao.mjs <pasta-dos-prints>
import { writeFileSync } from "node:fs"
import { abrir, esperar } from "./lib.mjs"

const PASTA = process.argv[2] || "."
const j = await abrir("principal", { buffer: true })
const print = async (nome) => {
    const r = await j.enviar("Page.captureScreenshot", { format: "png" })
    writeFileSync(`${PASTA}/${nome}.png`, Buffer.from(r.data, "base64"))
}

const info = await j.ev(`
  const O=await import(U("components/helpers/output"))
  const outs=get(S.outputs); const led=Object.keys(outs).find(k=>outs[k].name==="Painel LED")
  return {primeira:O.getFirstActiveOutput()?.name, editor:O.getResolution(), led, ledRes:O.getOutputResolution(led), ledRatio:O.getResolution(null,null,false,led), ordem:O.getAllNormalOutputs().map(o=>o.name)}`)
console.log("INFO", JSON.stringify(info))

const medir = `
  const led=${JSON.stringify(info.led)}
  return [...document.querySelectorAll('[id="'+led+'"]')].filter(z=>z.querySelector(".slide")).map(z=>{const s=z.querySelector(".slide"); const r=s.getBoundingClientRect(); const imgs=[...s.querySelectorAll("img,canvas,video")].map(i=>{const b=i.getBoundingClientRect(); return {tag:i.tagName, fit:getComputedStyle(i).objectFit, top:Math.round(b.top-r.top), h:Math.round(b.height), w:Math.round(b.width)}}); return {slide:{w:Math.round(r.width),h:Math.round(r.height)}, imgs}})`

await j.ev(`MODO("culto"); return 1`)
await esperar(800)
// 1) so o fundo (midia de fundo 896x320) no telao LED
await j.ev(`const led=${JSON.stringify(info.led)}; S.outputs.update(o=>{o[led].out={background:{path:"C:/prova-perfil-telao/midia/telao-leitura.png", type:"image"}}; return o}); await esp(2500); return 1`)
console.log("FUNDO", JSON.stringify(await j.ev(medir)))
await j.foto(`${PASTA}/1-fundo-led.png`)

// 2) Biblia (Joao 3:16 com o modelo "Biblia Telao") no telao LED, sem fundo
await j.ev(`
  const led=${JSON.stringify(info.led)}
  const tpl=JSON.parse(JSON.stringify(get(S.templates)["2e059015cd0"]))
  const itens=tpl.items.map((it,i)=>it.type==="media"?it:{...it, type:"text", lines:[{align:"",text:[{value:i===1?"Porque Deus amou o mundo de tal maneira que deu o seu Filho unigenito":"Joao 3:16",style:"font-size:80px;color:#fff;"}]}]})
  S.showsCache.update(s=>{s["sonda"]={name:"sonda",category:null,settings:{},timestamps:{created:1,modified:1,used:1},meta:{},slides:{s1:{group:"",color:null,settings:{},notes:"",items:itens}},layouts:{l1:{name:"",notes:"",slides:[{id:"s1"}]}},media:{}}; return s})
  S.outputs.update(o=>{o[led].out={slide:{id:"sonda",layout:"l1",index:0}}; return o}); await esp(2500); return 1`)
console.log("MODELO", JSON.stringify(await j.ev(medir)))
await j.foto(`${PASTA}/2-modelo-led.png`)

// 3) modelo + fundo juntos
await j.ev(`const led=${JSON.stringify(info.led)}; S.outputs.update(o=>{o[led].out={...o[led].out, background:{path:"C:/prova-perfil-telao/midia/telao-leitura.png", type:"image"}}; return o}); await esp(2500); return 1`)
console.log("MODELO+FUNDO", JSON.stringify(await j.ev(medir)))
await j.foto(`${PASTA}/3-modelo-fundo-led.png`)
process.exit(0)
