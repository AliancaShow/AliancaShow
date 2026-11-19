// T9 (a), revisao C12: o MOTOR de um timer de contagem do FreeShow roda sem a aba Funcoes/Timers da gaveta (nunca aberta na sessao).
// Inicia um timer de contagem REAL (playPauseGlobal), amostra o valor por 6 s na janela principal e na de saida, e confere que o
// STAGE:ACTIVE_TIMERS saiu pelo gancho de IPC. Repete com a aba Funcoes aberta (a aba Timers nao tem no na arvore C6: escrever nela falha alto e volta a Shows): mesmo comportamento.
// (b) O timer do Sirvo (aliancaSirvo.publicar) NAO e provado aqui: nao e exportado e o perfil de teste nao tem chave. Fica declarado.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { abrir, esperar } from "./lib.mjs"
const principal = await abrir("principal")
const saida = await abrir("saida")
// instala o gravador (o gancho de IPC) na janela principal
await principal.ev(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "gravador.js"), "utf8").replace("__JANELA__", '"principal"'))
let falhas = 0
const ok = (c, m) => {
    console.log((c ? "OK   " : "FALHA ") + m)
    if (!c) falhas++
}
const tempo = `(get(S.activeTimers).find(t=>t.id==="t9")||{}).currentTime ?? null`

async function rodar(rotulo, comAba) {
    await principal.ev(`S.activeTimers.set([]); S.timers.update(a=>{a.t9={name:"T9",type:"counter",start:100,end:0,id:"t9"};return a}); S.activeDrawerTab.set(${JSON.stringify(comAba ? "functions" : "shows")}); await esp(500)`)
    const aba = await principal.ev(`return get(S.activeDrawerTab)`)
    ok(comAba ? aba === "functions" : aba !== "functions", `${rotulo}: aba ativa da gaveta = ${aba}`)
    await principal.avaliar("if (window.__provaFim) await window.__provaFim(); return 1")
    await principal.ev(`const {playPauseGlobal}=await import(U("components/drawer/timers/timers")); playPauseGlobal("t9", get(S.timers).t9, true); return 1`)
    const v0 = await principal.ev(`return ${tempo}`)
    await esperar(6000)
    const v1 = await principal.ev(`return ${tempo}`)
    const fim = await principal.avaliar("return await window.__provaFim()")
    const naSaida = await saida.ev(`return ${tempo}`).catch(() => null)
    ok(v0 !== null && v1 !== null && Math.abs(v1 - v0) >= 4, `${rotulo}: o timer avancou na janela principal (${v0} -> ${v1})`)
    ok(
        Object.keys(fim.canais).some((k) => k.endsWith(":ACTIVE_TIMERS")),
        `${rotulo}: STAGE:ACTIVE_TIMERS saiu pelo gancho (${
            Object.keys(fim.canais)
                .filter((k) => k.includes("TIMERS"))
                .join(",") || "nenhum"
        })`
    )
    ok(naSaida !== null && Math.abs(naSaida - v1) <= 1, `${rotulo}: a janela de saida recebeu o timer (${naSaida})`)
    await principal.ev(`S.activeTimers.set([]); return 1`)
}
await rodar("sem a aba", false)
await rodar("com a aba", true)
principal.fechar()
saida.fechar()
console.log(falhas ? `\n${falhas} falha(s)` : "\nmotor do timer independe da aba")
process.exit(falhas ? 1 : 0)
