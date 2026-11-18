// Medicao do vidro (leiaute v2, fatia 1, passo 1). SO MEDE: nenhum codigo do app muda e nada vai para o telao alem do video que o operador ja
// pos no ar. Roda NA MAQUINA DA CABINE, com a janela principal maximizada a 1920x1080, as saidas reais ligadas e um video 1080p no ar.
//
//   FS_CDP_PORTA=9222 node scripts/prova-culto/vidro.mjs [--segundos 60] [--saida resultado-vidro.json]
//
// Injeta, por CDP na janela PRINCIPAL, uma camada fixa com `pointer-events: none` que reproduz os paineis do board 1080 (mesmas posicoes e
// tamanhos: topo 56, roteiro 280, direita 330, biblioteca 260, centro com a sobra) em tres montagens:
//   A  sem efeito (paineis lisos)
//   B  paineis rgba(19,19,21,.62) com backdrop-filter: blur(22px) saturate(150%)
//   C  o mesmo mais os dois gradientes radiais da luz ambiente
// Em cada uma le, NA JANELA DE SAIDA, getVideoPlaybackQuality().droppedVideoFrames do video no ar (criterio) e a contagem de quadros de
// requestAnimationFrame com intervalo maior que 25 ms (informativa). Passa se B e C nao perderem mais quadros que A (margem de 2 em 3.600).
// Se nao passar: painel opaco #131315 para todos, e a luz ambiente so fica se passar sozinha. Escreve tambem a altura do titulo nativo
// (outerHeight - innerHeight) e a altura real do conteudo, para o PR.
import { writeFileSync } from "node:fs"
import { janela } from "./cdp.mjs"

const arg = (n, d) => {
    const i = process.argv.indexOf("--" + n)
    return i < 0 ? d : process.argv[i + 1]
}
const SEGUNDOS = Number(arg("segundos", 60))
const SAIDA = arg("saida", "resultado-vidro.json")
const MARGEM = 2 // quadros a mais que a montagem A, em 3.600 (60 s a 60 fps)

const montagens = {
    A: { vidro: false, ambiente: false },
    B: { vidro: true, ambiente: false },
    C: { vidro: true, ambiente: true }
}

/** a camada com os paineis do board (px de conteudo); w e h = tamanho do conteudo */
const camada = (w, h, m) => `(() => {
  const w=${w}, h=${h}, esq=280, dir=330, bib=260, topo=56
  const el=document.createElement("div"); el.id="__vidro"; el.style.cssText="position:fixed;inset:0;z-index:2147483000;pointer-events:none"
  const fundo=${m.vidro} ? "rgba(19,19,21,.62)" : "#131315"
  const fx=${m.vidro} ? "backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);" : ""
  const painel=(x,y,pw,ph)=>'<div style="position:absolute;left:'+x+'px;top:'+y+'px;width:'+pw+'px;height:'+ph+'px;border-radius:14px;background:'+fundo+';'+fx+'box-shadow:inset 0 0 0 1px rgba(248,248,240,.075)"></div>'
  const faixa=h-topo-10-8-bib
  let html=""
  if (${m.ambiente}) html+='<div style="position:absolute;inset:0;opacity:.55;background:radial-gradient(70% 90% at 78% 28%,#5b3aa8 0%,transparent 62%),radial-gradient(60% 80% at 25% 90%,#b4366b 0%,transparent 60%),linear-gradient(160deg,#2a1650,#120a22)"></div>'
  html+=painel(10,topo,esq,faixa)
  html+=painel(10+esq+8,topo,w-36-esq-dir,faixa)
  html+=painel(10,topo+faixa+8,w-20-8-dir,bib)
  html+=painel(w-10-dir,topo,dir,h-topo-10)
  el.innerHTML=html; document.body.appendChild(el)
})()`

async function medirSaida(saida, ms) {
    return saida.avaliar(`
const v=[...document.querySelectorAll("video")].find(x=>!x.paused && x.videoWidth>0)
if(!v) return JSON.stringify({erro:"nenhum video tocando na saida"})
const q0=v.getVideoPlaybackQuality(); const d0=q0.droppedVideoFrames, t0=q0.totalVideoFrames
let longos=0, ultimo=performance.now(), parar=false
const raf=(t)=>{ if(t-ultimo>25) longos++; ultimo=t; if(!parar) requestAnimationFrame(raf) }
requestAnimationFrame(raf)
await new Promise(r=>setTimeout(r,${ms}))
parar=true
const q1=v.getVideoPlaybackQuality()
return JSON.stringify({perdidos:q1.droppedVideoFrames-d0, quadros:q1.totalVideoFrames-t0, rafLongos:longos})`)
}

const principal = await janela("principal")
const saida = await janela("saida")
const medidas = {}
try {
    const dim = JSON.parse(await principal.avaliar(`const m=document.querySelector("[data-tela]")?.parentElement||document.querySelector("main"); const r=m.getBoundingClientRect(); return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),tituloNativo:outerHeight-innerHeight,menuBarra:25})`))
    medidas.conteudo = dim
    for (const [nome, m] of Object.entries(montagens)) {
        await principal.avaliar(`document.getElementById("__vidro")?.remove(); ${camada(dim.w, dim.h, m)}; await new Promise(r=>setTimeout(r,5000))`) // 5 s de aquecimento da montagem
        medidas[nome] = JSON.parse(await medirSaida(saida, SEGUNDOS * 1000))
        await principal.avaliar(`document.getElementById("__vidro")?.remove()`)
        console.log(nome, JSON.stringify(medidas[nome]))
    }
} finally {
    await principal.avaliar(`document.getElementById("__vidro")?.remove()`).catch(() => {})
    principal.fechar()
    saida.fechar()
}
const base = medidas.A?.perdidos
const passa = (k) => medidas[k] && !medidas[k].erro && base !== undefined && medidas[k].perdidos <= base + MARGEM
medidas.veredito = { B: passa("B"), C: passa("C"), margem: MARGEM, regra: "B e C passam se perdem no maximo (A + margem) quadros; se B falhar: painel opaco para todos; se C falhar: sem luz ambiente" }
writeFileSync(SAIDA, JSON.stringify(medidas, null, 2) + "\n")
console.log(JSON.stringify(medidas.veredito))
process.exit(medidas.veredito.B && medidas.veredito.C ? 0 : 1)
