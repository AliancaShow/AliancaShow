// Ferramentas comuns da prova do Culto: pre-ambulo dos modulos Vite, entrada REAL (mouse e teclado), repouso.
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { janela } from "./cdp.mjs"

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
    .split(String.fromCharCode(92))
    .join("/")
// pasta do app SERVIDO pela Vite (FS_REPO, quando o portao de aparencia mede a referencia); os scripts continuam sendo os deste repo
export const RAIZ_APP = (process.env.FS_REPO ? resolve(process.env.FS_REPO) : RAIZ).split(String.fromCharCode(92)).join("/")
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// Os modulos do app sao os MESMOS que a janela usa (a URL do recurso ja carregado), por isso embrulhar `set`/`update` pega as chamadas reais.
export const PRE = `
const BASE=${JSON.stringify("http://localhost:3000/@fs/" + RAIZ_APP + "/src/frontend/")}
const U=(n)=>{const e=performance.getEntriesByType("resource").map(r=>r.name).filter(x=>x.includes("/src/frontend/"+n+".ts")); return e[e.length-1]||(BASE+n+".ts")}
const S=await import(U("stores")); const get=(s)=>{let x;s.subscribe(v=>x=v)();return x}
// fatia 2: a tela e a porta (utils/aliancaTela.ts). MODO/MODOATUAL mantem o vocabulario dos roteiros: culto = Mostrar, preparar = Editar
const T=await import(U("utils/aliancaTela"))
const MODO=(m)=>T.trocarTela(m==="preparar"?"edit":"show","segmentado")
const MODOATUAL=()=>get(T.tela)==="editar"?"preparar":"culto"
const esp=(ms)=>new Promise(r=>setTimeout(r,ms))
`

/**
 * `buffer: true` (as fumacas): o buffer de recursos padrao (250) estoura com os modulos do app e `U()` nao acha mais o URL do modulo em uso. O ajuste e injetado AQUI,
 * por CDP, antes de a pagina carregar (nunca no public/index.html, que a janela de saida e a producao tambem carregam). Recarrega a janela UMA vez: chame no inicio do roteiro.
 */
export async function abrir(qual = "principal", { buffer = false } = {}) {
    const j = await janela(qual)
    if (buffer) {
        await j.enviar("Page.enable")
        await j.enviar("Page.addScriptToEvaluateOnNewDocument", { source: "performance.setResourceTimingBufferSize(4000)" })
        await j.enviar("Page.reload")
        await esperar(2500)
        for (let t = 0; t < 60; t++) {
            const pronta = await j.avaliar("return document.readyState === 'complete' && !!document.body && document.body.children.length > 0").catch(() => false)
            if (pronta) break
            await esperar(1000)
        }
        await esperar(3000)
    }
    j.ev = (corpo) => j.avaliar(PRE + corpo)
    return j
}

const VK = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, PageDown: 34, PageUp: 33, Home: 36, End: 35, Escape: 27, Enter: 13, " ": 32, ".": 190, Tab: 9, Backspace: 8, Delete: 46 }
for (let i = 1; i <= 12; i++) VK["F" + i] = 111 + i

/** tecla REAL (rawKeyDown + keyUp), com modificadores */
export async function tecla(j, key, mods = {}) {
    const m = (mods.alt ? 1 : 0) | (mods.ctrl ? 2 : 0) | (mods.meta ? 4 : 0) | (mods.shift ? 8 : 0)
    const vk = VK[key] ?? key.toUpperCase().charCodeAt(0)
    const printable = key.length === 1 && !mods.ctrl && !mods.alt
    const code = key.length === 1 && /[a-z]/i.test(key) ? "Key" + key.toUpperCase() : key.length === 1 && /\d/.test(key) ? "Digit" + key : key
    const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: m }
    await j.enviar("Input.dispatchKeyEvent", { type: printable ? "keyDown" : "rawKeyDown", ...base, ...(printable ? { text: key } : {}) })
    await j.enviar("Input.dispatchKeyEvent", { type: "keyUp", ...base })
}

export async function mover(j, x, y) {
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
}
/** clique REAL na coordenada (nunca force) */
export async function clicarEm(j, x, y, count = 1) {
    await mover(j, x, y)
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: count })
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: count })
}

/**
 * Acha o alvo, rola ate ele e confere que o elemento sob o cursor E o alvo (ou dentro dele). Devolve { ok, motivo, x, y }.
 * `expr` e uma expressao JS que devolve o elemento.
 */
export async function localizar(j, expr) {
    return j.ev(
        `const e=(${expr}); if(!e) return {ok:false,motivo:"alvo nao existe"}; e.scrollIntoView({block:"center",inline:"center"}); await esp(300); const r=e.getBoundingClientRect(); if(r.width<1||r.height<1) return {ok:false,motivo:"alvo sem tamanho"}; const x=r.x+r.width/2,y=r.y+r.height/2; const topo=document.elementFromPoint(x,y); const dentro=!!topo&&(topo===e||e.contains(topo)); return {ok:dentro,motivo:dentro?"":"coberto por <"+(topo?topo.tagName+"."+String(topo.className).slice(0,40):"nada")+">",x,y}`
    )
}

/** cabine-5: a raiz da Midia e a BIBLIOTECA (nao le mais as pastas do disco). As fumacas que clicam f1/v1 na raiz importam os dois para a raiz antes.
 *  Usa a chave que o `media` ja tem (o perfil grava "C:/..." com barra). */
export const BIB_RAIZ = `const _B=await import(U("utils/aliancaBibliotecaMidia")); const _r=Object.values(get(S.mediaFolders))[0].path; _B.importarCaminhos([_r+"/f1.png", _r+"/v1.mp4"], null); await esp(400);`
