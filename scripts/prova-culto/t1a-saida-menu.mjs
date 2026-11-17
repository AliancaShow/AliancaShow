// T-1a-5 (1a, D4): o item do telao no menu ⋯ do Preparar. Abre a janela de saida de dev de verdade (saidaLib: janelinha no canto).
// Cliques e teclas REAIS, nunca force.
//   bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh ; node scripts/prova-culto/t1a-saida-menu.mjs ; restaurar.sh
import { abrir, clicarEm, esperar, instalarContagem, irParaModo, lerContagem, localizar, PREPARAR_SAIDA, prepararCulto, recarregar, relato, tecla, desligarSaidaNoCulto } from "./t1aLib.mjs"

const r = relato("t1a-saida-menu")
const j = await abrir("principal")
await recarregar(j)
await j.ev(PREPARAR_SAIDA)
await prepararCulto(j)
await irParaModo(j, "Preparar")
await instalarContagem(j)

const BOTAO = `document.querySelector(".prepararBarra .menuBotao")`
const ITEM = `document.querySelector('[role=menuitem][data-item="saida"]')`
const MESMO = `document.querySelector('[role=menuitem][data-item="desligar-mesmo"]')`
const lerItem = () => j.ev(`const i=${ITEM}; return i?{estado:i.dataset.estado, texto:i.innerText.trim(), dis:i.getAttribute("aria-disabled")}:null`)
const toggles = async () => (await lerContagem(j)).canais.filter((k) => k.includes("TOGGLE_OUTPUTS")).length
const od = () => j.ev(`return !!get(S.outputDisplay)`)
async function abrirMenu() {
    if (await j.ev(`return !!document.querySelector('.prepararMenu .menu')`)) return
    const b = await localizar(j, BOTAO)
    await clicarEm(j, b.x, b.y)
    await esperar(300)
}
async function esperarEstado(est, ms = 4000) {
    for (let t = 0; t < ms / 100; t++) {
        if ((await lerItem())?.estado === est) return true
        await esperar(100)
    }
    return false
}
const clicarItem = async (expr) => {
    const l = await localizar(j, expr)
    if (!l.ok) throw new Error("alvo: " + l.motivo)
    await clicarEm(j, l.x, l.y)
    return l
}

// ---------------------------------------------------------------- com tela fisica
await abrirMenu()
let it = await lerItem()
r.ok("1.1 o item mostra 'Ligar o telão'", it?.estado === "desligado" && it.texto === "Ligar o telão", JSON.stringify(it))
await clicarItem(ITEM)
r.ok("1.2 Ligar liga: o item passa a 'Desligar o telão'", (await esperarEstado("ligado")) && (await od()), JSON.stringify(await lerItem()))
await esperar(800)
await instalarContagem(j) // a partir daqui conta so o que o teste provoca (o Ligar acima ja emitiu o seu TOGGLE_OUTPUTS)

for (const atraso of [80, 300, 600, 850]) {
    await abrirMenu()
    await esperarEstado("ligado")
    const t0 = Date.now()
    const item = await clicarItem(ITEM) // 1o clique: so pergunta
    const mesmo = await localizar(j, MESMO)
    r.ok(`2.${atraso}.a 'Desligar o telão' so pergunta (nao desliga)`, (await lerItem())?.estado === "perguntando" && (await od()) && (await toggles()) === 0, JSON.stringify(await lerItem()))
    await esperar(Math.max(0, atraso - (Date.now() - t0)))
    await clicarEm(j, item.x, item.y) // toque duplo na MESMA coordenada
    await clicarEm(j, mesmo.x, mesmo.y) // e no 'Desligar mesmo' ainda inerte
    r.ok(`2.${atraso}.b toque a ${atraso} ms nao desliga`, (await od()) && (await toggles()) === 0, `outputDisplay=${await od()} toggles=${await toggles()}`)
    await tecla(j, "Escape") // cancela a pergunta
    await esperar(300)
}

// Enter no item nao faz nada (so mouse)
await abrirMenu()
await esperarEstado("ligado")
await tecla(j, "ArrowDown")
await tecla(j, "Enter")
await esperar(300)
r.ok("3.1 Enter no item do telao nao faz nada", (await lerItem())?.estado === "ligado" && (await toggles()) === 0, JSON.stringify(await lerItem()))
await tecla(j, " ")
await esperar(300)
r.ok("3.2 Espaco no item do telao nao faz nada", (await lerItem())?.estado === "ligado" && (await toggles()) === 0, JSON.stringify(await lerItem()))

