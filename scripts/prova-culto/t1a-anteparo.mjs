// T-1a-7 (1a, D2/Q8): chips e anteparo de 700 ms. Um chip leva ao Culto; o toque que cairia, nos 700 ms seguintes, no botao que acabou de
// aparecer sob o dedo (Editar, ou o botao da saida) e engolido. Cliques REAIS, nunca force.
//
//   bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh   (app limpo, perfil de prova; depois, restaurar.sh)
//   node scripts/prova-culto/t1a-anteparo.mjs          (sai com 1 em qualquer falha; MUTACAO: sem <AnteparoDeModo /> no Top fica vermelho)
import { BOTAO_DO_MODO, abrir, clicarEm, esperar, injetarChips, instalarContagem, irParaModo, lerContagem, ligarSaidaNoCulto, localizar, prepararCulto, recarregar, relato, desligarSaidaNoCulto } from "./t1aLib.mjs"

const r = relato("t1a-anteparo")
const j = await abrir("principal")
await recarregar(j)
await ligarSaidaNoCulto(j)
await prepararCulto(j)

// onde ficam, no Culto, o Editar do topo e o botao da saida (o centro medido)
const centro = (expr) => j.ev(`const e=(${expr}); const b=e.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height}`)
const EDITAR = `[...document.querySelectorAll("button")].find(b=>b.innerText.trim()==="Editar" && (b.getAttribute("data-title")||"").startsWith("Editando"))`
const SAIDA = `document.querySelector("#output_window_button")`
const editar = await centro(EDITAR)
const saida = await centro(SAIDA)
r.ok("0.1 o Editar e o botao da saida existem no Culto e nao estao desabilitados", editar.w > 10 && saida.w > 10 && (await j.ev(`return !${EDITAR}.disabled && !${SAIDA}.disabled`)), JSON.stringify({ editar, saida }))

await injetarChips(j)
await instalarContagem(j)

const CHIP = (id) => `document.querySelector('.prepararBarra .chip[data-chip="${id}"]')`
const estadoFinal = (j) => j.ev(`return {pagina:get(S.activePage), modo:get(S.modoAlianca), foco:document.activeElement?.tagName, anteparo:!!document.querySelector(".anteparo"), avisos:(await import(U("utils/aliancaSirvo"))).sirvoAvisos&&0, linhas:get((await import(U("utils/aliancaSirvo"))).sirvoAvisos).linhas.length, naoLidas:get((await import(U("utils/aliancaSirvoChat"))).sirvoChat).naoLidas, confirma:!!document.querySelector(".click_again")}`)

async function umChip(id, atrasoMs, alvo, rotulo) {
    await irParaModo(j, "Preparar")
    await esperar(900) // o anteparo da rodada anterior ja venceu
    const chip = await localizar(j, CHIP(id))
    if (!r.ok(`${rotulo}.chip ${id} esta livre para o clique`, chip.ok, chip.motivo)) return
    await instalarContagem(j)
    await clicarEm(j, chip.x, chip.y)
    await esperar(atrasoMs)
    await clicarEm(j, alvo.x, alvo.y) // 2o clique REAL no centro medido de Editar (ou da saida)
    await esperar(600)
    const e = await estadoFinal(j)
    const c = await lerContagem(j)
    return { e, c }
}

for (const atraso of [80, 250, 500]) {
    // 2o clique no centro de Editar
    let x = await umChip("roteiro", atraso, editar, `1.${atraso}`)
    if (x) {
        r.ok(`1.${atraso}.a termina no Culto em show (o 2o clique no Editar foi engolido)`, x.e.modo === "culto" && x.e.pagina === "show", JSON.stringify(x.e))
        r.ok(`1.${atraso}.b zero escrita em outputs`, x.c.out === 0, String(x.c.out))
        r.ok(`1.${atraso}.c nada dispensado nem lido`, x.e.linhas === 2 && x.e.naoLidas === 2, JSON.stringify(x.e))
        r.ok(`1.${atraso}.d foco no BODY e sem elemento .anteparo`, x.e.foco === "BODY" && !x.e.anteparo, JSON.stringify(x.e))
    }
    // 2o clique no centro do botao da saida: o `.click_again` nao aparece e zero TOGGLE_OUTPUTS
    x = await umChip("chat", atraso, saida, `2.${atraso}`)
    if (x) {
        r.ok(`2.${atraso}.a o .click_again nao apareceu (o clique no botao da saida foi engolido)`, !x.e.confirma, JSON.stringify(x.e))
        r.ok(`2.${atraso}.b zero OUTPUT:TOGGLE_OUTPUTS e zero escrita em outputs`, !x.c.canais.some((k) => k.includes("TOGGLE_OUTPUTS")) && x.c.out === 0, JSON.stringify(x.c))
        r.ok(`2.${atraso}.c termina no Culto em show, foco no BODY`, x.e.modo === "culto" && x.e.pagina === "show" && x.e.foco === "BODY", JSON.stringify(x.e))
    }
}

