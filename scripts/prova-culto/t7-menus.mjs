// Fatia 6 (botao direito da biblioteca e do roteiro; clique simples nao vai ao ar): fumaca com cliques e teclas REAIS (nunca force) contra o Show de dev
// (CDP, FS_CDP_PORTA) e prints 1920x1080.
//   node scripts/prova-culto/t7-menus.mjs <pasta-de-prints>
//   A. clique simples em Mostrar so seleciona: show, midia, efeito/sobreposicao, versiculo -> zero escritas em outputs, nada no ar
//   B. duplo clique nao dispara 2x: na biblioteca e no roteiro (zero escritas, o roteiro nao muda)
//   C. botao direito numa linha de show: Editar / ＋ roteiro / Mostrar agora, sem "Busca rapida"; Mostrar agora vai ao ar SEM pôr no roteiro; repetido < 400 ms conta 1x
//   D. botao direito numa midia e num efeito: Mostrar agora poe no ar, o roteiro nao muda; saida travada recusa
//   E. botao direito num item do roteiro: Editar, Mostrar agora, Mover, Tirar do roteiro
//   F. botao direito num bloco: Editar titulo (cursor no titulo), Mover, Novo bloco, Tirar
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-6"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")
const dom = (expr) => j.ev(`return ${expr}`)
async function print(nome) {
    await esperar(600)
    const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
    writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
    console.log("print", nome)
}
async function direito(x, y) {
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "right", clickCount: 1 })
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "right", clickCount: 1 })
    await esperar(400)
}
const menu = () => dom(`(()=>{const m=document.querySelector('.contextMenu'); return m? m.innerText.split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean):null})()`)
async function itemDoMenu(texto) {
    const a = await localizar(j, `[...document.querySelectorAll('.contextMenu > div')].find(d=>d.innerText.includes(${JSON.stringify(texto)}))`)
    if (!a.ok) throw new Error("item do menu nao achado: " + texto + " :: " + a.motivo)
    return a
}
async function clicarItem(texto) {
    const a = await itemDoMenu(texto)
    await clicarEm(j, a.x, a.y)
    await esperar(500)
}
async function fecharMenu() {
    await j.ev(`S.contextActive.set(false); return 1`)
    await esperar(200)
}
const escritas = () => dom(`window.__n`)
const mudancas = () => dom(`window.__m`)
const noAr = () => dom(`(()=>{const o=get(S.outputs); return Object.values(o).map(x=>({s:x.out?.slide?.id||null,b:x.out?.background?.path||x.out?.background?.id||null,e:(x.out?.effects||[]).length||0,ov:(x.out?.overlays||[]).length||0}))})()`)
const algoNoAr = async () => (await noAr()).some((x) => x.s || x.b || x.e || x.ov)
const limpar = () =>
    j.ev(`S.contextActive.set(false); S.outLocked.set(false); S.activePopup.set(null); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); S.outputCache.set(null); await esp(300); window.__n=0; window.__m=0; return 1`)
