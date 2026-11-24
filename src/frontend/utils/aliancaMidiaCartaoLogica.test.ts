import { describe, expect, it } from "vitest"
import { acaoDoClique, criarCacheDeDuracao, estadoDoCartao, formatarDuracao, resolucaoAcimaDoRecomendado, TRAVA_CARTAO_MS } from "./aliancaMidiaCartaoLogica"
import { CLIQUE_MIDIA_MS, CLIQUE_REPETIDO_MS } from "./aliancaToqueLogica"
import { readFileSync } from "node:fs"
import { join } from "node:path"

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
    it("a trava do cartao (700 ms, a que o operador ve) e a que o clique engole sao a MESMA, e a global do resto e menor", () => {
        expect(TRAVA_CARTAO_MS).toBe(CLIQUE_MIDIA_MS)
        expect(CLIQUE_REPETIDO_MS).toBeLessThan(TRAVA_CARTAO_MS)
    })
    it("a barra que enche na tela dura o mesmo que a trava (token --luz-trava no global.css, lido pelo cartao)", () => {
        const css = readFileSync(join(__dirname, "../../../public/global.css"), "utf8")
        const m = /--luz-trava: *([0-9]+)ms/.exec(css)
        expect(Number(m?.[1])).toBe(TRAVA_CARTAO_MS)
        expect(readFileSync(join(__dirname, "../components/drawer/media/MediaCard.svelte"), "utf8")).toContain("animation: encherTrava var(--luz-trava)")
    })
    it("o cartao nao tem tamanho de texto solto: tudo vem dos tokens --luz-fs-* (revisao do PR #40, achado 8)", () => {
        const fonte = readFileSync(join(__dirname, "../components/drawer/media/MediaCard.svelte"), "utf8")
        const css = fonte.slice(fonte.indexOf("<style>"))
        expect(css.match(/font-size: *[0-9]+px/g) || []).toEqual([])
        expect(css).not.toContain("var(--text)")
    })
})

describe("resolucaoAcimaDoRecomendado", () => {
    it("1080p, LED e vertical 1080×1920 não avisam; 4K e 2.5K avisam", () => {
        expect(resolucaoAcimaDoRecomendado(1920, 1080)).toBeNull()
        expect(resolucaoAcimaDoRecomendado(896, 320)).toBeNull()
        expect(resolucaoAcimaDoRecomendado(1080, 1920)).toBeNull()
        expect(resolucaoAcimaDoRecomendado(0, 0)).toBeNull()
        expect(resolucaoAcimaDoRecomendado(3840, 2160)?.rotulo).toBe("4K")
        expect(resolucaoAcimaDoRecomendado(2560, 1440)?.rotulo).toBe("2.5K")
        expect(resolucaoAcimaDoRecomendado(1920, 1200)?.rotulo).toBe("HD+")
    })
})