// o clique legitimo passa: depois do anteparo (900 ms) um clique real no botao da saida mostra o `.click_again` e nao emite TOGGLE_OUTPUTS
{
    const x = await umChip("roteiro", 900, saida, "3")
    if (x) {
        r.ok("3.a aos 900 ms o clique no botao da saida PASSA: .click_again aparece", x.e.confirma, JSON.stringify(x.e))
        r.ok("3.b e nao emite OUTPUT:TOGGLE_OUTPUTS (so pergunta)", !x.c.canais.some((k) => k.includes("TOGGLE_OUTPUTS")), JSON.stringify(x.c))
        await esperar(1900)
        r.ok("3.c esperar 1,9 s e o .click_again some", (await j.ev(`return !document.querySelector(".click_again")`)) === true, "o .click_again ficou")
    }
}

// dois chips seguidos: o anteparo e renovado. Um chip tocado dentro do anteparo (a barra e a mesma) tambem e engolido.
{
    await irParaModo(j, "Preparar")
    await esperar(900)
    const chip = await localizar(j, CHIP("roteiro"))
    const modo = await localizar(j, BOTAO_DO_MODO("Preparar"))
    await clicarEm(j, chip.x, chip.y) // 1o chip: vai ao Culto, anteparo armado
    await clicarEm(j, modo.x, modo.y) // o seletor de modo (a esquerda) nunca e engolido, e volta ao Preparar sem esperar
    r.ok("4.1 o seletor de modo funciona dentro do anteparo (volta ao Preparar)", (await j.ev(`return get(S.modoAlianca)`)) === "preparar", "ficou no Culto")
    await clicarEm(j, chip.x, chip.y) // ainda dentro dos 700 ms (alguns ms depois do 1o): engolido, nao sai do Preparar
    await esperar(300)
    r.ok("4.2 um chip tocado dentro do anteparo e engolido (continua no Preparar)", (await j.ev(`return get(S.modoAlianca)`)) === "preparar", "saiu do Preparar")
    await esperar(800)
    const chip3 = await localizar(j, CHIP("roteiro"))
    await clicarEm(j, chip3.x, chip3.y) // vencido o anteparo: passa
    await esperar(500)
    r.ok("4.3 passados os 700 ms o chip passa e leva ao Culto", (await j.ev(`return get(S.modoAlianca)`)) === "culto", "nao foi ao Culto")
    // o anteparo foi renovado: Editar 450 ms depois do 2o chip bem sucedido... (o clique no chip3 acabou de armar de novo; medimos desde ele)
    await irParaModo(j, "Preparar")
    await esperar(800)
    const chip4 = await localizar(j, CHIP("roteiro"))
    await clicarEm(j, chip4.x, chip4.y)
    await esperar(400)
    await clicarEm(j, editar.x, editar.y)
    await esperar(500)
    r.ok("4.4 o anteparo de cada chip dura 700 ms a partir do seu clique (Editar aos 400 ms engolido)", (await j.ev(`return get(S.activePage)`)) === "show", "foi para edit")
    await esperar(500)
    await clicarEm(j, editar.x, editar.y)
    await esperar(600)
    r.ok("4.5 depois dos 700 ms o Editar funciona (nao e bloqueio permanente)", (await j.ev(`return get(S.activePage)`)) === "edit", "o Editar continua engolido")
    await j.ev(`S.activePage.set("show"); await esp(300); return 1`)
}

// saindo de settings pelo codigo do chip (os chips so existem na pagina show na 1a): chega em show
{
    await j.ev(`S.modoAlianca.set("preparar"); S.activePage.set("settings"); await esp(400); const P=await import(U("utils/aliancaPilula")); P.irAoCulto(); await esp(400); return 1`)
    const e = await j.ev(`return {pagina:get(S.activePage), modo:get(S.modoAlianca)}`)
    r.ok("5.1 irAoCulto() saindo de settings chega em show no Culto", e.pagina === "show" && e.modo === "culto", JSON.stringify(e))
}

await desligarSaidaNoCulto(j)
j.fechar()
r.fim()
