// Fatia 7 (faixa de transporte da coluna No ar: video, audio, medidor, temporizadores, Spotify): fumaca com cliques REAIS (nunca force)
// contra o Show de dev (CDP, FS_CDP_PORTA) e prints 1920x1080.
//   node scripts/prova-culto/t8-midia.mjs <pasta-de-prints>
//   A. nada tocando: a faixa tem altura 0 e nada ao redor se mexe (a posicao do chat e a mesma antes e depois de abrir e fechar)
//   B. video no fundo: a faixa abre logo abaixo da tela, nao cobre a faixa de camadas, e a tela principal nao fica sob ela
//   C. repetir / pausar / tocar: cliques reais mudam o estado do player
//   D. arrastar a barra de tempo (pressionar, mover, soltar) leva o video ao ponto e, se tocava, continua tocando
//   E. mudo e volume
//   F. limpar o fundo pelo icone da faixa de camadas fecha a faixa (altura 0, chat no lugar de antes)
//   G. audio: abre a linha de audio com o medidor, tocar/pausar e arrastar funcionam, parar (F4 pelo icone) fecha
//   H. temporizador de contagem: linha com nome e tempo, pausar/continuar e parar com cliques reais; some quando para
//   I. Spotify: a linha aparece com estado de Spotify e some sem ele
//   J. as teclas de midia (espaco, setas) NAO foram tocadas: a faixa nao escuta o teclado
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, mover, tecla } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-7"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
const dom = (expr) => j.ev(`return ${expr}`)
async function print(nome, espera = 500) {
    await esperar(espera)
    const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
    writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
    console.log("print", nome)
}
// (codigo da pagina) o modulo do SpotifyManager que o app usa tem "?t=" na URL (invalidacao da Vite): ler a URL de quem o importa, senao o import cria outra instancia do store
const IMPORTA_SPOTIFY = `const _t=await (await fetch(BASE+"components/output/preview/SpotifyController.svelte")).text(); const M=await import(_t.match(/from "([^"]*SpotifyManager\.ts[^"]*)"/)[1]);`
const FAIXA = `document.querySelector('[data-acao=transporte]')`
const faixa = () => dom(`(()=>{const f=${FAIXA}; const r=f.getBoundingClientRect(); return {estado:f.dataset.estado, h:r.height, top:r.top, bottom:r.bottom}})()`)
// revisao da fatia 7, achado 3: o topo de TUDO o que vem depois da faixa no No ar (outras telas, mensagem pro palco, chat) e a altura da propria faixa
const abaixo = () => dom(`(()=>{const f=${FAIXA}; const out=[Math.round(f.getBoundingClientRect().height*10)/10]; for(let e=f.nextElementSibling;e;e=e.nextElementSibling) out.push(Math.round(e.getBoundingClientRect().top*10)/10); return JSON.stringify(out)})()`)
const chatTop = () => dom(`(()=>{const e=document.querySelector('[data-regiao=no-ar] [data-acao=chat], [data-regiao=no-ar] .chat'); const r=(e||document.querySelector('[data-regiao=no-ar]').lastElementChild).getBoundingClientRect(); return Math.round(r.top*10)/10})()`)
const videoState = () => dom(`Object.values(get(S.playingVideoState))[0]||null`)
const audioState = () => dom(`(()=>{const a=Object.values(get(S.playingAudio))[0]; return a? {paused:a.paused, t:a.audio?.currentTime}:null})()`)
const clicarSel = async (sel, rotulo) => {
    const a = await localizar(j, `document.querySelector(${JSON.stringify(sel)})`)
    if (!a.ok) throw new Error(`${rotulo || sel}: ${a.motivo}`)
    await clicarEm(j, a.x, a.y)
    return a
}
async function arrastar(sel, de, ate, passos = 6, pausa = 60) {
    const a = await localizar(j, `document.querySelector(${JSON.stringify(sel)})`)
    if (!a.ok) throw new Error(`barra ${sel}: ${a.motivo}`)
    const medir = () => dom(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:r.x,w:r.width,y:r.y+r.height/2}})()`)
    let r = await medir()
    await mover(j, r.x + r.w * de, r.y)
    await esperar(600) // o passar do mouse acende a dica (tooltip) e a coluna pode se ajustar: mede de novo com ela assentada
    r = await medir()
    const x0 = r.x + r.w * de
    const x1 = r.x + r.w * ate
    await mover(j, x0, r.y)
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: r.y, button: "left", clickCount: 1 })
    for (let i = 1; i <= passos; i++) {
        await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / passos, y: r.y, button: "left", buttons: 1 })
        await esperar(pausa)
    }
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: r.y, button: "left", clickCount: 1 })
    await esperar(500)
    const f = await medir()
    return { x1, fracaoFinal: (x1 - f.x) / f.w } // onde o ponteiro acabou, em fracao da barra COMO ELA ESTAVA ao soltar (a coluna pode se ajustar 5 px durante o arrasto)
}

// arquivos: o video do perfil de teste e um WAV de 12 s gerado aqui (fora do perfil, para nao mexer na biblioteca da prova)
const PERFIL = process.env.FS_PERFIL_DIR ? process.env.FS_PERFIL_DIR.split("\\").join("/") : "C:/Users/andre.zagato/Documents/ProjetosPessoais/aliancashow/bancada/prova-perfil-9223"
const VIDEO = `${PERFIL}/midia/v1.mp4`
const WAV = join(tmpdir(), "fs-t8-tom.wav").split("\\").join("/")
{
    const taxa = 8000
    const n = taxa * 12
    const b = Buffer.alloc(44 + n * 2)
    b.write("RIFF", 0)
    b.writeUInt32LE(36 + n * 2, 4)
    b.write("WAVEfmt ", 8)
    b.writeUInt32LE(16, 16)
    b.writeUInt16LE(1, 20)
    b.writeUInt16LE(1, 22)
    b.writeUInt32LE(taxa, 24)
    b.writeUInt32LE(taxa * 2, 28)
    b.writeUInt16LE(2, 32)
    b.writeUInt16LE(16, 34)
    b.write("data", 36)
    b.writeUInt32LE(n * 2, 40)
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(9000 * Math.sin((2 * Math.PI * 440 * i) / taxa)), 44 + i * 2)
    writeFileSync(WAV, b)
}

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); T.trocarTela("show","segmentado"); S.outputs.update(a=>{a.default.out={};return a}); S.activeTimers.set([]); await esp(700); return 1`)
    await j.ev(`const C=await import(U("components/output/clear")); C.clearAll(true); const A=await import(U("audio/audioFading")); A.clearAudio("",{clearPlaylist:true,clearMicrophones:true,commonClear:true}); await esp(500); return 1`)

    // ---- A. nada tocando
    const f0 = await faixa()
    const chat0 = await chatTop()
    const lay0 = await abaixo()
    ok("A: sem nada tocando a faixa esta presente, vazia, com a altura reservada de 60 px (1 cartao, C2)", f0.estado === "vazio" && f0.h === 60 && /nada tocando/.test(await dom(`${FAIXA}.innerText`)), JSON.stringify(f0))
    ok("A: no estado vazio nao ha controle algum", (await dom(`!${FAIXA}.querySelector('button, [role=slider]')`)) === true)
    await print("nada-tocando")

    // ---- B. video no fundo
    await j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("background",{path:${JSON.stringify(VIDEO)},type:"video",name:"v1.mp4"}); await esp(1500); return 1`)
    const f1 = await faixa()
    ok("B: com video no fundo a faixa ganha os controles, na MESMA altura (60 px)", f1.estado === "ativo" && f1.h === 60, JSON.stringify(f1))
    ok("B: nada abaixo da faixa se mexeu quando o video entrou (outras telas, mensagem, chat)", (await abaixo()) === lay0, `${await abaixo()} vs ${lay0}`)
    const geo = await dom(`(()=>{const q=(s)=>document.querySelector(s).getBoundingClientRect(); const t=q('[data-acao=tela-principal]'), c=q('[data-acao=camadas]'), f=q('[data-acao=transporte]'); const mid=document.elementFromPoint(t.x+t.width/2,t.y+t.height/2); return {telaBottom:t.bottom, camBottom:c.bottom, fTop:f.top, tocaTela:!!mid&&!!mid.closest('[data-acao=transporte]')}})()`)
    ok("B: a faixa fica abaixo da tela e da faixa de camadas (nao cobre nada)", geo.fTop >= geo.telaBottom - 0.5 && geo.fTop >= geo.camBottom - 0.5 && !geo.tocaTela, JSON.stringify(geo))
    const nome = await dom(`document.querySelector('[data-transporte=video] .nome')?.innerText`)
    ok("B: a linha diz o nome do video", nome === "v1", nome)
    ok("B: o medidor de audio aparece junto", (await dom(`!!document.querySelector('[data-acao=medidor] .meter')`)) === true)
    await print("video-tocando")

    // ---- C. repetir / pausar / tocar
    await clicarSel('[data-transporte=video] [data-acao=transporte-repetir]', "repetir")
    await esperar(500)
    ok("C: repetir liga (loop no player)", (await videoState())?.loop === true, JSON.stringify(await videoState()))
    await clicarSel('[data-transporte=video] [data-acao=transporte-tocar]', "pausar")
    await esperar(500)
    const p1 = await videoState()
    ok("C: pausar pausa o video", p1?.paused === true, `paused=${p1?.paused}`)
    await esperar(700)
    ok("C: pausado, o tempo nao anda", Math.abs((await videoState()).currentTime - p1.currentTime) < 0.05)
    await clicarSel('[data-transporte=video] [data-acao=transporte-tocar]', "tocar")
    await esperar(500)
    ok("C: tocar volta a tocar", (await videoState())?.paused === false)

    // ---- D. arrastar a barra de tempo (video tocando, em laco)
    const antes = await dom(`get(S.outputs).default.out.background.path`)
    await arrastar('[data-transporte=video] .barra[aria-label="Posição"]', 0.15, 0.8)
    const d1 = await videoState()
    ok("D: arrastar leva o video perto de 80%", d1.currentTime > 1.4 && d1.currentTime < 3.1, `t=${d1.currentTime} dur=${d1.duration}`)
    ok("D: depois de soltar, o video que tocava continua tocando", d1.paused === false)
    ok("D: o fundo no ar nao mudou", (await dom(`get(S.outputs).default.out.background.path`)) === antes)
    // pausado: arrastar nao liga o video
    await clicarSel('[data-transporte=video] [data-acao=transporte-tocar]', "pausar")
    await esperar(400)
    await arrastar('[data-transporte=video] .barra[aria-label="Posição"]', 0.8, 0.3)
    const d2 = await videoState()
    ok("D: pausado, arrastar leva ao ponto e CONTINUA pausado", d2.paused === true && d2.currentTime < 1.6, `paused=${d2.paused} t=${d2.currentTime}`)
    // revisao da fatia 7, achado 1: arrastar ate (alem de) a ponta direita, SEM repetir, nao pode disparar o "acabou" que tira o video do telao
    await clicarSel('[data-transporte=video] [data-acao=transporte-repetir]', "repetir desligado")
    await esperar(300)
    ok("D2: repetir desligado", (await videoState())?.loop === false)
    await arrastar('[data-transporte=video] .barra[aria-label="Posição"]', 0.3, 1.4)
    await esperar(1200)
    const d3 = await videoState()
    ok("D2: arrastar ate o fim nao limpa o video do telao", (await dom(`get(S.outputs).default.out.background?.path ?? null`)) === antes && d3 !== null, JSON.stringify(d3))
    ok("D2: a busca parou antes do fim (duration - 0,25) e o video segue pausado", d3 && d3.paused === true && d3.currentTime < d3.duration - 0.2 && d3.currentTime > d3.duration - 0.3, `t=${d3?.currentTime} dur=${d3?.duration}`)
    await clicarSel('[data-transporte=video] [data-acao=transporte-repetir]', "repetir ligado")
    await esperar(300)
    await arrastar('[data-transporte=video] .barra[aria-label="Posição"]', 1, 0.2)
    await clicarSel('[data-transporte=video] [data-acao=transporte-tocar]', "tocar")
    await esperar(400)

    // revisao da fatia 7, achado 2: Esc no MEIO do arrasto (o fundo e limpo e a linha desmonta com o botao apertado) nao pode prender o tempo em 0:00
    {
        const r = await dom(`(()=>{const r=document.querySelector('[data-transporte=video] .barra[aria-label="Posição"]').getBoundingClientRect(); return {x:r.x,w:r.width,y:r.y+r.height/2}})()`)
        await mover(j, r.x + r.w * 0.3, r.y)
        await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x + r.w * 0.3, y: r.y, button: "left", clickCount: 1 })
        await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x + r.w * 0.5, y: r.y, button: "left", buttons: 1 })
        await esperar(200)
        await tecla(j, "Escape")
        await esperar(700)
        await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x + r.w * 0.5, y: r.y, button: "left", clickCount: 1 })
        await esperar(300)
        ok("D3: Esc no meio do arrasto limpou o fundo e fechou a linha", (await dom(`get(S.outputs).default.out.background?.path ?? null`)) === null && (await dom(`!document.querySelector('[data-transporte=video]')`)) === true)
        await j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("background",{path:${JSON.stringify(VIDEO)},type:"video",name:"v1.mp4"}); await esp(1000); return 1`)
        const t1 = await dom(`document.querySelector('[data-transporte=video] [data-transporte-decorrido]')?.innerText`)
        await esperar(700)
        const t2 = await dom(`document.querySelector('[data-transporte=video] [data-transporte-decorrido]')?.innerText`)
        const sv = await videoState()
        ok("D3: o proximo video segue o tempo (nao fica preso em 0:00) e esta tocando", sv && sv.paused === false && (t1 !== "0:00" || t2 !== "0:00"), `${t1} -> ${t2} ${JSON.stringify(sv)}`)
        await clicarSel('[data-transporte=video] [data-acao=transporte-repetir]', "repetir")
        await esperar(300)
    }

    // ---- E. mudo e volume
    await clicarSel('[data-transporte=video] [data-acao=transporte-mudo]', "mudo")
    await esperar(400)
    ok("E: mudo liga", (await videoState())?.muted === true)
    await clicarSel('[data-transporte=video] [data-acao=transporte-mudo]', "mudo")
    await esperar(400)
    ok("E: mudo desliga", (await videoState())?.muted === false)
    const fimVol = await arrastar('[data-transporte=video] .vol .barra', 0.99, 0.4)
    const vol = await dom(`get(S.media)[${JSON.stringify(VIDEO)}]?.volume`)
    ok("E: arrastar o volume escreve o volume do arquivo (onde o ponteiro soltou, ate 125 %)", typeof vol === "number" && Math.abs(vol - Math.min(1.25, Math.max(0, fimVol.fracaoFinal * 1.25))) < 0.04 && vol > 0.3 && vol < 0.7, `${vol} esperado ${fimVol.fracaoFinal * 1.25}`)
    // revisao da fatia 7, achado 5: o IPC do `media` (manda o objeto inteiro a todas as saidas) e limitado a ~10/s e o final nunca se perde
    {
        await j.ev(`window.__w=0; window.__u=S.media.subscribe(()=>window.__w++); return 1`)
        const t0 = Date.now()
        const fim2 = await arrastar('[data-transporte=video] .vol .barra', 0.99, 0.3, 40, 8)
        const dt = (Date.now() - t0) / 1000
        const w = await dom(`(()=>{window.__u(); return window.__w})()`)
        const v2 = await dom(`get(S.media)[${JSON.stringify(VIDEO)}]?.volume`)
        ok("E2: 40 movimentos do ponteiro nao viram 40 escritas (no maximo ~10 por segundo)", w <= dt * 10 + 4, `${w} escritas em ${dt.toFixed(1)} s`)
        ok("E2: o valor final (onde soltou) foi gravado", Math.abs(v2 - fim2.fracaoFinal * 1.25) < 0.04, `${v2} vs ${fim2.fracaoFinal * 1.25}`)
    }
    // achado 5: volume salvo acima de 100 % aparece como e (barra cheia em 125 %), nao como "cheia" mentindo
    await j.ev(`S.media.update(a=>({...a,[${JSON.stringify(VIDEO)}]:{...(a[${JSON.stringify(VIDEO)}]||{}),volume:1.25}})); await esp(400); return 1`)
    ok("E3: 125 % salvo enche a barra de volume ate o fim e o rotulo diz 125%", (await dom(`(()=>{const b=document.querySelector('[data-transporte=video] .vol .barra'); return b.querySelector('.cheio').style.width==='100%' && b.getAttribute('aria-label')==='Volume 125%'})()`)) === true)
    await j.ev(`S.media.update(a=>({...a,[${JSON.stringify(VIDEO)}]:{...(a[${JSON.stringify(VIDEO)}]||{}),volume:1}})); await esp(300); return 1`)
    ok("E: nenhum slide foi para o ar por causa da faixa", (await dom(`get(S.outputs).default.out.slide ?? null`)) === null)

    // ---- J. teclado: a faixa nao ficou com o foco (o espaco e as setas continuam sendo da pagina)
    ok("J: nenhum controle da faixa ficou com o foco", (await dom(`!document.activeElement?.closest?.('[data-acao=transporte]')`)) === true)
    await print("video-tocando-2")

    // ---- F. limpar o fundo pelo icone de camadas fecha a faixa
    await clicarSel('[data-acao=camadas] [data-camada=fundo]', "limpar fundo")
    await esperar(700)
    const f2 = await faixa()
    ok("F: sem fundo a faixa volta a vazia, com os mesmos 60 px", f2.estado === "vazio" && f2.h === 60, JSON.stringify(f2))
    ok("F: nada abaixo se mexeu quando o video saiu", (await abaixo()) === lay0 && (await chatTop()) === chat0, `${await abaixo()} vs ${lay0}`)

    // ---- G. audio
    await j.ev(`const {AudioPlayer}=await import(U("audio/audioPlayer")); await AudioPlayer.start(${JSON.stringify(WAV)},{name:"tom"},{}); await esp(1500); return 1`)
    const fa = await faixa()
    ok("G: com audio tocando a faixa ganha a linha de audio, na mesma altura", fa.estado === "ativo" && fa.h === 60 && (await abaixo()) === lay0, JSON.stringify(fa))
    ok("G: ha uma linha de audio com o nome", (await dom(`document.querySelector('[data-transporte=audio] .nome')?.innerText`)) === "tom")
    ok("G: o medidor aparece", (await dom(`!!document.querySelector('[data-acao=medidor] .meter')`)) === true)
    ok("G: o audio nao tem repetir nem mudo (o player nao tem)", (await dom(`!document.querySelector('[data-transporte=audio] [data-acao=transporte-repetir], [data-transporte=audio] [data-acao=transporte-mudo]')`)) === true)
    await print("audio-tocando")
    await clicarSel('[data-transporte=audio] [data-acao=transporte-tocar]', "pausar audio")
    await esperar(500)
    ok("G: pausar pausa o audio", (await audioState())?.paused === true, JSON.stringify(await audioState()))
    await arrastar('[data-transporte=audio] .barra[aria-label="Posição"]', 0.05, 0.5)
    const ga = await audioState()
    ok("G: arrastar leva o audio perto de 6 s e ele continua pausado", ga?.paused === true && ga.t > 4 && ga.t < 8, JSON.stringify(ga))
    await clicarSel('[data-transporte=audio] [data-acao=transporte-tocar]', "tocar audio")
    await esperar(600)
    ok("G: tocar volta a tocar", (await audioState())?.paused === false)
    await clicarSel('[data-acao=camadas] [data-camada=audio]', "parar audio")
    await esperar(3500)
    const fb = await faixa()
    ok("G: parar o audio esvazia a faixa, sem mexer em nada abaixo", fb.estado === "vazio" && fb.h === 60 && (await abaixo()) === lay0, JSON.stringify(fb))
    ok("G: o chat voltou ao lugar de antes", (await chatTop()) === chat0)

    // ---- H. temporizador de contagem
    await j.ev(`S.timers.update(a=>{a.t8={name:"Pregacao",type:"counter",start:0,end:600}; return a}); const T2=await import(U("components/drawer/timers/timers")); T2.playPauseGlobal("t8", get(S.timers).t8, true); await esp(1500); return 1`)
    const fh = await faixa()
    ok("H: um temporizador ativo entra na faixa sem mudar a altura", fh.estado === "ativo" && fh.h === 60 && (await abaixo()) === lay0, JSON.stringify(fh))
    const th = await dom(`document.querySelector('[data-timer=t8]')?.innerText.replace(/\\s+/g,' ')`)
    ok("H: a linha mostra o nome e o tempo", /Pregacao/.test(th) && /\d:\d\d/.test(th), th)
    ok("H: sem video nem audio nao ha medidor", (await dom(`!document.querySelector('[data-acao=medidor]')`)) === true)
    await print("temporizador")
    await clicarSel('[data-timer=t8] .q.p', "pausar timer")
    await esperar(400)
    ok("H: o botao pausa o temporizador", (await dom(`get(S.activeTimers).find(a=>a.id==='t8')?.paused`)) === true)
    await clicarSel('[data-timer=t8] [aria-label="Parar temporizador"]', "parar timer")
    await esperar(800)
    const fh2 = await faixa()
    ok("H: parar remove o temporizador e esvazia a faixa", fh2.estado === "vazio" && fh2.h === 60 && (await abaixo()) === lay0 && (await dom(`get(S.activeTimers).length`)) === 0, JSON.stringify(fh2))

    // ---- I. Spotify (so a linha: o estado e fingido, nao ha Spotify no aparelho de teste; o controlador escondido zera o estado a cada 1 s, por isso o estado e reposto)
    await j.ev(`${IMPORTA_SPOTIFY} for(let i=0;i<8;i++){M.spotifyState.set({title:"Cantico",artist:"Coral",isPlaying:false,positionSec:3,durationSec:200,volume:1}); await esp(30)} await esp(20); return 1`)
    let fs1 = await faixa()
    // o controlador escondido zera o estado a cada 1 s: se zerou entre o set e a medida, repoe o estado (ate 4 vezes) e mede de novo
    for (let t = 0; t < 4 && fs1.estado !== "ativo"; t++) {
        await j.ev(`${IMPORTA_SPOTIFY} for(let i=0;i<8;i++){M.spotifyState.set({title:"Cantico",artist:"Coral",isPlaying:false,positionSec:3,durationSec:200,volume:1}); await esp(30)} await esp(20); return 1`)
        fs1 = await faixa()
    }
    const sp = await dom(`document.querySelector('[data-acao=spotify]')?.innerText.replace(/\\s+/g,' ')`)
    ok("I: com estado de Spotify a pilha mostra o cartao do Spotify, mesma altura", fs1.estado === "ativo" && fs1.h === 60 && (await abaixo()) === lay0 && /Cantico/.test(sp || ""), `${JSON.stringify(fs1)} ${sp}`)
    await j.ev(`${IMPORTA_SPOTIFY} for(let i=0;i<3;i++){M.spotifyState.set({title:"Cantico",artist:"Coral",isPlaying:false,positionSec:3,durationSec:200,volume:1}); await esp(40)} return 1`)
    await print("spotify", 0)
    await j.ev(`${IMPORTA_SPOTIFY} M.spotifyState.set(null); await esp(700); return 1`)
    ok("I: sem Spotify a faixa esvazia", (await faixa()).estado === "vazio")

    // ---- K. varias coisas tocando (C2): um cartao por midia, SEM "+N"; do 4o em diante a pilha rola por dentro (altura maxima de 3 cartoes = 188 px)
    await j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("background",{path:${JSON.stringify(VIDEO)},type:"video",name:"v1.mp4"}); const {AudioPlayer}=await import(U("audio/audioPlayer")); await AudioPlayer.start(${JSON.stringify(WAV)},{name:"tom"},{}); S.timers.update(a=>{a.t8={name:"Pregacao",type:"counter",start:0,end:600}; return a}); const T2=await import(U("components/drawer/timers/timers")); T2.playPauseGlobal("t8", get(S.timers).t8, true); await esp(1800); return 1`)
    const k0 = await faixa()
    ok("K: video + audio + temporizador: 3 cartoes visiveis (60 + 60 + 36 + 2 respiros = 164 px), todos na tela, sem +N", k0.estado === "ativo" && Math.abs(k0.h - 164) <= 1 && (await dom(`[...${FAIXA}.querySelectorAll('[data-transporte=video],[data-transporte=audio],[data-timer]')].length`)) === 3 && (await dom(`!${FAIXA}.querySelector('[data-acao=transporte-mais]')`)) === true, JSON.stringify(k0))
    ok("K: cada cartao de midia tem 60 px", (await dom(`[...${FAIXA}.querySelectorAll('[data-transporte]')].every(e=>Math.round(e.getBoundingClientRect().height)===60)`)) === true)
    await print("transporte-pilha", 200)
    await j.ev(`${IMPORTA_SPOTIFY} for(let i=0;i<8;i++){M.spotifyState.set({title:"Cantico",artist:"Coral",isPlaying:true,positionSec:3,durationSec:200,volume:1}); await esp(30)} await esp(20); return 1`)
    const medirK = () => dom(`(()=>{const p=${FAIXA}.querySelector('[data-acao=transporte-pilha]'); return {h:Math.round(p.getBoundingClientRect().height), rola:p.scrollHeight>p.clientHeight+1, cartoes:p.querySelectorAll('[data-transporte],[data-timer],[data-acao=spotify]').length}})()`)
    // o 4o cartao nasce depois de um ciclo de render (sob carga passa de 20 ms): espera ate 4 s pela MESMA medida
    let k1 = await medirK()
    for (let t = 0; t < 20 && k1.cartoes !== 4; t++) (await esperar(200), (k1 = await medirK()))
    ok("K: com o 4o cartao a pilha para em 188 px e rola por dentro", k1.cartoes === 4 && k1.h === 188 && k1.rola === true, JSON.stringify(k1))
    await print("transporte-pilha-rola", 200)
    await j.ev(`${IMPORTA_SPOTIFY} M.spotifyState.set(null); await esp(500); return 1`)
    await clicarSel('[data-acao=camadas] [data-camada=audio]', "parar audio")
    await j.ev(`const C=await import(U("components/output/clear")); C.clearAll(true); const T2=await import(U("components/drawer/timers/timers")); T2.resetTimer("t8"); await esp(3500); return 1`)
    ok("K: ao esvaziar, tudo volta ao lugar", (await faixa()).estado === "vazio" && (await abaixo()) === lay0, `${JSON.stringify(await faixa())} ${await abaixo()} ${await dom(`${FAIXA}.innerText`)}`)

    // ---- L. varias saidas (C2): um cartao por arquivo; a etiqueta da saida so quando ha duvida; nunca "Primaria"; sem "+1 saida"
    const VIDEO2 = VIDEO.replace("v1.mp4", "v2.mp4")
    copyFileSync(VIDEO, VIDEO2)
    const nomeOrig = await dom(`get(S.outputs).default.name ?? ""`)
    await j.ev(`S.outputs.update(o=>{o.default.name="Primary"; o.default.out={}; o.segunda={...JSON.parse(JSON.stringify(o.default)), name:"NDI Live", enabled:true, out:{}}; return o}); await esp(1000); return 1`)
    const lay2 = await abaixo()
    await j.ev(`S.outputs.update(o=>{o.default.out={background:{path:${JSON.stringify(VIDEO)},type:"video",name:"v1.mp4"}}; o.segunda.out={background:{path:${JSON.stringify(VIDEO2)},type:"video",name:"v2.mp4"}}; return o}); await esp(1200); return 1`)
    ok("L: duas saidas com videos diferentes = DOIS cartoes (um por arquivo), o da tela primeiro", (await dom(`[...document.querySelectorAll('[data-transporte=video] .nome')].map(e=>e.innerText).join(',')`)) === "v1,v2")
    ok("L: so o cartao da tela tem o ponto vermelho \"no telao\"", (await dom(`[...document.querySelectorAll('[data-transporte=video]')].map(e=>!!e.querySelector('[data-transporte-ponto]')).join(',')`)) === "true,false")
    ok("L: a etiqueta da saida aparece (ha duvida) e a de fabrica \"Primary\" vira TELAO, nunca \"Primaria\"", (await dom(`[...document.querySelectorAll('[data-transporte-saida]')].map(e=>e.innerText).join(',')`)) === "TELÃO,NDI LIVE")
    ok("L: nenhum \"+1 saida\" na pilha", (await dom(`!/[+]\\d saída/.test(${FAIXA}.innerText)`)) === true)
    await print("duas-saidas", 200)
    await j.ev(`S.outputs.update(o=>{o.segunda.out.background={path:${JSON.stringify(VIDEO)},type:"video",name:"v1.mp4"}; return o}); await esp(800); return 1`)
    ok("L: o MESMO arquivo nas duas saidas e UM cartao, sem etiqueta (nao ha duvida)", (await dom(`document.querySelectorAll('[data-transporte=video]').length`)) === 1 && (await dom(`!document.querySelector('[data-transporte-saida]')`)) === true)
    await j.ev(`S.outputs.update(o=>{o.default.out={}; o.segunda.out.background={path:${JSON.stringify(VIDEO2)},type:"video",name:"v2.mp4"}; return o}); await esp(800); return 1`)
    ok("L: principal sem video e outra com: o cartao da outra aparece, com etiqueta e sem o ponto do telao", (await dom(`document.querySelectorAll('[data-transporte=video]').length`)) === 1 && (await dom(`document.querySelector('[data-transporte-saida]')?.innerText`)) === "NDI LIVE" && (await dom(`!document.querySelector('[data-transporte-ponto]')`)) === true)
    await j.ev(`S.outputs.update(o=>{delete o.segunda; o.default.name=${JSON.stringify(nomeOrig)}; o.default.out={}; return o}); await esp(800); return 1`)
    // a coluna (mensagem pro palco, uma linha por saida) so reassenta depois do ciclo de render: espera ate 5 s pela MESMA medida
    for (let t = 0; t < 25 && (await abaixo()) !== lay0; t++) await esperar(200)
    ok("L: de volta a uma saida so, sem etiqueta e a pilha no lugar", (await faixa()).estado === "vazio" && (await abaixo()) === lay0, `${await abaixo()} vs ${lay0}`)
} catch (e) {
    console.log("FALHA excecao", e.message)
    falhas.push("excecao")
}
await j.fechar?.()
console.log(falhas.length ? `${falhas.length} falha(s)` : "tudo verde")
process.exit(falhas.length ? 1 : 0)