const projeto = () => dom(`get(S.projects)[get(S.activeProject)].shows.map(s=>(s.type||"show")+":"+s.id+":"+(s.name||"")).join("|")`)
const tamanho = () => dom(`get(S.projects)[get(S.activeProject)].shows.length`)
async function noDaArvore(nome) {
    await j.ev(`let e=document.querySelector('[data-acao=arvore]'); while(e){ if(e.scrollTop) e.scrollTop=0; e=e.parentElement } await esp(200); return 1`)
    const a = await localizar(j, `[...document.querySelectorAll('[data-acao=arvore] button')].find(b=>b.innerText.split(String.fromCharCode(10)).join(' ').includes(${JSON.stringify(nome)}))`)
    if (!a.ok) throw new Error("no da arvore nao achado: " + nome)
    await clicarEm(j, a.x, a.y)
    await esperar(900)
}

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.contextActive.set(false); S.outLocked.set(false); T.trocarTela("show","segmentado"); S.activeProject.set("f3");
const {loadShows}=await import(U("components/helpers/setShow")); const p=get(S.projects).f3.shows.find(s=>(s.type===undefined||s.type==="show")); await loadShows([p.id]);
S.activeShow.set({id:p.id,index:0,type:"show"}); S.activeDrawerTab.set("shows"); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); S.outputCache.set(null)
window.__n=0; window.__m=0; window.__sig=''; S.outputs.subscribe((o)=>{window.__n++; const g=JSON.stringify(Object.values(o).map(x=>x.out||{})); if(g!==window.__sig){window.__sig=g; window.__m++}}); await esp(1200); window.__n=0; window.__m=0; return 1`)
    const tam0 = await tamanho()
    await print("00-inicio")

    // ---------- A: clique simples so seleciona
    { const a = await localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[3]`)
      const id = await dom(`document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[3].dataset.show`)
      await clicarEm(j, a.x, a.y); await esperar(700)
      ok("A1 clique numa linha de show: abre no centro (previa) e zero escritas em outputs", (await dom(`get(S.activeShow)?.id`)) === id && (await escritas()) === 0, `n=${await escritas()}`)
      ok("A1b nada foi ao ar", !(await algoNoAr())) }
    await noDaArvore("Mídia")
    { const a = await localizar(j, `document.querySelector('[data-regiao=biblioteca] [class*="#media_card"]')`)
      await clicarEm(j, a.x, a.y); await esperar(900)
      ok("A2 clique num cartao de midia: zero escritas em outputs e nada no ar", (await escritas()) === 0 && !(await algoNoAr()), `n=${await escritas()}`) }
    await noDaArvore("Sobreposições")
    { const a = await localizar(j, `document.querySelector('[data-regiao=biblioteca] [class*="#effect_card"]')`)
      await clicarEm(j, a.x, a.y); await esperar(900)
      ok("A3 clique num efeito: zero escritas em outputs e nada no ar", (await escritas()) === 0 && !(await algoNoAr()), `n=${await escritas()}`) }
    await noDaArvore("Bíblia")
    { const v = await localizar(j, `document.querySelector('[data-regiao=biblioteca] .verse')`)
      if (v.ok) { await clicarEm(j, v.x, v.y); await esperar(900) }
      ok("A4 clique num versiculo: zero escritas em outputs e nada no ar", v.ok && (await escritas()) === 0 && !(await algoNoAr()), `n=${await escritas()}`) }

    // ---------- B: duplo clique
    await noDaArvore("Mídia")
    { const a = await localizar(j, `document.querySelector('[data-regiao=biblioteca] [class*="#media_card"]')`)
      await clicarEm(j, a.x, a.y, 1); await clicarEm(j, a.x, a.y, 2); await esperar(900)
      ok("B1 duplo clique num cartao de midia: zero escritas e o roteiro nao ganhou item", (await escritas()) === 0 && (await tamanho()) === tam0, `n=${await escritas()} tam=${await tamanho()}`) }
    await noDaArvore("Shows")
    { const a = await localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[4]`)
      await clicarEm(j, a.x, a.y, 1); await clicarEm(j, a.x, a.y, 2); await esperar(900)
      ok("B2 duplo clique numa linha de show: zero escritas e o roteiro nao mudou", (await escritas()) === 0 && (await tamanho()) === tam0, `n=${await escritas()}`) }
    { const a = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[1]`)
      await clicarEm(j, a.x, a.y, 1); await clicarEm(j, a.x, a.y, 2); await esperar(900)
      ok("B3 duplo clique num item do roteiro: zero escritas e o roteiro nao mudou", (await escritas()) === 0 && (await tamanho()) === tam0, `n=${await escritas()}`) }

    // ---------- C: botao direito numa linha de show
    await limpar()
    const idLinha = await dom(`document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[5].dataset.show`)
    { const a = await localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[5]`)
      await direito(a.x, a.y)
      const m = await menu()
      ok("C1 o menu da linha de show tem Editar, ＋ roteiro e Mostrar agora, e o titulo", !!m && m.includes("Editar") && m.some((t) => t.includes("Adicionar ao roteiro")) && m.some((t) => t.startsWith("Mostrar agora (sem pôr no roteiro)")), JSON.stringify(m))
      ok("C2 sem o item antigo \"Busca rápida\" do FreeShow", !!m && !m.some((t) => /busca/i.test(t)))
      await print("01-menu-show")
      await clicarItem("Mostrar agora")
      const n1 = await escritas()
      const ar = await noAr()
      ok("C3 Mostrar agora: o show foi ao ar", ar.some((x) => x.s === idLinha), JSON.stringify(ar))
      ok("C4 e o roteiro nao mudou", (await tamanho()) === tam0)
      ok("C5 uma ida ao ar: o que esta no ar mudou uma vez", (await mudancas()) === 1, `n=${n1} mudancas=${await mudancas()}`)
      // duplo clique no item do menu: o primeiro fecha o menu e vai ao ar; o segundo cai na linha de baixo (so seleciona) e o telao recebe UMA ida
      await limpar()
      await direito(a.x, a.y)
      { const it = await itemDoMenu("Mostrar agora")
        await clicarEm(j, it.x, it.y, 1)
        await clicarEm(j, it.x, it.y, 2)
        await esperar(700) }
      ok("C6 duplo clique em Mostrar agora: uma ida ao ar so", (await mudancas()) === 1 && !(await dom(`!!document.querySelector('.contextMenu')`)), `mudancas=${await mudancas()} n=${await escritas()}`)
    }
    await limpar()
    { const a = await localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[6]`)
      const idx = await dom(`document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[6].dataset.show`)
      await direito(a.x, a.y)
      await clicarItem("Adicionar ao roteiro")
      ok("C7 ＋ roteiro poe no fim do roteiro e nao vai ao ar", (await tamanho()) === tam0 + 1 && (await dom(`get(S.projects)[get(S.activeProject)].shows.slice(-1)[0].id`)) === idx && (await escritas()) === 0, `tam=${await tamanho()} n=${await escritas()}`)
    }

    { const a = await localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .linha[data-show]')[2]`)
      await direito(a.x, a.y)
      await clicarItem("Editar")
      ok("C8 Editar abre o show em Editar (so o gesto troca a tela)", (await dom(`get(T.tela)`)) === "editar" && (await escritas()) === 0)
      await j.ev(`T.trocarTela("show","segmentado"); await esp(900); return 1`) }
    await limpar()

    // ---------- D: midia, efeito, versiculo; saida travada
    await noDaArvore("Mídia")
    { const a = await localizar(j, `document.querySelector('[data-regiao=biblioteca] [class*="#media_card"]')`)
      await direito(a.x, a.y)
      const m = await menu()
      ok("D1 o menu da midia tem ＋ roteiro e Mostrar agora (sem a previa antiga)", !!m && m.some((t) => t.includes("Adicionar ao roteiro")) && m.some((t) => t.startsWith("Mostrar agora")) && !m.some((t) => /^Pré-visualizar|^Preview/i.test(t)), JSON.stringify(m))
      await print("02-menu-midia")
      const tam = await tamanho()
      await clicarItem("Mostrar agora")
      const ar = await noAr()
      ok("D2 Mostrar agora: a midia foi ao fundo da saida e o roteiro nao mudou", ar.some((x) => x.b) && (await tamanho()) === tam, JSON.stringify(ar))
      await limpar()
      await j.ev(`S.outLocked.set(true); return 1`)
      await direito(a.x, a.y)
      await clicarItem("Mostrar agora")
      ok("D3 saida travada: recusa e nada vai ao ar", !(await algoNoAr()) && (await escritas()) === 0)
      await j.ev(`S.outLocked.set(false); return 1`)
      await limpar()
      // revisao da fatia 6, achado 6: botao direito em cima do icone do cartao (a estrela de favorito) manda o ITEM ao ar; o icone nao e executado
      const caminho = ar.find((x) => x.b)?.b
      await j.ev(`S.media.update(a=>{a[${JSON.stringify(caminho)}]={...(a[${JSON.stringify(caminho)}]||{}),favourite:true}; return a}); await esp(700); return 1`)
      const est = await localizar(j, `document.querySelector('[data-regiao=biblioteca] [class*="#media_card"] .icons button')`)
      if (est.ok) {
        await direito(est.x, est.y)
        await clicarItem("Mostrar agora")
        const arI = await noAr()
        const fav = await dom(`!!get(S.media)[${JSON.stringify(caminho)}]?.favourite`)
        ok("D2b Mostrar agora com o botao direito no icone do cartao: a midia vai ao ar e o favorito nao e tirado", arI.some((x) => x.b) && fav, JSON.stringify({ arI, fav }))
      } else ok("D2b o cartao tem o icone de favorito", false, est.motivo)
      await j.ev(`S.media.update(a=>{a[${JSON.stringify(caminho)}]={...a[${JSON.stringify(caminho)}],favourite:false}; return a}); await esp(300); return 1`)
      await limpar() }
    await noDaArvore("Sobreposições")
    { const a = await localizar(j, `document.querySelector('[data-regiao=biblioteca] [class*="#effect_card"]')`)
      await direito(a.x, a.y)
      await print("03-menu-efeito")
      await clicarItem("Mostrar agora")
      const ar = await noAr()
      ok("D4 Mostrar agora num efeito poe o efeito no ar", ar.some((x) => x.e || x.ov), JSON.stringify(ar))
      await limpar() }
    await noDaArvore("Bíblia")
    { const v = await localizar(j, `document.querySelector('[data-regiao=biblioteca] .verse')`)
      if (v.ok) {
        await clicarEm(j, v.x, v.y); await esperar(600); await limpar()
        await direito(v.x, v.y)
        const m = await menu()
        ok("D5 o menu do versiculo tem Mostrar agora", !!m && m.some((t) => t.startsWith("Mostrar agora")), JSON.stringify(m))
        await clicarItem("Mostrar agora")
        await esperar(500)
        ok("D6 Mostrar agora num versiculo escreve em outputs (o texto vai ao ar)", (await escritas()) >= 1, `n=${await escritas()}`)
        // revisao da fatia 6, achado 1: com a Biblia JA no ar (o caso da leitura), Mostrar agora no versiculo seguinte tem que mandar o versiculo ao ar
        const v2 = await localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .verse')[2]`)
        await j.ev(`window.__n=0; window.__m=0; return 1`)
        await direito(v2.x, v2.y)
        await clicarItem("Mostrar agora")
        await esperar(700)
        ok("D7 versiculo A no ar: Mostrar agora no versiculo B manda o B ao ar (escreve em outputs)", (await escritas()) >= 1, `n=${await escritas()}`)
        await limpar()
      } else ok("D5 versiculo existe no perfil", false) }
    await noDaArvore("Shows")

    // ---------- E: item do roteiro
    await limpar()
    const antes = await projeto()
    { const a = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[1]`)
      await direito(a.x, a.y)
      const m = await menu()
      ok("E1 o menu do item do roteiro: Editar, Mostrar agora, Mover para cima/baixo, Tirar do roteiro", !!m && ["Editar", "Mostrar agora", "Mover para cima", "Mover para baixo", "Tirar do roteiro"].every((t) => m.some((x) => x.startsWith(t))), JSON.stringify(m))
      await print("04-menu-roteiro")
      await clicarItem("Mover para baixo")
      const depois = await projeto()
      ok("E2 Mover para baixo troca com o seguinte (uma entrada na lista)", depois !== antes && depois.split("|").length === antes.split("|").length)
      // o item que andou agora esta uma posicao abaixo: sobe de volta
      const b = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[2]`)
      await direito(b.x, b.y)
      await clicarItem("Mover para cima")
      ok("E3 Mover para cima desfaz", (await projeto()) === antes)
      const c = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[0]`)
      await direito(c.x, c.y)
      await clicarItem("Mostrar agora")
      ok("E4 Mostrar agora do item vai ao ar e o roteiro nao muda", (await algoNoAr()) && (await projeto()) === antes)
      await limpar()
      const d = await localizar(j, `[...document.querySelectorAll('[data-acao=lista-roteiro] button.item')].slice(-1)[0]`)
      const nAntes = await tamanho()
      await direito(d.x, d.y)
      await clicarItem("Tirar do roteiro")
      ok("E5 Tirar do roteiro tira so o item clicado", (await tamanho()) === nAntes - 1)
      // revisao da fatia 6, achado 3: pela mesma porta do Delete (o rastro "tirado · Desfazer" aparece e o Desfazer repoe o item)
      await esperar(300)
      ok("E5b Tirar do roteiro deixa o rastro \"tirado\" com Desfazer", await dom(`!!document.querySelector('[data-acao=lista-roteiro] .tirado .td')`))
      { const td = await localizar(j, `document.querySelector('[data-acao=lista-roteiro] .tirado .td')`)
        if (td.ok) { await clicarEm(j, td.x, td.y); await esperar(500) }
        ok("E5c Desfazer repoe o item no mesmo lugar", (await tamanho()) === nAntes && (await projeto()) === antes, `tam=${await tamanho()}`) }
    }

    // ---------- G: o 2o toque do duplo clique nao atravessa o menu (revisao da fatia 6, achado 2)
    await limpar()
    await j.ev(`window.__vazou=0; if(!window.__vazouLigado){ window.__vazouLigado=1; document.addEventListener("click",(e)=>{ if(!e.target.closest(".contextMenu")) window.__vazou++ }) } return 1`)
    for (const [rotulo, pausa] of [["120 ms (duplo clique de gente: o menu ja fechou)", 120], ["0 ms (o menu ainda esta no fade)", 0]]) {
      const a = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[1]`)
      const antesG = await projeto()
      await j.ev(`window.__vazou=0; return 1`)
      await direito(a.x, a.y)
      const it = await itemDoMenu("Mover para baixo")
      await clicarEm(j, it.x, it.y, 1)
      if (pausa) await esperar(pausa)
      await clicarEm(j, it.x, it.y, 2)
      await esperar(500)
      ok(`G1 duplo clique (${rotulo}): o 2o toque nao cai no que estava embaixo`, (await dom(`window.__vazou`)) === 0 && (await escritas()) === 0, `vazou=${await dom(`window.__vazou`)} n=${await escritas()}`)
      // um unico "Mover para cima" desfaz: so houve UM mover
      const b = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[2]`)
      await direito(b.x, b.y)
      await clicarItem("Mover para cima")
      ok(`G2 duplo clique (${rotulo}): a acao rodou uma vez so`, (await projeto()) === antesG)
      await limpar()
    }
    // passado o anteparo o ponto volta a ser do que esta embaixo (nao e uma area morta)
    { const a = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[1]`)
      await j.ev(`window.__vazou=0; return 1`)
      await direito(a.x, a.y)
      const it = await itemDoMenu("Editar")
      await clicarEm(j, it.x, it.y, 1)
      await esperar(500)
      await clicarEm(j, it.x, it.y, 1)
      await esperar(300)
      ok("G3 depois do anteparo o clique no mesmo ponto chega ao que esta embaixo", (await dom(`window.__vazou`)) >= 1, `vazou=${await dom(`window.__vazou`)}`)
      await j.ev(`T.trocarTela("show","segmentado"); await esp(600); return 1`)
      await limpar() }

    // ---------- H: o roteiro mudou com o menu aberto (revisao da fatia 6, achado 5): recusa, nao age no item que passou a ocupar a posicao
    await limpar()
    { const a = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.item')[1]`)
      await j.ev(`window.__origH=JSON.parse(JSON.stringify(get(S.projects)[get(S.activeProject)].shows)); return 1`)
      await direito(a.x, a.y)
      // o Sirvo (ou outro PC) poe um item NA FRENTE com o menu aberto: a posicao 1 agora e outro item
      await j.ev(`S.projects.update(a=>{const p=a[get(S.activeProject)]; p.shows=[{...window.__origH[0]}, ...window.__origH]; return a}); await esp(600); return 1`)
      const depoisInsercao = await projeto()
      await clicarItem("Tirar do roteiro")
      ok("H1 roteiro mudou com o menu aberto: Tirar do roteiro recusa e nao tira o item que ocupa a posicao", (await projeto()) === depoisInsercao, `antes=${depoisInsercao.split("|").length} depois=${(await projeto()).split("|").length}`)
      await j.ev(`S.projects.update(a=>{a[get(S.activeProject)].shows=window.__origH; return a}); await esp(400); return 1`)
      await limpar() }

    // ---------- F: blocos (um projeto de blocos nossos: o do Sirvo e trancado e recusa)
    await j.ev(`const p=get(S.projects).f3; window.__orig=JSON.parse(JSON.stringify(p.shows)); const sh=window.__orig.filter(x=>(x.type||"show")==="show");
S.projects.update(a=>{a.f3.shows=[{id:"t7a",type:"section",name:"Louvor"},sh[0],sh[1],{id:"t7b",type:"section",name:"Palavra"},sh[2],{id:"t7c",type:"section",name:"Final"},sh[3]]; return a}); S.activeProject.set("f3"); await esp(900); return 1`)
    await limpar()
    const nomes = () => dom(`get(S.projects)[get(S.activeProject)].shows.filter(s=>s.type==="section").map(s=>s.name||s.id).join("|")`)
    { const a = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.bloco')[1]`)
      await direito(a.x, a.y)
      const m = await menu()
      ok("F1 o menu do bloco: Editar titulo, Mover, Novo bloco, Tirar", !!m && ["Editar título", "Mover para cima", "Mover para baixo", "Novo bloco", "Tirar do roteiro"].every((t) => m.some((x) => x.startsWith(t))), JSON.stringify(m))
      await print("05-menu-bloco")
      await clicarItem("Editar título")
      await esperar(600)
      ok("F2 Editar titulo abre o bloco no centro com o cursor no titulo", await dom(`document.activeElement?.tagName==="INPUT" && !!document.activeElement.closest("#sectionTitle")`))
      await j.ev(`document.activeElement.blur(); return 1`)
      const ordemAntes = await nomes()
      const b = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.bloco')[1]`)
      await direito(b.x, b.y)
      await clicarItem("Mover para cima")
      const ordemDepois = await nomes()
      ok("F3 Mover bloco para cima troca com o bloco de cima (com os itens dele)", ordemAntes === "Louvor|Palavra|Final" && ordemDepois === "Palavra|Louvor|Final", `${ordemAntes} -> ${ordemDepois}`)
      const n0 = await tamanho()
      const c = await localizar(j, `document.querySelectorAll('[data-acao=lista-roteiro] button.bloco')[0]`)
      await direito(c.x, c.y)
      await clicarItem("Novo bloco")
      await esperar(500)
      ok("F4 Novo bloco acrescenta uma secao logo depois do bloco clicado", (await tamanho()) === n0 + 1 && (await dom(`get(S.projects)[get(S.activeProject)].shows.filter(s=>s.type==="section").length`)) === 4)
      await j.ev(`S.projects.update(a=>{a.f3.shows=window.__orig; return a}); await esp(400); return 1`)
    }
    // o projeto do Sirvo (blocos trancados) recusa Editar titulo/Mover com um aviso
    await print("99-fim")
} catch (e) {
    console.log("ERRO", e.stack || e.message)
    falhas.push("erro: " + e.message)
} finally {
    // o projeto de blocos que o teste montou na memoria nunca fica: restaura o original mesmo se uma checagem lancou
    try {
        await j.ev("if (window.__orig) { S.projects.update(a=>{a.f3.shows=window.__orig; return a}); window.__orig=null } S.contextActive.set(false); S.outLocked.set(false); return 1")
    } catch {}
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nTUDO OK")
process.exit(falhas.length ? 1 : 0)
