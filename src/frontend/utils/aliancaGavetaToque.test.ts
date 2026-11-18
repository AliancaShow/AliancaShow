import { describe, expect, it, vi } from "vitest"

const falhas = vi.hoisted(() => [] as any[])
vi.mock("./aliancaFalha", () => ({ falhaAlta: (...a: any[]) => falhas.push(a) }))

import { arAutorizado, autorizarAr, dispararNoAlvo, gavetaNaoToca } from "./aliancaGavetaToque"

describe("a guarda da biblioteca (fatia 6)", () => {
    it("vale SEMPRE, e so abre dentro de autorizarAr", () => {
        expect(gavetaNaoToca()).toBe(true)
        autorizarAr(() => {
            expect(gavetaNaoToca()).toBe(false)
            expect(arAutorizado()).toBe(true)
        })
        expect(gavetaNaoToca()).toBe(true)
        expect(arAutorizado()).toBe(false)
    })
    it("nunca deixa a guarda aberta, nem quando o gesto lanca", () => {
        expect(() =>
            autorizarAr(() => {
                throw new Error("boom")
            })
        ).toThrow("boom")
        expect(gavetaNaoToca()).toBe(true)
    })
    it("autorizacao aninhada fecha so no fim", () => {
        autorizarAr(() => {
            autorizarAr(() => {})
            expect(gavetaNaoToca()).toBe(false)
        })
        expect(gavetaNaoToca()).toBe(true)
    })
    it("dispararNoAlvo sem item acende a falha (defeito de codigo)", () => {
        falhas.length = 0
        expect(dispararNoAlvo(null)).toBe(false)
        expect(falhas.length).toBe(1)
    })
    it("revisao da fatia 6, achado 10: item que saiu da tela (lista recriada) devolve false, sem faixa de falha (quem chama avisa o operador)", () => {
        falhas.length = 0
        expect(dispararNoAlvo({ isConnected: false } as any)).toBe(false)
        expect(falhas.length).toBe(0)
    })
})
