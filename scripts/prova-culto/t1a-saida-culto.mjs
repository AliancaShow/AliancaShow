// T-1a-16 (1a): o botao da saida do Culto continua o mesmo. Com a saida ligada, antes e depois de uma ida e volta ao Preparar, um clique
// real em #output_window_button so PERGUNTA (.click_again), nao emite OUTPUT:TOGGLE_OUTPUTS e o telao segue no ar; 1,9 s depois a pergunta some.
// Roda tambem com o app servido pela referencia (FS_REPO=../ref-f0c, Vite da referencia em :3000): o resultado tem de ser o mesmo.
//   bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh ; node scripts/prova-culto/t1a-saida-culto.mjs ; restaurar.sh
import { abrir, clicarEm, desligarSaidaNoCulto, esperar, instalarContagem, irParaModo, lerContagem, ligarSaidaNoCulto, localizar, prepararCulto, recarregar, relato } from "./t1aLib.mjs"

const r = relato("t1a-saida-culto")
const j = await abrir("principal")
await recarregar(j)
await ligarSaidaNoCulto(j)

async function umaRodada(rotulo) {
    await prepararCulto(j)
    await esperar(700)
    await instalarContagem(j)
    const b = await localizar(j, `document.querySelector("#output_window_button")`)
    if (!r.ok(`${rotulo}.0 o botao da saida esta livre para o clique`, b.ok, b.motivo)) return
    await clicarEm(j, b.x, b.y)
    await esperar(500)
    const e = await j.ev(`return {confirma:!!document.querySelector(".click_again"), od:!!get(S.outputDisplay)}`)
    const c = await lerContagem(j)
    r.ok(`${rotulo}.1 o clique mostra o .click_again`, e.confirma, JSON.stringify(e))
    r.ok(`${rotulo}.2 nao emite OUTPUT:TOGGLE_OUTPUTS e o telao segue no ar`, !c.canais.some((k) => k.includes("TOGGLE_OUTPUTS")) && e.od, JSON.stringify({ e, c }))
    await esperar(1900)
    r.ok(`${rotulo}.3 1,9 s depois o .click_again sumiu`, (await j.ev(`return !document.querySelector(".click_again")`)) === true, "ficou")
}

await umaRodada("1")
await irParaModo(j, "Preparar")
await esperar(300)
await irParaModo(j, "Culto")
await esperar(900) // o anteparo (se algum) ja venceu; aqui nenhum chip foi tocado
await umaRodada("2")

await desligarSaidaNoCulto(j)
j.fechar()
r.fim()
