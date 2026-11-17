// T-1b-1, 2, 10, 12 e 13 (1b, D7/D8): a moldura da barra do Preparar de verdade. Cliques e teclas REAIS, nunca force. Nada escreve no Sirvo.
//   FS_PERFIL_DIR=... bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh ; node scripts/prova-culto/t1b-moldura.mjs ; restaurar.sh
// Prints (PNG) em ../prints-1b/ quando T1B_PRINTS=1.
import { mkdirSync } from "node:fs"
import { abrir, clicarEm, esperar, instalarContagem, irParaModo, lerContagem, localizar, prepararCulto, recarregar, relato, tecla } from "./t1aLib.mjs"

const r = relato("t1b-moldura")
const PRINTS = process.env.T1B_PRINTS === "1" ? "../prints-1b" : null
if (PRINTS) mkdirSync(PRINTS, { recursive: true })
const j = await abrir("principal")
await recarregar(j)
await prepararCulto(j)
await irParaModo(j, "Preparar")
await esperar(500)
await instalarContagem(j)

const pagina = () => j.ev(`return get(S.activePage)`)
const barra = () =>
    j.ev(`const b=document.querySelector(".prepararBarra"); if(!b) return null; const t=(s)=>{const e=b.querySelector(s); return e?e.innerText.trim():null}
return { moldura:b.dataset.moldura, voltar:t(".voltar"), titulo:t(".titulo"), crumb:t(".crumb"), desfazer:!!b.querySelector(".desfazer"), desfazerDesab:b.querySelector(".desfazer")?.disabled??null, pronto:!!b.querySelector(".prontoBotao"), pilula:!!b.querySelector(".pilula, .aviso"), novo:!!b.querySelector(".alianca-novo"), menu:!!b.querySelector(".menuBotao"), relogio:!!b.querySelector(".relogio"), altura:Math.round(document.querySelector(".top.panel").getBoundingClientRect().height) }`)
const clicar = async (expr, nome) => {
    const b = await localizar(j, expr)
    if (!b.ok) throw new Error(nome + ": " + b.motivo)
    await clicarEm(j, b.x, b.y)
    await esperar(500)
}
const VOLTAR = `document.querySelector(".prepararBarra .voltar")`
const MENU = `document.querySelector(".prepararBarra .menuBotao")`
const ITEM = (n) => `document.querySelector('[role=menuitem][data-item="${n}"]')`
// o 1o "Editar" da tela e o da barra de menus do app (y 0): o do show tem o titulo "Editar os slides..."
const EDITAR = `[...document.querySelectorAll("button")].find(b=>b.innerText.trim()==="Editar" && (b.title||b.dataset.title||"").startsWith("Editar os slides"))`
const PALCO = `[...document.querySelectorAll("button")].find(b=>b.innerText.includes("Monitor de retorno"))`
const foto = async (nome) => PRINTS && (await j.foto(`${PRINTS}/${nome}.png`))
const nenhumaFalha = async () => (await j.ev(`const F=await import(U("utils/aliancaFalha")); return get(F.falhas).length`)) === 0

// ---------------------------------------------------------------- T-1b-1: moldura em cada pagina
let b = await barra()
r.ok("T-1b-1.0 show: barra de culto (pilula, + Novo, menu, relogio), sem Voltar", b?.moldura === "show" && b.pilula && b.novo && b.menu && b.relogio && !b.voltar && b.altura === 54, JSON.stringify(b))

// edit (Editar do cabecalho do show)
await clicar(EDITAR, "botao Editar")
b = await barra()
r.ok("T-1b-1.1 edit: Voltar ao culto, crumb, Desfazer, Pronto, menu e relogio; sem pilula nem + Novo", (await pagina()) === "edit" && b?.moldura === "editor" && b.voltar === "← Voltar ao culto" && /^(Música|Apresentação) · .+ · (slide \d+ de \d+|sem slides)$/.test(b.crumb || "") && b.desfazer && b.pronto && b.menu && b.relogio && !b.pilula && !b.novo && b.altura === 54, JSON.stringify(b))
await foto("1b-editor-crumb")
await clicar(VOLTAR, "Voltar do editor")
r.ok("T-1b-1.2 Voltar do editor volta a show com a pilula", (await pagina()) === "show" && (await barra())?.pilula === true, JSON.stringify(await barra()))

// settings (menu ⋯ > Configuracoes)
await clicar(MENU, "menu")
await clicar(ITEM("config"), "item Configuracoes")
b = await barra()
r.ok("T-1b-1.3 settings: Voltar, titulo Configuracoes, menu e relogio", (await pagina()) === "settings" && b?.moldura === "pagina" && b.voltar === "← Voltar" && b.titulo === "Configurações" && b.menu && b.relogio && !b.pilula && !b.novo, JSON.stringify(b))
await foto("1b-configuracoes-voltar")

