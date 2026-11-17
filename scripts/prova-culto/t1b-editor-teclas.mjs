// T-1b-2, 3, 4, 5, 6, 7 e 11 (1b): editor, Desenhar e Biblia, teclas 1 a 6, Esc, Culto alcancavel, undo que pula e segunda camada.
// Cliques e teclas REAIS, nunca force. Nada escreve no Sirvo (o perfil de prova e restaurado ao fim: restaurar.sh).
//   FS_PERFIL_DIR=... bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh ; node scripts/prova-culto/t1b-editor-teclas.mjs ; restaurar.sh
import { abrir, clicarEm, esperar, instalarContagem, irParaModo, lerContagem, localizar, prepararCulto, recarregar, relato, tecla } from "./t1aLib.mjs"

const r = relato("t1b-editor-teclas")
const j = await abrir("principal")
await recarregar(j)
await prepararCulto(j)
await esperar(500)

const pagina = () => j.ev(`return get(S.activePage)`)
const barra = () =>
    j.ev(`const b=document.querySelector(".prepararBarra"); if(!b) return null; const t=(s)=>{const e=b.querySelector(s); return e?e.innerText.trim():null}
return { moldura:b.dataset.moldura, voltar:t(".voltar"), titulo:t(".titulo"), crumb:t(".crumb"), desfazerDesab:b.querySelector(".desfazer")?.disabled??null, pilula:!!b.querySelector(".pilula, .aviso") }`)
const clicar = async (expr, nome) => {
    const b = await localizar(j, expr)
    if (!b.ok) throw new Error(nome + ": " + b.motivo)
    await clicarEm(j, b.x, b.y)
    await esperar(500)
}
const VOLTAR = `document.querySelector(".prepararBarra .voltar")`
const MENU = `document.querySelector(".prepararBarra .menuBotao")`
const ITEM = (n) => `document.querySelector('[role=menuitem][data-item="${n}"]')`
const DESFAZER = `document.querySelector(".prepararBarra .desfazer")`
const PRONTO = `document.querySelector(".prepararBarra .prontoBotao")`
const EDITAR = `[...document.querySelectorAll("button")].find(b=>b.innerText.trim()==="Editar" && (b.title||b.dataset.title||"").startsWith("Editar os slides"))`
const ENTRADA = (pag) => `S.undoHistory.set([{ id: "t1b-sem-efeito", oldData: {}, newData: {}, location: { page: ${JSON.stringify(pag)} } }]); S.redoHistory.set([])`
const nenhumaFalha = async () => (await j.ev(`const F=await import(U("utils/aliancaFalha")); return get(F.falhas).length`)) === 0
// espera o toast anterior sumir sozinho (o timer do Toast.svelte tira o 1o da fila: forcar a lista vazia deixaria o timer velho comer o toast novo)
const limparToasts = async () => {
    for (let t = 0; t < 100 && (await j.ev(`return get(S.toastMessages).length`)) > 0; t++) await esperar(100)
}
const toasts = () => j.ev(`return get(S.toastMessages)`)
// nada vai ao ar: zero escrita em outputs e nenhum canal de saida alem do espelho de dados (PROJECTS/SHOWS) da troca de pagina
const limpo = async () => {
    const c = await lerContagem(j)
    const estranhos = c.canais.filter((k) => !/OUTPUT:(PROJECTS|SHOWS)$/.test(k))
    return { ok: c.out === 0 && estranhos.length === 0, c }
}

