// Escrita atrasada (revisao I2/C10): Esc no Preparar com a gaveta aberta e troca de modo com ~5 ms de intervalo, 20 vezes.
// O lado Culto de `drawer` NAO pode mudar (a gaveta do Culto fica aberta em 300). Pontos que decidem num lado e escrevem depois:
// Drawer.svelte:47 (100 ms), shortcuts.ts:134-147 (voltarDaGaveta, 20 ms), Resizeable.svelte:27-33 (2 s).
//
//   node scripts/prova-culto/escrita-atrasada.mjs
// Sai com 1 se o Culto mudou em alguma rodada. So faz sentido com a fachada por modo (0b); na base compartilhada o Esc vaza de proposito.
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const j = await abrir("principal")
const clicarModo = async (nome) => {
    const l = await localizar(j, `[...document.querySelectorAll("button")].find(b=>b.innerText.trim()===${JSON.stringify(nome)})`)
    if (!l.ok) throw new Error("alvo: " + l.motivo)
    await clicarEm(j, l.x, l.y)
}
const culto = () => j.ev(`const c=S.drawer.culto||S.drawer; return JSON.stringify(get(c))`)
let falhas = 0
for (let i = 0; i < 20; i++) {
    await j.ev(`S.modoAlianca.set("culto"); S.activePage.set("show"); (S.drawer.culto||S.drawer).set({height:300,stored:null}); await esp(250)`)
    await clicarModo("Preparar")
    await esperar(250)
    await j.ev(`S.drawer.set({height:300,stored:null}); await esp(150)`) // gaveta do Preparar aberta
    const antes = await culto()
    // Esc (decide o lado agora, escreve 20 ms depois) e, ~5 ms depois, a troca de modo
    const esc = tecla(j, "Escape")
    await esperar(5)
    const troca = clicarModo("Culto")
    await Promise.all([esc, troca])
    await esperar(400) // passa os 20 ms e os 100 ms das escritas atrasadas
    const depois = await culto()
    const ok = depois === antes
    if (!ok) falhas++
    console.log(`${ok ? "ok   " : "FALHA"} rodada ${i + 1}: culto antes=${antes} depois=${depois}`)
}
console.log(falhas ? `\n${falhas}/20 rodadas mudaram o lado Culto` : "\n20/20: o lado Culto nao mudou")
j.fechar()
process.exit(falhas ? 1 : 0)
