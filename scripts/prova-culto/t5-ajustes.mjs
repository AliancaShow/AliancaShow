// Ajustes do teste 1 do Andre (feat/layout-v2-4), contra o Show de dev (CDP, FS_CDP_PORTA). Cliques e teclas REAIS, nunca force.
//   node scripts/prova-culto/t5-ajustes.mjs <pasta-de-prints>
//   A. o X de limpar tudo limpa com UM clique; "Voltar o que foi limpo" volta; indisponivel diz o motivo (nada limpo / saida travada)
//   B. a seta da pilula do telao e visivel (>= 28 px de area de clique) e abre o menu
//   C. resultado da busca da biblioteca: ＋ roteiro e ▶ (entra no roteiro e manda o 1o slide ao ar; travada recusa; toque repetido nao duplica)
//   D. Configuracoes: Salvar confirma; Fechar volta a Mostrar, e a Editar quando veio de Editar
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const saida = process.argv[2] || "prints-ajustes"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")
const dom = (expr) => j.ev(`return ${expr}`)
const clique = async (expr) => { const a = await localizar(j, expr); if (!a.ok) throw new Error("alvo: " + a.motivo + " :: " + expr); await clicarEm(j, a.x, a.y, 1); return a }
async function print(nome) {
    await esperar(700)
    const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
    writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
    console.log("print", nome)
}
const noAr = () => j.ev(`return get(S.outputs).default?.out?.slide ? get(S.outputs).default.out.slide.id + "#" + get(S.outputs).default.out.slide.index : null`)
const itemMenu = (i) => `document.querySelector('[data-acao="telao-menu-pop"] [data-item="${i}"]')`

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); S.outLocked.set(false); T.trocarTela("show","segmentado"); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); S.outputCache.set(null)
const p=get(S.projects); const alvo=Object.entries(p).find(([k,v])=>(v.shows||[]).some(s=>(s.type===undefined||s.type==="show")))
S.activeProject.set(alvo[0]); const i=alvo[1].shows.findIndex(s=>(s.type===undefined||s.type==="show"))
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([alvo[1].shows[i].id])
S.activeShow.set({id:alvo[1].shows[i].id,index:i,type:"show"}); S.activeDrawerTab.set("shows"); await esp(1200); return 1`)

    // ---------- A + B
    { const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[1]`); await clicarEm(j, a.x, a.y) }
    await esperar(600)
    ok("A0 slide no ar antes do X", (await noAr()) !== null, String(await noAr()))
    ok("A1 o X tem a dica 'Limpar tudo (Esc)'", await dom(`document.querySelector('[data-camada=tudo]')?.dataset.title==="Limpar tudo (Esc)"`))
    await clique(`document.querySelector('[data-camada=tudo]')`)
    await esperar(500)
    ok("A2 UM clique no X limpa tudo", (await noAr()) === null, String(await noAr()))
    await esperar(1300)
    const seta = await dom(`JSON.stringify((()=>{const r=document.querySelector('[data-acao=telao-menu]').getBoundingClientRect(); return {w:r.width,h:r.height}})())`)
    const { w, h } = JSON.parse(seta)
    ok("B1 a seta tem area de clique >= 28 px", w >= 28 && h >= 28, seta)
    await clique(`document.querySelector('[data-acao=telao-menu]')`)
    await esperar(300)
    ok("A3 item se chama 'Voltar o que foi limpo' e esta disponivel", await dom(`${itemMenu("restaurar")}?.innerText.includes("Voltar o que foi limpo") && ${itemMenu("restaurar")}?.getAttribute("aria-disabled")==="false"`))
    await print("pilula-menu-aberto-1920")
    await clique(itemMenu("restaurar"))
    await esperar(700)
    ok("A4 clicar em 'Voltar o que foi limpo' traz o slide de volta", (await noAr()) !== null, String(await noAr()))
    // indisponivel: nada limpo / travada
    await j.ev(`S.outputCache.set(null); return 1`)
    await clique(`document.querySelector('[data-acao=telao-menu]')`)
    await esperar(300)
    ok("A5 sem cache diz 'Nada foi limpo ainda.'", await dom(`${itemMenu("restaurar")}?.innerText.includes("Nada foi limpo ainda.")`), await dom(`${itemMenu("restaurar")}?.innerText`))
    await print("pilula-menu-nada-limpo-1920")
    await j.ev(`S.outLocked.set(true); return 1`)
    await esperar(300)
    ok("A6 travada: diz que a saida esta travada", await dom(`${itemMenu("restaurar")}?.innerText.includes("travada")`), await dom(`${itemMenu("restaurar")}?.innerText`))
    ok("A7 'Destravar saida' segue no menu", await dom(`${itemMenu("travar")}?.innerText.includes("Destravar saída")`))
    await j.ev(`S.outLocked.set(false); return 1`)
    await tecla(j, "Escape")
    await esperar(900)
    await j.ev(`S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); return 1`)

    // ---------- C
    // um show COM slides que ainda nao esta no roteiro (a regra do ▶ nao poe duas vezes o mesmo)
    const TERMO = await dom(`(()=>{const ids=new Set(get(S.projects)[get(S.activeProject)].shows.map(s=>s.id)); const o=Object.entries(get(S.shows)).find(([id,s])=>!ids.has(id) && s.name && !/bondade/i.test(s.name) && /^impulso_/.test(id)); return o ? o[1].name : null})()`)
    console.log("termo da busca:", TERMO)
    await j.ev(`S.activeDrawerTab.set("shows"); return 1`)
    await clique(`document.querySelector('[data-regiao="biblioteca"] input.busca')`)
    await j.enviar("Input.insertText", { text: TERMO })
    await esperar(1500)
    const linhas = await dom(`document.querySelectorAll('[data-regiao="biblioteca"] .conteudo .linha').length`)
    ok("C1 a busca achou resultado", linhas >= 1, String(linhas))
    ok("C2 cada resultado tem ＋ roteiro e ▶", await dom(`[...document.querySelectorAll('[data-regiao="biblioteca"] .conteudo .linha')].every(l=>l.querySelector('.mais') && l.querySelector('[data-acao=biblioteca-tocar]'))`))
    await print("busca-mais-e-tocar-1920")
    const antes = await dom(`get(S.projects)[get(S.activeProject)].shows.length`)
    const id1 = await dom(`document.querySelector('[data-regiao="biblioteca"] .conteudo .linha').dataset.show`)
    const a = await localizar(j, `document.querySelector('[data-regiao="biblioteca"] .conteudo .linha [data-acao=biblioteca-tocar]')`)
    await j.ev(`S.outLocked.set(true); return 1`)
    await clicarEm(j, a.x, a.y)
    await esperar(600)
    ok("C3 saida travada: o ▶ nao manda ao ar nem poe no roteiro", (await noAr()) === null && (await dom(`get(S.projects)[get(S.activeProject)].shows.length`)) === antes, String(await noAr()))
    await j.ev(`S.outLocked.set(false); return 1`)
    await esperar(1000)
    await clicarEm(j, a.x, a.y)
    await clicarEm(j, a.x, a.y)
    await esperar(1200)
    const depois = await dom(`get(S.projects)[get(S.activeProject)].shows.length`)
    const no = await noAr()
    ok("C4 ▶ poe o show no roteiro (uma vez, mesmo com toque duplo) e manda o 1o slide ao ar", depois === antes + 1 && no && no.startsWith(id1 + "#"), `roteiro ${antes}->${depois} noAr=${no}`)
    await print("busca-tocar-no-ar-1920")
    await j.ev(`S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); return 1`)

    // ---------- D
    for (const origem of ["show", "edit"]) {
        await j.ev(`T.trocarTela("${origem}","segmentado"); S.activePopup.set(null); return 1`)
        await esperar(900)
        await clique(`document.querySelector('[data-acao=menu-app]')`)
        await esperar(250)
        await clique(`document.querySelector('[role=menuitem][data-item="settings"]')`)
        await esperar(900)
        ok(`D1(${origem}) Configuracoes tem Salvar e Fechar no cabecalho`, await dom(`!!document.querySelector('[data-acao=pagina-cabecalho] [data-acao=pagina-salvar]') && !!document.querySelector('[data-acao=pagina-cabecalho] [data-acao=pagina-fechar]')`))
        if (origem === "show") {
            await clique(`document.querySelector('[data-acao=pagina-salvar]')`)
            await esperar(1500)
            const av = await dom(`document.querySelector('[data-acao=pagina-aviso]')?.innerText`)
            ok("D2 Salvar confirma em texto", /Salvo|Salvando/.test(av || ""), av)
            await print("configuracoes-salvar-fechar-1920")
        }
        await clique(`document.querySelector('[data-acao=pagina-fechar]')`)
        await esperar(900)
        ok(`D3(${origem}) Fechar volta a ${origem === "show" ? "Mostrar" : "Editar"}`, (await dom(`get(S.activePage)`)) === origem, await dom(`get(S.activePage)`))
    }
} catch (e) {
    console.log("FALHA excecao", e.message)
    falhas.push("excecao")
} finally {
    await j.ev(`S.outLocked.set(false); S.activePopup.set(null); T.trocarTela("show","segmentado"); return 1`).catch(() => {})
}
console.log(falhas.length ? "FALHAS: " + falhas.join(" | ") : "tudo verde")
process.exit(falhas.length ? 1 : 0)