// stage (botao Palco dentro de Configuracoes)
r.ok("T-1b-1.4 Configuracoes tem o botao Palco (so no Preparar)", (await j.ev(`return !!(${PALCO})`)) === true, "sem botao")
await clicar(PALCO, "botao Palco")
b = await barra()
r.ok("T-1b-1.5 stage pelo botao Palco: Voltar, titulo Monitor de retorno", (await pagina()) === "stage" && b?.moldura === "pagina" && b.voltar === "← Voltar" && b.titulo === "Monitor de retorno", JSON.stringify(b))
await foto("1b-palco-em-configuracoes")
await clicar(VOLTAR, "Voltar do Palco")
r.ok("T-1b-1.6 Voltar do Palco volta a Configuracoes (paginaAnterior)", (await pagina()) === "settings", await pagina())
await clicar(VOLTAR, "Voltar de Configuracoes")
r.ok("T-1b-1.7 Voltar de Configuracoes volta a show (barra de culto)", (await pagina()) === "show" && (await barra())?.moldura === "show", await pagina())

// stage pela busca (Ctrl+G, "Palco", Enter)
await tecla(j, "g", { ctrl: true })
await esperar(400)
await j.enviar("Input.insertText", { text: "Palco" })
await esperar(400)
await tecla(j, "Enter")
await esperar(600)
b = await barra()
r.ok("T-1b-1.8 stage pela busca: moldura de pagina com titulo Monitor de retorno", (await pagina()) === "stage" && b?.titulo === "Monitor de retorno" && b.voltar === "← Voltar", JSON.stringify({ p: await pagina(), b }))
await clicar(VOLTAR, "Voltar do Palco (busca)")
r.ok("T-1b-1.9 Voltar do Palco (vindo da busca) volta a show", (await pagina()) === "show", await pagina())

// ---------------------------------------------------------------- T-1b-12: pagina fora da lista (Q14)
await instalarContagem(j)
for (const p of ["calendar", "reflow"]) {
    await j.ev(`S.activePage.set(${JSON.stringify(p)}); return 1`)
    await esperar(60)
    const meio = await barra() // a barra nunca fica vazia, nem no meio do redirecionamento
    await esperar(500)
    const toasts = await j.ev(`return get(S.toastMessages)`)
    r.ok(`T-1b-12 ${p}: volta a show com o toast, a barra nunca ficou vazia, zero outputs`, (await pagina()) === "show" && !!meio && toasts.includes("Essa página não abre no Preparar.") && (await lerContagem(j)).out === 0 && (await nenhumaFalha()), JSON.stringify({ meio, toasts }))
    await j.ev(`S.toastMessages.set([]); return 1`)
}

// ---------------------------------------------------------------- T-1b-3 (parte): entrar no Preparar estando em draw
await irParaModo(j, "Culto")
await j.ev(`S.activePage.set("draw"); await esp(300); return 1`)
await irParaModo(j, "Preparar")
await esperar(500)
r.ok("T-1b-3.x entrar no Preparar estando em draw: volta a show com o toast de Desenhar e Biblia", (await pagina()) === "show" && (await j.ev(`return get(S.toastMessages)`)).includes("Desenhar e Bíblia em tela cheia ficam no Culto."), await pagina())
await foto("1b-toast-desenhar-recusado")
await j.ev(`S.toastMessages.set([]); return 1`)

// ---------------------------------------------------------------- T-1b-10: decisao 9 (Preparar -> Culto)
for (const [de, vai] of [["settings", "show"], ["stage", "show"], ["edit", "edit"]]) {
    await irParaModo(j, "Preparar")
    await j.ev(`S.activePage.set(${JSON.stringify(de)}); await esp(300); return 1`)
    if (de === "edit") await j.ev(`S.activeEdit.set({slide:0,items:[],showId:get(S.activeShow)?.id}); return 1`)
    await irParaModo(j, "Culto")
    r.ok(`T-1b-10 ${de} no Preparar, clique real em Culto: ${vai}`, (await pagina()) === vai, await pagina())
    await j.ev(`S.activePage.set("show"); await esp(200); return 1`)
}
await foto("1b-culto-depois-da-volta")

// ---------------------------------------------------------------- T-1b-13: falha da guarda e visivel (Q13)
await irParaModo(j, "Preparar")
await instalarContagem(j)
await j.ev(`window.__toastOriginal = S.toastMessages.set; let n = 0; S.toastMessages.set = (...a) => { if (n++ === 0) throw new Error("toast quebrado (T-1b-13)"); return window.__toastOriginal(...a) }; S.activePage.set("draw"); await esp(600); return 1`)
const falhas = await j.ev(`const F=await import(U("utils/aliancaFalha")); return get(F.falhas).map(f=>f.origem)`)
r.ok("T-1b-13 a faixa acende com guarda-de-pagina, a pagina ja voltou a show, zero outputs", falhas.includes("guarda-de-pagina") && (await pagina()) === "show" && (await lerContagem(j)).out === 0 && (await j.ev(`return !!document.querySelector(".faixaFalha")`)) === true, JSON.stringify({ falhas, p: await pagina() }))
await j.ev(`S.toastMessages.set = window.__toastOriginal; return 1`)
await clicar(MENU, "menu depois da falha")
r.ok("T-1b-13 o operador continua clicando: clique real em ⋯ abre o menu", (await j.ev(`return !!document.querySelector('.prepararMenu .menu')`)) === true, "menu nao abriu")
await tecla(j, "Escape")
await foto("1b-faixa-de-falha-da-guarda")

j.fechar()
r.fim()