// 3 s sem clicar volta a 'Desligar o telão'
await clicarItem(ITEM)
await esperar(1100)
r.ok("4.1 depois de 1 s o 'Desligar mesmo' esta ativo", (await lerItem())?.estado === "armado", JSON.stringify(await lerItem()))
await esperar(3300)
r.ok("4.2 3 s sem clicar volta a 'Desligar o telão'", (await lerItem())?.estado === "ligado" && (await toggles()) === 0, JSON.stringify(await lerItem()))

// fechar o menu (clique fora), Esc e trocar de modo cancelam a pergunta
await clicarItem(ITEM)
await esperar(200)
await clicarEm(j, 700, 600) // fora do menu (centro da janela)
await esperar(300)
r.ok("5.1 clicar fora fecha o menu e cancela", !(await j.ev(`return !!document.querySelector('.prepararMenu .menu')`)) && (await od()) && (await toggles()) === 0, "")
await abrirMenu()
r.ok("5.2 reabrir mostra 'Desligar o telão' (derivado)", (await lerItem())?.estado === "ligado", JSON.stringify(await lerItem()))
await clicarItem(ITEM)
await tecla(j, "Escape")
await esperar(300)
r.ok("5.3 Esc fecha o menu e cancela", !(await j.ev(`return !!document.querySelector('.prepararMenu .menu')`)) && (await od()), "")
await abrirMenu()
await clicarItem(ITEM)
await irParaModo(j, "Culto")
await irParaModo(j, "Preparar")
await abrirMenu()
r.ok("5.4 trocar de modo cancela (e nada foi desligado)", (await lerItem())?.estado === "ligado" && (await od()) && (await toggles()) === 0, JSON.stringify(await lerItem()))

// Desligar mesmo, depois de 1 s: desliga com state false; trava de 800 ms
await clicarItem(ITEM)
await esperar(1150)
await clicarItem(MESMO)
r.ok(
    "6.1 'Desligar mesmo' depois de 1 s desliga (outputDisplay falso)",
    await (async () => {
        for (let t = 0; t < 30; t++) {
            if (!(await od())) return true
            await esperar(100)
        }
        return false
    })(),
    "ficou ligado"
)
it = await lerItem()
r.ok("6.2 o item vai a trava ('Ligar o telão' desabilitado)", it?.estado === "trava" && it.dis === "true", JSON.stringify(it))
await clicarItem(ITEM)
r.ok("6.3 clique durante a trava nao liga", !(await od()), "religou")
await esperar(900)
it = await lerItem()
r.ok("6.4 depois de 800 ms volta a 'Ligar o telão'", it?.estado === "desligado" && it.texto === "Ligar o telão", JSON.stringify(it))
await tecla(j, "Escape")
await esperar(300)

// ---------------------------------------------------------------- sem tela de saida
// (a) saida habilitada = falso, por store. DESVIO: o app reabilita a unica saida na hora (getAllEnabledOutputs, output.ts), entao o estado
// "nenhuma saida habilitada" nao e alcancavel pela interface com uma saida so; a maquina cobre o caso no vitest (temSaida falso => semTela).
await j.ev(`S.outputs.update(o=>{o.default.enabled=false; return o}); await esp(700); return 1`)
r.ok("7.1 (documentado) o app reabilita a unica saida: enabled=false nao se sustenta, o caso e coberto no vitest", (await j.ev(`return get(S.outputs).default.enabled`)) === true, "enabled ficou falso")
// (b) sem tela fisica (saida invisivel): o item abre Configuracoes em display_settings
await j.ev(`S.outputs.update(o=>{o.default.invisible=true; return o}); S.settingsTab.set("general"); await esp(400); return 1`)
await abrirMenu()
it = await lerItem()
r.ok("7.2 sem tela fisica o item mostra 'Sem tela de saída: configurar'", it?.estado === "semTela", JSON.stringify(it))
await clicarItem(ITEM)
await esperar(500)
const e = await j.ev(`return {pagina:get(S.activePage), aba:get(S.settingsTab)}`)
r.ok("7.3 o clique abre Configuracoes em display_settings", e.pagina === "settings" && e.aba === "display_settings", JSON.stringify(e))
await j.ev(`S.outputs.update(o=>{o.default.invisible=false; return o}); S.activePage.set("show"); await esp(400); return 1`)

await desligarSaidaNoCulto(j)
j.fechar()
r.fim()
