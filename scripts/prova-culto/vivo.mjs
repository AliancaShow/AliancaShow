// Fumaca da tela nova (leiaute v2, fatia 1): "o app vive". Roda contra o Show de dev (CDP, FS_CDP_PORTA) sobre o perfil da Prova.
//   1. abre um culto e um show PELO ROTEIRO (clique na linha) e ve a grade de slides no centro;
//   2. manda um slide ao ar pelo clique e a seta para a direita muda `outputs` (a tecla do telao vive);
//   3. F1 limpa o fundo e Esc limpa tudo;
//   4. Configuracoes abre pelo menu do app e volta pelo segmentado Mostrar.
// Sai com 1 se algum passo falhar. Nunca liga a saida e nunca usa click({force:true}).
import { abrir, clicarEm, esperar, tecla } from "./lib.mjs"

const falhas = []
const ok = (nome, cond, extra = "") => {
    console.log(`${cond ? "ok " : "FALHA"} ${nome}${extra ? " :: " + extra : ""}`)
    if (!cond) falhas.push(nome)
}

const j = await abrir("principal")
try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1105, deviceScaleFactor: 1, mobile: false })
    // 1. um culto com show: a lista so existe com projeto aberto; abre pelo store (o seletor tem a propria prova) e o show pelo clique na linha
    await j.ev(`
const p=get(S.projects); const alvo=Object.entries(p).find(([k,v])=>(v.shows||[]).some(s=>(s.type===undefined||s.type==="show")))
if(!alvo) throw new Error("perfil sem projeto com show")
S.activePage.set("show"); S.activeProject.set(alvo[0]); await esp(600)`)
    const linhas = await j.avaliar(`return document.querySelectorAll('[data-acao="lista-roteiro"] button.item').length`)
    ok("roteiro mostra itens", linhas > 0, String(linhas))
    await j.avaliar(`document.querySelector('[data-acao="lista-roteiro"] button.item').click(); await new Promise(r=>setTimeout(r,900))`)
    const cards = await j.avaliar(`return document.querySelectorAll('[data-acao="grade-slides"] .grid > *').length`)
    ok("grade de slides no centro", cards > 0, String(cards))

    // 2. ao ar pelo clique e seta
    const antes = await j.ev(`return JSON.stringify(Object.values(get(S.outputs)).map(o=>o.out?.slide?.index ?? null))`)
    const r = JSON.parse(await j.avaliar(`const b=document.querySelector('[data-acao="grade-slides"] .grid > *').getBoundingClientRect(); return JSON.stringify({x:b.left+b.width/2,y:b.top+b.height/2})`))
    await clicarEm(j, r.x, r.y)
    await esperar(600)
    await j.ev(`document.activeElement?.blur?.()`)
    const noAr = await j.ev(`return JSON.stringify(Object.values(get(S.outputs)).map(o=>o.out?.slide?.index ?? null))`)
    ok("clique no slide muda outputs", noAr !== antes, `${antes} -> ${noAr}`)
    await tecla(j, "ArrowRight")
    await esperar(500)
    const seta = await j.ev(`return JSON.stringify(Object.values(get(S.outputs)).map(o=>o.out?.slide?.index ?? null))`)
    ok("seta para a direita muda outputs", seta !== noAr, `${noAr} -> ${seta}`)

    // 3. F1 e Esc
    await tecla(j, "F1")
    await esperar(300)
    await tecla(j, "Escape")
    await esperar(500)
    const limpo = await j.ev(`return !Object.values(get(S.outputs)).some(o=>o.out?.slide)`)
    ok("Esc limpa tudo", limpo)

    // 4. Configuracoes pelo menu do app e volta pelo segmentado
    await j.avaliar(`document.querySelector('[data-acao="menu-app"]').click(); await new Promise(r=>setTimeout(r,300)); document.querySelector('[data-item="settings"]').click(); await new Promise(r=>setTimeout(r,700))`)
    ok("Configuracoes abre", await j.avaliar(`return document.querySelector('[data-regiao="corpo-pagina"]')?.dataset.pagina === "settings"`))
    await j.avaliar(`document.querySelector('[data-aba="mostrar"]').click(); await new Promise(r=>setTimeout(r,800))`)
    ok("volta a Mostrar", await j.avaliar(`return !document.querySelector('[data-regiao="corpo-pagina"]') && !!document.querySelector('[data-regiao="roteiro"]')`))
    const f = await j.ev(`const F=await import(U("utils/aliancaFalha")); return get(F.falhas).length`)
    ok("rodada limpa: falhas vazias", f === 0, String(f))
} finally {
    j.fechar()
}
process.exit(falhas.length ? 1 : 0)
