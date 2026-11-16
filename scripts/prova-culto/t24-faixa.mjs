// H1 (fatia R3): a faixa de falha nao empurra, nao intercepta, nao engole toque, e persiste. Sem efeito no produto.
//
//   FS_PERFIL_DIR=... bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh   (app limpo, perfil de prova)
//   node scripts/prova-culto/t24-faixa.mjs          (sai com 1 em qualquer falha, imprimindo o passo; depois, restaurar.sh de novo)
//
// Cliques e teclas sao REAIS (Input.dispatch*), nunca force. O app e o de dev com o perfil de prova; nada aqui escreve no Sirvo.
import { abrir, clicarEm, esperar, localizar, RAIZ } from "./lib.mjs"
import { VARREDURA } from "./aparencia/fva-lib.mjs"

const ID_SHOW = "impulso_aos_teus_pes"
const falhas = []
const ok = (passo, cond, detalhe = "") => {
    console.log(`${cond ? "ok   " : "FALHA"} ${passo}${cond ? "" : "  <- " + detalhe}`)
    if (!cond) falhas.push(`${passo}: ${detalhe}`)
    return cond
}

const j = await abrir("principal")
const ACENDE = `const f=await import(U("utils/aliancaFalha")); f.falhaAlta("teste-cdp", new Error("x")); return 1`
const FAIXA = `document.querySelector(".faixaFalha")`
const ABA = (t) => `[...document.querySelectorAll("button.tab")].find(b=>b.innerText.trim()===${JSON.stringify(t)})`

async function recarregar() {
    await j.avaliar("location.reload(); return 1").catch(() => {})
    await esperar(2000)
    for (let t = 0; t < 60 && !(await j.avaliar('return !!document.querySelector("button.tab")').catch(() => false)); t++) await esperar(1000)
    await esperar(1500)
}
// comeca sempre de um app sem faixa (uma rodada anterior deixa a faixa na tela ate o app fechar)
await recarregar()

// ---------------------------------------------------------------- 1. rects: a faixa nao muda nenhum outro elemento
await j.ev(`S.activePopup.set(null); S.modoAlianca.set("culto"); S.editMode.set("default"); S.activeEdit.set({items:[]}); S.drawerOpenedInEdit.set(false);
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([${JSON.stringify(ID_SHOW)}]);
S.activeShow.set({id:${JSON.stringify(ID_SHOW)},type:"show"}); S.activePage.set("show"); S.drawer.set({height:300,stored:null}); S.activeDrawerTab.set("shows"); document.activeElement?.blur?.(); await esp(900); return 1`)
const slide0 = await localizar(j, `document.querySelectorAll("#showArea .slide")[0]`)
ok("1.0 o 1o slide da grade existe e esta livre para o clique", slide0.ok, slide0.motivo)
if (slide0.ok) await clicarEm(j, slide0.x, slide0.y)
await esperar(900)
const noAr = await j.ev(`return !!Object.values(get(S.outputs)).some(o=>o?.out?.slide)`)
ok("1.1 um slide esta no ar no app de prova", noAr, "nenhum slide no ar")

const RETS = `const r=(e)=>{const b=e&&e.getBoundingClientRect(); return b&&[b.x,b.y,b.width,b.height].map(v=>Math.round(v*100)/100)}; return JSON.stringify({slide:r(document.querySelectorAll("#showArea .slide")[0]), saida:r(document.querySelector("#output_window_button")), aba:r([...document.querySelectorAll("button.tab")].find(b=>b.innerText.trim()==="Mídia"))})`
const varrer = async () => JSON.parse(await j.ev(VARREDURA)).els
const antes = await varrer()
const retsAntes = await j.ev(RETS)
await j.ev(ACENDE)
await esperar(300)
const aposEls = await varrer()
const retsDepois = await j.ev(RETS)
const dentro = (e) => e.tag.includes("faixaFalha")
const semFaixa = aposEls.filter((e) => !dentro(e))
ok("1.2 a faixa apareceu", aposEls.some(dentro) && !antes.some(dentro), "sem .faixaFalha depois de falhaAlta")
ok("1.3 o mesmo numero de elementos (fora da faixa)", semFaixa.length === antes.length, `${antes.length} antes, ${semFaixa.length} depois`)
const difs = []
for (let i = 0; i < Math.min(antes.length, semFaixa.length); i++) if (JSON.stringify(antes[i].rect) !== JSON.stringify(semFaixa[i].rect)) difs.push(`${antes[i].tag} ${JSON.stringify(antes[i].rect)} -> ${JSON.stringify(semFaixa[i].rect)}`)
ok("1.4 todo rect igual, par a par", difs.length === 0, `${difs.length} diferem; 1o: ${difs[0]}`)
ok("1.5 getBoundingClientRect igual: 1o slide, #output_window_button, aba da gaveta", retsAntes === retsDepois && !retsAntes.includes("null"), `${retsAntes} -> ${retsDepois}`)

