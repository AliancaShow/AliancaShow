import { describe, expect, it } from "vitest"
import { temFundoQuebrado } from "./aliancaFundoQuebrado"

describe("temFundoQuebrado", () => {
    it("sem show, sem layout ou sem fundo: nao ha o que consertar (nada de escrever no cache)", () => {
        expect(temFundoQuebrado(null)).toBe(false)
        expect(temFundoQuebrado({})).toBe(false)
        expect(temFundoQuebrado({ layouts: { a: { slides: [{ id: "x" }] } }, media: {} })).toBe(false)
    })
    it("fundo que existe em `media` esta bom", () => {
        expect(temFundoQuebrado({ layouts: { a: { slides: [{ background: "m1" }] } }, media: { m1: {} } })).toBe(false)
    })
    it("fundo que nao esta em `media` esta quebrado, em qualquer layout", () => {
        expect(temFundoQuebrado({ layouts: { a: { slides: [{ background: "m1" }] }, b: { slides: [{}, { background: "fantasma" }] } }, media: { m1: {} } })).toBe(true)
    })
    it("slides que nao e lista e ignorado", () => {
        expect(temFundoQuebrado({ layouts: { a: { slides: "x" } }, media: {} })).toBe(false)
    })
})
