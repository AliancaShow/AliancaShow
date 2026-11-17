// Rodada limpa (H4, fatia R3): depois de uma gravacao A a F e do reinicio, nas DUAS janelas: `get(falhas)` vazio (o store acumula desde
// a abertura, entao pega o que aconteceu antes do CDP conectar) e nenhuma linha `[AliancaShow] FALHA` no console (Console.enable reenvia
// as mensagens ja emitidas; Runtime.enable acompanha dali em diante). Sai com 1 se achar qualquer coisa.
//
//   node scripts/prova-culto/t24-limpa.mjs        (com o app aberto)
import { PORTA } from "./cdp.mjs"
import { RAIZ } from "./lib.mjs"

const BASE = "http://localhost:3000/@fs/" + RAIZ + "/src/frontend/"

async function conectar(alvo) {
    const ws = new WebSocket(alvo.webSocketDebuggerUrl)
    await new Promise((r, rej) => {
        ws.addEventListener("open", r)
        ws.addEventListener("error", () => rej(new Error("CDP nao abriu")))
    })
    let n = 0
    const pend = new Map()
    const linhas = []
    const texto = (args = []) => args.map((a) => a.value ?? a.description ?? "").join(" ")
    ws.addEventListener("message", (m) => {
        const d = JSON.parse(m.data)
        if (d.id && pend.has(d.id)) return void (pend.get(d.id)(d), pend.delete(d.id))
        if (d.method === "Console.messageAdded") linhas.push(String(d.params.message.text))
        if (d.method === "Runtime.consoleAPICalled") linhas.push(texto(d.params.args))
    })
    const enviar = (method, params = {}) =>
        new Promise((r, rej) => {
            const id = ++n
            const t = setTimeout(() => (pend.delete(id), rej(new Error("CDP sem resposta em 30 s: " + method))), 30000)
            pend.set(id, (d) => (clearTimeout(t), r(d)))
            ws.send(JSON.stringify({ id, method, params }))
        })
    const avaliar = async (corpo) => {
        const d = await enviar("Runtime.evaluate", { expression: `(async () => { ${corpo} })()`, awaitPromise: true, returnByValue: true })
        if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description || d.result.exceptionDetails.text)
        return d.result?.result?.value
    }
    return { enviar, avaliar, linhas, fechar: () => ws.close() }
}

const alvos = (await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json()).filter((t) => t.type === "page" && t.url.startsWith("http://localhost:3000"))
if (alvos.length < 2) {
    console.error(`t24-limpa: esperava 2 janelas (principal e saida), achei ${alvos.length}`)
    process.exit(1)
}
const problemas = []
let janelas = 0
for (const alvo of alvos) {
    const j = await conectar(alvo)
    await j.enviar("Console.enable")
    await j.enviar("Runtime.enable")
    await new Promise((r) => setTimeout(r, 1500)) // o reenvio das mensagens ja emitidas chega logo depois do enable
    const ehSaida = await j.avaliar('return !document.querySelector(".top.panel")')
    const nome = ehSaida ? "saida" : "principal"
    // o MESMO modulo que o app usa (a URL do recurso ja carregado): importar por outra URL criaria um store vazio e um falso verde
    const lido = await j.avaliar(`const e=performance.getEntriesByType("resource").map(r=>r.name).filter(x=>x.includes("/src/frontend/utils/aliancaFalha.ts")); if(!e.length) return {semModulo:true}; const m=await import(e[e.length-1]); let v; m.falhas.subscribe(x=>v=x)(); return {falhas:JSON.parse(JSON.stringify(v))}`)
    if (lido.semModulo) problemas.push(`${nome}: modulo utils/aliancaFalha nao esta carregado (nao da para ler o store)`)
    else if (lido.falhas.length) problemas.push(`${nome}: get(falhas) nao vazio: ${JSON.stringify(lido.falhas)}`)
    const sujas = j.linhas.filter((l) => l.includes("[AliancaShow] FALHA"))
    if (sujas.length) problemas.push(`${nome}: ${sujas.length} linha(s) [AliancaShow] FALHA no console: ${sujas[0].slice(0, 200)}`)
    console.log(`${nome}: falhas=${lido.falhas ? lido.falhas.length : "?"} linhasDeFalha=${sujas.length} mensagensDeConsoleVistas=${j.linhas.length}`)
    janelas++
    j.fechar()
}
if (problemas.length) {
    console.error("RODADA SUJA:\n  - " + problemas.join("\n  - "))
    process.exit(1)
}
console.log(`t24-limpa: verde nas ${janelas} janelas`)
