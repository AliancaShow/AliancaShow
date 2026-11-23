// Fatia 8b (modo "so retorno" de verdade): fumaca com cliques e teclas REAIS (nunca force) contra o Show de dev (CDP, FS_CDP_PORTA).
// O perfil de prova ganha, por store, uma 2a saida configurada como retorno (stageOutput) e o layout de palco dela; NADA liga janela nem toca o Sirvo.
//   node scripts/prova-culto/t10-retorno.mjs <pasta-de-prints>
//   A. ligar (clique real no botao): o retorno e semeado com o slide do telao, a fonte do layout aponta para o retorno e CONTINUA apontando (R1)
//   B. para cada caminho de envio, o `out` do telao fica BYTE A BYTE igual e o do retorno muda:
//      clique no slide, seta, Espaco, PageUp, avancar pela API/celular (OutputHelper), "Mandar pro ar" do Editar, Ctrl+K (musica Ctrl+Enter e versiculo Enter),
//      saida explicita (como o clique de midia, a linha do tempo e o updateOut fazem), fundo de midia (muted no retorno, sem player no telao), sobreposicao
//   C. ajuste do que ja esta no ar (repetir/mudo) segue falando com o telao (semDesvio) e a limpeza de sobreposicao tambem
//   D. Esc real limpa o telao normal e NAO apaga o retorno
//   E. desligar (clique real na faixa): o `out` INTEIRO do retorno esvazia, a fonte volta, o telao nao e tocado; depois um clique volta ao normal
//   B'. D1 (decisao do coordenador): o modo aceita SO slide de texto. Midia (fundo/video), PDF, audio, sobreposicao e efeito sao RECUSADOS ALTO (falha "so-retorno-recusa")
//       sem tocar o telao nem o retorno nem o tocador; Espaco/seta com a midia ja no telao nunca pausam/retomam o video do telao (B3); PDF pelas setas
//       nao limpa o fundo do telao (B1)
//   I. automacao do TELAO segue movendo o telao com o modo ligado: temporizador de slide (I1), avancar ao fim da midia, linha do tempo; expiracao de
//      sobreposicao com duracao no telao (I2) tira do telao. O modo so desvia GESTOS do operador. Ao desligar nada fica congelado
//   F. retorno desabilitado com o modo ligado: o modo desliga sozinho e o envio nunca cai no telao
//   G. queda: modo "desligado" com a marca na fonte (sessao nova) e devolvida pelo assinante do topo, mesmo em Editar
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { conectar, PORTA } from "./cdp.mjs"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-8b"
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
const sel = (a) => `document.querySelector('[data-acao=${a}]')`
const clicarAcao = async (a) => {
    const r = await localizar(j, sel(a))
    if (!r.ok) throw new Error(`${a}: ${r.motivo}`)
    await clicarEm(j, r.x, r.y)
}
const telao = () => dom(`JSON.stringify(get(S.outputs).default?.out ?? null)`)
const retorno = () => dom(`JSON.stringify(get(S.outputs).ret_t10?.out ?? null)`)
const slideRet = () => dom(`(()=>{const s=get(S.outputs).ret_t10?.out?.slide; return s ? s.id+"#"+s.index : null})()`)
const idxRet = () => dom(`get(S.outputs).ret_t10?.out?.slide?.index ?? null`)
const idxTel = () => dom(`get(S.outputs).default?.out?.slide?.index ?? null`)
const fonte = () => dom(`get(S.stageShows).L_t10?.settings?.output ?? null`)
const SHOW = "impulso_aos_teus_pes"
const PERFIL_DIR = (process.env.FS_PERFIL_DIR || "C:/Users/andre.zagato/Documents/ProjetosPessoais/aliancashow/bancada/prova-perfil-9226").split(String.fromCharCode(92)).join("/")
const PDF = PERFIL_DIR + "/midia/t10.pdf"
const PDF_MINIMO = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n5 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n"

