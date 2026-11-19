// Rodada da cabine, 19/nov, fase 4. Fumaca contra o Show de dev (CDP). Sem cliques forcados.
//   node scripts/prova-culto/t14-cabine4.mjs <pasta-de-prints>
//   A  Spotify para sozinho quando midia COM SOM entra no ar (estado do Spotify injetado como a t8 faz; nao ha Spotify no aparelho de teste)
//      A1 video de fundo MUDO em repeticao NAO dispara o fade; A2 video com som (frente) dispara; A3 so em saida de retorno NAO dispara;
//      A4 audio dispara; A5 Spotify parado nao dispara
import { mkdirSync } from "node:fs"
import { abrir, esperar } from "./lib.mjs"

const saida = process.argv[2] || "prints-cabine4"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
const dom = (expr) => j.ev(`return ${expr}`)
const IMPORTA_SPOTIFY = `const _t=await (await fetch(BASE+"components/output/preview/SpotifyController.svelte")).text(); const M=await import(_t.match(/from "([^"]*SpotifyManager\.ts[^"]*)"/)[1]);`
// o controlador escondido zera o estado a cada 1 s: o estado e reposto antes de cada gesto
const repor = (tocando) => j.ev(`${IMPORTA_SPOTIFY} for(let i=0;i<4;i++){M.spotifyState.set({title:"Cantico",artist:"Coral",isPlaying:${tocando},positionSec:3,durationSec:200,volume:1}); await esp(20)} M.spotifyIsFading.set(false); return 1`)
const fade = () => j.ev(`${IMPORTA_SPOTIFY} return get(M.spotifyIsFading)`)
// um "video no ar": a entrada que o VideoPlayer poe em playingVideos (o `muted` e escrito logo depois, como la)
const videoNoAr = (path, muted, saidas) => j.ev(`const v={path:${JSON.stringify(path)},audio:{muted:false,paused:false,ended:false},linkedOutputIds:${JSON.stringify(saidas)}}; S.playingVideos.update(a=>{a.push(v); return a}); v.audio.muted=${muted}; return 1`)
const limpar = () => j.ev(`S.playingVideos.set([]); S.playingAudio.set({}); await esp(250); return 1`)
try {
    const saidas = await dom(`Object.keys(get(S.outputs))`)
    const tela = saidas[0]
    await limpar()
    await repor(true)

    await videoNoAr("fundo.mp4", true, [tela])
    await esperar(500)
    ok("A1: video de fundo mudo em repeticao NAO para o Spotify", (await fade()) === false)
    await limpar()

    await repor(true)
    await videoNoAr("frente.mp4", false, [tela])
    await esperar(500)
    ok("A2: video com som (frente) para o Spotify na hora (fade em curso)", (await fade()) === true)
    await esperar(3800)
    await limpar()

    // A3: saida so de retorno
    await j.ev(`S.outputs.update(o=>{o.ret_c4={...JSON.parse(JSON.stringify(o[${JSON.stringify(tela)}])), enabled:true, stageOutput:"x", out:{}}; return o}); return 1`)
    await repor(true)
    await videoNoAr("so-retorno.mp4", false, ["ret_c4"])
    await esperar(500)
    ok("A3: video com som so no retorno NAO para o Spotify", (await fade()) === false)
    await j.ev(`S.outputs.update(o=>{delete o.ret_c4; return o}); return 1`)
    await limpar()

    await repor(true)
    await j.ev(`S.playingAudio.update(a=>{a["/x/tom.wav"]={name:"tom",paused:false,isMic:false,audio:{}}; return a}); return 1`)
    await esperar(500)
    ok("A4: audio tocando para o Spotify", (await fade()) === true)
    await esperar(3800)
    await limpar()

    await repor(false)
    await videoNoAr("frente2.mp4", false, [tela])
    await esperar(500)
    ok("A5: com o Spotify parado nada acontece", (await fade()) === false)
    await limpar()
} catch (e) {
    console.log("FALHA excecao", e.message)
    falhas.push("excecao")
}
await j.fechar?.()
console.log(falhas.length ? `${falhas.length} falha(s)` : "tudo verde")
process.exit(falhas.length ? 1 : 0)
