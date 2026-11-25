// Apagar modelo (André, 25/nov: "temos como apagar modelos? isso tava faltando"). Editar > Modelos: × no cartao (ou botao direito) confirma no proprio
// cartao e apaga; Ctrl+Z traz de volta; modelo em uso (Visual, estilo, Biblia padrao...) NAO apaga e diz onde. Miniatura na proporcao do telao.
// Contra o Show de dev (CDP), perfil de prova. Cliques REAIS.
//   node scripts/prova-culto/t20-apagar-modelo.mjs
import { writeFileSync } from "node:fs"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await esperar(600)
const clicar = async (nome, expr) => {
    const l = await localizar(j, expr)
    ok("clique: " + nome, l.ok, l.motivo)
    if (l.ok) await clicarEm(j, l.x, l.y)
    await esperar(400)
    return l
}
async function direito(expr) {
    const l = await localizar(j, expr)
    ok("botao direito: achou o alvo", l.ok, l.motivo)
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: l.x, y: l.y })
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: l.x, y: l.y, button: "right", clickCount: 1 })
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: l.x, y: l.y, button: "right", clickCount: 1 })
    await esperar(400)
}
const existe = (id) => j.ev(`return !!get(S.templates)[${JSON.stringify(id)}]`)
const cartao = (id) => `document.querySelector('[data-modelo="${id}"]')`
const xDo = (id) => `document.querySelector('[data-modelo="${id}"]')?.parentElement.querySelector('[data-acao="modelo-apagar"]')`
let novo = ""

try {
    await j.ev(`const E=await import(U("utils/aliancaEditarEstado")); MODO("preparar"); await esp(600); E.modoDoEditar.set("modelos"); E.categoriaDosModelos.set("todos"); await esp(800); return 1`)
    ok("lista de modelos aberta", await j.ev(`return !!document.querySelector('[data-acao="modelos-grade"]')`))

    // A: cria um modelo (clique real no ＋ Modelo) e apaga pelo ×
    const antes = await j.ev(`return Object.keys(get(S.templates))`)
    await clicar("＋ Modelo", `document.querySelector('[data-acao="modelos-novo"]')`)
    await esperar(600)
    novo = await j.ev(`const a=${JSON.stringify(antes)}; return Object.keys(get(S.templates)).find(k=>!a.includes(k))||""`)
    ok("A o ＋ Modelo criou um modelo e ele esta aberto no editor", !!novo && (await j.ev(`return get(S.activeEdit).id`)) === novo, novo)
    await clicar("× do modelo novo", xDo(novo))
    ok("A o × pede confirmacao no cartao (nada apagado ainda)", (await j.ev(`return !!document.querySelector('[data-acao="modelo-apagar-confirma"]')`)) && (await existe(novo)))
    await clicar("Apagar", `document.querySelector('[data-acao="modelo-apagar-sim"]')`)
    await esperar(500)
    ok("A apagou: sumiu da lista e dos modelos; o editor fechou", !(await existe(novo)) && !(await j.ev(`return !!${cartao(novo)}`)) && (await j.ev(`return get(S.activeEdit).id||""`)) !== novo)

    // B: Ctrl+Z traz de volta
    await j.ev(`document.activeElement?.blur?.(); return 1`)
    await tecla(j, "z", { ctrl: true })
    await esperar(700)
    ok("B Ctrl+Z traz o modelo de volta", await existe(novo))

    // C: botao direito no cartao pede confirmacao; Nao cancela; sem o menu do FreeShow
    await direito(cartao(novo))
    ok("C botao direito pede confirmacao e nao abre o menu do FreeShow", (await j.ev(`return !!document.querySelector('[data-acao="modelo-apagar-confirma"]')`)) && !(await j.ev(`return !!document.querySelector('.contextMenu')`)))
    await clicar("Nao", `document.querySelector('[data-acao="modelo-apagar-confirma"] .nao')`)
    ok("C Nao cancela", (await existe(novo)) && !(await j.ev(`return !!document.querySelector('[data-acao="modelo-apagar-confirma"]')`)))

    // D: modelo em uso nao apaga
    const emUso = await j.ev(`const L=await import(U("utils/aliancaModelosLogica")); const V=await import(U("utils/aliancaVisualLogica"))
        const ctx={visuais:V.lerVisuais(get(S.special)), estilos:get(S.styles), modelos:get(S.templates), bibliaPadrao:get(S.scriptureSettings)?.template, categoriasDeMusica:get(S.categories)}
        return Object.keys(get(S.templates)).find(id=>L.usosDoModelo(id,ctx).length && document.querySelector('[data-modelo="'+id+'"]'))||""`)
    if (emUso) {
        await clicar("× do modelo em uso", xDo(emUso))
        const txt = await j.ev(`const e=document.querySelector('[data-acao="modelo-em-uso"]'); return e?e.innerText.split(String.fromCharCode(10)).join(" "):""`)
        ok("D modelo em uso: diz onde e nao apaga", /Em uso:/.test(txt) && (await existe(emUso)) && !(await j.ev(`return !!document.querySelector('[data-acao="modelo-apagar-sim"]')`)), txt)
        await clicar("Ok", `document.querySelector('[data-acao="modelo-em-uso"] .nao')`)
    } else ok("D o perfil tem um modelo em uso visivel na lista", false)

    // E: a miniatura segue a proporcao do telao (a mesma do editor)
    const r = await j.ev(`const O=await import(U("components/helpers/output")); const E=await import(U("utils/aliancaSaidaDoEditorLogica")); const res=O.getResolution(null,null,false,E.saidaDoEditor(get(S.outputs)))
        const m=document.querySelector('[data-modelo] .mini').getBoundingClientRect(); return {esperado:+(res.width/res.height).toFixed(2), mini:+(m.width/m.height).toFixed(2)}`)
    ok("E miniatura na proporcao do telao", Math.abs(r.esperado - r.mini) < 0.05, JSON.stringify(r))
    const d = await j.enviar("Page.captureScreenshot", { format: "png" })
    if (process.argv[2] && d?.result?.data) writeFileSync(process.argv[2], Buffer.from(d.result.data, "base64"))
} catch (e) {
    ok("sem excecao", false, String(e?.stack || e))
} finally {
    if (novo) await j.ev(`S.templates.update(a=>{delete a[${JSON.stringify(novo)}]; return a}); return 1`).catch(() => {})
    await j.ev(`const E=await import(U("utils/aliancaEditarEstado")); E.modoDoEditar.set("slides"); S.activeEdit.set({items:[]}); MODO("culto"); return 1`).catch(() => {})
    await j.enviar("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
    console.log(falhas.length ? `\nT20: ${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nT20: tudo ok")
    process.exit(falhas.length ? 1 : 0)
}
