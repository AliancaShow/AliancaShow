// Rodada da cabine, 19/nov, fase 4. Fumaca contra o Show de dev (CDP). Sem cliques forcados.
//   node scripts/prova-culto/t14-cabine4.mjs <pasta-de-prints>
//   A  Spotify para sozinho quando midia COM SOM entra no ar (estado do Spotify injetado como a t8 faz; nao ha Spotify no aparelho de teste)
//   B  propriedades do Editar em BLOCOS (prancha C4): Fonte/Alinhamento/Texto/Linhas abertos, Contorno/Sombra recolhidos com resumo (dentro de Mais),
//      numero com regua (- / + de 22 px, regua dentro do campo), uma grade so (alturas, respiros, rotulos), aberto/recolhido SOBREVIVE a recarregar
//      B6 camada fundo/frente da midia (so relata o que a arvore C6 e o clique do cartao C1 fazem)
//      A1 video de fundo MUDO em repeticao NAO dispara o fade; A2 video com som (frente) dispara; A3 so em saida de retorno NAO dispara;
//      A4 audio dispara; A5 Spotify parado nao dispara
import { mkdirSync } from "node:fs"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const saida = process.argv[2] || "prints-cabine4"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")
const dom = (expr) => j.ev(`return ${expr}`)
const IMPORTA_SPOTIFY = `const _t=await (await fetch(BASE+"components/output/preview/SpotifyController.svelte")).text(); const M=await import(_t.match(/from "([^"]*SpotifyManager\.ts[^"]*)"/)[1]);`
// o controlador escondido zera o estado a cada 1 s: o estado e reposto antes de cada gesto
const repor = (tocando) => j.ev(`${IMPORTA_SPOTIFY} for(let i=0;i<4;i++){M.spotifyState.set({title:"Cantico",artist:"Coral",isPlaying:${tocando},positionSec:3,durationSec:200,volume:1}); await esp(20)} M.spotifyIsFading.set(false); return 1`)
const fade = () => j.ev(`${IMPORTA_SPOTIFY} return get(M.spotifyIsFading)`)
// um "video no ar": a entrada que o VideoPlayer poe em playingVideos (o `muted` e escrito logo depois, como la)
const videoNoAr = (path, muted, saidas) => j.ev(`const v={path:${JSON.stringify(path)},audio:Object.assign(new Audio(),{}),linkedOutputIds:${JSON.stringify(saidas)}}; S.playingVideos.update(a=>{a.push(v); return a}); v.audio.muted=${muted}; return 1`)
// espera o fade em curso acabar (cada passo do fade e uma ida ao processo principal: a duracao real passa dos 3 s)
const fimDoFade = async () => { for (let i = 0; i < 60 && (await fade()); i++) await esperar(500) }
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
    await fimDoFade()
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
    await j.ev(`S.playingAudio.update(a=>{a["/x/tom.wav"]={name:"tom",paused:false,isMic:false,audio:new Audio()}; return a}); return 1`)
    await esperar(500)
    ok("A4: audio tocando para o Spotify", (await fade()) === true)
    await fimDoFade()
    await limpar()

    await repor(false)
    await videoNoAr("frente2.mp4", false, [tela])
    await esperar(500)
    ok("A5: com o Spotify parado nada acontece", (await fade()) === false)
    await limpar()

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
    
    ok("B1: Fonte, Alinhamento, Texto e Linhas nascem ABERTOS, em caixa alta e nessa ordem", ["vista:default", "vista:align", "vista:text", "vista:lines"].every((k) => rotulos.find((r) => r.k === k)?.a === "true") && rotulos.slice(0, 4).map((r) => r.t.toUpperCase()).join("|") === "FONTE|ALINHAMENTO|TEXTO|LINHAS", JSON.stringify(rotulos))
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

    // numero com regua
    const num = await dom(`(()=>{const f=${bloco("vista:text")}.querySelector('.luz-num.regua'); if(!f) return null; const q=[...f.querySelectorAll('.q')].map(b=>{const r=b.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height)}); const reg=f.querySelector('input.reg'); const r=reg.getBoundingClientRect(), fr=f.getBoundingClientRect(); return {q, dentro: r.left>=fr.left && r.right<=fr.right && r.top>=fr.top && r.bottom<=fr.bottom, h:Math.round(fr.height)}})()`)
    ok("B3: numero com regua: regua DENTRO do campo de 44 px e botoes - / + de 22 x 22 px", !!num && num.dentro && num.h === 44 && num.q.join(",") === "22x22,22x22", JSON.stringify(num))
    const antes = await dom(`${bloco("vista:text")}.querySelector('.luz-num.regua input:not(.reg)').value`)
    await clique(`${bloco("vista:text")}.querySelector('[data-acao=numero-mais]')`)
    await esperar(500)
    const depois = await dom(`${bloco("vista:text")}.querySelector('.luz-num.regua input:not(.reg)').value`)
    ok("B4: clicar em + muda o valor de verdade (e aparece o pontinho de 'mudou do padrao')", Number(depois) === Number(antes) + 1 && (await dom(`!!${bloco("vista:text")}.querySelector('.luz-num.regua .ponto')`)) === true, antes + " -> " + depois)
    await clique(`${bloco("vista:text")}.querySelector('[data-acao=numero-menos]')`)
    await esperar(500)
    ok("B4b: clicar em - volta ao valor e o pontinho some", (await dom(`${bloco("vista:text")}.querySelector('.luz-num.regua input:not(.reg)').value`)) === antes && (await dom(`!${bloco("vista:text")}.querySelector('.luz-num.regua .ponto')`)) === true)

    // Mais: Contorno e Sombra recolhidos com resumo
    await clique(`${painel}.querySelector('[data-grupo=mais]')`)
    await esperar(600)
    const raros = await dom(`[...${painel}.querySelectorAll('[data-acao=bloco-cabecalho]')].filter(h=>/^(contorno|sombra do texto|lista|acordes)/i.test(h.innerText.trim())).map(h=>h.getAttribute('aria-expanded')+':'+h.innerText.replace(/\\s+/g,' ').trim())`)
    ok("B5: dentro de Mais, Contorno, Sombra, Lista e Acordes nascem recolhidos com resumo \"desligado\"", raros.length === 4 && raros.every((r) => r.startsWith("false:") && /desligado/.test(r)), JSON.stringify(raros))
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
    const clicaV1 = async () => { const th = await caixaC(`${cartao("v1")}.querySelector('.card')`); await clicarEm(j, th.x + th.w / 2, th.y + th.h / 2); await esperar(900); if (!(await estadoAr()).fundo) { await esperar(1200); await clicarEm(j, th.x + th.w / 2, th.y + th.h / 2); await esperar(900) } }
    const limparAr = () => j.ev(`S.outputs.update(o=>{Object.values(o).forEach(x=>{x.out={}}); return o}); await esp(500); return 1`)
    const marca = (v) => j.ev(`S.media.update(m=>{m[${JSON.stringify(caminhoV1)}]={...(m[${JSON.stringify(caminhoV1)}]||{}), videoType:${JSON.stringify(v)}}; if(!${JSON.stringify(v)}) delete m[${JSON.stringify(caminhoV1)}].videoType; return m}); await esp(300); return 1`)
    await limparAr()
    // por midia: frente
    await marca("foreground"); await ponhaTexto(); await clicaV1()
    let e1 = await estadoAr()
    ok("C1: midia marcada FRENTE: o clique tira o texto do ar e o video toca COM som", e1.fundo === "v1.mp4" && e1.texto === false && e1.mudo === false, JSON.stringify(e1))
    await limparAr(); await esperar(800)
    // por midia: fundo
    await marca("background"); await ponhaTexto(); await clicaV1()
    let e2 = await estadoAr()
    ok("C2: midia marcada FUNDO: entra ATRAS do texto (o texto fica no ar) e MUDO", e2.fundo === "v1.mp4" && e2.texto === true && e2.mudo === true, JSON.stringify(e2))
    await limparAr(); await esperar(800)
    // herdada da pasta: sem marca propria, a pasta decide
    await marca(null)
    await j.ev(`S.mediaTags.update(t=>{t.pc4={name:"Pasta de teste C4",color:null,aliancaPasta:{camada:"frente",fim:"repetir"}}; return t}); S.media.update(m=>{const k=${JSON.stringify(caminhoV1)}; m[k]={...(m[k]||{}), tags:["pc4"]}; return m}); await esp(400); return 1`)
    await ponhaTexto(); await clicaV1()
    let e3 = await estadoAr()
    ok("C3: pasta FRENTE (sem marca propria na midia): o clique tira o texto e toca COM som", e3.fundo === "v1.mp4" && e3.texto === false && e3.mudo === false, JSON.stringify(e3))
    await limparAr(); await esperar(800)
    await j.ev(`S.mediaTags.update(t=>{t.pc4.aliancaPasta.camada="fundo"; return t}); await esp(400); return 1`)
    await ponhaTexto(); await clicaV1()
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