// ---------------------------------------------------------------- T-1b-2: editor
await irParaModo(j, "Preparar")
await instalarContagem(j)
await clicar(EDITAR, "Editar")
let b = await barra()
const m1 = /slide (\d+) de (\d+)/.exec(b?.crumb || "")
r.ok("T-1b-2.1 o crumb mostra o slide 1 de N ao abrir o editor", (await pagina()) === "edit" && !!m1 && m1[1] === "1" && Number(m1[2]) > 1, JSON.stringify(b))
const total0 = Number(m1?.[2])
// seleciona o 3o slide da lista do editor por clique real
{
    // os slides da lista do editor sao os `.slide.context` (o resto e a miniatura interna)
    const l = await localizar(j, `[...document.querySelectorAll(".slide")].filter(e=>e.className.includes("context"))[2] || null`)
    if (l.ok) {
        await clicarEm(j, l.x, l.y)
        await esperar(500)
        b = await barra()
        r.ok("T-1b-2.2 o crumb acompanha a selecao (clique real no 3o slide: slide 3 de N)", new RegExp(`slide 3 de ${total0}$`).test(b?.crumb || ""), JSON.stringify(b))
    } else r.ok("T-1b-2.2 o crumb acompanha a selecao (clique real no 3o slide)", false, l.motivo)
}
// cria um slide pelo "Novo slide" do editor
{
    const l = await localizar(j, `[...document.querySelectorAll("button")].find(b=>/Novo slide/.test(b.innerText))`)
    if (l.ok) {
        await clicarEm(j, l.x, l.y)
        await esperar(700)
        b = await barra()
        r.ok("T-1b-2.3 o crumb acompanha a criacao de slide (N+1) e o Desfazer fica habilitado", new RegExp(`de ${total0 + 1}$`).test(b?.crumb || "") && b.desfazerDesab === false, JSON.stringify(b))
    } else r.ok("T-1b-2.3 o crumb acompanha a criacao de slide", false, l.motivo)
}
await clicar(DESFAZER, "Desfazer")
b = await barra()
r.ok("T-1b-2.4 Desfazer desfaz e deixa no editor (N de volta, pagina edit)", (await pagina()) === "edit" && new RegExp(`de ${total0}$`).test(b?.crumb || ""), JSON.stringify(b))
// Pronto nao salva
await j.ev(`window.__salvou = 0; const ant=globalThis.__gravarIPC; globalThis.__gravarIPC=(id,canal,dados)=>{ if(/SAVE/.test(String(canal))) window.__salvou++; ant?.(id,canal,dados) }; window.__savedAntes = get(S.saved); return 1`)
await clicar(PRONTO, "Pronto")
r.ok("T-1b-2.5 Pronto sai para show e NAO salva (saved nao mudou por ele e nenhum canal SAVE)", (await pagina()) === "show" && (await j.ev(`return {s: get(S.saved) === window.__savedAntes, n: window.__salvou}`)).s && (await j.ev(`return window.__salvou`)) === 0, JSON.stringify(await j.ev(`return {saved:get(S.saved), antes:window.__savedAntes, salvou:window.__salvou}`)))
// Voltar do editor (vindo da aba Biblioteca)
await j.ev(`const E=await import(U("utils/aliancaBibliotecaEstado")); E.abaLateral.set("biblioteca"); await esp(400); return 1`)
await clicar(EDITAR, "Editar (biblioteca)")
b = await barra()
r.ok("T-1b-2.6 vindo da aba Biblioteca o rotulo e Voltar a biblioteca", (await pagina()) === "edit" && b?.voltar === "← Voltar à biblioteca", JSON.stringify(b))
await clicar(VOLTAR, "Voltar do editor")
r.ok("T-1b-2.7 Voltar sai para show", (await pagina()) === "show", await pagina())
await j.ev(`const E=await import(U("utils/aliancaBibliotecaEstado")); E.abaLateral.set("culto"); await esp(300); return 1`)
r.ok("T-1b-2.8 nada foi ao ar", (await limpo()).ok, JSON.stringify(await limpo()))

// ---------------------------------------------------------------- T-1b-3: Desenhar e Biblia no Preparar (desfazer e bolinha da nuvem)
for (const alvo of ["draw", "scripture"]) {
    const texto = "Desenhar e Bíblia em tela cheia ficam no Culto."
    // (a) desfazer de uma entrada feita em `alvo`
    await instalarContagem(j)
    await limparToasts()
    await j.ev(`${ENTRADA(alvo)}; S.activePage.set("show"); await esp(300); document.activeElement?.blur?.(); return 1`)
    await tecla(j, "z", { ctrl: true })
    await esperar(600)
    const lim = await limpo()
    r.ok(`T-1b-3 ${alvo} pelo desfazer: volta a show, toast, zero outputs, zero canal DRAW*`, (await pagina()) === "show" && (await toasts()).includes(texto) && lim.ok && (await nenhumaFalha()), JSON.stringify({ p: await pagina(), t: await toasts(), lim }))
    // (b) a bolinha de um usuario da nuvem que esta em `alvo`
    await instalarContagem(j)
    await limparToasts()
    await j.ev(`S.cloudUsers.set([{ displayName: "Teste", color: "#d33", lastUpdate: Date.now(), activePage: ${JSON.stringify(alvo)} }]); await esp(500); return 1`)
    await clicar(`document.querySelector(".users .user")`, "bolinha da nuvem")
    const lim2 = await limpo()
    r.ok(`T-1b-3 ${alvo} pela bolinha da nuvem: volta a show, toast, zero outputs, zero canal DRAW*`, (await pagina()) === "show" && (await toasts()).includes(texto) && lim2.ok && (await nenhumaFalha()), JSON.stringify({ p: await pagina(), t: await toasts(), lim2 }))
    await j.ev(`S.cloudUsers.set([]); return 1`)
}

