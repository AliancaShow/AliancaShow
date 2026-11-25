// Coluna No ar (25/nov, Andre: desenho coluna_no_ar_secoes_recolhiveis_v1). Secoes com titulo e setinha: OUTRAS TELAS e RECADOS
// (abas Palco / Chamadas so com a secao aberta; pilula do que esta no ar no titulo mesmo recolhida). Contra o Show de dev (CDP), perfil
// de teste. Cliques REAIS (localizar + clicarEm), nunca force.
//   node scripts/prova-culto/t18-recados.mjs
//   A  primeira abertura (sem escolha guardada): Recados recolhido, sem abas; Outras telas aberta (se houver outra tela)
//   B  clique no titulo abre Recados na aba Chamadas; as abas aparecem; o chat encolhe e volta a crescer ao recolher
//   C  aba Palco; recolher e abrir de novo volta no Palco; o texto digitado no campo do palco sobrevive a recolher
//   D  chamada no ar com Recados recolhido: pilula "Kids" no titulo; Tirar na pilula tira de todas as saidas
//   E  mensagem viva no palco: pilula "Palco" com contagem; clicar no nome abre Recados na aba Palco
//   F  a escolha sobrevive a recarregar a janela
//   G  limpeza: nada no ar, escolhas do operador devolvidas
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
let j = await abrir("principal", { buffer: true })
await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await esperar(600)
const clicar = async (nome, expr) => {
    const l = await localizar(j, expr)
    ok("clique: " + nome, l.ok, l.motivo)
    if (l.ok) await clicarEm(j, l.x, l.y)
    await esperar(350)
    return l.ok
}
const sel = (s) => `document.querySelector(${JSON.stringify(s)})`
const tituloRecados = `document.querySelector('[data-acao="recados"] [data-acao="alternar-secao"]')`
const visivel = (s) => j.ev(`const e=document.querySelector(${JSON.stringify(s)}); return !!e && e.getClientRects().length>0`)
const estado = () =>
    j.ev(`const r=document.querySelector('[data-acao="recados"]'); const o=document.querySelector('[data-acao="outras-telas"]'); const c=document.querySelector('[data-regiao-filho="chat"]')
        return {recados: r?.dataset.aberta, abas: !!r && [...r.querySelectorAll('[data-acao="aba-recados"]')].some(b=>b.getClientRects().length), outras: o ? o.dataset.aberta : "sem", chatH: Math.round(c?.getBoundingClientRect().height||0)}`)
const noAr = (id) => j.ev(`return Object.values(get(S.outputs)).filter(x=>(x.out?.overlays||[]).includes(${JSON.stringify(id)})).length`)
const CHAVES = ["noar|recados", "noar|recados-aba-palco", "noar|outras-telas"]

// guarda as escolhas do operador e limpa (primeira abertura)
const antes = await j.ev(`const B=await import(U("utils/aliancaBlocosEstado")); const e=get(B.blocos); const g={}; for (const k of ${JSON.stringify(CHAVES)}) if (k in e) g[k]=e[k]
    B.blocos.update(x=>{ const y={...x}; for (const k of ${JSON.stringify(CHAVES)}) delete y[k]; return y }); S.activePopup.set(null); MODO("culto"); await esp(700); return g`)

