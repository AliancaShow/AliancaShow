// Prints de fidelidade do leiaute v2 (fatia 1): leva a tela nova aos estados F1-F4 do plano por cliques/stores e grava o recorte do `main`
// (o conteudo, nao a janela). Uso: FS_CDP_PORTA=9223 node scripts/prova-culto/fidelidade.mjs <pasta-de-saida>
//   F1 1920x1080  Mostrar, telao desligado, nada no ar, pasta Shows
//   F2 1920x1080  telao ligado, slide 2 no ar
//   F3 1920x1080  como F2, com a pasta Midia aberta (grade)
//   F4 1440x900   como F2 (a regua de medidas.mjs)
// O que o app nao tem como mostrar sem o Sirvo vivo (bloco ao vivo, AO VIVO pelo roteiro) fica de fora e e dito no PR.
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, esperar, clicarEm } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-1"
mkdirSync(saida, { recursive: true })
const j = await abrir("principal")

let atual = ""
async function print(nome, w, h) {
    // o conteudo e o `main`: viewport = conteudo + 25 px da barra de menus do Windows
    // refazer o override com as MESMAS medidas trava o quadro seguinte no CDP: so muda quando muda
    if (atual !== `${w}x${h}`) await j.enviar("Emulation.setDeviceMetricsOverride", { width: w, height: h + 25, deviceScaleFactor: 1, mobile: false })
    atual = `${w}x${h}`
    await esperar(900)
    const r = JSON.parse(await j.avaliar(`const b=document.querySelector('[data-tela]').parentElement.getBoundingClientRect(); return JSON.stringify({x:b.left,y:b.top,w:b.width,h:b.height})`))
    const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } })
    writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
    console.log(nome, JSON.stringify(r))
}

try {
    await j.ev(`
S.activePopup.set(null); S.activePage.set("show"); S.modoAlianca.set("culto")
const O=await import(U("components/helpers/output"))
S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a})
const p=get(S.projects); const alvo=Object.entries(p).find(([k,v])=>(v.shows||[]).some(s=>(s.type===undefined||s.type==="show")))
S.activeProject.set(alvo[0]); const i=alvo[1].shows.findIndex(s=>(s.type===undefined||s.type==="show"))
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([alvo[1].shows[i].id])
S.activeShow.set({id:alvo[1].shows[i].id,index:i,type:"show"}); S.activeDrawerTab.set("shows")
S.outputDisplay.set(false)
document.activeElement?.blur?.(); await esp(1200)`)
    await print("F1-mostrar-desligado-1920", 1920, 1080)

    // F2: telao ligado e o slide 2 no ar (a saida de dev abre uma janela: desligada no fim)
    await j.ev(`// so o store (a pilula, o anel vermelho e o AO VIVO leem outputDisplay): abrir a janela de saida de verdade a poe por cima da principal e o CDP nao entrega o quadro
const O=await import(U("components/helpers/output")); S.outputDisplay.set(true); await esp(800)
const id=get(S.activeShow).id; const layout=get(S.showsCache)[id]?.settings?.activeLayout
O.setOutput("slide",{id,layout,index:1,line:0}); await esp(1200)`)
    await print("F2-telao-ligado-slide2-1920", 1920, 1080)

    // F3: pasta Midia
    await j.ev(`S.activeDrawerTab.set("media"); await esp(1500)`)
    await print("F3-midia-1920", 1920, 1080)

    // F4: como F2 a 1440x900
    await j.ev(`S.activeDrawerTab.set("shows"); await esp(800)`)
    await print("F4-telao-ligado-1440", 1440, 900)
} finally {
    await j.ev(`const O=await import(U("components/helpers/output")); O.clearAll?.(true); S.outputDisplay.set(false); await esp(800)`).catch(() => {})
    await j.enviar("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
    j.fechar()
}