// ---------------------------------------------------------------- T-1b-7: undo que pula (stage com moldura e Voltar; Ctrl+Y idem)
await limparToasts()
await j.ev(`${ENTRADA("stage")}; S.activePage.set("show"); await esp(300); document.activeElement?.blur?.(); return 1`)
await tecla(j, "z", { ctrl: true })
await esperar(500)
b = await barra()
r.ok("T-1b-7.1 Ctrl+Z com a entrada feita no Palco: cai em stage com a moldura (Voltar, titulo Monitor de retorno)", (await pagina()) === "stage" && b?.moldura === "pagina" && b.titulo === "Monitor de retorno" && b.voltar === "← Voltar", JSON.stringify(b))
await clicar(VOLTAR, "Voltar do Palco")
r.ok("T-1b-7.2 Voltar leva a show", (await pagina()) === "show", await pagina())
await tecla(j, "y", { ctrl: true })
await esperar(500)
b = await barra()
r.ok("T-1b-7.3 Ctrl+Y: cai em stage de novo, com a moldura", (await pagina()) === "stage" && b?.titulo === "Monitor de retorno" && (await nenhumaFalha()), JSON.stringify({ p: await pagina(), b }))
await clicar(VOLTAR, "Voltar do Palco")

// ---------------------------------------------------------------- T-1b-4: teclas 1 a 6 (nos dois modos)
for (const modo of ["preparar", "culto"]) {
    if (modo === "culto") await irParaModo(j, "Culto")
    for (const d of ["1", "2", "3", "4", "5", "6"]) {
        await j.ev(`S.activePage.set("show"); await esp(200); document.activeElement?.blur?.(); return document.activeElement===document.body`)
        await tecla(j, d)
        await esperar(450)
        if ((await pagina()) !== "show") r.ok(`T-1b-4 ${modo}: a tecla ${d} nao troca de pagina`, false, await pagina())
    }
    r.ok(`T-1b-4 ${modo}: as teclas 1 a 6 nao trocaram de pagina`, (await pagina()) === "show", await pagina())
}
// Culto com numberKeys: o digito toca o slide N como antes (e so isso)
await instalarContagem(j)
await j.ev(`S.special.update(s=>({...s, numberKeys:true})); S.activePage.set("show"); await esp(300); document.activeElement?.blur?.(); return 1`)
await tecla(j, "2")
await esperar(900)
r.ok("T-1b-4 Culto com numberKeys: o 2 toca o slide 2 (escreve em outputs) e a pagina nao muda", (await lerContagem(j)).out > 0 && (await pagina()) === "show", JSON.stringify(await lerContagem(j)))
await j.ev(`S.special.update(s=>({...s, numberKeys:false})); S.outputs.update(a=>a); return 1`)
// titulos das abas do Culto sem [N]
{
    const t = await j.ev(`return [...document.querySelectorAll(".top.panel button")].map(b=>b.dataset.title||b.title||"").filter(Boolean)`)
    r.ok("T-1b-4 os titulos das abas do Culto nao tem [N]", t.length > 0 && !t.some((x) => /\[\d\]/.test(x)), JSON.stringify(t))
}

// ---------------------------------------------------------------- T-1b-6: Culto alcancavel (cada aba, settings e draw, e a volta)
await irParaModo(j, "Culto")
const TOPO = (titulo) => `[...document.querySelectorAll(".top.panel button")].find(b=>(b.dataset.title||b.title||"")===${JSON.stringify(titulo)})`
for (const [titulo, pag] of [["Editando", "edit"], ["Visão do palco", "stage"], ["Bíblia", "scripture"], ["Configurações", "settings"], ["Desenhando", "draw"], ["Mostrando", "show"]]) {
    await clicar(TOPO(titulo), "botao " + titulo)
    r.ok(`T-1b-6 no Culto o botao ${titulo} chega em ${pag}`, (await pagina()) === pag, await pagina())
}
r.ok("T-1b-6 em show a ClearButtons existe", (await j.ev(`return !!document.querySelector(".clearAll, .clear, [class*=clear]")`)) === true, "sem ClearButtons")
r.ok("T-1b-6 nenhuma moldura no Culto", (await j.ev(`return !document.querySelector(".prepararBarra")`)) === true, "barra do Preparar no Culto")

