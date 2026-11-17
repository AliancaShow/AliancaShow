// Prints da 1a para o dono (PNG na bancada): a barra do Preparar, os chips, o menu da saida, o menu + Novo e a faixa de falha acesa
// (forcada por CDP so em dev). Uso: node scripts/prova-culto/t1a-prints.mjs <pasta-de-saida>
import { writeFileSync } from "node:fs"
import { abrir, clicarEm, esperar, injetarChips, irParaModo, localizar, PREPARAR_SAIDA, prepararCulto, recarregar } from "./t1aLib.mjs"

const dir = process.argv[2] || "../prints-1a"
const j = await abrir("principal")
await recarregar(j)
await j.ev(PREPARAR_SAIDA)
await prepararCulto(j)
await irParaModo(j, "Preparar")
const foto = async (nome, alto = 200) => {
    const r = (await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1365, height: alto, scale: 1 } })).result
    writeFileSync(`${dir}/${nome}.png`, Buffer.from(r.data, "base64"))
    console.log("print", `${dir}/${nome}.png`)
}
await esperar(800)
await foto("1a-barra-do-preparar", 120)
await injetarChips(j)
await esperar(600)
await foto("1a-chips-roteiro-e-chat", 120)
const m = await localizar(j, `document.querySelector(".prepararBarra .menuBotao")`)
await clicarEm(j, m.x, m.y)
await esperar(500)
await foto("1a-menu-da-saida-aberto", 260)
await j.ev(`S.activePopup.set(null); return 1`)
const fora = await localizar(j, `document.querySelector(".prepararBarra .menuBotao")`)
await clicarEm(j, fora.x, fora.y) // fecha
await esperar(300)
const n = await localizar(j, `document.querySelector(".prepararBarra .alianca-novo .botao")`)
await clicarEm(j, n.x, n.y)
await esperar(500)
await foto("1a-menu-novo-aberto", 320)
await j.ev(`S.activePopup.set(null); return 1`)
await clicarEm(j, n.x, n.y)
await esperar(300)
// a faixa vermelha, forcada por CDP (so em dev): vive no pe da janela
await j.ev(`const f=await import(U("utils/aliancaFalha")); f.falhaAlta("teste-cdp", new Error("falha forcada para o print")); await esp(500); return 1`)
const alto = await j.ev(`return innerHeight`)
const r = (await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: alto - 160, width: 1365, height: 160, scale: 1 } })).result
writeFileSync(`${dir}/1a-faixa-de-falha-acesa.png`, Buffer.from(r.data, "base64"))
console.log("print", `${dir}/1a-faixa-de-falha-acesa.png`)
j.fechar()
