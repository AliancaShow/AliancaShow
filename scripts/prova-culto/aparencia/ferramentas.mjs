// Compat para os scripts de aparencia (os 13 estados da FV-A): as mesmas funcoes que a8lib/f4lib davam, sobre ../lib.mjs.
import { PRE, RAIZ, abrir as abrirBase, clicarEm, esperar, mover, tecla } from "../lib.mjs"
export { clicarEm, esperar, mover, tecla }
const PRE_APARENCIA = PRE + `const M=await import(U("utils/aliancaModo")); const O=await import(U("components/helpers/output"))\n`
export async function abrir() {
    const j = await abrirBase("principal")
    j.ev = (c) => j.avaliar(PRE_APARENCIA + c)
    return j
}
export async function caixa(j, expr) {
    return j.ev(`const e=(${expr}); if(!e) return null; e.scrollIntoView({block:"center"}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width}`)
}
export async function clicarSel(j, expr, desc, count = 1) {
    const c = await caixa(j, expr)
    if (!c) throw new Error("nao achei: " + (desc || expr))
    await clicarEm(j, c.x, c.y, count)
    await esperar(300)
    return c
}
// abre um show no editor (navegacao por store; as interacoes do teste sao reais)
export async function abrirShow(j, id, slide = 0, modo = "culto", limpar = true) {
    await j.ev(`S.activePopup.set(null); MODO("culto"); S.editMode.set("default"); ${limpar ? "S.outputs.update(a=>{a.default.out={};return a});" : ""} const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([${JSON.stringify(id)}]); S.activeShow.set({id:${JSON.stringify(id)},type:"show"}); T.trocarTela("edit", "segmentado"); S.activeEdit.set({slide:${slide},items:[],showId:${JSON.stringify(id)}}); S.modoAlianca.set(${JSON.stringify(modo)}); return 1`)
    await esperar(1500)
}
export { RAIZ }
