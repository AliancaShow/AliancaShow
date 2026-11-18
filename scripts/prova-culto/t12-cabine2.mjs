// Rodada da cabine, 18/nov, fase 2 (C1-C6, D1): fumaca com cliques e teclas REAIS (nunca force) contra o Show de dev (CDP, FS_CDP_PORTA).
//   node scripts/prova-culto/t12-cabine2.mjs <pasta-de-prints>
//   C1 cartao de midia: thumb = ao ar; faixa do nome so seleciona; ＋ com alvo de 38 px; duracao; no ar = cartao vermelho; clique no que ja esta no ar REINICIA (2o clique < 700 ms ignorado)
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, mover } from "./lib.mjs"

const saida = process.argv[2] || "prints-cabine2"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")
const dom = (expr) => j.ev(`return ${expr}`)
async function print(nome) {
    await esperar(600)
    try {
        const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
        writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
        console.log("print", nome)
    } catch (e) {
        console.log("print", nome, "(sem captura)")
    }
}
const fundo = () => dom(`get(S.outputs).default?.out?.background?.path || null`)
const limpar = () => j.ev(`S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); await esp(400); return 1`)
const cartao = (nome) => `[...document.querySelectorAll('[data-acao=midia-cartao]')].find(c=>c.querySelector('.nm').innerText.trim()===${JSON.stringify(nome)})`
const caixa = (expr) => dom(`(()=>{const e=${expr}; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})()`)
const tempo = () => dom(`(async()=>{const V=await import(U("components/media/video/videoPlayer")); const p=get(S.outputs).default?.out?.background?.path; const a=V.VideoPlayer.getAudio(p,"default"); return a? a.currentTime : -1})()`)
const nRoteiro = () => dom(`(get(S.projects)[get(S.activeProject)]?.shows||[]).length`)

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); S.outLocked.set(false); S.activeProject.set("f3"); T.trocarTela("show","segmentado"); S.activeDrawerTab.set("media"); await esp(2500); return 1`)
    await limpar()

    // ---------- C1: anatomia
    const v1 = await caixa(cartao("v1"))
    const f1 = await caixa(cartao("f1"))
    ok("C1 os dois cartoes existem", !!v1 && !!f1)
    ok("C1 gap de 10 px entre os cartoes", f1 && v1 && Math.abs(v1.x - (f1.x + f1.w) - 10) <= 1, JSON.stringify({ f1, v1 }))
    const th = await caixa(`${cartao("v1")}.querySelector('.card')`)
    const pe = await caixa(`${cartao("v1")}.querySelector('.pe')`)
    ok("C1 faixa do nome de 30 px logo abaixo do thumb, dentro do cartao", pe && th && Math.abs(pe.h - 30) <= 1 && pe.y >= th.y + th.h - 1 && pe.y <= th.y + th.h + 4, JSON.stringify({ th, pe }))
    const eng = await caixa(`${cartao("v1")}.querySelector('.eng')`)
    ok("C1 engrenagem de 24 px alinhada a direita na faixa do nome", eng && Math.abs(eng.w - 24) <= 1 && eng.x + eng.w <= pe.x + pe.w + 1 && eng.y >= pe.y, JSON.stringify(eng))
    const mais = await caixa(`${cartao("v1")}.querySelector('.mais')`)
    ok("C1 alvo do ＋ de 38 x 38 no canto inferior direito do thumb", mais && Math.abs(mais.w - 38) <= 1 && Math.abs(mais.h - 38) <= 1 && Math.abs(mais.x + mais.w - (th.x + th.w)) <= 1 && Math.abs(mais.y + mais.h - (th.y + th.h)) <= 1, JSON.stringify({ mais, th }))
    const dur = await dom(`${cartao("v1")}.querySelector('.dur')?.innerText`)
    ok("C1 duracao do video no canto superior (m:ss)", /^\d+:\d\d$/.test(dur || ""), String(dur))
    ok("C1 imagem nao tem selo de duracao", (await dom(`!${cartao("f1")}.querySelector('.dur')`)) === true)
    const durBox = await caixa(`${cartao("v1")}.querySelector('.dur')`)
    ok("C1 a duracao esta no canto SUPERIOR direito do thumb", durBox && durBox.y < th.y + 10 && durBox.x + durBox.w > th.x + th.w - 12, JSON.stringify(durBox))
    ok("C1 nao sobrou botao ▶ solto ao lado do nome", (await dom(`document.querySelectorAll('[data-acao=midia-tocar]').length`)) === 0)
    await mover(j, th.x + th.w / 2, th.y + th.h / 2)
    await print("c1-hover")

    // ---------- faixa do nome: so seleciona, nunca vai ao ar
    await clicarEm(j, pe.x + 30, pe.y + 15)
    await esperar(700)
    ok("C1 clicar na faixa do nome NAO manda ao ar", (await fundo()) === null, String(await fundo()))
    // ---------- ＋ com o alvo de 38 px: clicar numa parte do alvo FORA do quadrado de 26 px (6 px para cima e para a esquerda) ainda cai no ＋
    const r0 = await nRoteiro()
    await clicarEm(j, mais.x + 5, mais.y + 5)
    await esperar(700)
    ok("C1 clicar no alvo de 38 px (fora dos 26 px visiveis) poe no roteiro e NAO manda ao ar", (await nRoteiro()) === r0 + 1 && (await fundo()) === null, JSON.stringify({ r0, r1: await nRoteiro(), f: await fundo() }))
    await esperar(300)
    ok("C1 depois de adicionado o ＋ vira ✓ verde", (await dom(`${cartao("v1")}.querySelector('.mais').classList.contains('ok')`)) === true)

    // ---------- thumb: clique simples vai ao ar
    await clicarEm(j, th.x + th.w / 2, th.y + th.h / 2)
    await esperar(150)
    // 2o clique dentro de 700 ms do primeiro: ignorado (o video nao volta ao inicio)
    await j.ev(`const V=await import(U("components/media/video/videoPlayer")); const p=get(S.outputs).default.out.background.path; V.VideoPlayer.seekTo(p,"default",1.6); await esp(60); return 1`)
    const t0 = await tempo()
    await clicarEm(j, th.x + th.w / 2, th.y + th.h / 2)
    await esperar(150)
    const t1 = await tempo()
    ok("C1 2o clique em ate 700 ms e IGNORADO (nao reinicia)", t0 >= 1.5 && t1 >= t0, JSON.stringify({ t0, t1 }))
    await esperar(800)
    ok("C1 clique simples no thumb manda o video ao ar", /v1\.mp4$/.test((await fundo()) || ""), String(await fundo()))
    ok("C1 no ar = cartao inteiro vermelho (estado ar, fundo #f21a27, selo NO AR)", (await dom(`(()=>{const c=${cartao("v1")}; return c.dataset.estado==="ar" && getComputedStyle(c).backgroundColor==="rgb(242, 26, 39)" && !!c.querySelector('.selo')})()`)) === true)
    await print("c1-no-ar")
    await j.ev(`const V=await import(U("components/media/video/videoPlayer")); const p=get(S.outputs).default.out.background.path; V.VideoPlayer.seekTo(p,"default",1.6); await esp(200); return 1`)
    await clicarEm(j, th.x + th.w / 2, th.y + th.h / 2)
    await esperar(250)
    const t2 = await tempo()
    ok("C1 clique no que JA esta no ar (passada a trava) REINICIA o video", t2 >= 0 && t2 < 1.2, String(t2))
    ok("C1 reiniciar nao limpa o ar", /v1\.mp4$/.test((await fundo()) || ""))
    await limpar()

    // ---------- imagem: clique simples ao ar; de novo nao limpa
    const th2 = await caixa(`${cartao("f1")}.querySelector('.card')`)
    await clicarEm(j, th2.x + th2.w / 2, th2.y + th2.h / 2)
    await esperar(1000)
    ok("C1 clique simples na imagem manda ao ar", /f1\.png$/.test((await fundo()) || ""), String(await fundo()))
    await clicarEm(j, th2.x + th2.w / 2, th2.y + th2.h / 2)
    await esperar(900)
    ok("C1 clicar de novo na imagem que ja esta no ar NAO limpa", /f1\.png$/.test((await fundo()) || ""), String(await fundo()))
    await limpar()
} catch (e) {
    console.log("ERRO", e && e.stack ? e.stack : e)
    falhas.push("erro")
}
console.log(falhas.length ? `FALHAS: ${falhas.length}` : "TUDO OK")
process.exit(falhas.length ? 1 : 0)