// ---------------------------------------------------------------- T-1b-5: Esc
await irParaModo(j, "Preparar")
// stage e settings: popup fecha antes; depois volta
for (const alvo of ["settings", "stage"]) {
    await j.ev(`S.activePage.set(${JSON.stringify(alvo)}); await esp(400); S.drawer.set({height:40,stored:null}); document.activeElement?.blur?.(); return 1`)
    await j.ev(`S.activePopup.set("shortcuts"); await esp(400); return 1`)
    await tecla(j, "Escape")
    await esperar(300)
    r.ok(`T-1b-5 ${alvo}: com popup aberto o 1o Esc fecha o popup e fica na pagina`, (await pagina()) === alvo && (await j.ev(`return get(S.activePopup)`)) === null, JSON.stringify({ p: await pagina(), pop: await j.ev(`return get(S.activePopup)`) }))
    await tecla(j, "Escape")
    await esperar(300)
    r.ok(`T-1b-5 ${alvo}: o Esc seguinte volta (show)`, (await pagina()) === "show", await pagina())
}
// settings com foco num campo: 1o Esc tira o foco, 2o volta
{
    await j.ev(`S.activePage.set("settings"); await esp(500); return 1`)
    // clica no primeiro campo de texto da pagina (aba Saidas tem o nome da saida; Conexao tem campos): ach a um que seja input de texto
    const achou = await j.ev(`S.settingsTab.set("connection"); await esp(500); const i=[...document.querySelectorAll("input[type=text], input:not([type])")].find(e=>e.offsetParent && !e.disabled); return i?true:false`)
    if (achou) {
        await clicar(`[...document.querySelectorAll("input[type=text], input:not([type])")].find(e=>e.offsetParent && !e.disabled)`, "campo de texto")
        const focado = await j.ev(`return document.activeElement?.tagName`)
        await tecla(j, "Escape")
        await esperar(300)
        const aposPrimeiro = { p: await pagina(), foco: await j.ev(`return document.activeElement?.tagName`) }
        await tecla(j, "Escape")
        await esperar(300)
        r.ok("T-1b-5 settings com foco num campo: o 1o Esc tira o foco (fica em settings) e o 2o volta", focado === "INPUT" && aposPrimeiro.p === "settings" && aposPrimeiro.foco === "BODY" && (await pagina()) === "show", JSON.stringify({ focado, aposPrimeiro, p: await pagina() }))
    } else r.ok("T-1b-5 settings com foco num campo", false, "nenhum campo de texto visivel")
}
// editor igual a hoje: Esc volta para show
await clicar(EDITAR, "Editar")
await j.ev(`S.drawer.set({height:40,stored:null}); document.activeElement?.blur?.(); return 1`)
// com um item selecionado no editor o 1o Esc o solta e o 2o volta (a cadeia de hoje: voltarDoEditor so vale sem itens)
let escs = 0
for (; escs < 4 && (await pagina()) === "edit"; escs++) {
    await tecla(j, "Escape")
    await esperar(400)
}
r.ok("T-1b-5 editor: o Esc volta para show em ate 3 toques (a cadeia de hoje: solta o item, depois volta)", (await pagina()) === "show" && escs <= 3, JSON.stringify({ escs, p: await pagina() }))
// Culto: o Esc em settings segue igual a hoje (nao volta)
await irParaModo(j, "Culto")
await j.ev(`S.activePage.set("settings"); await esp(400); document.activeElement?.blur?.(); return 1`)
await tecla(j, "Escape")
await esperar(300)
r.ok("T-1b-5 no Culto o Esc em settings nao volta (igual a hoje)", (await pagina()) === "settings", await pagina())
await j.ev(`S.activePage.set("show"); return 1`)
// gaveta aberta: ir a Configuracoes, um Esc com foco no corpo volta, e a gaveta continua aberta
await irParaModo(j, "Preparar")
await j.ev(`S.drawer.set({height:300,stored:null}); S.activePage.set("show"); await esp(400); document.activeElement?.blur?.(); return 1`)
await clicar(MENU, "menu")
await clicar(ITEM("config"), "item Configuracoes")
await tecla(j, "Escape")
await esperar(400)
r.ok("T-1b-5 gaveta aberta: um Esc em Configuracoes volta, e a gaveta continua aberta em show", (await pagina()) === "show" && (await j.ev(`return get(S.drawer).height`)) === 300, JSON.stringify({ p: await pagina(), h: await j.ev(`return get(S.drawer).height`) }))

