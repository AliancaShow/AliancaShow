// Percorre os estados e grava varredura+print em <dir>/<prefixo><estado>
import { abrir, abrirShow, esperar, clicarSel, clicarEm, mover, caixa, guardar, botaoTexto, ID } from "./fva-lib.mjs"
const [, , dir, pref = ""] = process.argv
const j = await abrir()
let gravar = false
const g = async (n) => {
    await esperar(900)
    if (gravar) {
        await guardar(j, dir, pref + n)
        console.log("ok", n)
    }
}
const noAr = async (i) => {
    await j.ev(`const sh=get(S.showsCache)["${ID}"]; O.setOutput("slide",{id:"${ID}",layout:sh.settings.activeLayout,index:${i},projectIndex:0}); return 1`)
    await esperar(900)
}
const limpar = () => j.ev(`S.outputs.update(a=>{a.default.out={};return a}); S.activePopup.set(null); return 1`)
const escape = async () => {
    await j.enviar("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
    await j.enviar("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
    await esperar(400)
}

if (process.env.TEMA) {
    await j.ev(`const {defaultThemes}=await import(U("components/settings/tabs/defaultThemes")); const {updateThemeValues}=await import(U("utils/updateSettings")); S.themes.update(t=>({...defaultThemes,...t})); S.theme.set(${JSON.stringify(process.env.TEMA)}); updateThemeValues(get(S.themes)[${JSON.stringify(process.env.TEMA)}]); return 1`)
    await esperar(800)
}
async function sequencia() {
    await j.ev(`S.activePopup.set(null); S.focusMode.set(false); S.editMode.set("default"); S.activeEdit.set({items:[]}); S.activePage.set("show"); S.modoAlianca.set("culto"); return 1`)
    await esperar(500)
    await abrirShow(j, ID, 0, "culto", true)
    await j.ev(`S.activePage.set("show"); return 1`)
    await esperar(800)
    await mover(j, 5, 5)
    await g("01-culto-parado")
    await noAr(1)
    await g("02-culto-no-ar")
    // hover num slide e num item da lista de cultos
    const s3 = await caixa(j, `document.querySelectorAll("#slides .main, .slides .main")[2] || document.querySelectorAll(".main")[3]`)
    await mover(j, s3.x, s3.y)
    await g("03-hover-slide")
    // menu de contexto (botao direito real)
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: s3.x, y: s3.y, button: "right", clickCount: 1 })
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: s3.x, y: s3.y, button: "right", clickCount: 1 })
    await g("04-menu-contexto")
    await escape()
    await j.ev(`S.activePage.set("show"); return 1`)
    await mover(j, 5, 5)
    // abas da gaveta (cliques reais no texto exato dentro do menu da biblioteca)
    for (const [t, n] of [
        ["Mídia", "05-gaveta-midia"],
        ["Áudio", "06-gaveta-audio"],
        ["Bíblia", "07-gaveta-biblia"],
        ["Shows", "08-gaveta-shows"]
    ]) {
        await botaoTexto(j, "button.tab", t)
        await mover(j, 5, 5)
        await g(n)
    }
    // Configuracoes (engrenagem do cabecalho)
    await clicarSel(j, `document.querySelector('.top button[data-title^="Configurações"]')`, "config")
    await g("09-config")
    await limpar()
    await j.ev(`S.activePage.set("show"); return 1`)
    await esperar(300)
    // pagina de edicao
    await abrirShow(j, ID, 1, "culto", false)
    await j.ev(`S.activePage.set("edit"); return 1`)
    await mover(j, 5, 5)
    await g("10-culto-editor")
    await j.ev(`S.activePage.set("show"); return 1`)
    // Preparar
    await j.ev(`S.modoAlianca.set("preparar"); return 1`)
    await esperar(1200)
    await mover(j, 5, 5)
    await g("11-preparar")
    await j.ev(`S.activePage.set("edit"); return 1`)
    await g("12-preparar-editor")
    await j.ev(`S.activePage.set("show"); return 1`)
    // ida e volta
    await j.ev(`S.modoAlianca.set("culto"); return 1`)
    await g("13-culto-depois-da-volta")
    await limpar()
}
await sequencia()
gravar = true
await sequencia()
j.fechar()
