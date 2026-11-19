// Rodada da cabine, 19/nov, fase 4. Fumaca contra o Show de dev (CDP). Sem cliques forcados.
//   node scripts/prova-culto/t14-cabine4.mjs <pasta-de-prints>
//   A  Spotify para sozinho quando midia COM SOM passa a TOCAR. O video/audio entra pelo caminho REAL (clique no cartao, VideoPlayer.start/play/toggleMute,
//      AudioPlayer.start); so a PORTA do Spotify e de mentira (nao ha Spotify no aparelho de teste): estado fresco + registro dos comandos
//   B  propriedades do Editar em BLOCOS (prancha C4): Fonte/Alinhamento/Texto/Linhas abertos, Contorno/Sombra recolhidos com resumo (dentro de Mais),
//      numero com regua (- / + de 22 px, regua dentro do campo), uma grade so (alturas, respiros, rotulos), aberto/recolhido SOBREVIVE a recarregar
//      B6 camada fundo/frente da midia (so relata o que a arvore C6 e o clique do cartao C1 fazem)
//      A1 fundo mudo NAO dispara; A2 video com som (frente) dispara, fade ~1 s; A3 so retorno NAO; A4 audio; A5 Spotify parado NAO; A6 tirar o mudo dispara;
//      A7 entrar pausado NAO, despausar dispara; A8 reexibir o mesmo video; A9 fora da pagina Mostrar (Editar, Palco, Configuracoes)
import { mkdirSync } from "node:fs"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const saida = process.argv[2] || "prints-cabine4"
mkdirSync(saida, { recursive: true })
const falhas = []
// um tom curto e mudo (WAV 8 kHz mono 16 bit, 0,6 s) para o AudioPlayer.start real
const tomWav = () => {
    const n = 4800
    const b = Buffer.alloc(44 + n * 2)
    b.write("RIFF", 0)
    b.writeUInt32LE(36 + n * 2, 4)
    b.write("WAVEfmt ", 8)
    b.writeUInt32LE(16, 16)
    b.writeUInt16LE(1, 20)
    b.writeUInt16LE(1, 22)
    b.writeUInt32LE(8000, 24)
    b.writeUInt32LE(16000, 28)
    b.writeUInt16LE(2, 32)
    b.writeUInt16LE(16, 34)
    b.write("data", 36)
    b.writeUInt32LE(n * 2, 40)
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(800 * Math.sin(i / 6)), 44 + i * 2)
    return b
}
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
const dom = (expr) => j.ev(`return ${expr}`)
const IMPORTA_SPOTIFY = `const F=await import(U("utils/aliancaSpotifyFadeCurto")); const _m=await import(U("components/output/preview/SpotifyManager"));`
// Spotify de mentira NA PORTA do processo principal (o aparelho de teste nao tem Spotify): estado fresco + o registro dos comandos com a hora de cada um.
// O video e o audio entram pelo CAMINHO REAL (clique no cartao de midia; VideoPlayer.start / AudioPlayer.start / play / toggleMute), nunca por escrita no store.
const spotify = (tocando) => j.ev(`${IMPORTA_SPOTIFY} window.__cmds=[]; F.portaDoSpotify.estado=async()=>({isPlaying:${tocando},volume:1}); F.portaDoSpotify.comando=async(c,v)=>{window.__cmds.push({c,v,t:performance.now()})}; _m.spotifyIsFading.set(false); return 1`)
const cmds = () => dom(`window.__cmds||[]`)
const fimDoFade = async () => {
    for (let i = 0; i < 20 && ((await dom(`window.__cmds.some(x=>x.c==="pause")`)) === false || (await dom(`window.__cmds.at(-1).c`)) !== "setVolume" || (await dom(`window.__cmds.filter(x=>x.c==="setVolume").length`)) < 11); i++) await esperar(250)
}
const limpar = () => j.ev(`const {VideoPlayer}=await import(U("components/media/video/videoPlayer")); for (const v of [...get(S.playingVideos)]) await VideoPlayer.stop(v.path); S.playingVideos.set([]); S.playingAudio.set({}); S.outputs.update(o=>{Object.values(o).forEach(x=>{x.out={}}); return o}); await esp(900); return 1`)
const VP = `const {VideoPlayer}=await import(U("components/media/video/videoPlayer"));`
const CAMINHO_V1 = `Object.values(get(S.mediaFolders))[0].path.split("/").join(String.fromCharCode(92)) + String.fromCharCode(92) + "v1.mp4"`
const cartaoV1 = `[...document.querySelectorAll('[data-acao=midia-cartao]')].find(c=>c.querySelector('.nm').innerText.trim()==="v1")`
const marcaV1 = (v) => j.ev(`const k=${CAMINHO_V1}; S.media.update(m=>{m[k]={...(m[k]||{}), videoType:${JSON.stringify(v)}}; return m}); await esp(300); return 1`)
const cliqueV1 = async () => {
    const th = await dom(`(()=>{const r=${cartaoV1}.querySelector('.card').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await clicarEm(j, th.x, th.y)
    await esperar(1500)
}
const tocandoNoStore = () => dom(`get(S.playingVideos).length`)
try {
    const tela = await dom(`Object.keys(get(S.outputs))[0]`)
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); S.outLocked.set(false); S.activeProject.set("f3"); T.trocarTela("show","segmentado"); S.activeDrawerTab.set("media"); await esp(2500); return 1`)
    await limpar()

    // A1: clique no cartao de um video marcado FUNDO (mudo, em repeticao) com o Spotify tocando: nada acontece
    await marcaV1("background")
    await spotify(true)
    await cliqueV1()
    ok("A1: video de fundo mudo (clique no cartao) NAO para o Spotify", (await tocandoNoStore()) >= 1 && (await cmds()).length === 0, JSON.stringify(await cmds()))
    // A6: o mesmo fundo mudo, agora com o mudo TIRADO (toggleMute real): na hora o Spotify para
    await j.ev(`${VP} const v=get(S.playingVideos)[0]; VideoPlayer.toggleMute(v.path, v.linkedOutputIds[0]); await esp(600); return 1`)
    const c6 = await cmds()
    ok(
        "A6: tirar o mudo do video que ja estava no ar para o Spotify (fade curto)",
        c6.some((x) => x.c === "setVolume"),
        JSON.stringify(c6.slice(0, 2))
    )
    await fimDoFade()
    await limpar()

    // A2: clique no cartao de um video marcado FRENTE (com som): o Spotify para na hora, em ~1 s, e termina em pausa
    await marcaV1("foreground")
    await spotify(true)
    const t0 = await dom(`performance.now()`)
    await cliqueV1()
    await fimDoFade()
    const c2 = await cmds()
    const sv = c2.filter((x) => x.c === "setVolume")
    const pausa = c2.find((x) => x.c === "pause")
    ok("A2: video com som (clique no cartao) para o Spotify: 10 passos descendo, depois pausa, depois volume de volta", sv.length === 11 && !!pausa && sv[0].v < 1 && sv[9].v === 0 && sv[10].v === 1, JSON.stringify(sv.map((x) => x.v)))
    const durFade = pausa ? pausa.t - c2[0].t : 99999
    ok("A2b: o fade dura cerca de 1 s (entre 0,7 s e 2 s), nao os 3 s do botao", durFade > 700 && durFade < 2000, durFade + " ms")
    await limpar()

    // A3: so numa saida de retorno (stageOutput): nao conta
    await j.ev(`S.outputs.update(o=>{o.ret_c4={...JSON.parse(JSON.stringify(o[${JSON.stringify(tela)}])), enabled:true, stageOutput:"x", out:{}}; return o}); return 1`)
    await spotify(true)
    await j.ev(`${VP} await VideoPlayer.start(${CAMINHO_V1}, {muted:false, loop:false}, ["ret_c4"]); await esp(1500); return 1`)
    ok("A3: video com som so na saida de retorno NAO para o Spotify", (await tocandoNoStore()) >= 1 && (await cmds()).length === 0, JSON.stringify(await cmds()))
    await j.ev(`S.outputs.update(o=>{delete o.ret_c4; return o}); return 1`)
    await limpar()

    // A4: audio tocando (AudioPlayer.start real, arquivo de verdade)
    const wav = await dom(`Object.values(get(S.mediaFolders))[0].path.split("/").join(String.fromCharCode(92)) + String.fromCharCode(92) + "t14-tom.wav"`)
    writeFileSync(String(wav), tomWav())
    await spotify(true)
    await j.ev(`const {AudioPlayer}=await import(U("audio/audioPlayer")); await AudioPlayer.start(${JSON.stringify(wav)}, {name:"tom"}); await esp(1500); return 1`)
    ok(
        "A4: audio tocando (AudioPlayer.start) para o Spotify",
        (await cmds()).some((x) => x.c === "setVolume"),
        JSON.stringify((await cmds()).slice(0, 2))
    )
    await fimDoFade()
    await limpar()

    // A5: Spotify parado: nada acontece
    await spotify(false)
    await j.ev(`${VP} await VideoPlayer.start(${CAMINHO_V1}, {muted:false, loop:false}, [${JSON.stringify(tela)}]); await esp(1500); return 1`)
    ok("A5: com o Spotify parado nada acontece", (await tocandoNoStore()) >= 1 && (await cmds()).length === 0, JSON.stringify(await cmds()))
    await limpar()

    // A7: video que entra PAUSADO nao dispara; ao dar play, dispara
    await spotify(true)
    await j.ev(`${VP} await VideoPlayer.start(${CAMINHO_V1}, {muted:false, loop:false, paused:true}, [${JSON.stringify(tela)}]); await esp(1500); return 1`)
    ok("A7: video que entra PAUSADO nao para o Spotify", (await tocandoNoStore()) >= 1 && (await cmds()).length === 0, JSON.stringify(await cmds()))
    await j.ev(`${VP} const v=get(S.playingVideos)[0]; VideoPlayer.play(v.path, v.linkedOutputIds[0]); await esp(700); return 1`)
    ok(
        "A7b: dar play nesse video (despausar) para o Spotify",
        (await cmds()).some((x) => x.c === "setVolume"),
        JSON.stringify((await cmds()).slice(0, 2))
    )
    await fimDoFade()
    await limpar()

    // A8: reexibir o MESMO video (parar e tocar de novo, sem o Spotify ter sido religado pelo sistema) dispara de novo
    await spotify(true)
    await j.ev(`${VP} await VideoPlayer.start(${CAMINHO_V1}, {muted:false, loop:false}, [${JSON.stringify(tela)}]); await esp(1200); return 1`)
    await fimDoFade()
    await spotify(true)
    await j.ev(`${VP} await VideoPlayer.stop(${CAMINHO_V1}); await VideoPlayer.start(${CAMINHO_V1}, {muted:false, loop:false}, [${JSON.stringify(tela)}]); await esp(1200); return 1`)
    ok(
        "A8: reexibir o mesmo video dispara o fade de novo",
        (await cmds()).some((x) => x.c === "setVolume"),
        JSON.stringify((await cmds()).slice(0, 2))
    )
    await fimDoFade()
    await limpar()

    // A9: fora da pagina Mostrar (Editar, Palco, Configuracoes) o gatilho continua valendo (nao depende do estado do Spotify que o controlador da pagina Mostrar mantem)
    for (const [nome, pag] of [
        ["Editar", "edit"],
        ["Palco", "stage"],
        ["Configuracoes", "settings"]
    ]) {
        await j.ev(`T.trocarTela(${JSON.stringify(pag)},"segmentado"); await esp(1500); return 1`)
        if ((await dom(`get(S.activePage)`)) !== pag) { ok(`A9: a pagina ${nome} abriu`, false, String(await dom(`get(S.activePage)`))); continue }
        await spotify(true)
        await j.ev(`${VP} await VideoPlayer.start(${CAMINHO_V1}, {muted:false, loop:false}, [${JSON.stringify(tela)}]); await esp(1500); return 1`)
        ok(
            `A9: com a pagina ${nome} aberta (nao Mostrar), video com som para o Spotify`,
            (await cmds()).some((x) => x.c === "setVolume"),
            JSON.stringify((await cmds()).slice(0, 2))
        )
        await fimDoFade()
        await limpar()
    }
    await j.ev(`T.trocarTela("show","segmentado"); await esp(800); return 1`)
    await marcaV1(null)

    // o estado fingido de A nao deve vazar para B: pagina nova
    await j.enviar("Page.reload", { ignoreCache: true })
    await esperar(9000)
    // ---------------- B. propriedades do Editar
    const abrirEditar = async () => {
        for (let tent = 0; tent < 4; tent++) {
            await j.ev(`S.activePopup.set(null); const p=get(S.projects); const alvo=Object.entries(p).find(([k,v])=>(v.shows||[]).some(s=>(s.type===undefined||s.type==="show")))
    S.activeProject.set(alvo[0]); const i=alvo[1].shows.findIndex(s=>(s.type===undefined||s.type==="show"))
    const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([alvo[1].shows[i].id])
    S.activeShow.set({id:alvo[1].shows[i].id,index:i,type:"show"}); S.activeDrawerTab.set("shows"); await esp(900)
    T.trocarTela("edit","segmentado"); await esp(1200)
    S.activeEdit.set({type:"show",slide:0,items:[0],showId:get(S.activeShow).id}); await esp(1500); return 1`)
            for (let i = 0; i < 20 && (await dom(`document.querySelector('[data-acao=editar-ferramentas]')?.querySelectorAll('[data-acao=bloco-cabecalho]').length || 0`)) < 4; i++) await esperar(250)
            if ((await dom(`document.querySelector('[data-acao=editar-ferramentas]')?.querySelectorAll('[data-acao=bloco-cabecalho]').length || 0`)) >= 4) return
        }
    }
    const print = async (nome) => {
        await esperar(600)
        const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
        writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
        console.log("print", nome)
    }
    const clique = async (expr) => {
        const a = await localizar(j, expr)
        if (!a.ok) throw new Error("alvo nao clicavel: " + a.motivo + " :: " + expr)
        await clicarEm(j, a.x, a.y)
    }
    const painel = `document.querySelector('[data-acao=editar-ferramentas]')`
    const bloco = (chave) => `${painel}.querySelector('[data-bloco="${chave}"]')`
    const aberto = (chave) => dom(`${bloco(chave)}?.querySelector('[data-acao=bloco-cabecalho]')?.getAttribute('aria-expanded')`)
    // limpa a escolha guardada de execucoes anteriores (a prova parte dos padroes)
    await j.ev(`try{localStorage.removeItem("aliancashow.editar.blocos.v1")}catch(e){} return 1`)
    await abrirEditar()
    // recarrega para provar que o padrao vale com o armazenamento limpo
    const rotulos = await dom(`[...${painel}.querySelectorAll('[data-acao=bloco-cabecalho]')].map(h=>({k:h.closest('[data-bloco]').dataset.bloco, a:h.getAttribute('aria-expanded'), t:h.innerText.replace(/\\s+/g,' ').trim()}))`)

    ok(
        "B1: Fonte, Alinhamento, Texto e Linhas nascem ABERTOS, em caixa alta e nessa ordem",
        ["vista:default", "vista:align", "vista:text", "vista:lines"].every((k) => rotulos.find((r) => r.k === k)?.a === "true") &&
            rotulos
                .slice(0, 4)
                .map((r) => r.t.toUpperCase())
                .join("|") === "FONTE|ALINHAMENTO|TEXTO|LINHAS",
        JSON.stringify(rotulos)
    )
    ok("B1b: Mais e Avancado nascem recolhidos com resumo de 1 linha", (await dom(`[...${painel}.querySelectorAll('[data-acao=editar-grupo]')].every(b=>b.getAttribute('aria-expanded')==='false' && /tudo no padrão/.test(b.innerText))`)) === true)
    await print("c4-depois-texto")

    // grade: alturas e respiros iguais em todos os blocos
    const grade = await dom(`(()=>{const P=${painel}; const h=(s)=>[...new Set([...P.querySelectorAll(s)].map(e=>Math.round(e.getBoundingClientRect().height)))];
      const campos=h('.luz-lin > .textfield, .luz-lin > .luz-num'); const past=h('.luz-lin:has(.highlight)');
      const rotulosCampo=[...new Set([...P.querySelectorAll('.luz-num > label, .textfield > label.selected')].map(e=>getComputedStyle(e).fontSize))];
      const secs=[...new Set([...P.querySelectorAll('.luz-sec')].map(e=>{const c=getComputedStyle(e); return c.fontSize+'/'+c.textTransform}))];
      const gaps=[...new Set([...P.querySelectorAll('.luz-lin:not(:has(.highlight))')].map(e=>getComputedStyle(e).columnGap+'/'+getComputedStyle(e).rowGap))];
      // distancia vertical entre linhas vizinhas do mesmo bloco = altura + 8
      const dist=[]; for(const c of P.querySelectorAll('.luz-corpo')){const ls=[...c.querySelectorAll(':scope > .luz-lin')]; for(let i=1;i<ls.length;i++){dist.push(Math.round(ls[i].getBoundingClientRect().top-ls[i-1].getBoundingClientRect().bottom))}}
      return {campos,past,rotulosCampo,secs,gaps,dist:[...new Set(dist)]}})()`)
    ok("B2: grade unica: campo 44 px em todo bloco, pastilha 36 px, rotulo de campo 10,5 px, titulo de bloco 12 px caixa alta, respiro 8 px entre campos e entre linhas", JSON.stringify(grade.campos) === "[44]" && JSON.stringify(grade.past) === "[36]" && JSON.stringify(grade.rotulosCampo) === '["10.5px"]' && JSON.stringify(grade.secs) === '["12px/uppercase"]' && JSON.stringify(grade.gaps) === '["8px/8px"]' && JSON.stringify(grade.dist) === "[8]", JSON.stringify(grade))

    // numero com regua: so onde o campo PEDE (showSlider). Na caixa isso e o bloco de Filtros (em Avancado); Texto e Posicao nao tem regua.
    const FILTROS = "avancado:backdrop_filters"
    ok("B2b: Posicao volta a forma compacta: 2 campos por linha e NENHUMA regua", (await dom(`${bloco("vista:position")}.querySelectorAll('.luz-lin').length`)) === 2 && (await dom(`${bloco("vista:position")}.querySelectorAll('.luz-num.regua').length`)) === 0 && (await dom(`${bloco("vista:text")}.querySelectorAll('.luz-num.regua').length`)) === 0)
    await clique(`${painel}.querySelectorAll('[data-grupo=avancado]')[1]`)
    await esperar(500)
    await clique(`${bloco(FILTROS)}.querySelector('[data-acao=bloco-cabecalho]')`)
    await esperar(500)
    const num = await dom(`(()=>{const f=${bloco(FILTROS)}.querySelector('.luz-num.regua'); if(!f) return null; const q=[...f.querySelectorAll('.q')].map(b=>{const r=b.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height)}); const reg=f.querySelector('input.reg'); const r=reg.getBoundingClientRect(), fr=f.getBoundingClientRect(); return {q, dentro: r.left>=fr.left && r.right<=fr.right && r.top>=fr.top && r.bottom<=fr.bottom, h:Math.round(fr.height)}})()`)
    ok("B3: numero com regua: regua DENTRO do campo de 44 px e botoes - / + de 22 x 22 px", !!num && num.dentro && num.h === 44 && num.q.join(",") === "22x22,22x22", JSON.stringify(num))
    const antes = await dom(`${bloco(FILTROS)}.querySelector('.luz-num.regua input:not(.reg)').value`)
    await clique(`${bloco(FILTROS)}.querySelector('[data-acao=numero-mais]')`)
    await esperar(500)
    const depois = await dom(`${bloco(FILTROS)}.querySelector('.luz-num.regua input:not(.reg)').value`)
    ok("B4: clicar em + muda o valor de verdade (e aparece o pontinho de 'mudou do padrao')", Number(depois) > Number(antes) && (await dom(`!!${bloco(FILTROS)}.querySelector('.luz-num.regua .ponto')`)) === true, antes + " -> " + depois)
    await clique(`${bloco(FILTROS)}.querySelector('[data-acao=numero-menos]')`)
    await esperar(500)
    ok("B4b: clicar em - volta ao valor e o pontinho some", (await dom(`${bloco(FILTROS)}.querySelector('.luz-num.regua input:not(.reg)').value`)) === antes && (await dom(`!${bloco(FILTROS)}.querySelector('.luz-num.regua .ponto')`)) === true)

    // Mais: Contorno e Sombra recolhidos com resumo
    await clique(`${painel}.querySelector('[data-grupo=mais]')`)
    await esperar(600)
    const raros = await dom(`[...${painel}.querySelectorAll('[data-acao=bloco-cabecalho]')].filter(h=>/^(contorno|sombra do texto|lista|acordes)/i.test(h.innerText.trim())).map(h=>h.getAttribute('aria-expanded')+':'+h.innerText.replace(/\\s+/g,' ').trim())`)
    ok('B5: dentro de Mais, Contorno, Sombra, Lista e Acordes nascem recolhidos com resumo "desligado"', raros.length === 4 && raros.every((r) => r.startsWith("false:") && /desligado/.test(r)), JSON.stringify(raros))
    await print("c4-depois-mais")

    // persistencia: recolher Fonte, abrir Mais ja esta aberto; recarregar e conferir
    await clique(`${bloco("vista:default")}.querySelector('[data-acao=bloco-cabecalho]')`)
    await esperar(400)
    ok("B6: clicar no titulo recolhe o bloco e mostra o resumo", (await aberto("vista:default")) === "false" && /padrão/.test(await dom(`${bloco("vista:default")}.innerText`)))
    const guardado = await dom(`localStorage.getItem("aliancashow.editar.blocos.v1")`)
    ok("B6b: a escolha foi guardada no armazenamento do app", /vista:default/.test(guardado || "") && /grupo:mais/.test(guardado || ""), guardado)
    await j.enviar("Page.reload", { ignoreCache: true })
    await esperar(9000)
    await abrirEditar()
    ok("B7: depois de recarregar o app, Fonte continua RECOLHIDA, Alinhamento aberto e Mais aberto", (await aberto("vista:default")) === "false" && (await aberto("vista:align")) === "true" && (await dom(`${painel}.querySelector('[data-grupo=mais]').getAttribute('aria-expanded')`)) === "true")
    // B8 (revisao do PR #42, achado 8): bloco que LIGA um recurso nao fecha sozinho quando o valor volta ao padrao (desmarcar Lista deixava o bloco sumir debaixo do mouse)
    await clique(`${bloco("mais:list")}.querySelector('[data-acao=bloco-cabecalho]')`)
    await esperar(600)
    ok("B8a: abrir Lista liga o recurso e mostra a caixa de marcar ligada", (await aberto("mais:list")) === "true" && (await dom(`${bloco("mais:list")}.querySelector('.checkboxfield input')?.checked`)) === true)
    await clique(`${bloco("mais:list")}.querySelector('.checkboxfield')`)
    await esperar(800)
    ok("B8b: desmarcar Lista (valor volta ao padrao) NAO fecha o bloco: ele continua aberto, com a caixa na mao", (await aberto("mais:list")) === "true" && (await dom(`${bloco("mais:list")}.querySelector('.checkboxfield input')?.checked`)) === false)
    await clique(`${bloco("mais:list")}.querySelector('.checkboxfield')`)
    await esperar(600)
    ok("B8c: marcar de novo funciona com o bloco aberto", (await aberto("mais:list")) === "true" && (await dom(`${bloco("mais:list")}.querySelector('.checkboxfield input')?.checked`)) === true)
    // escopos distintos (achado 9): recolher Fonte no Editar de texto nao mexe nas chaves guardadas dos outros usos
    ok("B9: as chaves guardadas do Editar de texto levam o escopo da caixa (nenhuma cai em x|)", !/"x[|]/.test((await dom(`localStorage.getItem("aliancashow.editar.blocos.v1")`)) || ""))
    // devolve o padrao para o resto da rodada
    await j.ev(`try{localStorage.removeItem("aliancashow.editar.blocos.v1")}catch(e){} return 1`)

    // ---------------- C. fundo/frente no clique do cartao (C1)
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); S.outLocked.set(false); S.activeProject.set("f3"); T.trocarTela("show","segmentado"); S.activeDrawerTab.set("media"); await esp(2500); return 1`)
    const cartao = (nome) => `[...document.querySelectorAll('[data-acao=midia-cartao]')].find(c=>c.querySelector('.nm').innerText.trim()===${JSON.stringify(nome)})`
    const caixaC = (expr) => dom(`(()=>{const e=${expr}; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})()`)
    // o caminho do jeito que o cartao usa (barras invertidas no Windows)
    const caminhoV1 = await dom(`Object.values(get(S.mediaFolders))[0].path.split("/").join(String.fromCharCode(92)) + String.fromCharCode(92) + "v1.mp4"`)
    const tela1 = await dom(`Object.keys(get(S.outputs))[0]`)
    const ponhaTexto = () => j.ev(`S.outputs.update(o=>{o["${tela1}"].out={slide:{id:"impulso_aos_teus_pes",index:0,layout:"default"}}; return o}); await esp(500); return 1`)
    const estadoAr = () => dom(`(()=>{const o=get(S.outputs)["${tela1}"].out||{}; return {texto:!!o.slide, fundo:(o.background?.path||"").split(String.fromCharCode(92)).pop()||"", mudo:o.background?.muted}})()`)
    const clicaV1 = async () => {
        const th = await caixaC(`${cartao("v1")}.querySelector('.card')`)
        await clicarEm(j, th.x + th.w / 2, th.y + th.h / 2)
        await esperar(900)
        if (!(await estadoAr()).fundo) {
            await esperar(1200)
            await clicarEm(j, th.x + th.w / 2, th.y + th.h / 2)
            await esperar(900)
        }
    }
    const limparAr = () => j.ev(`S.outputs.update(o=>{Object.values(o).forEach(x=>{x.out={}}); return o}); await esp(500); return 1`)
    const marca = (v) => j.ev(`S.media.update(m=>{m[${JSON.stringify(caminhoV1)}]={...(m[${JSON.stringify(caminhoV1)}]||{}), videoType:${JSON.stringify(v)}}; if(!${JSON.stringify(v)}) delete m[${JSON.stringify(caminhoV1)}].videoType; return m}); await esp(300); return 1`)
    await limparAr()
    // por midia: frente
    await marca("foreground")
    await ponhaTexto()
    await clicaV1()
    let e1 = await estadoAr()
    ok("C1: midia marcada FRENTE: o clique tira o texto do ar e o video toca COM som", e1.fundo === "v1.mp4" && e1.texto === false && e1.mudo === false, JSON.stringify(e1))
    await limparAr()
    await esperar(800)
    // por midia: fundo
    await marca("background")
    await ponhaTexto()
    await clicaV1()
    let e2 = await estadoAr()
    ok("C2: midia marcada FUNDO: entra ATRAS do texto (o texto fica no ar) e MUDO", e2.fundo === "v1.mp4" && e2.texto === true && e2.mudo === true, JSON.stringify(e2))
    await limparAr()
    await esperar(800)
    // herdada da pasta: sem marca propria, a pasta decide
    await marca(null)
    await j.ev(`S.mediaTags.update(t=>{t.pc4={name:"Pasta de teste C4",color:null,aliancaPasta:{camada:"frente",fim:"repetir"}}; return t}); S.media.update(m=>{const k=${JSON.stringify(caminhoV1)}; m[k]={...(m[k]||{}), tags:["pc4"]}; return m}); await esp(400); return 1`)
    await ponhaTexto()
    await clicaV1()
    let e3 = await estadoAr()
    ok("C3: pasta FRENTE (sem marca propria na midia): o clique tira o texto e toca COM som", e3.fundo === "v1.mp4" && e3.texto === false && e3.mudo === false, JSON.stringify(e3))
    await limparAr()
    await esperar(800)
    await j.ev(`S.mediaTags.update(t=>{t.pc4.aliancaPasta.camada="fundo"; return t}); await esp(400); return 1`)
    await ponhaTexto()
    await clicaV1()
    let e4 = await estadoAr()
    ok("C4: pasta FUNDO: entra atras do texto e MUDO", e4.fundo === "v1.mp4" && e4.texto === true && e4.mudo === true, JSON.stringify(e4))
    // o selo do cartao diz de onde vem
    const selo = await dom(`${cartao("v1")}.querySelector('[data-title]')?.getAttribute('data-title')`)
    console.log("info selo do cartao:", selo)
    await limparAr()
    // limpeza do que a prova criou
    await j.ev(`S.mediaTags.update(t=>{delete t.pc4; return t}); S.media.update(m=>{const k=${JSON.stringify(caminhoV1)}; if(m[k]) delete m[k].tags; return m}); await esp(300); return 1`)
} catch (e) {
    console.log("FALHA excecao", e.message)
    falhas.push("excecao")
}
await j.fechar?.()
console.log(falhas.length ? `${falhas.length} falha(s)` : "tudo verde")
process.exit(falhas.length ? 1 : 0)
