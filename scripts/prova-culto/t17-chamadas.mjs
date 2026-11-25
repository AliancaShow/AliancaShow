// Cabine 6 (25/nov): fumaca das Chamadas (Kids, Estacionamento) e dos Valores dinamicos em portugues. Contra o Show de dev (CDP), perfil de
// teste. Cliques e teclas REAIS (localizar + clicarEm, Input.insertText), nunca force.
//   node scripts/prova-culto/t17-chamadas.mjs            (A..G, ~30 s)
//   FS_LONGO=1 node scripts/prova-culto/t17-chamadas.mjs (mais H: a chamada de 30 s sai sozinha)
//   A  o painel CHAMADAS existe em Mostrar com Kids e Estacionamento (criadas uma vez por perfil)
//   B  digitar o numero (teclado real) atualiza a previa; o espaco digitado no campo NAO passa slide
//   C  "Chamar no telao" poe a sobreposicao em todas as saidas normais ligadas; NO AR com contagem; "Tirar" tira de todas
//   D  Estacionamento: Enter no ultimo campo chama, com os dois campos no texto
//   E  editor: "+ Chamada" com [campos] -> chip novo com as caixinhas; posicao Canto muda a caixa; Apagar (com confirmacao) tira tudo
//   F  Valores dinamicos: o botao direito abre a janela em portugues (nao o popup do FreeShow); clicar "Hora" poe o codigo no cursor;
//      "Todos os codigos (avancado)" abre o popup original
//   G  nada sobrou: nenhuma chamada no ar, chamada e modelo de teste apagados
import { abrir, clicarEm, esperar, localizar, RECADOS, tecla } from "./lib.mjs"

const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await esperar(800)
const clicar = async (nome, expr) => {
    const l = await localizar(j, expr)
    ok("clique: " + nome, l.ok, l.motivo)
    if (l.ok) await clicarEm(j, l.x, l.y)
    await esperar(400)
    return l.ok
}
const digitar = async (texto) => {
    await j.enviar("Input.insertText", { text: texto })
    await esperar(200)
}
const sel = (s) => `document.querySelector(${JSON.stringify(s)})`
const chip = (nome) => `[...document.querySelectorAll('[data-acao="chip-chamada"]')].find(b=>b.textContent.trim()===${JSON.stringify(nome)})`
const noAr = (nome) => j.ev(`const o=get(S.overlays); const id=Object.keys(o).find(k=>o[k].name===${JSON.stringify(nome)}); return Object.values(get(S.outputs)).filter(x=>(x.out?.overlays||[]).includes(id)).length`)
const normaisLigadas = () => j.ev(`return Object.values(get(S.outputs)).filter(o=>o.enabled && !o.stageOutput && !o.isKeyOutput).length`)

