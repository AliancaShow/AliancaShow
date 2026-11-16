// Percorre os 13 estados (ESTADOS_APARENCIA) e grava varredura+print em <dir>/<prefixo><estado>.{json,png} e <dir>/<prefixo>cabecalho.json
//   node fva-estados.mjs <dir> <prefixo>
// Antes de guardar cada estado espera ESTABILIDADE (duas varreduras seguidas iguais, a 400 ms, e todo img carregado; teto de 8 s: estourar sai com 1).
// FS_MUTAR_APARENCIA=desloca-topo injeta `.top button{margin-left:1px}` antes da 2a sequencia (mutacao de prova do portao).
// FS_REPO = pasta servida (para gravar o SHA do commit no cabecalho); padrao: este repositorio.
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { abrir, abrirShow, esperar, clicarSel, clicarEm, mover as moverMouse, caixa, guardar, botaoTexto, ID, VARREDURA } from "./fva-lib.mjs"
import { ESTADOS_APARENCIA } from "./fvaLogica.mjs"
const [, , dir, pref = ""] = process.argv
const N = Object.fromEntries(ESTADOS_APARENCIA.map((e) => [e.slice(0, 2), e]))
const j = await abrir()
// o hover do Chromium so e recalculado com movimento do mouse: cada estado gravado repete o ultimo movimento (mesma posicao) antes da espera
// de estabilidade, senao um :hover (barra de menus em 5,5, overlay do slide) aparece ou some conforme o timing do render (A/A medida)
let ultimoMouse = { x: 5, y: 5 }
const mover = async (jj, x, y) => {
    ultimoMouse = { x, y }
    await moverMouse(jj, x, y)
}
let gravar = false
const TETO_ESTAVEL_MS = 8000
const assinatura = async () => {
    const v = JSON.parse(await j.ev(VARREDURA))
    const imgs = await j.ev(`return [...document.images].every(i=>i.complete)`)
    return { chave: JSON.stringify(v.els.map((e) => [e.sig, e.rect, e.cor, e.est, e.ff])), imgs }
}
async function estavel(nome) {
    const t0 = Date.now()
    let anterior = await assinatura()
    while (Date.now() - t0 < TETO_ESTAVEL_MS) {
        await esperar(400)
        const atual = await assinatura()
        if (atual.chave === anterior.chave && atual.imgs && anterior.imgs) return
        anterior = atual
    }
    console.error(`INSTAVEL: o estado ${nome} nao estabilizou em ${TETO_ESTAVEL_MS} ms`)
    process.exit(1)
}
const g = async (n) => {
    if (gravar) {
        await moverMouse(j, ultimoMouse.x, ultimoMouse.y)
        await esperar(400)
        await estavel(n)
        await guardar(j, dir, pref + n)
        console.log("ok", n)
    } else await esperar(900)
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
    await g(N["01"])
    await noAr(1)
    await g(N["02"])
    // hover num slide e num item da lista de cultos
    const s3 = await caixa(j, `document.querySelectorAll("#slides .main, .slides .main")[2] || document.querySelectorAll(".main")[3]`)
    await mover(j, s3.x, s3.y)
    await g(N["03"])
    // menu de contexto (botao direito real)
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: s3.x, y: s3.y, button: "right", clickCount: 1 })
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: s3.x, y: s3.y, button: "right", clickCount: 1 })
    // o mouse volta ao slide: sem isto o hover do slide (overlay) as vezes nao esta registrado no quadro do print (A/A: head-1 x head-2, opacity 0 x 1)
    await mover(j, s3.x, s3.y)
    await g(N["04"])
    await escape()
    await j.ev(`S.activePage.set("show"); return 1`)
    await mover(j, 5, 5)
    // abas da gaveta (cliques reais no texto exato dentro do menu da biblioteca)
    for (const [t, n] of [
        ["Mídia", N["05"]],
        ["Áudio", N["06"]],
        ["Bíblia", N["07"]],
        ["Shows", N["08"]]
    ]) {
        await botaoTexto(j, "button.tab", t)
        await mover(j, 5, 5)
        await g(n)
    }
    // Configuracoes (engrenagem do cabecalho)
    await clicarSel(j, `document.querySelector('.top button[data-title^="Configurações"]')`, "config")
    await g(N["09"])
    await limpar()
    await j.ev(`S.activePage.set("show"); return 1`)
    await esperar(300)
    // pagina de edicao
    await abrirShow(j, ID, 1, "culto", false)
    await j.ev(`S.activePage.set("edit"); return 1`)
    await mover(j, 5, 5)
    await g(N["10"])
    await j.ev(`S.activePage.set("show"); return 1`)
    // Preparar
    await j.ev(`S.modoAlianca.set("preparar"); return 1`)
    await esperar(1200)
    await mover(j, 5, 5)
    await g(N["11"])
    await j.ev(`S.activePage.set("edit"); return 1`)
    await g(N["12"])
    await j.ev(`S.activePage.set("show"); return 1`)
    // ida e volta
    await j.ev(`S.modoAlianca.set("culto"); return 1`)
    await g(N["13"])
    await limpar()
}
await sequencia()
gravar = true
if (process.env.FS_MUTAR_APARENCIA === "desloca-topo") {
    await j.ev(`const s=document.createElement("style"); s.id="__mut_aparencia"; s.textContent=".top button{margin-left:1px}"; document.head.appendChild(s); return 1`)
    console.log("mutacao: desloca-topo")
}
await sequencia()
let commit = "?"
try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.env.FS_REPO || process.cwd(), encoding: "utf8" }).trim()
} catch {}
const outputDisplay = await j.ev(`return !!get(S.outputDisplay)`)
writeFileSync(`${dir}/${pref}cabecalho.json`, JSON.stringify({ outputDisplay, commit, mutacao: process.env.FS_MUTAR_APARENCIA || null }))
console.log("cabecalho", JSON.stringify({ outputDisplay, commit }))
j.fechar()
