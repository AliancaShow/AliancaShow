// Rodada da cabine, 18/nov (A1, A6, A7, A8, A9, A10): fumaca com cliques e teclas REAIS (nunca force) contra o Show de dev (CDP, FS_CDP_PORTA).
//   node scripts/prova-culto/t11-cabine1a.mjs <pasta-de-prints>
//   A1  saida de rede (NDI, `invisible`) habilitada vira aba na coluna No ar
//   A6  Ctrl+K: sem Biblia diz "Nenhuma Bíblia instalada" (referencia e so o nome do livro); aba velha cai na primeira Biblia; "João" so avisa que falta o capitulo
//   A7  o video do centro (previa de um item de video) NUNCA toca: nem sozinho, nem com a saida tocando, nem depois de parada
//   A8  o seletor de dia lista os proximos cultos do Sirvo sem projeto (a lista de Configuracoes > Sirvo)
//   A9  voltar de Configuracoes para Editar com um bloco aberto no centro: sem "editar-tipo-desconhecido" (varias vezes)
//   A10 a faixa de cima (roteiro/centro) nunca colapsa, nem com a biblioteca pedindo mais altura do que cabe
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const saida = process.argv[2] || "prints-c1a"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
const dom = (expr) => j.ev(`return ${expr}`)
async function print(nome) {
    await esperar(600)
    // o print e so evidencia: com um <video> na tela o CDP as vezes nao devolve a captura (30 s); isso nao reprova a prova
    try {
        const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
        writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
        console.log("print", nome)
    } catch (e) {
        console.log("print", nome, "(sem captura: " + String(e && e.message).slice(0, 60) + ")")
    }
}
const PERFIL = process.env.FS_PERFIL_DIR ? process.env.FS_PERFIL_DIR.split("\\").join("/") : "C:/Users/andre.zagato/Documents/ProjetosPessoais/aliancashow/bancada/prova-perfil-9223"
const VIDEO = `${PERFIL}/midia/v1.mp4`
const falhasAcesas = () => dom(`(async()=>{const FA=await import(U("utils/aliancaFalha")); return JSON.stringify(get(FA.falhas).map(f=>f.origem))})()`)
const limparFalhas = () => j.ev(`const FA=await import(U("utils/aliancaFalha")); FA.falhas.set([]); return 1`)

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); S.outLocked.set(false); S.activeProject.set("f3"); T.trocarTela("show","segmentado"); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); await esp(800); return 1`)
    await limparFalhas()

    // ---------- A1: saida de rede vira aba
    const abas = () => dom(`[...document.querySelectorAll('[data-acao=outras-telas] [role=tab]')].map(t=>t.innerText.trim())`)
    const antes = await abas()
    await j.ev(`S.outputs.update(a=>{a.ndi_c1a={name:"NDI cabine",enabled:true,invisible:true,active:true,out:{},style:Object.keys(get(S.styles))[0]||""}; return a}); await esp(900); return 1`)
    const depois = await abas()
    ok("A1 a saida NDI habilitada (invisible) vira aba abaixo do No ar", depois.includes("NDI cabine") && depois.length === antes.length + 1, JSON.stringify({ antes, depois }))
    await print("a1-aba-ndi")
    await j.ev(`S.outputs.update(a=>{a.ndi_c1a.enabled=false; return a}); await esp(600); return 1`)
    ok("A1b desabilitada, a aba some", !(await abas()).includes("NDI cabine"))
    await j.ev(`S.outputs.update(a=>{delete a.ndi_c1a; return a}); await esp(300); return 1`)

    // ---------- A6: Ctrl+K sem Biblia, aba velha, so o livro
    const guardada = await dom(`JSON.stringify({s:get(S.scriptures), d:get(S.drawerTabsData).scripture})`)
    async function buscar(q) {
        await j.ev(`S.activePopup.set(null); S.quickSearchActive.set(false); return 1`)
        await esperar(300)
        await tecla(j, "k", { ctrl: true })
        await esperar(400)
        await j.ev(`document.querySelector('[data-acao=spotlight-campo]').select(); return 1`)
        await j.enviar("Input.insertText", { text: q })
        await esperar(1500)
        const r = await dom(`JSON.stringify([...document.querySelectorAll('[data-acao=spotlight] .linha')].map(l=>({t:l.dataset.tipo, aviso:l.classList.contains('aviso'), x:l.innerText.split(String.fromCharCode(10)).join(' | ')})))`)
        return JSON.parse(r)
    }
    await j.ev(`S.scriptures.set({}); S.drawerTabsData.update(a=>{a.scripture={activeSubTab:"",enabled:true};return a}); return 1`)
    let r = await buscar("Jo 3:16")
    ok("A6a sem Biblia, \"Jo 3:16\" diz ALTO \"Nenhuma Bíblia instalada\" (linha de aviso)", r.length === 1 && r[0].aviso && /Nenhuma Bíblia instalada/.test(r[0].x), JSON.stringify(r))
    await print("a6-sem-biblia")
    r = await buscar("João")
    ok("A6b sem Biblia, so o nome do livro (\"João\") tambem diz que nao ha Biblia, nao fica calada", r.some((l) => l.t === "versiculo" && /Nenhuma Bíblia instalada/.test(l.x)), JSON.stringify(r))
    await j.ev(`S.quickSearchActive.set(false); return 1`)
    // volta a Biblia do perfil, com a aba da pasta Biblia VELHA (uma Biblia que nao existe mais)
    await j.ev(`const g=${guardada}; S.scriptures.set(g.s); S.drawerTabsData.update(a=>{a.scripture={...(g.d||{}),activeSubTab:"biblia_que_saiu",enabled:true};return a}); return 1`)
    r = await buscar("Jo 3:16")
    ok("A6c aba da Biblia velha: cai na primeira instalada e LISTA o versiculo (antes dizia \"Nenhuma Bíblia\" havendo uma)", r.length === 1 && !r[0].aviso && /Porque Deus tanto amou/.test(r[0].x), JSON.stringify(r))
    r = await buscar("João")
    ok("A6d com Biblia, so \"João\": avisa que falta o capitulo e o versiculo (nao fica calada)", r.some((l) => l.t === "versiculo" && l.aviso && /Falta o capítulo/.test(l.x)), JSON.stringify(r))
    await j.ev(`S.quickSearchActive.set(false); S.drawerTabsData.update(a=>{a.scripture=${JSON.stringify(JSON.parse(guardada).d || { enabled: true })};return a}); return 1`)
    await esperar(300)

    // ---------- A7: o video do centro nunca toca
    await j.ev(`S.activeProject.set("f3"); S.activeShow.set({id:${JSON.stringify(VIDEO)},index:0,type:"video"}); T.trocarTela("show","segmentado"); await esp(2500); return 1`)
    const central = () => dom(`(()=>{const v=document.querySelector('#showArea video'); return v? {paused:v.paused, t:Math.round(v.currentTime*100)/100, d:Math.round((v.duration||0)*10)/10, ready:v.readyState} : null})()`)
    const c0 = await central()
    ok("A7a a previa do centro e um video PARADO (quadro parado), sem iniciar sozinho", !!c0 && c0.paused && c0.ready >= 1, JSON.stringify(c0))
    await esperar(1500)
    const c1 = await central()
    ok("A7b continua parado e no mesmo quadro depois de 1,5 s", !!c1 && c1.paused && c1.t === c0.t, JSON.stringify({ c0, c1 }))
    await print("a7-central-parado")
    // a saida toca o video: o centro nao acompanha nem toca
    await j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("background",{path:${JSON.stringify(VIDEO)},type:"video",name:"v1.mp4",loop:true,muted:true}); await esp(2500); return 1`)
    const tocando = await dom(`JSON.stringify(Object.values(get(S.playingVideoState)).map(v=>({p:v.paused,t:Math.round((v.currentTime||0)*10)/10})))`)
    const c2 = await central()
    await esperar(1500)
    const c3 = await central()
    ok("A7c com a SAIDA tocando o video, o do centro segue parado e no mesmo quadro", !!c2 && c2.paused && !!c3 && c3.paused && c3.t === c2.t, JSON.stringify({ tocando, c2, c3 }))
    // pausa a saida (o caso do teste do André: "parado no ar"): o do centro continua parado
    await j.ev(`const S2=await import(U("components/helpers/output")); const V=get(S.playingVideoState); const k=Object.keys(V)[0]; const P=await import(U("components/media/video/videoPlayer")); void P; S.playingVideoState.update(a=>{if(k) a[k]={...a[k],paused:true}; return a}); await esp(1500); return 1`)
    const c4 = await central()
    ok("A7d com a saida pausada, o centro continua parado", !!c4 && c4.paused && c4.t === c2.t, JSON.stringify(c4))
    await j.ev(`const C=await import(U("components/output/clear")); C.clearAll(true); await esp(1200); return 1`)
    const c5 = await central()
    ok("A7e depois de limpar a saida, o centro continua parado", !!c5 && c5.paused, JSON.stringify(c5))
    ok("A7f nao ha botao de tocar/pausar/mudo da previa no menu do centro", await dom(`!document.querySelector('#showArea ~ * [data-sem-trava] [title*="media.play"], #showArea ~ * [data-sem-trava] [title*="media.pause"]')`))

    // ---------- A8: o seletor lista os cultos do Sirvo
    await j.ev(`S.activeShow.set(null); S.activeProject.set("f3"); T.trocarTela("show","segmentado"); await esp(600); return 1`)
    await j.ev(`const A=await import(U("utils/aliancaSirvo")); const f=(n)=>new Date(Date.now()+n*86400000).toISOString(); A.sirvo.update(s=>({...s,status:"conectado",roteiroNoAr:false,cultos:[1,2,3].map((k)=>({event_id:"c1a_"+k,titulo:"Culto de Domingo",comeca_em:f(3+7*k),no_ar:false,encerrado:false,rev:1}))})); await esp(500); return 1`)
    const bt = await localizar(j, `document.querySelector('[data-acao=seletor-culto] .bt.dia')`)
    await clicarEm(j, bt.x, bt.y)
    await esperar(900)
    const ops = JSON.parse(await dom(`JSON.stringify([...document.querySelectorAll('.seletor-pop .op.cartao')].map(o=>o.dataset.opcao))`))
    const doSirvo = ops.filter((o) => o.startsWith("sirvo:"))
    ok("A8 o seletor lista os 3 proximos cultos do Sirvo (a mesma lista de Configuracoes > Sirvo) alem dos projetos", doSirvo.length === 3 && ops.length > 3, JSON.stringify(ops))
    await print("a8-seletor")
    // com o culto seguido no ar, escolher um culto do Sirvo recusa (nao troca o culto seguido no meio do culto)
    await j.ev(`const A=await import(U("utils/aliancaSirvo")); A.sirvo.update(s=>({...s,roteiroNoAr:true})); return 1`)
    const op = await localizar(j, `document.querySelector('.seletor-pop [data-opcao="sirvo:c1a_1"]')`)
    await clicarEm(j, op.x, op.y)
    await esperar(900)
    ok("A8b com culto no ar, escolher um culto do Sirvo nao troca o culto seguido", (await dom(`get((await import(U("utils/aliancaSirvo"))).sirvo).escolhaManual`)) === null)
    await j.ev(`const A=await import(U("utils/aliancaSirvo")); A.sirvo.update(s=>({...s,roteiroNoAr:false,cultos:[]})); S.contextActive.set(false); return 1`)
    await tecla(j, "Escape")
    await esperar(900)

    // ---------- A9: voltar de Configuracoes para Editar com um bloco aberto no centro
    await limparFalhas()
    await j.ev(`S.activeProject.set("f3"); S.activeShow.set({id:"bloco_c1a",index:0,type:"section"}); T.trocarTela("edit","segmentado"); await esp(900); return 1`)
    for (let i = 0; i < 3; i++) {
        await j.ev(`T.trocarTela("settings","menu-app"); await esp(800); return 1`)
        const f = await localizar(j, `document.querySelector('[data-acao=pagina-fechar]')`)
        await clicarEm(j, f.x, f.y)
        await esperar(900)
    }
    ok("A9 voltar de Configuracoes para Editar 3x com um bloco aberto: nenhuma falha acesa", (await falhasAcesas()) === "[]", await falhasAcesas())
    ok("A9b o editor nao adotou o tipo do bloco (activeEdit.type nao e section)", (await dom(`get(S.activeEdit)?.type`)) !== "section", String(await dom(`get(S.activeEdit)?.type`)))
    await print("a9-editar")

    // ---------- A10: a faixa de cima nunca colapsa
    await j.ev(`S.activeShow.set(null); T.trocarTela("show","segmentado"); await esp(800); return 1`)
    await j.ev(`const b=document.querySelector('[data-regiao=biblioteca]'); b.style.height='1200px'; await esp(600); return 1`)
    const alt = await dom(`(()=>{const r=(q)=>Math.round(document.querySelector(q).getBoundingClientRect().height); return {rot:r('[data-regiao=roteiro]'), cen:r('[data-regiao=centro]'), bib:r('[data-regiao=biblioteca]')}})()`)
    ok("A10 com a biblioteca pedindo mais altura do que cabe, a faixa de roteiro/centro fica com 240 px ou mais", alt.rot >= 240 && alt.cen >= 240, JSON.stringify(alt))
    await print("a10-faixa")
    await j.ev(`document.querySelector('[data-regiao=biblioteca]').style.height=''; await esp(300); return 1`)
} catch (e) {
    ok("a fumaca nao quebrou", false, String(e && e.message))
}
await j.ev(`S.quickSearchActive.set(false); S.contextActive.set(false); return 1`).catch(() => {})
j.fechar()
console.log(falhas.length ? `\nFALHAS: ${falhas.length}\n - ${falhas.join("\n - ")}` : "\nTUDO OK")
process.exit(falhas.length ? 1 : 0)
