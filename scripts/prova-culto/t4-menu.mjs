// Fatia 4 (menu do app, paginas e popovers): fumaca com cliques e teclas REAIS (nunca force) contra o Show de dev (CDP, FS_CDP_PORTA) e os prints 1920x1080.
//   node scripts/prova-culto/t4-menu.mjs <pasta-de-prints>
//   A. sem barra de menus nem titulo nativo: o topo comeca em y=0 e nao existe a barra (.menus)
//   B. menu do app: itens exatos (com os de dev), Esc fecha e NAO limpa o telao; Exportar, Historico, Atalhos e Sobre abrem o popup certo; nada escreve em outputs
//   C. Configuracoes pelo menu: cabecalho com o nome e Fechar volta a Mostrar
//   D. popovers de clique (pilula Sirvo, pilula do telao ▾, seletor de culto): abrem so por clique, o Esc fecha cada um e NAO limpa o telao
//   E. vazio do centro: sem link de documentacao do FreeShow e sem versiculo do dia; "Novo show" abre o popup
//   F. a pasta Mixer da arvore de Audio abre o mixer
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-4"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
const dom = (expr) => j.ev(`return ${expr}`)
const clique = async (expr) => { const a = await localizar(j, expr); if (!a.ok) throw new Error("alvo: " + a.motivo + " :: " + expr); await clicarEm(j, a.x, a.y, 1); return a }
async function print(nome) {
    await esperar(700)
    const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
    writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
    console.log("print", nome)
}
const noAr = () => j.ev(`return get(S.outputs).default?.out?.slide?.index ?? null`)
const escritas = () => j.ev(`return JSON.stringify(get(S.outputs))`)

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); T.trocarTela("show","segmentado"); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a})
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows(["impulso_aos_teus_pes"]); S.activeShow.set({id:"impulso_aos_teus_pes",type:"show"}); await esp(900); return 1`)

    // ---------- A
    ok("A1 nao existe barra de menus", await dom(`!document.querySelector(".menus") && !document.querySelector("[id=file]")`))
    ok("A2 o topo comeca em y=0 e a tela ocupa a janela", await dom(`(()=>{const t=document.querySelector('[data-regiao=topo]').getBoundingClientRect(); const e=document.querySelector('.tela').getBoundingClientRect(); return t.top===0 && e.top===0 && Math.round(e.height)===innerHeight})()`))
    ok("A3 o topo e area de arrastar e o que e botao nao (a regiao vale pelo ancestral mais proximo que a declara)", await dom(`(()=>{const reg=(e)=>{for(;e;e=e.parentElement){const v=getComputedStyle(e).webkitAppRegion; if(v!=="none") return v} return "none"}; const q=(s)=>reg(document.querySelector(s)); return getComputedStyle(document.querySelector("[data-regiao=topo]")).webkitAppRegion==="drag" && q("[data-acao=menu-app]")==="no-drag" && q("[data-acao=sirvo]")==="no-drag" && q("[data-acao=segmentado]")==="no-drag" && q("[data-acao=telao]")==="no-drag" && q("[data-acao=telao-menu]")==="no-drag"})()`))

    // slide no ar para provar que Esc dos popovers nao limpa
    { const a = await localizar(j, `document.querySelectorAll("#showArea .slide")[1]`); await clicarEm(j, a.x, a.y) }
    await esperar(600)
    ok("slide no ar antes dos popovers", (await noAr()) !== null, String(await noAr()))
    const base = await escritas()

    // ---------- B
    await clique(`document.querySelector('[data-acao=menu-app]')`)
    await esperar(300)
    const itens = await dom(`JSON.stringify([...document.querySelectorAll('[role=menuitem][data-item]')].map(b=>b.dataset.item))`)
    ok("B1 itens do menu (com os de dev)", itens === JSON.stringify(["settings", "stage", "draw", "save", "undo", "redo", "import", "export", "history", "fullscreen", "shortcuts", "about", "reload", "devtools"]), itens)
    // B1b: clique REAL no vazio do topo (area de arrastar) fecha o menu aberto (a cortina recebe o clique); reabre para o resto da secao
    { const r = await dom(`(()=>{const c=document.querySelector('[data-regiao=topo] .centro').getBoundingClientRect(); return JSON.stringify({x:c.right-24,y:28})})()`); const { x, y } = JSON.parse(r); await clicarEm(j, x, y, 1); await esperar(300) }
    ok("B1b clique no vazio do topo fecha o menu do app", await dom(`!document.querySelector('[role=menu]')`))
    await clique(`document.querySelector('[data-acao=menu-app]')`)
    await esperar(300)
    ok("B1c Salvar, Desfazer e Refazer mostram o atalho ao lado", await dom(`['save','undo','redo'].map(i=>document.querySelector('[data-item='+i+'] .atalho')?.textContent).join()==="Ctrl+S,Ctrl+Z,Ctrl+Y"`))
    await print("M1-menu-do-app-1920")
    await tecla(j, "Escape")
    await esperar(300)
    ok("B2 o Esc fechou o menu e NAO limpou o telao", (await dom(`!document.querySelector('[role=menu]')`)) && (await noAr()) !== null, String(await noAr()))
    for (const [item, popup] of [["export", "export"], ["history", "history"], ["shortcuts", "shortcuts"], ["about", "about"]]) {
        await esperar(800)
        await clique(`document.querySelector('[data-acao=menu-app]')`)
        await esperar(250)
        await clique(`document.querySelector('[role=menuitem][data-item="${item}"]')`)
        await esperar(500)
        ok(`B3 ${item} abre o popup ${popup}`, (await dom(`get(S.activePopup)`)) === popup, String(await dom(`get(S.activePopup)`)))
        await j.ev(`S.activePopup.set(null); return 1`)
    }
    ok("B4 nada do menu escreveu em outputs", (await escritas()) === base)

    // ---------- C
    await esperar(800)
    await clique(`document.querySelector('[data-acao=menu-app]')`)
    await esperar(250)
    await clique(`document.querySelector('[role=menuitem][data-item="settings"]')`)
    await esperar(900)
    ok("C1 Configuracoes abre com o cabecalho", await dom(`document.querySelector('[data-regiao=corpo-pagina]')?.dataset.pagina==="settings" && document.querySelector('[data-acao=pagina-cabecalho] h1')?.innerText==="Configurações"`))
    await print("M2-configuracoes-1920")
    await clique(`document.querySelector('[data-acao=pagina-fechar]')`)
    await esperar(900)
    ok("C2 Fechar volta a Mostrar", (await dom(`get(T.tela)`)) === "mostrar" && (await dom(`!document.querySelector('[data-regiao=corpo-pagina]')`)))
    for (const p of ["stage", "draw"]) {
        await j.ev(`T.trocarTela("${p}","menu-app"); await esp(800); return 1`)
        ok(`C3 pagina ${p} com cabecalho e Fechar`, await dom(`!!document.querySelector('[data-regiao=corpo-pagina] [data-acao=pagina-fechar]')`))
        await clique(`document.querySelector('[data-acao=pagina-fechar]')`)
        await esperar(700)
    }
    ok("C4 as paginas nao escreveram em outputs", (await escritas()) === base)

    // ---------- D
    const popovers = [
        ["pilula Sirvo", `document.querySelector('[data-acao=sirvo]')`, `[data-acao=sirvo-pop]`],
        ["pilula do telao", `document.querySelector('[data-acao=telao-menu]')`, `[data-acao=telao-menu-pop]`],
        ["seletor de culto", `document.querySelector('[data-regiao=roteiro] button.bt.dia')`, `.seletor-pop`]
    ]
    for (const [nome, alvo, pop] of popovers) {
        await esperar(900)
        ok(`D0 ${nome}: fechado ate o clique`, await dom(`!document.querySelector('${pop}')`))
        await clique(alvo)
        await esperar(400)
        const aberto = await dom(`!!document.querySelector('${pop}')`)
        ok(`D1 ${nome}: abre com o clique`, aberto)
        if (nome === "pilula Sirvo") await print("M3-popover-sirvo-1920")
        if (nome === "pilula do telao") await print("M4-popover-telao-1920")
        if (nome === "seletor de culto") await print("M5-popover-culto-1920")
        await tecla(j, "Escape")
        await esperar(350)
        ok(`D2 ${nome}: o Esc fecha e NAO limpa o telao`, (await dom(`!document.querySelector('${pop}')`)) && (await noAr()) !== null, String(await noAr()))
    }
    ok("D3 os popovers nao escreveram em outputs", (await escritas()) === base)

    // ---------- E
    await j.ev(`S.activeShow.set(null); await esp(900); return 1`)
    ok("E1 vazio do centro sem link do FreeShow nem versiculo do dia", await dom(`(()=>{const s=document.querySelector('[data-acao=splash]'); return !!s && !/freeshow|Documenta|votd/i.test(s.innerText) && !s.querySelector('a')})()`), await dom(`document.querySelector('[data-acao=splash]')?.innerText.replace(/\\n/g," | ")`))
    await clique(`document.querySelector('[data-acao=splash-novo-show]')`)
    await esperar(500)
    ok("E2 Novo show abre o popup", (await dom(`get(S.activePopup)`)) === "show", String(await dom(`get(S.activePopup)`)))
    await j.ev(`S.activePopup.set(null); return 1`)

    // ---------- F
    await j.ev(`S.activeDrawerTab.set("audio"); await esp(500); return 1`)
    await clique(`[...document.querySelectorAll('[data-acao=arvore] button')].find(b=>b.innerText.trim()==="Mixer")`)
    await esperar(900)
    ok("F1 Mixer abre o mixer de canais", await dom(`!!document.querySelector('[data-regiao=biblioteca] .mixers')`))
} catch (e) {
    console.log("ERRO", e.message)
    falhas.push("erro: " + e.message)
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\ntudo verde")
process.exit(falhas.length ? 1 : 0)
