// Teste de reinicio (T2): o que se faz com gaveta e colunas no PREPARAR nao pode chegar ao Culto, nem na memoria nem no disco.
//
//   FS_PERFIL_DIR=... node scripts/prova-culto/reinicio.mjs <fase> [--saida arq.json]
//     fase "antes":  (app aberto em Culto) fixa gaveta 300 e colunas 290/290, salva (Ctrl+S real) e guarda o settings.json inteiro (H0).
//     fase "preparar": clica Preparar (real), Esc, Ctrl+T, arrasta a coluna esquerda, troca de aba, mexe no filtro da F7, salva (Ctrl+S) e
//                      guarda o settings.json inteiro (H1). Compara H1 com H0 e LISTA toda chave que diferir.
//     fase "fechar": fecha o app pelo caminho do dia a dia (Browser.close apos Ctrl+S; matar o processo nao prova nada).
//     fase "depois": (app reaberto) le o Culto: gaveta, colunas, aba; guarda o settings.json inteiro apos salvar (H2) e compara com H0.
// Quem orquestra (reiniciar.sh entre "fechar" e "depois") e o chamador; os arquivos vao para --saida (JSON).
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla, RAIZ } from "./lib.mjs"
import { PORTA } from "./cdp.mjs"

const fase = process.argv[2]
const iS = process.argv.indexOf("--saida")
const SAIDA = iS > 0 ? process.argv[iS + 1] : join(RAIZ, "scripts/prova-culto/gravacoes/reinicio.json")
const PERFIL = (process.env.FS_PERFIL_DIR || join(RAIZ, "../prova-perfil")).split(String.fromCharCode(92)).join("/")
const SETTINGS = join(PERFIL, "store/settings.json")
const lerEstado = () => (existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, "utf8")) : {})
const gravarEstado = (e) => writeFileSync(SAIDA, JSON.stringify(e, null, 1))
const settings = () => JSON.parse(readFileSync(SETTINGS, "utf8"))

/** chaves de primeiro nivel que diferem, com o que mudou (ignora a carimbos de tempo do proprio salvamento) */
function diferencas(a, b) {
    const r = {}
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) r[k] = { antes: a[k], depois: b[k] }
    return r
}
async function salvar(j) {
    await tecla(j, "s", { ctrl: true })
    await esperar(1800)
}

const j = fase === "fechar" ? null : await abrir("principal")
const e = lerEstado()

if (fase === "antes") {
    await j.ev(`MODO("culto"); T.trocarTela("show", "segmentado"); S.drawer.set({height:300,stored:null}); S.resized.update(a=>({...a,leftPanel:290,rightPanel:290,leftPanelDrawer:290,rightPanelDrawer:290})); S.activeDrawerTab.set("shows"); await esp(800)`)
    await salvar(j)
    e.H0 = settings()
    e.culto0 = await j.ev(`return {drawer:get(S.drawer.culto||S.drawer), resized:get(S.resized.culto||S.resized), aba:get(S.activeDrawerTab.culto||S.activeDrawerTab)}`)
    console.log("H0 gravado", JSON.stringify(e.culto0))
}
if (fase === "preparar") {
    const clicar = async (expr) => {
        const l = await localizar(j, expr)
        if (!l.ok) throw new Error("alvo: " + l.motivo)
        await clicarEm(j, l.x, l.y)
        await esperar(500)
    }
    await clicar(`[...document.querySelectorAll(".modo button")].find(b=>b.innerText.trim()==="Preparar")`)
    await esperar(800)
    const passos = {}
    // aba da gaveta (Ctrl+2, tecla real) e filtro da F7 (clique real) com a gaveta ABERTA; so depois Esc, Ctrl+T e o arrasto da coluna
    await tecla(j, "2", { ctrl: true })
    await esperar(600)
    passos.depoisAba = await j.ev(`return {aba:get(S.activeDrawerTab), culto:get(S.activeDrawerTab.culto||S.activeDrawerTab)}`)
    // filtro da F7 (so existe com a aba Midia aberta): clique real no chip de filtro, se achar
    const chip = await localizar(j, `[...document.querySelectorAll("button")].find(b=>["Vídeo","Video","Foto"].includes(b.innerText.trim()) && b.closest(".drawer, #leftPanelDrawer, section"))`).catch(() => ({ ok: false }))
    if (chip.ok) await clicarEm(j, chip.x, chip.y)
    await esperar(500)
    passos.depoisFiltro = { clicou: !!chip.ok, ...(await j.ev(`return {midia:get(S.drawerTabsData).media, culto:(get(S.drawerTabsData.culto||S.drawerTabsData)).media}`)) }
    await tecla(j, "Escape")
    await esperar(600)
    passos.depoisEsc = await j.ev(`return {drawer:get(S.drawer), culto:get(S.drawer.culto||S.drawer)}`)
    await tecla(j, "t", { ctrl: true })
    await esperar(600)
    passos.depoisCtrlT = await j.ev(`return {resized:get(S.resized), culto:get(S.resized.culto||S.resized)}`)
    // coluna esquerda: arrasta o divisor com o mouse (mouse real)
    const d = await j.ev(`const e=document.querySelector("#leftPanel"); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.right-2,y:r.y+r.height/2}`)
    if (d) {
        await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: d.x, y: d.y })
        await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: d.x, y: d.y, button: "left", clickCount: 1 })
        for (const dx of [20, 60, 90]) await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: d.x + dx, y: d.y, button: "left" })
        await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: d.x + 90, y: d.y, button: "left", clickCount: 1 })
        await esperar(500)
    }
    passos.depoisArrasto = { arrastou: !!d, ...(await j.ev(`return {resized:get(S.resized), culto:get(S.resized.culto||S.resized)}`)) }
    await salvar(j)
    e.preparar = passos
    e.H1 = settings()
    e.dif_H1_H0 = diferencas(e.H0, e.H1)
    console.log("chaves que mudaram no disco apos a visita ao Preparar:", Object.keys(e.dif_H1_H0))
}
if (fase === "fechar") {
    // caminho do dia a dia: o salvamento ja foi feito (Ctrl+S) e o app fecha pelo proprio navegador, sem matar processo
    const ver = await (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).json()
    const ws = new WebSocket(ver.webSocketDebuggerUrl)
    await new Promise((r) => ws.addEventListener("open", r))
    ws.send(JSON.stringify({ id: 1, method: "Browser.close" }))
    await esperar(4000)
    console.log("Browser.close enviado")
}
if (fase === "depois") {
    await esperar(2000)
    e.culto2 = await j.ev(`return {modo:MODOATUAL(), drawer:get(S.drawer.culto||S.drawer), resized:get(S.resized.culto||S.resized), aba:get(S.activeDrawerTab.culto||S.activeDrawerTab)}`)
    await salvar(j)
    e.H2 = settings()
    e.dif_H2_H0 = diferencas(e.H0, e.H2)
    // entra no Preparar de novo: ele nasce igual ao Culto (semente), gaveta como a do Culto
    await j.ev(`MODO("preparar"); await esp(600)`)
    e.preparar2 = await j.ev(`return {drawer:get(S.drawer), resized:get(S.resized)}`)
    console.log("Culto depois de reabrir:", JSON.stringify(e.culto2))
    console.log("chaves que diferem de H0 depois de reabrir:", Object.keys(e.dif_H2_H0))
}
if (j) j.fechar()
gravarEstado(e)
process.exit(0)