// ---------------------------------------------------------------- T-1b-11: segunda camada (com a guarda de pagina desligada, so dev)
await limparToasts()
await instalarContagem(j)
await j.ev(`const M=await import(U("utils/aliancaMoldura")); M._pararMolduraAlianca(); S.drawer.set({height:40,stored:null}); S.activePage.set("scripture"); await esp(1500); return 1`)
r.ok("T-1b-11.0 sem a guarda de pagina o Preparar chega em scripture (e a prova mede so a segunda camada)", (await pagina()) === "scripture", await pagina())
{
    // seleciona um versiculo por clique real e tenta enviar pelo botao primario
    // livro, capitulo e versiculo por clique real
    await clicar(`document.querySelector("button.row.book")`, "livro")
    await clicar(`document.querySelector("button.num")`, "capitulo")
    const v = await localizar(j, `document.querySelector("button.row.verse")`)
    if (v.ok) {
        await clicarEm(j, v.x, v.y)
        await esperar(400)
        const e = await localizar(j, `document.querySelector("button.btn.primary")`)
        if (e.ok) await clicarEm(j, e.x, e.y)
        await esperar(600)
        const lim = await limpo()
        r.ok("T-1b-11.1 scripture: clique real no versiculo e no botao de enviar: zero outputs, zero canal de saida", lim.ok, JSON.stringify(lim))
    } else r.ok("T-1b-11.1 scripture: clique real num versiculo", false, v.motivo)
}
await instalarContagem(j)
await j.ev(`S.activePage.set("draw"); await esp(1500); return 1`)
r.ok("T-1b-11.2 sem a guarda de pagina o Preparar chega em draw", (await pagina()) === "draw", await pagina())
{
    const ferrAntes = await j.ev(`return JSON.stringify({t:get(S.drawTool), s:get(S.drawSettings)})`)
    const area = await j.ev(`const e=document.querySelector(".draw .parent, .parent"); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}`)
    if (area) {
        await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: area.x, y: area.y })
        await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: area.x, y: area.y, button: "left", buttons: 1, clickCount: 1 })
        for (let i = 1; i <= 6; i++) await j.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: area.x + i * 12, y: area.y + i * 6, buttons: 1 })
        await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: area.x + 72, y: area.y + 36, button: "left", clickCount: 1 })
        await esperar(500)
    }
    // troca de ferramenta por clique real (DrawTabs)
    // troca de ferramenta por clique real (DrawTabs): um botao de ferramenta diferente da atual
    const t = await localizar(j, `[...document.querySelectorAll("button")].find(b=>/Zoom|Preencher|Part[ií]culas|Pintar|Pincel|Ponteiro|Pointer|Fill|Paint/i.test(b.innerText) && !b.classList.contains("active"))`)
    if (t.ok) await clicarEm(j, t.x, t.y)
    await esperar(500)
    const lim = await limpo()
    const ferrDepois = await j.ev(`return JSON.stringify({t:get(S.drawTool), s:get(S.drawSettings)})`)
    r.ok("T-1b-11.3 draw: clique e arrasto na previa e troca de ferramenta: zero outputs e zero canal DRAW*", !!area && t.ok && lim.ok, JSON.stringify({ area, t, lim }))
    r.ok("T-1b-11.4 a ferramenta e as configuracoes do desenho nao mudaram (barrado na origem)", ferrAntes === ferrDepois, ferrAntes + " -> " + ferrDepois)
}
await j.ev(`const M=await import(U("utils/aliancaMoldura")); M.iniciarMolduraAlianca(); await esp(600); return 1`)
r.ok("T-1b-11.5 religada a guarda (iniciarMolduraAlianca) o Preparar volta a show", (await pagina()) === "show", await pagina())
r.ok("T-1b-fim a rodada limpa: nenhuma falha", await nenhumaFalha(), "falhas acesas")

j.fechar()
r.fim()
