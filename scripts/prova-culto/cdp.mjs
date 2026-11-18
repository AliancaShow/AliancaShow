// CDP do AliancaShow em dev (porta 9222). janela("principal" | "saida") devolve { avaliar, enviar, foto, fechar }.
// Nada aqui toca o app instalado nem o %APPDATA%: so a janela de dev aberta com --remote-debugging-port.
import { writeFileSync } from "node:fs"

export const PORTA = process.env.FS_CDP_PORTA || "9222"

/** acha a janela esperando ate 40 s (o Vite recarrega a pagina quando um arquivo muda: o corpo nasce vazio por alguns segundos) */
export async function janela(qual = "principal") {
    let ultimo = null
    for (let t = 0; t < 40; t++) {
        try {
            return await achar(qual)
        } catch (e) {
            ultimo = e
            await new Promise((r) => setTimeout(r, 1000))
        }
    }
    throw ultimo
}

async function achar(qual) {
    const alvos = (await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json()).filter((t) => t.type === "page" && t.url.startsWith("http://localhost:3000"))
    for (const t of alvos) {
        const j = await conectar(t.webSocketDebuggerUrl)
        const ehSaida = await j.avaliar("return !document.querySelector('[data-regiao=\"topo\"]')").catch(() => false)
        if ((qual === "saida") === !!ehSaida) return j
        j.fechar()
    }
    throw new Error("janela " + qual + " nao achada")
}

async function conectar(url) {
    const ws = new WebSocket(url)
    await new Promise((r) => ws.addEventListener("open", r))
    let n = 0
    const pend = new Map()
    ws.addEventListener("message", (m) => {
        const d = JSON.parse(m.data)
        if (pend.has(d.id)) {
            pend.get(d.id)(d)
            pend.delete(d.id)
        }
    })
    // sem resposta em 30 s a chamada falha (pagina recarregando/travada nao pode pendurar a prova para sempre)
    const enviar = (method, params) =>
        new Promise((r, rej) => {
            const id = ++n
            const t = setTimeout(() => {
                pend.delete(id)
                rej(new Error("CDP sem resposta em 30 s: " + method))
            }, 30000)
            pend.set(id, (d) => {
                clearTimeout(t)
                r(d)
            })
            ws.send(JSON.stringify({ id, method, params }))
        })
    return {
        async avaliar(corpo) {
            const d = await enviar("Runtime.evaluate", { expression: `(async () => { ${corpo} })()`, awaitPromise: true, returnByValue: true })
            if (!d.result) throw new Error("CDP: " + JSON.stringify(d.error))
            if (d.result.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description || d.result.exceptionDetails.text)
            return d.result.result.value
        },
        async foto(arquivo) {
            const d = await Promise.race([enviar("Page.captureScreenshot", { format: "png" }), new Promise((_, rej) => setTimeout(() => rej(new Error("print demorou")), 8000))])
            writeFileSync(arquivo, Buffer.from(d.result.data, "base64"))
            return arquivo
        },
        enviar,
        fechar: () => ws.close()
    }
}
