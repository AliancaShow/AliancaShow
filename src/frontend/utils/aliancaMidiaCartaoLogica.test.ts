import { describe, expect, it } from "vitest"
import { acaoDoClique, criarCacheDeDuracao, estadoDoCartao, formatarDuracao, TRAVA_CARTAO_MS } from "./aliancaMidiaCartaoLogica"
import { CLIQUE_REPETIDO_MS } from "./aliancaToqueLogica"

describe("C1: duracao no cartao", () => {
    it("formata m:ss e h:mm:ss; sem duracao valida nao mostra selo", () => {
        expect(formatarDuracao(72)).toBe("1:12")
        expect(formatarDuracao(5)).toBe("0:05")
        expect(formatarDuracao(3725)).toBe("1:02:05")
        expect(formatarDuracao(0)).toBe("")
        expect(formatarDuracao(NaN)).toBe("")
        expect(formatarDuracao(undefined)).toBe("")
    })
    it("o cache le cada arquivo uma vez, mesmo com pedidos juntos, e nao guarda leitura que falhou", async () => {
        let leituras = 0
        const c = criarCacheDeDuracao(async (p) => (leituras++, p === "ruim.mp4" ? 0 : 42))
        const [a, b] = await Promise.all([c.pedir("a.mp4"), c.pedir("a.mp4")])
        expect([a, b, leituras]).toEqual([42, 42, 1])
        await c.pedir("a.mp4")
        expect(leituras).toBe(1)
        expect(c.sabida("a.mp4")).toBe(42)
        await c.pedir("ruim.mp4")
        await c.pedir("ruim.mp4")
        expect(leituras).toBe(3) // a que falhou tenta de novo
    })
    it("so `limite` leituras em curso ao mesmo tempo", async () => {
        let ativas = 0
        let pico = 0
        const c = criarCacheDeDuracao(async () => {
            pico = Math.max(pico, ++ativas)
            await new Promise((r) => setTimeout(r, 5))
            ativas--
            return 1
        }, 2)
        await Promise.all(["1", "2", "3", "4", "5"].map((p) => c.pedir(p)))
        expect(pico).toBe(2)
    })
})

describe("C1: o clique no thumb", () => {
    it("video no ar REINICIA; imagem no ar nao faz nada; nunca limpa", () => {
        expect(acaoDoClique({ noAr: true, falta: false, tipo: "video" })).toBe("reiniciar")
        expect(acaoDoClique({ noAr: true, falta: false, tipo: "image" })).toBe("nada")
        expect(acaoDoClique({ noAr: false, falta: false, tipo: "video" })).toBe("ao-ar")
    })
    it("arquivo sumido nao clica", () => {
        expect(acaoDoClique({ noAr: false, falta: true, tipo: "video" })).toBe("nada")
        expect(acaoDoClique({ noAr: true, falta: true, tipo: "video" })).toBe("nada")
    })
    it("estado: sumido vence no ar, no ar vence a trava", () => {
        expect(estadoDoCartao({ falta: true, noAr: true, trava: true })).toBe("falta")
        expect(estadoDoCartao({ falta: false, noAr: true, trava: true })).toBe("ar")
        expect(estadoDoCartao({ falta: false, noAr: false, trava: true })).toBe("trava")
        expect(estadoDoCartao({ falta: false, noAr: false, trava: false })).toBe("repouso")
    })
    it("a trava do cartao e a global valem o mesmo: 700 ms", () => {
        expect(TRAVA_CARTAO_MS).toBe(700)
        expect(CLIQUE_REPETIDO_MS).toBe(700)
    })
})
