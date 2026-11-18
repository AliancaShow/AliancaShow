import { describe, expect, it } from "vitest"
import { CLIQUE_REPETIDO_MS, ESC_SEGURA_MS, criarEscSeguro, criarRepeticao } from "./aliancaToqueLogica"

describe("Esc que fechou algo segura o seguinte (700 ms)", () => {
    it("sem Esc que fechou: nada e segurado", () => {
        const e = criarEscSeguro()
        expect(e.segura(1000)).toBe(false)
    })
    it("depois de fechar, o Esc dentro de 700 ms e engolido e o de 700 ms em diante passa", () => {
        const e = criarEscSeguro()
        e.fechou(1000)
        expect(e.segura(1000 + ESC_SEGURA_MS - 1)).toBe(true)
        expect(e.segura(1000 + ESC_SEGURA_MS)).toBe(false)
    })
    it("o Esc engolido NAO reinicia a espera (quem segura a tecla nao fica preso)", () => {
        const e = criarEscSeguro()
        e.fechou(0)
        e.segura(300)
        e.segura(600)
        expect(e.segura(700)).toBe(false)
    })
    it("fechar de novo renova a espera", () => {
        const e = criarEscSeguro()
        e.fechou(0)
        e.fechou(500)
        expect(e.segura(1100)).toBe(true)
        expect(e.segura(1200)).toBe(false)
    })
})

describe("clique repetido no mesmo item (400 ms)", () => {
    it("o primeiro passa, o segundo dentro de 400 ms e engolido, o de 400 ms em diante passa", () => {
        const r = criarRepeticao<string>()
        expect(r.engole("a", 0)).toBe(false)
        expect(r.engole("a", CLIQUE_REPETIDO_MS - 1)).toBe(true)
        expect(r.engole("a", CLIQUE_REPETIDO_MS)).toBe(false)
    })
    it("itens diferentes nao se engolem", () => {
        const r = criarRepeticao<string>()
        expect(r.engole("a", 0)).toBe(false)
        expect(r.engole("b", 10)).toBe(false)
    })
    it("clicar a cada 300 ms nao silencia o item para sempre (conta contra o ultimo ACEITO)", () => {
        const r = criarRepeticao<string>()
        const res = [0, 300, 600, 900, 1200].map((t) => r.engole("a", t))
        expect(res).toEqual([false, true, false, true, false])
    })
    it("o mapa nao cresce sem fim", () => {
        const r = criarRepeticao<number>()
        for (let i = 0; i < 200; i++) r.engole(i, i * 1000)
        expect(r.engole(0, 300000)).toBe(false)
    })
})
