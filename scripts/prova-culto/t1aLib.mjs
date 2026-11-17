// Ferramentas comuns dos testes CDP da 1a (t1a-*.mjs). Cliques e teclas REAIS (Input.dispatch*), nunca force. Nada escreve no Sirvo.
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"
import { PREPARAR_SAIDA } from "./saidaLib.mjs"

export { abrir, clicarEm, esperar, localizar, tecla, PREPARAR_SAIDA }
export const ID_SHOW = "impulso_aos_teus_pes"

export function relato(nome) {
    const falhas = []
    return {
        ok(passo, cond, detalhe = "") {
            console.log(`${cond ? "ok   " : "FALHA"} ${passo}${cond ? "" : "  <- " + detalhe}`)
            if (!cond) falhas.push(`${passo}: ${detalhe}`)
            return cond
        },
        fim() {
            if (falhas.length) {
                console.error(`\n${nome}: ${falhas.length} passo(s) falharam:\n  - ${falhas.join("\n  - ")}`)
                process.exit(1)
            }
            console.log(`\n${nome}: verde`)
        }
    }
}

export const BOTAO_DO_MODO = (nome) => `[...document.querySelectorAll(".top.panel button")].find(b=>b.innerText.trim()===${JSON.stringify(nome)} && b.closest(".modo"))`

/** clique REAL no seletor Culto | Preparar */
export async function irParaModo(j, nome) {
    const b = await localizar(j, BOTAO_DO_MODO(nome))
    if (!b.ok) throw new Error("botao do modo " + nome + ": " + b.motivo)
    await clicarEm(j, b.x, b.y)
    await esperar(500)
}

/** show aberto, no Culto, sem popup, gaveta como a prova (so preparo por store, fora de qualquer gesto medido) */
export async function prepararCulto(j) {
    await j.ev(`S.activePopup.set(null); S.modoAlianca.set("culto"); S.editMode.set("default"); S.activeEdit.set({items:[]}); S.drawerOpenedInEdit.set(false);
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([${JSON.stringify(ID_SHOW)}]);
S.activeShow.set({id:${JSON.stringify(ID_SHOW)},type:"show"}); S.activePage.set("show"); S.drawer.set({height:300,stored:null}); S.activeDrawerTab.set("shows"); document.activeElement?.blur?.(); await esp(900); return 1`)
}

/** recarrega o app (a faixa de falha e o estado da sessao somem) */
export async function recarregar(j) {
    await j.avaliar("location.reload(); return 1").catch(() => {})
    await esperar(2000)
    for (let t = 0; t < 60 && !(await j.avaliar('return !!document.querySelector(".top.panel")').catch(() => false)); t++) await esperar(1000)
    await esperar(2500)
}

/** conta escritas em `outputs` e chamadas de canal OUTPUT/STAGE (a partir de agora) */
export async function instalarContagem(j) {
    await j.ev(`if(!window.__t1a){ window.__t1a={out:0,canais:[]}; let primeiro=true; S.outputs.subscribe(()=>{ if(primeiro){primeiro=false;return} window.__t1a.out++ })
const ant=globalThis.__gravarIPC; globalThis.__gravarIPC=(id,canal,dados)=>{ const k=String(id)+":"+String(canal); if(/OUTPUT|STAGE/.test(k)) window.__t1a.canais.push(k); ant?.(id,canal,dados) } } window.__t1a.out=0; window.__t1a.canais=[]; return 1`)
}
export const lerContagem = (j) => j.ev(`return {out:window.__t1a.out, canais:[...window.__t1a.canais]}`)

/** liga a saida de verdade (janelinha no canto, ver saidaLib) por clique real no botao do Culto */
export async function ligarSaidaNoCulto(j) {
    await j.ev(PREPARAR_SAIDA)
    await prepararCulto(j)
    const b = await localizar(j, `document.querySelector("#output_window_button")`)
    if (!b.ok) throw new Error("botao da saida: " + b.motivo)
    await clicarEm(j, b.x, b.y)
    for (let t = 0; t < 30 && !(await j.ev(`return !!get(S.outputDisplay)`)); t++) await esperar(200)
    if (!(await j.ev(`return !!get(S.outputDisplay)`))) throw new Error("a saida nao ligou")
    await esperar(1200)
}

/** desliga a saida pelo botao do Culto (dois cliques: o 2o entre 1 s e 1,8 s do 1o) */
export async function desligarSaidaNoCulto(j) {
    if (!(await j.ev(`return !!get(S.outputDisplay)`))) return
    await j.ev(`S.modoAlianca.set("culto"); S.activePage.set("show"); await esp(500); return 1`)
    const b = await localizar(j, `document.querySelector("#output_window_button")`)
    await clicarEm(j, b.x, b.y)
    await esperar(1100)
    const b2 = await localizar(j, `document.querySelector("#output_window_button")`)
    await clicarEm(j, b2.x, b2.y)
    for (let t = 0; t < 30 && (await j.ev(`return !!get(S.outputDisplay)`)); t++) await esperar(200)
    await esperar(1000)
}

/** injeta "o roteiro mudou" (2 linhas) e 2 mensagens de chat nao lidas do culto seguido */
export async function injetarChips(j) {
    await j.ev(`const A=await import(U("utils/aliancaSirvo")); const C=await import(U("utils/aliancaSirvoChat"));
A.sirvoAvisos.set({linhas:[{chave:"a",texto:"Musica trocada"},{chave:"b",texto:"Bloco novo"}],anteriores:false,desde:Date.now()});
A.sirvo.update(s=>({...s,cultoId:"cteste"}));
C.sirvoChat.update(e=>({...e,cultoId:"cteste",ligado:true,congelado:false,naoLidas:2,mensagens:[]})); await esp(400); return 1`)
}
