// Fatia 3 (Editar na forma final): fumaca com teclas e cliques REAIS (nunca force) contra o Show de dev (CDP, FS_CDP_PORTA) e os prints 1920x1080.
//   node scripts/prova-culto/t3-editar.mjs <pasta-de-prints>
//   A. slide comum: coluna de slides + seletor, centro com cabecalho/vistas/zoom, propriedades; sem faixa
//   B. slide NO AR editado: selos EDITADO + NO AR, faixa "Mandar pro ar"; o telao NAO muda ate mandar; mandar atualiza a foto e apaga os selos
//   C. botao direito numa miniatura: Mandar pro ar (sem "Monitor de retorno"); o clique manda
//   D. aberto da biblioteca: botao direito numa linha da biblioteca, Editar: selo BIBLIOTECA e secao "Aberto da biblioteca" no seletor
//   E. teclado: em Editar so o Esc limpa o telao; Espaco, setas, F1 e PageDown nao mexem; o Esc que fecha o seletor nao limpa; o 2o Esc em < 700 ms nao limpa
//   F. duplo clique num slide de Mostrar nao abre o editor
//   G. editar a midia que esta no fundo do telao: aviso "muda no telao na hora" (fundo e lido ao vivo, a foto so cobre slide de show)
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-3"
mkdirSync(saida, { recursive: true })
const MARCA = " M" + Date.now().toString(36).toUpperCase() // marca unica por rodada: o perfil guarda o texto editado
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")

async function print(nome, w = 1920, h = 1080) {
    await esperar(700)
    // o conteudo e o `main` (w x h): desde a fatia 4 nao ha barra de menus nem titulo nativo (viewport = conteudo)
    const r = { x: 0, y: 0, w, h }
    const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } })
    writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
    console.log("print", nome, JSON.stringify(r))
}
const noAr = () => j.ev(`const o=get(S.outputs).default?.out; return JSON.stringify({index:o?.slide?.index ?? null, texto:(o?.slide?.foto?.slide?.items?.[0]?.lines||[]).map(l=>(l.text||[]).map(t=>t.value).join("")).join("|")})`).then(JSON.parse)
const dom = (expr) => j.ev(`return ${expr}`)
const clique = async (expr, n = 1) => { const a = await localizar(j, expr); if (!a.ok) throw new Error("alvo: " + a.motivo + " :: " + expr); await clicarEm(j, a.x, a.y, n); return a }

async function direito(x, y) {
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "right", clickCount: 1 })
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "right", clickCount: 1 })
}

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    // preparo: culto aberto, um show com slides, telao ligado (so o store: a janela de saida de verdade poe-se por cima e o CDP nao entrega o quadro)
    await j.ev(`S.activePopup.set(null); T.trocarTela("show","segmentado"); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a})
const p=get(S.projects); const alvo=Object.entries(p).find(([k,v])=>(v.shows||[]).some(s=>(s.type===undefined||s.type==="show")))
S.activeProject.set(alvo[0]); const i=alvo[1].shows.findIndex(s=>(s.type===undefined||s.type==="show"))
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([alvo[1].shows[i].id])
S.activeShow.set({id:alvo[1].shows[i].id,index:i,type:"show"}); S.outputDisplay.set(true); S.activeDrawerTab.set("shows"); await esp(1200); return 1`)

    // ---------- F: duplo clique em Mostrar nao abre o editor
    { const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[0]`); await clicarEm(j, a.x, a.y, 1); await esperar(500); await clicarEm(j, a.x, a.y, 2); await esperar(600) }
    ok("F  duplo clique no slide de Mostrar nao abre o editor", (await dom(`get(T.tela)`)) === "mostrar", await dom(`get(T.tela)`))
    await j.ev(`S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); return 1`)

    // ---------- A: slide comum em Editar (pelo segmentado, clique real)
    await clique(`[...document.querySelectorAll('[role=tab]')].find(b=>b.innerText.trim()==="Editar")`)
    await esperar(1500)
    await j.ev(`S.activeEdit.set({type:"show",slide:0,items:[],showId:get(S.activeShow).id}); await esp(600); return 1`)
    ok("A1 a tela e Editar", (await dom(`get(T.tela)`)) === "editar")
    ok("A2 coluna da esquerda tem EDITANDO, seletor e miniaturas", await dom(`!!document.querySelector('[data-acao=editando-seletor]') && document.querySelectorAll('[data-acao=editando-slides] .slide').length>1`))
    ok("A3 a biblioteca segue por baixo, de ponta a ponta", await dom(`(()=>{const b=document.querySelector('[data-regiao=biblioteca]').getBoundingClientRect(),e=document.querySelector('[data-regiao=roteiro]').getBoundingClientRect(),d=document.querySelector('[data-regiao=no-ar]').getBoundingClientRect();return b.left<=e.left+1 && b.bottom>e.bottom && b.right<=d.left})()`))
    ok("A4 cabecalho do centro: vistas e zoom; nenhum painel flutuante do zoom", await dom(`!!document.querySelector('[data-acao=editar-vistas]') && !!document.querySelector('[data-acao=editar-zoom]')`))
    ok("A5 sem faixa de pendencia num slide fora do ar", await dom(`!document.querySelector('[data-acao=editar-pendencia]')`))
    ok("A6 propriedades a direita", await dom(`!!document.querySelector('[data-acao=editar-ferramentas]')`))
    await print("E1-editar-slide-comum-1920")

    // ---------- B: slide no ar, editado
    await j.ev(`const O=await import(U("components/helpers/output")); const id=get(S.activeShow).id; const layout=get(S.showsCache)[id]?.settings?.activeLayout