/** a janela de saida do retorno de teste (a que desenha o layout de palco com o item "c"); null se nao abriu em 20 s */
async function janelaDoRetorno() {
    for (let t = 0; t < 20; t++) {
        const alvos = (await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json()).filter((a) => a.type === "page" && a.url.startsWith("http://localhost:3000"))
        for (const a of alvos) {
            const c = await conectar(a.webSocketDebuggerUrl)
            const eh = await c.avaliar(`return !document.querySelector('[data-regiao="topo"]') && !!document.querySelector('[id="c"].stage_item')`).catch(() => false)
            if (eh) return c
            c.fechar()
        }
        await esperar(1000)
    }
    return null
}

/** roda `acao`, e exige: telao identico, retorno diferente (ou satisfazendo `pred`) */
async function caminho(nome, acao, pred = null, espera = 700) {
    const t0 = await telao()
    const r0 = await retorno()
    await acao()
    await esperar(espera)
    const t1 = await telao()
    const r1 = await retorno()
    ok(`B. ${nome}: o telao NAO mudou`, t0 === t1, t0 === t1 ? "" : `${t0}  ->  ${t1}`)
    ok(`B. ${nome}: o retorno mudou`, pred ? await pred(r0, r1) : r0 !== r1, `${r0.slice(0, 60)} -> ${r1.slice(0, 60)}`)
}

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); S.outLocked.set(false); T.trocarTela("show","segmentado"); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); S.outputCache.set(null)
S.outputs.update(a=>({...a, ret_t10:{enabled:true,active:false,name:"Retorno t10",color:"#000",bounds:{x:0,y:0,width:1280,height:720},screen:null,stageOutput:"L_t10",out:{}}}))
S.stageShows.update(s=>({...s, L_t10:{name:"Retorno t10",disabled:false,settings:{color:"#000"},items:{}}}))
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows(["${SHOW}"]); S.activeShow.set({id:"${SHOW}",type:"show"}); await esp(1000); return 1`)
    {
        const w = await localizar(j, `document.querySelectorAll("#showArea .slide")[8]`)
        await clicarEm(j, w.x, w.y)
    } // aquece: o 1o clique de um Electron recem-aberto pode se perder
    await esperar(1500)
    await j.ev(`S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); S.outputCache.set(null); return 1`)
    ok("0. o retorno de teste existe e o layout dele nao tem fonte", (await fonte()) === null && (await dom(`!!get(S.outputs).ret_t10`)))

    // um slide no telao ANTES do modo (clique real)
    {
        const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[0]`)
        await clicarEm(j, a.x, a.y)
    }
    await esperar(700)
    ok("0. o telao mostra o slide 0", (await idxTel()) === 0, String(await idxTel()))
    const tel0 = await telao()

    // ---------- A. ligar
    await clicarAcao("modo-so-retorno")
    await esperar(600)
    ok("A. o botao acendeu", (await dom(`${sel("modo-so-retorno")}.getAttribute("aria-pressed")`)) === "true")
    ok("A. a fonte do layout aponta para o retorno e CONTINUA apontando (R1: a recuperacao nao desfaz)", (await fonte()) === "ret_t10", String(await fonte()))
    ok("A. o retorno foi semeado com o slide do telao (nao apaga o monitor)", (await idxRet()) === 0, String(await idxRet()))
    ok("A. o telao nao foi tocado ao ligar", (await telao()) === tel0)
    // C3 (cabine 18/nov, contrato mudou): a tarja diz so "SÓ RETORNO · telão parado"; o que o retorno mostra esta na aba Retorno logo abaixo
    ok("A. a coluna No ar diz que o modo esta ligado e o telao parado", /telão parado/.test(await dom(`${sel("retorno-mostra")}?.textContent||""`)), await dom(`${sel("retorno-mostra")}?.textContent||""`))
    await print("t10-a-ligado")

    // ---------- A4 + A5 (cabine, 18/nov; reescritas na cabine 6, fatia A): o layout de palco do retorno com o modo LIGADO, conferido na PROPRIA
    // janela do retorno (a previa da principal agora e captura da janela, ou desenho com o video em miniatura quando a saida esta desligada).
    // A4: o item "saida atual" (current_output) SEM fonte propria cai em `settings.output`, que no modo e o PROPRIO retorno: antes desenhava o layout dele DENTRO
    // dele (recursao, com fundo opaco por cima da letra). Agora mostra o conteudo da saida (o que o modo mandou) e o texto do slide aparece.
    // So aqui a janela do retorno e ligada (e desligada no fim do bloco); o resto da fumaca segue sem janela.
    await j.ev(
        `S.stageShows.update(s=>{s.L_t10.settings.labels=true; s.L_t10.items={c:{type:"current_output",style:"left:0px;top:0px;width:1920px;height:1080px;"},t:{type:"slide_text",style:"left:0px;top:0px;width:1920px;height:540px;font-size:800px;",slideOffset:0},u:{type:"slide_text",style:"left:0px;top:560px;width:1200px;height:400px;font-size:800px;",slideOffset:1}}; return s}); await esp(500); const O=await import(U("components/helpers/output")); O.toggleOutputs(["ret_t10"],{state:true, force:true}); await esp(3500); return 1`
    )
    const ret = await janelaDoRetorno()
    ok("A4. a janela do retorno abriu e mostra o layout de palco", !!ret)
    const noRet = (expr) => (ret ? ret.avaliar(`return ${expr}`) : Promise.resolve(null))
    const vis = (id) => `[...document.querySelectorAll('[id="${id}"].stage_item')].find(e=>e.getBoundingClientRect().width>0)`
    ok("A4. o item 'saida atual' do retorno NAO contem outro layout de palco dentro dele (sem recursao)", (await noRet(`!!(${vis("c")}) && !(${vis("c")}).querySelector(".stageArea")`)) === true, String(await noRet(`(${vis("c")})?.innerHTML.slice(0,120)`)))
    const norm = (t) => String(t).split(/\s+/).join("").toLowerCase()
    const esperado = await dom(`(async()=>{const G=await import(U("components/edit/scripts/textStyle")); const sh=get(S.showsCache)["${SHOW}"]; const lay=sh.layouts[sh.settings.activeLayout]; const sl=sh.slides[lay.slides[0].id]; return sl.items.filter(i=>(i.type||"text")==="text").map(i=>G.getItemText(i)).join(" ")})()`)
    const naTela = (await noRet(`(${vis("t")})?.innerText||""`)) || ""
    ok("A4. o texto do slide aparece no item de texto do layout do retorno (e e o do slide que o modo mandou)", norm(esperado).length > 5 && norm(naTela).includes(norm(esperado).slice(0, 12)), JSON.stringify([esperado.slice(0, 40), naTela.slice(0, 60)]))
    if (ret) await ret.foto(join(saida, "t10-a4-janela-do-retorno.png")).catch(() => 0)
    await print("t10-a4-retorno-sem-recursao")
    // A5: o texto do slide escala como na saida real (o cache de autoajuste nao pode deixar 800 px). Muda o slide com clique real e confere na janela do retorno.
    const fonteDe = (id) => noRet(`(()=>{const e=${vis(id)}; const s=e?.querySelector(".lines .break span"); return s?Math.round(parseFloat(getComputedStyle(s).fontSize)):null})()`)
    {
        const w = await localizar(j, `document.querySelectorAll("#showArea .slide")[4]`)
        await clicarEm(j, w.x, w.y)
    }
    await esperar(1500)
    const f1 = await fonteDe("t"),
        f2 = await fonteDe("u")
    ok("A5. janela do retorno: o texto do slide escala como na saida real (nao fica em 800 px depois de mudar de slide)", f1 !== null && f1 > 10 && f1 < 400 && f2 !== null && f2 > 10 && f2 < 400, JSON.stringify([f1, f2]))
    await print("t10-a5-retorno")
    if (ret) ret.fechar()
    await j.ev(`const O=await import(U("components/helpers/output")); O.toggleOutputs(["ret_t10"],{state:false, force:true}); await esp(800); return 1`)
    await j.ev(`S.stageShows.update(s=>{s.L_t10.items={}; delete s.L_t10.settings.labels; return s}); await esp(400); return 1`)

    // ---------- B. cada caminho
    await caminho(
        "clique no slide (real)",
        async () => {
            const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[2]`)
            await clicarEm(j, a.x, a.y)
        },
        async () => (await idxRet()) === 1
    )
    await j.ev(`document.activeElement?.blur?.(); return 1`)
    await caminho(
        "seta direita (real)",
        () => tecla(j, "ArrowRight"),
        async () => (await idxRet()) === 2
    )
    await caminho(
        "Espaco (real)",
        () => tecla(j, " "),
        async () => (await idxRet()) === 3
    )
    await caminho(
        "PageUp (real)",
        () => tecla(j, "PageUp"),
        async () => (await idxRet()) === 2
    )
    await caminho(
        "avancar pela API/celular (OutputHelper.advanceOutputs)",
        () => j.ev(`const H=await import(U("components/helpers/OutputHelper")); H.OutputHelper.advanceOutputs("next"); return 1`),
        async () => (await idxRet()) === 3
    )
    await caminho(
        "Mandar pro ar do Editar (mandarSlideAoAr)",
        () => j.ev(`const E=await import(U("utils/aliancaEditarAcoes")); return E.mandarSlideAoAr("${SHOW}", 1, [])`),
        async () => (await idxRet()) === 1
    )
    await caminho(
        "Mandar pro ar com saida explicita 'default'",
        () => j.ev(`const E=await import(U("utils/aliancaEditarAcoes")); return E.mandarSlideAoAr("${SHOW}", 2, ["default"])`),
        async () => (await idxRet()) === 2
    )
    await caminho(
        "saida explicita (setOutput com id: MediaCard, linha do tempo, updateOut)",
        () => j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("slide",{id:"${SHOW}",layout:get(S.showsCache)["${SHOW}"].settings.activeLayout,index:5,line:0},false,"default"); return 1`),
        async () => (await idxRet()) === 5
    )
    // Ctrl+K: musica (Ctrl+Enter = roteiro + 1o slide) e versiculo (Enter)
    await j.ev(`S.activeDrawerTab.set("shows"); return 1`)
    await tecla(j, "k", { ctrl: true })
    await esperar(400)
    await j.ev(`document.querySelector('[data-acao=spotlight-campo]').select(); return 1`)
    await j.enviar("Input.insertText", { text: "Jo 3.16" })
    await esperar(1500)
    await caminho(
        "Ctrl+K: versiculo (Enter)",
        () => tecla(j, "Enter"),
        async (r0, r1) => r1 !== r0 && /temp/.test(r1),
        2500
    )
    await print("t10-b-biblia")
    ok("B. o versiculo nao disparou som/efeitos no telao (telao igual)", (await telao()) === tel0)
    // ---------- B'. D1: so letra. Tudo o que nao e slide de texto e recusado alto
    const VIDEO = PERFIL_DIR + "/midia/v1.mp4"
    await j.ev(`const V=await import(U("components/media/video/videoPlayer")); const AP=await import(U("audio/audioPlayer")); window.__vp=[]; window.__ap=[]
if(!V.VideoPlayer.__espiado){const o=V.VideoPlayer.start.bind(V.VideoPlayer); V.VideoPlayer.start=(...a)=>{window.__vp.push(JSON.stringify([a[0],a[1],a[2]])); return o(...a)}; V.VideoPlayer.__espiado=1}
if(!AP.AudioPlayer.__espiado){const o=AP.AudioPlayer.start.bind(AP.AudioPlayer); AP.AudioPlayer.start=(...a)=>{window.__ap.push(String(a[0])); return o(...a)}; AP.AudioPlayer.__espiado=1}
return 1`)
    const recusas = () => dom(`get((await import(U("utils/aliancaFalha"))).falhas).filter(f=>f.origem==="so-retorno-recusa").reduce((n,f)=>n+f.vezes,0)`)
    const limparFalhas = () => j.ev(`const F=await import(U("utils/aliancaFalha")); F.falhas.set([]); window.__vp=[]; window.__ap=[]; return 1`)
    /** `acao` e um GESTO de envio que o modo recusa: telao e retorno byte a byte iguais, nenhum tocador mexeu, e a recusa foi dita alto */
    async function recusado(nome, acao, espera = 800) {
        await limparFalhas()
        const t0 = await telao()
        const r0 = await retorno()
        await acao()
        await esperar(espera)
        ok(`D1. ${nome}: o telao NAO mudou`, (await telao()) === t0, t0)
        ok(`D1. ${nome}: o retorno NAO mudou`, (await retorno()) === r0, r0)
        ok(`D1. ${nome}: recusado ALTO (falha so-retorno-recusa)`, (await recusas()) >= 1, String(await recusas()))
        ok(`D1. ${nome}: nenhum tocador (video/audio) foi acionado`, (await dom(`window.__vp.length + window.__ap.length`)) === 0, await dom(`JSON.stringify([window.__vp, window.__ap])`))
    }
    await recusado("midia no fundo (API playMedia)", () => j.ev(`const A=await import(U("components/actions/apiHelper")); A.playMedia({path:${JSON.stringify(VIDEO)},data:{type:"video",loop:true,muted:false}}); return 1`))
    await recusado("sobreposicao (setOutput overlays)", () => j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("overlays","ov_t10",false,"",true); return 1`))
    await recusado("efeito (setOutput effects)", () => j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("effects","ef_t10",false,"",true); return 1`))
    await recusado("audio pela API (playAudio)", () => j.ev(`const A=await import(U("components/actions/apiHelper")); A.playAudio({path:${JSON.stringify(VIDEO)}}); return 1`))
    await recusado("PDF enviado direto (setOutput slide pdf)", () => j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("slide",{type:"pdf",id:"x.pdf",page:0,pages:2,name:"x"}); return 1`))
    await print("t10-b-recusa")

    // B3: Espaco/seta com o item ativo = o video que JA esta no telao nunca pausa/retoma o telao
    writeFileSync(PDF, PDF_MINIMO)
    await j.ev(`S.outputs.update(a=>{a.default.out={...(a.default.out||{}), background:{path:${JSON.stringify(VIDEO)},type:"video",loop:true,muted:true}}; a.ret_t10.out={...a.ret_t10.out, slide:null}; return a}); S.activeShow.set({id:${JSON.stringify(VIDEO)},type:"video"}); document.activeElement?.blur?.(); return 1`)
    await recusado("B3 Espaco sobre a midia que ja esta no telao", () => tecla(j, " "))
    await recusado("B3 seta direita sobre a midia que ja esta no telao", () => tecla(j, "ArrowRight"))
    // B1: PDF pelas setas nao limpa o fundo do telao (e o retorno nao muda)
    await j.ev(`S.activeShow.set({id:${JSON.stringify(PDF)},type:"pdf"}); document.activeElement?.blur?.(); return 1`)
    await recusado("B1 PDF pelas setas (seta direita)", () => tecla(j, "ArrowRight"), 1500)
    ok("B1. o fundo do telao SEGUE la (nao foi limpo)", !!JSON.parse(await telao()).background?.path, await telao())
    await recusado("B1 PDF pelo playPdf direto (temporizador de PDF)", () => j.ev(`const SA=await import(U("components/helpers/showActions")); await SA.playPdf({id:${JSON.stringify(PDF)},type:"pdf",page:0,pages:2}, true, false); return 1`), 1500)
    ok("B1. o fundo do telao SEGUE la depois do playPdf direto", !!JSON.parse(await telao()).background?.path, await telao())
    // devolve o cenario: retorno com slide, telao sem fundo
    await j.ev(`S.outputs.update(a=>{a.default.out={...(a.default.out||{}), background:null}; return a}); S.activeShow.set({id:"${SHOW}",type:"show"}); await esp(300); return 1`)
    await j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("slide",{id:"${SHOW}",layout:get(S.showsCache)["${SHOW}"].settings.activeLayout,index:1,line:0}); return 1`)
    await esperar(500)

    // ---------- I. automacao do TELAO: o modo so desvia gestos do operador
    const layoutId = await dom(`get(S.showsCache)["${SHOW}"].settings.activeLayout`)
    const poeTelao = (i) => j.ev(`S.outputs.update(a=>{a.default.out={...(a.default.out||{}), slide:{id:"${SHOW}",layout:${JSON.stringify(layoutId)},index:${i},line:0}}; return a}); return 1`)
    const retAntes = await retorno()
    // I1 a) temporizador de slide (newSlideTimer) que nasceu antes do modo e dispara com ele ligado
    await poeTelao(1)
    await j.ev(`const TK=await import(U("components/helpers/tick")); TK.newSlideTimer("default", 1); return 1`)
    await esperar(2600)
    ok("I1. temporizador de slide: o TELAO avancou (1 -> 2)", (await idxTel()) === 2, String(await idxTel()))
    ok("I1. temporizador de slide: o retorno NAO se mexeu", (await retorno()) === retAntes, `${retAntes} -> ${await retorno()}`)
    // I1 b) avancar ao fim da midia
    await poeTelao(1)
    await j.ev(`const sh=get(S.showsCache)["${SHOW}"]; const lay=sh.layouts[${JSON.stringify(layoutId)}]; window.__lay=JSON.stringify(lay.slides[1]); lay.slides[1].actions={...(lay.slides[1].actions||{}),nextAfterMedia:true}; lay.slides[1].background="mid_t10"; return 1`)
    await j.ev(`const SA=await import(U("components/helpers/showActions")); await SA.checkNextAfterMedia("mid_t10","media",["default"]); return 1`)
    await esperar(1200)
    ok("I1. avancar ao fim da midia: o TELAO avancou (1 -> 2)", (await idxTel()) === 2, String(await idxTel()))
    ok("I1. avancar ao fim da midia: o retorno NAO se mexeu", (await retorno()) === retAntes, `${retAntes} -> ${await retorno()}`)
    await j.ev(`const sh=get(S.showsCache)["${SHOW}"]; sh.layouts[${JSON.stringify(layoutId)}].slides[1]=JSON.parse(window.__lay); return 1`)
    // I1 c) linha do tempo do telao
    await poeTelao(0)
    await j.ev(`const TL=await import(U("components/timeline/ShowTimeline")); const ref=(await import(U("components/helpers/shows"))); const r=ref._show("${SHOW}").layouts([${JSON.stringify(layoutId)}]).ref()[0]; TL.ShowTimeline.playSlide({id:r[3].id,index:3,line:0},{id:"${SHOW}",layoutId:${JSON.stringify(layoutId)}}); return 1`)
    await esperar(1000)
    ok("I1. linha do tempo: o TELAO foi para o slide 3", (await idxTel()) === 3, String(await idxTel()))
    ok("I1. linha do tempo: o retorno NAO se mexeu", (await retorno()) === retAntes, `${retAntes} -> ${await retorno()}`)
    // I2) sobreposicao com duracao no telao: ao expirar SAI do telao e nao vai ao retorno
    await limparFalhas()
    await j.ev(`S.overlays.update(o=>({...o, ov_dur_t10:{name:"dur",displayDuration:1,items:[]}})); const R=await import(U("utils/aliancaSoRetorno")); const O=await import(U("components/helpers/output")); R.semDesvio(()=>O.setOutput("overlays","ov_dur_t10",false,"default",true)); return 1`)
    ok("I2. a sobreposicao com duracao esta no telao", (JSON.parse(await telao()).overlays || []).includes("ov_dur_t10"), await telao())
    await esperar(2200)
    ok("I2. expirou: SAIU do telao", !(JSON.parse(await telao()).overlays || []).includes("ov_dur_t10"), await telao())
    ok("I2. expirou: NAO foi adicionada ao retorno", (await retorno()) === retAntes, await retorno())
    ok("I2. a expiracao nao foi tratada como envio recusado", (await recusas()) === 0, String(await recusas()))
    await j.ev(`S.overlays.update(o=>{delete o.ov_dur_t10; return o}); return 1`)

    // C. ajuste e limpeza parcial continuam no telao
    await j.ev(`S.outputs.update(a=>{a.default.out={...(a.default.out||{}), background:{path:${JSON.stringify(VIDEO)},type:"video",loop:true,muted:true}, overlays:["lock_t10","ov2_t10"]}; return a}); return 1`)
    await j.ev(`const A=await import(U("components/actions/apiHelper")); A.toggleMediaMute(); return 1`)
    await esperar(500)
    ok("C. o ajuste (mudo) falou com o telao, como sempre", (await dom(`get(S.outputs).default.out.background?.muted`)) === false, String(await dom(`get(S.outputs).default.out.background?.muted`)))
    await j.ev(`const C=await import(U("components/output/clear")); C.clearOverlay("ov2_t10"); return 1`)
    await esperar(400)
    ok("C. clearOverlay tira do telao e NAO manda a lista restante para o retorno", (await dom(`JSON.stringify(get(S.outputs).default.out.overlays)`)) === '["lock_t10"]' && !(JSON.parse(await retorno()).overlays || []).includes("lock_t10"))
    // D. Esc
    await j.ev(`S.outputs.update(a=>{a.default.out={...(a.default.out||{}), slide:{id:"${SHOW}",layout:get(S.showsCache)["${SHOW}"].settings.activeLayout,index:1}}; return a}); document.activeElement?.blur?.(); return 1`)
    const rAntesEsc = await retorno()
    await tecla(j, "Escape")
    await esperar(700)
    ok("D. Esc real limpa o telao normal", (await idxTel()) === null && !JSON.parse(await telao()).background, await telao())
    ok("D. ...e nao apaga o retorno", (await retorno()) === rAntesEsc)
    await print("t10-d-esc")

    // ---------- E. desligar
    const telAntesDesligar = await telao()
    await clicarAcao("desligar-so-retorno")
    await esperar(600)
    ok("E. o out INTEIRO do retorno esvaziou", (await retorno()) === '{"slide":null,"background":null,"overlays":[],"effects":[],"transition":null}', await retorno())
    ok("E. a fonte do layout voltou", (await fonte()) === null)
    ok("E. o telao nao foi tocado ao desligar", (await telao()) === telAntesDesligar)
    {
        const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[3]`)
        await clicarEm(j, a.x, a.y)
    }
    await esperar(700)
    ok("E. desligado, o clique volta ao normal: vai ao telao e o retorno nao muda", (await idxTel()) !== null && (await slideRet()) === null, `${await idxTel()} ${await slideRet()}`)

    // I1 (volta): desligado, a automacao do telao segue normal (nada ficou congelado)
    await poeTelao(1)
    await j.ev(`const TK=await import(U("components/helpers/tick")); TK.newSlideTimer("default", 1); return 1`)
    await esperar(2600)
    ok("E. desligado, o temporizador do telao continua andando (1 -> 2)", (await idxTel()) === 2 && (await slideRet()) === null, `${await idxTel()} ${await slideRet()}`)

    // ---------- F. retorno some com o modo ligado
    await clicarAcao("modo-so-retorno")
    await esperar(500)
    const telF = await telao()
    await j.ev(`S.outputs.update(a=>{a.ret_t10.enabled=false; return a}); await esp(500); return 1`)
    ok("F. o modo desligou sozinho", (await dom(`${sel("modo-so-retorno")}.getAttribute("aria-pressed")`)) === "false")
    ok("F. a fonte do layout voltou", (await fonte()) === null)
    ok("F. a falha alta avisou", await j.ev(`const F=await import(U("utils/aliancaFalha")); return get(F.falhas).some(f=>f.origem==="so-retorno")`))
    ok("F. nada foi para o telao", (await telao()) === telF)
    await j.ev(`const F=await import(U("utils/aliancaFalha")); F.falhas.set([]); S.outputs.update(a=>{a.ret_t10.enabled=true; return a}); return 1`)

    // ---------- G. queda: sessao nova com a marca, em Editar
    await clicarAcao("modo-so-retorno")
    await esperar(400)
    ok("G0. ligado de novo, fonte apontada", (await fonte()) === "ret_t10")
    await j.ev(`T.trocarTela("edit","segmentado"); await esp(500); const R=await import(U("utils/aliancaSoRetorno")); R.soRetorno.set(false); S.stageShows.update(x=>({...x})); await esp(400); return 1`)
    ok("G. a recuperacao devolveu a fonte (so a queda deixava a marca; nao depende da coluna No ar)", (await fonte()) === null, String(await fonte()))
    await j.ev(`T.trocarTela("show","segmentado"); await esp(400); S.outputs.update(a=>{delete a.ret_t10; return a}); S.stageShows.update(s=>{const n={...s}; delete n.L_t10; return n}); Object.values(get(S.outputs)).forEach(()=>0); return 1`)
} catch (e) {
    console.log("FALHA excecao", e.message)
    falhas.push("excecao")
}
await j.fechar?.()
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\ntudo ok")
process.exit(falhas.length ? 1 : 0)