try {
    await j.ev(`S.activePopup.set(null); MODO("culto"); await esp(600); ${RECADOS("chamadas")} return 1`)

    // A
    ok("A painel CHAMADAS em Mostrar", await j.ev(`return !!document.querySelector('[data-regiao-filho="chamadas"]')`))
    const chips = await j.ev(`return [...document.querySelectorAll('[data-acao="chip-chamada"]')].map(b=>b.textContent.trim())`)
    ok("A Kids e Estacionamento", chips.includes("Kids") && chips.includes("Estacionamento"), chips.join(", "))

    // B
    await clicar("chip Kids", chip("Kids"))
    await clicar("campo Número", sel('[data-acao="campo-chamada"]'))
    await j.ev(`const O=await import(U("components/helpers/output")); const id=Object.keys(get(S.shows))[0]; const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([id]); const sh=get(S.showsCache)[id]; O.setOutput("slide",{id, layout: sh.settings.activeLayout, index:0}); await esp(500); return 1`)
    const slideAntes = await j.ev(`return JSON.stringify(Object.values(get(S.outputs)).map(o=>o.out?.slide?.index ?? null))`)
    await digitar("2 3")
    const slideDepois = await j.ev(`return JSON.stringify(Object.values(get(S.outputs)).map(o=>o.out?.slide?.index ?? null))`)
    ok("B espaço no campo não passa slide", slideAntes === slideDepois, `${slideAntes} -> ${slideDepois}`)
    const previa = await j.ev(`return document.querySelector(".previa .caixa")?.textContent || ""`)
    ok("B prévia com o número", previa.includes("Pais da criança 2 3"), previa)

    // C
    await clicar("Chamar no telão", sel('[data-acao="chamar"]'))
    await esperar(600)
    const n = await noAr("Kids")
    const esperadas = await normaisLigadas()
    ok("C Kids no ar em todas as saídas normais ligadas", n > 0 && n === esperadas, `${n} de ${esperadas}`)
    const linha = await j.ev(`return document.querySelector('[data-acao="chamada-no-ar"]')?.textContent || ""`)
    ok("C NO AR com contagem", /NO AR/.test(linha) && /\d:\d\d/.test(linha), linha)
    await clicar("Tirar", sel('[data-acao="tirar-chamada"]'))
    ok("C Tirar tirou de todas", (await noAr("Kids")) === 0)

    // D
    await clicar("chip Estacionamento", chip("Estacionamento"))
    await clicar("campo Carro", `document.querySelectorAll('[data-acao="campo-chamada"]')[0]`)
    await digitar("Gol prata")
    await clicar("campo Placa", `document.querySelectorAll('[data-acao="campo-chamada"]')[1]`)
    await digitar("ABC-1D23")
    await tecla(j, "Enter")
    await esperar(800)
    const textoEst = await j.ev(`return document.querySelector('[data-acao="chamada-no-ar"] .t')?.textContent || ""`)
    ok("D Enter no último campo chama", (await noAr("Estacionamento")) > 0 && textoEst.includes("Gol prata") && textoEst.includes("ABC-1D23"), textoEst)
    await clicar("Tirar", sel('[data-acao="tirar-chamada"]'))

    // E
    await clicar("+ Chamada", sel('[data-acao="nova-chamada"]'))
    await clicar("Nome", sel('[data-acao="nome-chamada"]'))
    await j.ev(`const c=document.querySelector('[data-acao="nome-chamada"]'); c.select(); return 1`)
    await digitar("Fumaça t17")
    await clicar("Texto", sel('[data-acao="texto-chamada"]'))
    await digitar("Atenção [nome], procure o [lugar]")
    await clicar("Salvar", sel('[data-acao="salvar-chamada"]'))
    const novos = await j.ev(`return {chip: document.querySelector('[data-acao="chip-chamada"].sel')?.textContent.trim(), campos: document.querySelectorAll('[data-acao="campo-chamada"]').length}`)
    ok("E chamada nova com 2 caixinhas", novos.chip === "Fumaça t17" && novos.campos === 2, JSON.stringify(novos))
    await clicar("editar", sel('[data-acao="editar-chamada"]'))
    await clicar("Canto", `[...document.querySelectorAll('[data-acao="posicao-chamada"]')].find(b=>b.textContent.trim()==="Canto")`)
    await clicar("Salvar", sel('[data-acao="salvar-chamada"]'))
    const canto = await j.ev(`const o=get(S.overlays); const id=Object.keys(o).find(k=>o[k].name==="Fumaça t17"); return o[id]?.items?.[0]?.style || ""`)
    ok("E posição Canto muda a caixa", canto.includes("top:40px") && canto.includes("left:1200px"), canto)
    await clicar("editar", sel('[data-acao="editar-chamada"]'))
    await clicar("Apagar", sel('[data-acao="apagar-chamada"]'))
    await clicar("Apagar (confirmar)", sel('[data-acao="apagar-chamada-sim"]'))
    ok("E Apagar tira o chip e a sobreposição", await j.ev(`const o=get(S.overlays); return !Object.values(o).some(x=>x.name==="Fumaça t17") && !document.querySelector('[data-acao="chip-chamada"].sel')?.textContent.includes("Fumaça")`))

    // F
    await j.ev(`S.templates.update(a=>{a.zz_t17={name:"zz t17",category:null,items:[{type:"text",style:"top:100px;left:100px;width:800px;height:200px;",lines:[{align:"",text:[{value:"Agora: ",style:"font-size:80px;"}]}]}]}; return a})
        S.activeEdit.set({type:"template",id:"zz_t17",items:[]}); T.trocarTela("edit","segmentado"); await esp(1500); return 1`)
    await j.ev(`S.popupData.set({obj:{contextElem:document.querySelector(".editItem")}, caret:{line:0,pos:7}}); S.activePopup.set("dynamic_values"); await esp(600); return 1`)
    ok("F janela em português no lugar do popup", await j.ev(`return !!document.querySelector('[data-acao="valores-dinamicos"]') && get(S.activePopup)===null`))
    await clicar("cartão Hora", `[...document.querySelectorAll('[data-acao="valor-pt"]')].find(e=>e.textContent.includes("Hora (19:30)"))`)
    const texto = await j.ev(`return get(S.templates).zz_t17.items[0].lines[0].text.map(t=>t.value).join("")`)
    ok("F Hora entrou no cursor e a janela fechou", texto === "Agora: {time_hours}:{time_minutes}" && (await j.ev(`return !document.querySelector('[data-acao="valores-dinamicos"]')`)), texto)
    await j.ev(`S.popupData.set({obj:{contextElem:document.querySelector(".editItem")}, caret:{line:0,pos:0}}); S.activePopup.set("dynamic_values"); await esp(500); return 1`)
    await clicar("Todos os códigos", sel('[data-acao="valores-codigos"]'))
    ok("F avançado abre o popup original", (await j.ev(`return get(S.activePopup)`)) === "dynamic_values")
    await j.ev(`S.activePopup.set(null); await esp(300); return 1`)

    // H (opcional)
    if (process.env.FS_LONGO) {
        await j.ev(`MODO("culto"); await esp(600); return 1`)
        await clicar("chip Kids", chip("Kids"))
        // voltar do Editar remonta o painel: o numero digitado antes nao fica
        await clicar("campo Número", sel('[data-acao="campo-chamada"]'))
        await digitar("9")
        await j.ev(`const s=document.querySelector('[data-acao="duracao-chamada"]'); s.value=s.options[0].value; s.dispatchEvent(new Event("change",{bubbles:true})); return 1`)
        await clicar("Chamar no telão (30 s)", sel('[data-acao="chamar"]'))
        ok("H no ar", (await noAr("Kids")) > 0)
        await esperar(32000)
        ok("H saiu sozinha em 30 s", (await noAr("Kids")) === 0 && (await j.ev(`return !document.querySelector('[data-acao="chamada-no-ar"]')`)))
    }
} catch (e) {
    ok("sem exceção", false, String(e?.stack || e))
} finally {
    // G
    await j
        .ev(
            `const o=get(S.overlays); for (const [id,x] of Object.entries(o)) if (x.aliancaChamada) { const A=await import(U("utils/aliancaChamadas")); A.tirarChamada(id) }
        S.overlays.update(a=>{ for (const k of Object.keys(a)) if (a[k].name==="Fumaça t17") delete a[k]; return a })
        S.templates.update(a=>{ delete a.zz_t17; return a }); S.activePopup.set(null)
        const C=await import(U("components/output/clear")); C.clearSlide(); MODO("culto"); await esp(500); return 1`
        )
        .catch(() => {})
    const sobrou = await j.ev(`const ids=Object.keys(get(S.overlays)).filter(k=>get(S.overlays)[k].aliancaChamada); return Object.values(get(S.outputs)).some(x=>(x.out?.overlays||[]).some(i=>ids.includes(i)))`).catch(() => true)
    ok("G nenhuma chamada no ar no fim", !sobrou)
    await j.enviar("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
    console.log(falhas.length ? `\nT17: ${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nT17: tudo ok")
    process.exit(falhas.length ? 1 : 0)
}