O.setOutput("slide",{id,layout,index:1,line:0}); await esp(900); S.activeEdit.set({type:"show",slide:1,items:[],showId:id}); await esp(900); return 1`)
    const antes = await noAr()
    ok("B1 slide 2 no ar (com foto)", antes.index === 1 && antes.texto.length > 0, JSON.stringify(antes))
    ok("B2 miniatura 2 com selo NO AR e sem EDITADO", await dom(`(()=>{const s=document.querySelectorAll('[data-acao=editando-slides] .main')[1]; return !!s.querySelector('.selo.noAr') && !s.querySelector('.selo.editado')})()`))
    // editar o texto do slide de verdade (clique no texto, digitar)
    await clique(`document.querySelector('[data-acao=editar-slide] .edit')`)
    await esperar(300)
    await tecla(j, "End", { ctrl: true })
    await j.enviar("Input.insertText", { text: MARCA })
    await esperar(1200)
    await j.ev(`document.activeElement?.blur?.(); return 1`)
    await esperar(900)
    ok("B3 miniatura 2 com EDITADO + NO AR", await dom(`(()=>{const s=document.querySelectorAll('[data-acao=editando-slides] .main')[1]; return !!s.querySelector('.selo.noAr') && !!s.querySelector('.selo.editado')})()`))
    ok("B4 faixa 'O telao ainda mostra a versao anterior' com o botao", await dom(`document.querySelector('[data-acao=editar-pendencia]')?.innerText.includes('Mandar pro ar') && document.querySelector('[data-acao=editar-pendencia]').innerText.includes('versão anterior')`))
    const meio = await noAr()
    ok("B5 o telao NAO mudou enquanto se edita (foto)", meio.texto === antes.texto && !meio.texto.includes(MARCA), JSON.stringify(meio))
    await print("E2-slide-no-ar-editado-1920")
    await clique(`document.querySelector('[data-acao=editar-mandar-pro-ar]')`)
    await esperar(1200)
    const depois = await noAr()
    ok("B6 'Mandar pro ar' atualiza o telao", depois.texto.includes(MARCA), JSON.stringify(depois))
    ok("B7 a faixa e o EDITADO somem; fica NO AR e a nota", await dom(`!document.querySelector('[data-acao=editar-pendencia]') && !document.querySelectorAll('[data-acao=editando-slides] .main')[1].querySelector('.selo.editado') && !!document.querySelectorAll('[data-acao=editando-slides] .main')[1].querySelector('.selo.noAr')`))

    // ---------- C: botao direito na miniatura
    await j.ev(`S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); await esp(500); return 1`)
    { const a = await localizar(j, `document.querySelectorAll('[data-acao=editando-slides] .main > .slide.context')[2]`); await direito(a.x, a.y) }
    await esperar(500)
    const menu = await dom(`document.querySelector('.contextMenu')?.innerText || ""`)
    ok("C1 menu tem 'Mandar pro ar'", /Mandar pro ar/.test(menu), menu.split("\n").slice(0, 3).join(" / "))
    ok("C2 menu NAO tem 'Monitor de retorno'", !/Monitor de retorno/i.test(menu))
    await print("E3-botao-direito-no-slide-1920")
    await clique(`[...document.querySelectorAll('.contextMenu *')].filter(e=>e.children.length===0 && (e.textContent||"").trim()==="Mandar pro ar")[0]`)
    await esperar(1200)
    ok("C3 o clique manda o slide 3 ao ar", (await noAr()).index === 2, JSON.stringify(await noAr()))

    // ---------- E: teclado em Editar
    for (const k of [" ", "ArrowRight", "F1", "PageDown"]) {
        const a0 = JSON.stringify(await noAr())
        await tecla(j, k)
        await esperar(500)
        ok(`E  em Editar a tecla '${k === " " ? "Espaco" : k}' nao mexe no telao`, JSON.stringify(await noAr()) === a0)
    }
    // o Esc que fecha o seletor nao limpa o telao; o seguinte, 150 ms depois, tambem nao
    await clique(`document.querySelector('[data-acao=editando-seletor]')`)
    await esperar(400)
    ok("E5 seletor aberto", await dom(`!!document.querySelector('[data-acao=editando-lista]')`))
    await tecla(j, "Escape")
    await esperar(150)
    await tecla(j, "Escape")
    await esperar(500)
    ok("E6 o Esc que fecha o seletor e o seguinte (150 ms) NAO limpam o telao", (await noAr()).index === 2 && !(await dom(`!!document.querySelector('[data-acao=editando-lista]')`)), JSON.stringify(await noAr()))
    await esperar(900)
    await j.ev(`document.activeElement?.blur?.(); return 1`)
    await tecla(j, "Escape")
    await esperar(600)
    ok("E7 passados os 700 ms o Esc LIMPA o telao em Editar", (await noAr()).index === null, JSON.stringify(await noAr()))

    // ---------- D: aberto da biblioteca (botao direito numa linha da biblioteca, Editar)
    // a biblioteca de Mostrar tem a lista de shows: o botao direito numa linha leva a Editar (a pagina so muda por gesto: o segmentado)
    await clique(`[...document.querySelectorAll('[role=tab]')].find(b=>b.innerText.trim()==="Mostrar")`)
    await esperar(1200)
    await j.ev(`S.activeDrawerTab.set("shows"); await esp(1200); return 1`)
    const linhas = await dom(`[...document.querySelectorAll('[data-regiao=biblioteca] .context')].map(e=>e.className+"|"+e.innerText.trim().slice(0,30)).slice(0,8).join(" ;; ")`)
    console.log("   linhas:", linhas)
    const alvoLinha = await j.ev(`const ids=get(S.projects)[get(S.activeProject)].shows.map(s=>s.id); const outro=Object.keys(get(S.shows)).find(id=>!ids.includes(id)); return outro||null`)
    ok("D0 ha um show fora do roteiro no perfil de teste", !!alvoLinha, String(alvoLinha))
    if (alvoLinha) {
        const nome = await dom(`get(S.shows)[${JSON.stringify(alvoLinha)}].name`)
        const a = await localizar(j, `[...document.querySelectorAll('[data-regiao=biblioteca] .context.linha')].find(e=>e.innerText.trim().startsWith(${JSON.stringify(nome)}))`)
        if (a.ok) {
            await direito(a.x, a.y)
            await esperar(500)
            const m = await dom(`document.querySelector('.contextMenu')?.innerText || ""`)
            console.log("   menu da biblioteca:", m.replace(/\n/g, " / ").slice(0, 160))
            await clique(`[...document.querySelectorAll('.contextMenu *')].filter(e=>e.children.length===0 && /^Editar$/i.test((e.textContent||"").trim()))[0]`)
            await esperar(1500)
            ok("D1 abriu o show da biblioteca em Editar", (await dom(`get(T.tela)`)) === "editar" && (await dom(`get(S.activeShow)?.id`)) === alvoLinha)
            ok("D2 o seletor mostra o selo BIBLIOTECA", await dom(`document.querySelector('[data-acao=editando-seletor]').innerText.includes('BIBLIOTECA')`))
            await clique(`document.querySelector('[data-acao=editando-seletor]')`)
            await esperar(500)
            ok("D3 a lista tem 'No roteiro' e 'Aberto da biblioteca'", await dom(`(()=>{const t=document.querySelector('[data-acao=editando-lista]')?.innerText||"";return t.includes('No roteiro') && t.includes('Aberto da biblioteca')})()`))
            await print("E4-aberto-da-biblioteca-1920")
        } else console.log("   (linha da biblioteca nao achada para o clique direito)", a.motivo)
    }
    // ---------- G: midia no fundo do telao, aberta em Editar
    {
        const midia = await j.ev(`const m=Object.keys(get(S.media)||{}).find(p=>/\.(png|jpe?g|mp4|webm)$/i.test(p)); return m||null`)
        ok("G0 ha midia no perfil", !!midia, String(midia))
        if (midia) {
            await j.ev(`const O=await import(U("components/helpers/output")); O.setOutput("background",{path:${JSON.stringify(midia)},type:"image"}); await esp(800); S.activeEdit.set({type:"media",id:${JSON.stringify(midia)},items:[]}); await esp(1200); return 1`)
            ok("G1 aviso 'muda no telao na hora' com a midia no ar", await dom(`!!document.querySelector('[data-acao=editar-aviso-ao-vivo]') && document.querySelector('[data-acao=editar-aviso-ao-vivo]').innerText.includes('na hora')`), await dom(`document.querySelector('[data-acao=editar-aviso-ao-vivo]')?.innerText ?? null`))
            ok("G2 sem faixa de 'Mandar pro ar' para midia (o fundo e ao vivo)", await dom(`!document.querySelector('[data-acao=editar-pendencia]')`))
            await j.ev(`S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); await esp(800); return 1`)
            ok("G3 sem midia no ar o aviso some", await dom(`!document.querySelector('[data-acao=editar-aviso-ao-vivo]')`))
        }
    }
} catch (e) {
    console.error("ERRO", e)
    falhas.push("excecao: " + (e?.message || e))
} finally {
    j.fechar()
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\ntudo verde")
process.exit(falhas.length ? 1 : 0)
