// Telas / Modelos / Visual (André, 25/nov: "aprovo papeis-saida" e "aprovo ajuste-pasta"). Contra o Show de dev (CDP), perfil de prova. Cliques REAIS.
//   node scripts/prova-culto/t21-telas-papeis.mjs
//   A  Telas: "Saida principal" escolhe a tela grande do No ar (e o retorno nunca e a principal)
//   B  Telas: "Esta tela mostra" vira uma tela em Retorno e de volta em Slides
//   C  Modelos: a aba Retorno abre "Modelos de retorno"; a aba Slides volta para Editar > Modelos; o menu ⋯ nao tem mais "Telas e monitor de retorno"
//   D  Ajuste na tela: a pasta pede (Preencher), o proprio da midia vence, sem nada vale a Tela
//   E  limpeza
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await esperar(600)
const clicar = async (nome, expr) => {
    const l = await localizar(j, expr)
    ok("clique: " + nome, l.ok, l.motivo)
    if (l.ok) await clicarEm(j, l.x, l.y)
    await esperar(500)
    return l.ok
}
const guardado = await j.ev(`return JSON.stringify({o:get(S.outputs), p:get(S.special).aliancaSaidaPrincipal ?? null, t:get(S.mediaTags), m:get(S.media)})`)

try {
    // A
    await j.ev(`T.trocarTela("settings","menu-app"); S.settingsTab.set("display_settings"); await esp(1500); return 1`)
    ok("A a pagina chama Telas", (await j.ev(`return document.querySelector('[data-acao="pagina-cabecalho"]')?.innerText||""`)).length > 0 && (await j.ev(`return !!document.querySelector('[data-acao="saida-principal"] select')`)))
    const opcoes = await j.ev(`return [...document.querySelectorAll('[data-acao="saida-principal"] option')].map(o=>o.value)`)
    const retornos = await j.ev(`return Object.entries(get(S.outputs)).filter(([,o])=>o.stageOutput).map(([id])=>id)`)
    ok("A o seletor so lista telas de slides (retorno fora)", opcoes.length > 0 && !opcoes.some((id) => retornos.includes(id)), JSON.stringify({ opcoes, retornos }))
    if (opcoes.length > 1) {
        const alvo = opcoes[opcoes.length - 1]
        await j.ev(`const s=document.querySelector('[data-acao="saida-principal"] select'); s.value=${JSON.stringify(alvo)}; s.dispatchEvent(new Event("change",{bubbles:true})); await esp(500); return 1`)
        const r = await j.ev(`const A=await import(U("utils/aliancaTransporteLogica")); return {esc:get(S.special).aliancaSaidaPrincipal, princ:A.saidasDasAbas(get(S.outputs), get(S.special).aliancaSaidaPrincipal).principal}`)
        ok("A escolher grava e a coluna No ar usa a escolhida", r.esc === alvo && r.princ === alvo, JSON.stringify(r))
    } else ok("A (so uma tela de slides: a escolha e ela)", opcoes.length === 1)

    // B: cria uma tela de teste e troca o papel com clique real
    const nova = await j.ev(`const O=await import(U("components/helpers/output")); const id=O.addOutput(false, "", false, "T21 tela"); await esp(600); S.currentOutputSettings.set(id); await esp(800); return id`)
    // so segue se a pagina mostra a tela de teste (nunca trocar o papel de uma tela de verdade do perfil)
    const naPagina = await j.ev(`return get(S.currentOutputSettings)`)
    if (!nova || naPagina !== nova) throw new Error("B: a tela de teste nao foi criada ou nao esta na pagina (" + nova + " / " + naPagina + ")")
    const temModeloRetorno = await j.ev(`return Object.keys(get(S.stageShows)).length > 0`)
    await clicar("Esta tela mostra: Retorno", `document.querySelector('[data-acao="saida-papel"] [data-papel="retorno"]')`)
    if (temModeloRetorno) {
        ok("B virou retorno (stageOutput com um modelo de retorno)", !!(await j.ev(`return get(S.outputs)[${JSON.stringify(nova)}]?.stageOutput`)))
        ok("B retorno nunca e a principal", (await j.ev(`const A=await import(U("utils/aliancaTransporteLogica")); return A.saidasDasAbas(get(S.outputs), ${JSON.stringify(nova)}).principal`)) !== nova)
        await clicar("Esta tela mostra: Slides", `document.querySelector('[data-acao="saida-papel"] [data-papel="slides"]')`)
        ok("B voltou a Slides (sem stageOutput)", !(await j.ev(`return get(S.outputs)[${JSON.stringify(nova)}]?.stageOutput`)))
    } else ok("B sem modelo de retorno: avisa e nao muda", (await j.ev(`return !!document.querySelector('[data-acao="saida-papel-aviso"]')`)) && !(await j.ev(`return get(S.outputs)[${JSON.stringify(nova)}]?.stageOutput`)))
    await j.ev(`const O=await import(U("components/helpers/output")); S.outputs.update(a=>{delete a[${JSON.stringify(nova)}]; return a}); await esp(400); return 1`)

    // C
    await j.ev(`const E=await import(U("utils/aliancaEditarEstado")); T.trocarTela("edit","segmentado"); await esp(600); E.modoDoEditar.set("modelos"); await esp(800); return 1`)
    await clicar("Modelos: Retorno", `document.querySelector('[data-acao="modelos-lista"] [data-acao="modelos-tipo"] [data-tipo="retorno"]')`)
    await esperar(800)
    ok("C a aba Retorno abre a pagina Modelos de retorno", (await j.ev(`return get(S.activePage)`)) === "stage" && /Modelos de retorno/.test(await j.ev(`return document.querySelector('[data-acao="pagina-cabecalho"] h1')?.innerText||""`)))
    await clicar("Modelos de retorno: Slides", `document.querySelector('[data-acao="pagina-cabecalho"] [data-tipo="slides"]')`)
    await esperar(800)
    ok("C a aba Slides volta a Editar > Modelos", (await j.ev(`return get(S.activePage)`)) === "edit" && (await j.ev(`return !!document.querySelector('[data-acao="modelos-grade"]')`)))
    await clicar("menu do app", `document.querySelector('[data-acao="menu-app"]') || document.querySelector('[data-acao="logo"]')`)
    const itens = await j.ev(`return document.body.innerText`)
    ok("C o menu nao tem mais Telas e monitor de retorno", !/Telas e monitor de retorno/.test(itens))
    await j.ev(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})); await esp(300); return 1`)

    // D: ajuste pela pasta e proprio
    const d = await j.ev(`const H=await import(U("components/helpers/media")); const L=await import(U("utils/aliancaPastasMidiaLogica"))
        const tags=get(S.mediaTags); const pid=Object.keys(tags).find(k=>tags[k].aliancaPasta); if(!pid) return {erro:"sem pasta"}
        const caminho="C:/t21/midia-de-teste.mp4"; S.media.update(m=>{m[caminho]={tags:[pid]}; return m}); await esp(100)
        const estilo={fit:"contain"}
        S.mediaTags.update(t=>{t[pid]={...t[pid], aliancaPasta:{...t[pid].aliancaPasta, ajuste:"cover"}}; return t}); await esp(100)
        const m0=get(S.media)[caminho]; const semProprio={...m0}; delete semProprio.fit
        const pasta=H.getMediaStyle(semProprio, estilo).fit
        const proprio=H.getMediaStyle({...semProprio, fit:"fill"}, estilo).fit
        S.mediaTags.update(t=>{const p={...t[pid].aliancaPasta}; delete p.ajuste; t[pid]={...t[pid], aliancaPasta:p}; return t}); await esp(100)
        const tela=H.getMediaStyle(semProprio, estilo).fit
        S.media.update(m=>{delete m[caminho]; return m})
        return {pasta, proprio, tela}`)
    ok("D a pasta pede Preencher", d.pasta === "cover", JSON.stringify(d))
    ok("D o ajuste proprio da midia vence a pasta", d.proprio === "fill")
    ok("D sem pasta pedindo, vale a Tela", d.tela === "contain")
} catch (e) {
    ok("sem excecao", false, String(e?.stack || e))
} finally {
    await j.ev(`const g=JSON.parse(${JSON.stringify(guardado)}); S.mediaTags.set(g.t); S.special.update(s=>{const x={...s}; if(g.p===null) delete x.aliancaSaidaPrincipal; else x.aliancaSaidaPrincipal=g.p; return x}); T.trocarTela("show","segmentado"); await esp(500); return 1`).catch(() => {})
    await j.enviar("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
    console.log(falhas.length ? `\nT21: ${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nT21: tudo ok")
    process.exit(falhas.length ? 1 : 0)
}
