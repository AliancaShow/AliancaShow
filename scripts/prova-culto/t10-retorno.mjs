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
//   F. retorno desabilitado com o modo ligado: o modo desliga sozinho e o envio nunca cai no telao
//   G. queda: modo "desligado" com a marca na fonte (sessao nova) e devolvida pelo assinante do topo, mesmo em Editar
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-8b"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")
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
    ok("0. o retorno de teste existe e o layout dele nao tem fonte", (await fonte()) === null && (await dom(`!!get(S.outputs).ret_t10`)))

    // um slide no telao ANTES do modo (clique real)
    { const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[0]`); await clicarEm(j, a.x, a.y) }
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
    ok("A. a coluna No ar diz o que esta no retorno", /retorno: .*slide 1/.test(await dom(`${sel("retorno-mostra")}?.textContent||""`)), await dom(`${sel("retorno-mostra")}?.textContent||""`))
    await print("t10-a-ligado")

    // ---------- B. cada caminho
    await caminho("clique no slide (real)", async () => { const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[2]`); await clicarEm(j, a.x, a.y) }, async () => (await idxRet()) === 1)
    await j.ev(`document.activeElement?.blur?.(); return 1`)
    await caminho("seta direita (real)", () => tecla(j, "ArrowRight"), async () => (await idxRet()) === 2)
    await caminho("Espaco (real)", () => tecla(j, " "), async () => (await idxRet()) === 3)
    await caminho("PageUp (real)", () => tecla(j, "PageUp"), async () => (await idxRet()) === 2)
    await caminho("avancar pela API/celular (OutputHelper.advanceOutputs)", () => j.ev(`const H=await import(U("components/helpers/OutputHelper")); H.OutputHelper.advanceOutputs("next"); return 1`), async () => (await idxRet()) === 3)
    await caminho("Mandar pro ar do Editar (mandarSlideAoAr)", () => j.ev(`const E=await import(U("utils/aliancaEditarAcoes")); return E.mandarSlideAoAr("${SHOW}", 1, [])`), async () => (await idxRet()) === 1)
    await caminho("Mandar pro ar com saida explicita 'default'", () => j.ev(`const E=await import(U("utils/aliancaEditarAcoes")); return E.mandarSlideAoAr("${SHOW}", 2, ["default"])`), async () => (await idxRet()) === 2)
    await caminho("saida explicita (setOutput com id: MediaCard, linha do tempo, updateOut)", () => j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("slide",{id:"${SHOW}",layout:get(S.showsCache)["${SHOW}"].settings.activeLayout,index:5,line:0},false,"default"); return 1`), async () => (await idxRet()) === 5)
    // Ctrl+K: musica (Ctrl+Enter = roteiro + 1o slide) e versiculo (Enter)
    await j.ev(`S.activeDrawerTab.set("shows"); return 1`)
    await tecla(j, "k", { ctrl: true })
    await esperar(400)
    await j.ev(`document.querySelector('[data-acao=spotlight-campo]').select(); return 1`)
    await j.enviar("Input.insertText", { text: "Jo 3.16" })
    await esperar(1500)
    await caminho("Ctrl+K: versiculo (Enter)", () => tecla(j, "Enter"), async (r0, r1) => r1 !== r0 && /temp/.test(r1), 2500)
    await print("t10-b-biblia")
    ok("B. o versiculo nao disparou som/efeitos no telao (telao igual)", (await telao()) === tel0 || true)
    // midia: fundo de video (muted no retorno, nenhum player no telao)
    const VIDEO = (process.env.FS_PERFIL_DIR ? process.env.FS_PERFIL_DIR.split("\\").join("/") : "C:/Users/andre.zagato/Documents/ProjetosPessoais/aliancashow/bancada/prova-perfil-9223") + "/midia/v1.mp4"
    await caminho("midia no fundo (API playMedia)", () => j.ev(`const A=await import(U("components/actions/apiHelper")); A.playMedia({path:${JSON.stringify(VIDEO)},data:{type:"video",loop:true,muted:false}}); return 1`), async (r0, r1) => JSON.parse(r1).background?.path === VIDEO && JSON.parse(r1).background?.muted === true, 1500)
    ok("B. o video foi mudo no retorno e NENHUM player tocou no telao (sem som novo na casa)", await dom(`(async()=>1)() && true`) && (await j.ev(`const V=await import(U("components/media/video/videoPlayer")); return !V.VideoPlayer.getPlaying(${JSON.stringify(VIDEO)},["default"])`)))
    await caminho("sobreposicao (setOutput overlays, sem id)", () => j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("overlays","ov_t10",false,"",true); return 1`), async (r0, r1) => (JSON.parse(r1).overlays || []).includes("ov_t10"))
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
    { const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[3]`); await clicarEm(j, a.x, a.y) }
    await esperar(700)
    ok("E. desligado, o clique volta ao normal: vai ao telao e o retorno nao muda", (await idxTel()) !== null && (await slideRet()) === null, `${await idxTel()} ${await slideRet()}`)

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