try {
    // A
    const a = await estado()
    ok("A Recados nasce recolhido e sem abas", a.recados === "false" && !a.abas, JSON.stringify(a))
    ok("A Outras telas nasce aberta (ou nao ha outra tela)", a.outras === "true" || a.outras === "sem", a.outras)

    // B
    await clicar("titulo Recados", tituloRecados)
    const b = await estado()
    ok("B o clique abre Recados e mostra as abas", b.recados === "true" && b.abas, JSON.stringify(b))
    ok("B abre na aba Chamadas (padrao)", (await j.ev(`return document.querySelector('[data-acao="aba-recados"][aria-selected="true"]')?.dataset.aba`)) === "chamadas")
    ok("B o chat cede espaco com Recados aberto", b.chatH < a.chatH, `${a.chatH} -> ${b.chatH}`)
    ok("B chips das chamadas visiveis", await visivel('[data-acao="chip-chamada"]'))

    // C
    await clicar("aba Palco", `document.querySelector('[data-acao="aba-recados"][data-aba="palco"]')`)
    ok("C aba Palco mostra o campo da mensagem e esconde as chamadas", (await visivel('[data-acao="mensagem-palco"]')) && !(await visivel('[data-acao="chip-chamada"]')))
    await clicar("campo da mensagem", sel('[data-acao="mensagem-palco"]'))
    await j.enviar("Input.insertText", { text: "Teste t18" })
    await esperar(200)
    await clicar("titulo Recados (recolher)", tituloRecados)
    const c1 = await estado()
    ok("C recolher esconde as abas e devolve o espaco ao chat", c1.recados === "false" && !c1.abas && c1.chatH === a.chatH, JSON.stringify(c1))
    await clicar("titulo Recados (abrir)", tituloRecados)
    ok("C abre de novo no Palco", (await j.ev(`return document.querySelector('[data-acao="aba-recados"][aria-selected="true"]')?.dataset.aba`)) === "palco")
    ok("C o texto digitado sobreviveu", (await j.ev(`return document.querySelector('[data-acao="mensagem-palco"]').value`)) === "Teste t18")
    await j.ev(`const e=document.querySelector('[data-acao="mensagem-palco"]'); e.value=""; e.dispatchEvent(new Event("input",{bubbles:true})); return 1`)

    // D
    await clicar("aba Chamadas", `document.querySelector('[data-acao="aba-recados"][data-aba="chamadas"]')`)
    await clicar("chip Kids", `[...document.querySelectorAll('[data-acao="chip-chamada"]')].find(b=>b.textContent.trim()==="Kids")`)
    await clicar("campo Número", sel('[data-acao="campo-chamada"]'))
    await j.enviar("Input.insertText", { text: "18" })
    await esperar(200)
    await clicar("Chamar no telão", sel('[data-acao="chamar"]'))
    await esperar(500)
    const kids = await j.ev(`return Object.keys(get(S.overlays)).find(k=>get(S.overlays)[k].name==="Kids")`)
    ok("D Kids no ar", (await noAr(kids)) > 0)
    await clicar("titulo Recados (recolher)", tituloRecados)
    const pil = await j.ev(`const p=document.querySelector('[data-acao="pilula-chamadas"]'); return p && p.getClientRects().length ? p.innerText.replace(/\\s+/g," ").trim() : ""`)
    ok("D recolhido: pilula Kids no titulo com Tirar", /Kids/.test(pil) && /Tirar/.test(pil), pil)
    await clicar("Tirar na pilula", sel('[data-acao="pilula-chamadas-tirar"]'))
    await esperar(300)
    ok("D Tirar na pilula tirou de todas as saidas e a pilula sumiu", (await noAr(kids)) === 0 && !(await j.ev(`return !!document.querySelector('[data-acao="pilula-chamadas"]')`)))
    ok("D Recados continuou recolhido", (await estado()).recados === "false")

    // E
    await j.ev(`const V=await import(U("utils/aliancaMensagemPalcoVista")); V.mensagemSubstituta.set({id:"t18",texto:"Pastor, 5 min",ate:new Date(Date.now()+125000).toISOString()}); await esp(800); return 1`)
    const pp = await j.ev(`const p=document.querySelector('[data-acao="pilula-palco"]'); return p ? p.innerText.replace(/\\s+/g," ").trim() : ""`)
    ok("E pilula Palco com contagem", /Palco/.test(pp) && /\d:\d\d/.test(pp) && /Limpar/.test(pp), pp)
    await clicar("nome na pilula Palco", `document.querySelector('[data-acao="pilula-palco"] .nome')`)
    ok("E o nome abre Recados na aba Palco", (await estado()).recados === "true" && (await j.ev(`return document.querySelector('[data-acao="aba-recados"][aria-selected="true"]')?.dataset.aba`)) === "palco")
    await j.ev(`const V=await import(U("utils/aliancaMensagemPalcoVista")); V.mensagemSubstituta.set(undefined); await esp(300); return 1`)

    // F
    await j.enviar("Page.reload")
    await esperar(2500)
    j = await abrir("principal")
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    for (let t = 0; t < 40 && !(await j.ev(`return !!document.querySelector('[data-acao="recados"]')`).catch(() => false)); t++) await esperar(500)
    await esperar(800)
    const f = await estado()
    ok("F depois de recarregar: Recados aberto na aba Palco (a escolha ficou)", f.recados === "true" && (await j.ev(`return document.querySelector('[data-acao="aba-recados"][aria-selected="true"]')?.dataset.aba`)) === "palco", JSON.stringify(f))
} catch (e) {
    ok("sem exceção", false, String(e?.stack || e))
} finally {
    // G
    await j
        .ev(
            `const A=await import(U("utils/aliancaChamadas")); const c=get(A.chamadaNoAr); if (c) A.tirarChamada(c.id)
        const V=await import(U("utils/aliancaMensagemPalcoVista")); V.mensagemSubstituta.set(undefined)
        const B=await import(U("utils/aliancaBlocosEstado")); const g=${JSON.stringify(antes || {})}
        B.blocos.update(x=>{ const y={...x}; for (const k of ${JSON.stringify(CHAVES)}) { if (k in g) y[k]=g[k]; else delete y[k] } return y }); await esp(300); return 1`
        )
        .catch(() => {})
    const sobrou = await j.ev(`const ids=Object.keys(get(S.overlays)).filter(k=>get(S.overlays)[k].aliancaChamada); return Object.values(get(S.outputs)).some(x=>(x.out?.overlays||[]).some(i=>ids.includes(i)))`).catch(() => true)
    ok("G nenhuma chamada no ar no fim", !sobrou)
    await j.enviar("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
    console.log(falhas.length ? `\nT18: ${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nT18: tudo ok")
    process.exit(falhas.length ? 1 : 0)
}