// ---------------------------------------------------------------- 2. nao intercepta
const alvo = await j.ev(`const f=${FAIXA}; const r=f.getBoundingClientRect(); const t=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); const cs=getComputedStyle(f); return {topo:t?t.tagName+"."+String(t.className).slice(0,40):null, ehFaixa:t===f||f.contains(t), pos:cs.position, pe:cs.pointerEvents, filhos:f.children.length}`)
ok("2.1 elementFromPoint no centro da faixa nao devolve a faixa nem filho", !alvo.ehFaixa, `devolveu ${alvo.topo}`)
ok("2.2 position fixed e pointer-events none", alvo.pos === "fixed" && alvo.pe === "none", `position=${alvo.pos} pointerEvents=${alvo.pe}`)
ok("2.3 sem filho interativo", alvo.filhos === 0, `${alvo.filhos} filhos`)

// ---------------------------------------------------------------- 3. toque duplo com a faixa nascendo no meio
await recarregar()
ok("3.0 o app recarregou sem a faixa", (await j.ev(`return !${FAIXA}`)) === true, "a faixa sobreviveu ao reload")
await j.ev(`S.modoAlianca.set("culto"); S.activePage.set("show"); await esp(400); return 1`)
await j.ev(`window.__t24={out:0,ipc:0,canais:[]}; let primeiro=true; S.outputs.subscribe(()=>{ if(primeiro){primeiro=false;return} window.__t24.out++ })
const ant=globalThis.__gravarIPC; globalThis.__gravarIPC=(id,canal,dados)=>{ const k=String(id)+":"+String(canal); if(/OUTPUT/.test(k)) { window.__t24.ipc++; window.__t24.canais.push(k) }; ant?.(id,canal,dados) }; return 1`)
// o app que acabou de recarregar ainda termina a propria partida (cria as saidas, ajusta valores): so conta o que vem DEPOIS de 4 s de repouso
await esperar(4000)
const partida = await j.ev(`const p={out:window.__t24.out, canais:[...new Set(window.__t24.canais)]}; window.__t24.out=0; window.__t24.ipc=0; window.__t24.canais=[]; return p`)
console.log(`     (partida do app, descartada: ${partida.out} escritas em outputs, canais ${partida.canais.join(", ") || "nenhum"})`)
const aba = await localizar(j, ABA("Áudio"))
ok("3.1 a aba Áudio esta livre para o clique", aba.ok, aba.motivo)
if (aba.ok) {
    await clicarEm(j, aba.x, aba.y)
    await j.ev(ACENDE)
    await esperar(120)
    await clicarEm(j, aba.x, aba.y) // 2o clique na MESMA coordenada, 120 ms depois, com a faixa ja na tela
    await esperar(600)
    const r = await j.ev(`return {out:window.__t24.out, ipc:window.__t24.ipc, canais:window.__t24.canais, aba:get(S.activeDrawerTab), faixa:!!${FAIXA}}`)
    ok("3.2 faixa na tela no 2o clique", r.faixa, "faixa ausente")
    ok("3.3 zero escritas novas em outputs", r.out === 0, `${r.out} escritas`)
    ok("3.4 zero canal OUTPUT novo", r.ipc === 0, `${r.ipc} chamadas de canal OUTPUT: ${[...new Set(r.canais)].join(", ")}`)
    ok("3.5 a aba clicada ficou ativa", r.aba === "audio", `aba ativa = ${r.aba}`)
}

// ---------------------------------------------------------------- 5. operavel com a faixa na tela (antes do passo 4, que espera 30 s)
// o reload tirou o show ativo (sem show o Editar do topo fica desabilitado): abre de novo SEM mexer em outputs
await j.ev(`const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([${JSON.stringify(ID_SHOW)}]); S.activeShow.set({id:${JSON.stringify(ID_SHOW)},type:"show"}); S.activePage.set("show"); await esp(700); return 1`)
// o `Editar` da navegacao de paginas (titulo "Editando [2]"); o #edit de 25 px no alto da janela e regiao de arrastar e nao recebe clique
const editar = await localizar(j, `[...document.querySelectorAll("button")].find(b=>b.innerText.trim()==="Editar" && (b.getAttribute("data-title")||"").startsWith("Editando"))`)
ok("5.1 o botao Editar do topo esta livre (a faixa nao o cobre)", editar.ok, editar.motivo)
if (editar.ok) {
    await clicarEm(j, editar.x, editar.y)
    await esperar(700)
    ok("5.2 clique real em Editar troca a pagina para edit com a faixa na tela", (await j.ev(`return get(S.activePage)`)) === "edit", "a pagina nao mudou")
    await j.ev(`S.activePage.set("show"); await esp(300); return 1`)
}

// ---------------------------------------------------------------- 4. persistente e so na principal
await esperar(Number(process.env.T24_ESPERA || 30000))
ok("4.1 a faixa continua 30 s depois", (await j.ev(`return !!${FAIXA}`)) === true, "a faixa sumiu")
const saida = await abrir("saida")
ok("4.2 na janela de saida nao existe .faixaFalha", (await saida.ev(`return document.querySelector(".faixaFalha")`)) === null, "a saida tem faixa")
saida.fechar()
j.fechar()

if (falhas.length) {
    console.error(`\nt24-faixa: ${falhas.length} passo(s) falharam:\n  - ${falhas.join("\n  - ")}`)
    process.exit(1)
}
console.log("\nt24-faixa: verde")
