import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _zerarFalhas, configurarRegistroDeFalha, falhaAlta, falhas } from "./aliancaFalha"

let erro: ReturnType<typeof vi.spyOn>
beforeEach(() => {
    _zerarFalhas()
    erro = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
    erro.mockRestore()
    _zerarFalhas()
})

const linhasDeFalha = () => erro.mock.calls.filter((c) => String(c[0]).startsWith("[AliancaShow] FALHA em ")).length

describe("falhaAlta", () => {
    it("(1) 3 chamadas da mesma origem: 3 linhas de console.error, vezes 3", () => {
        for (let i = 0; i < 3; i++) falhaAlta("a", new Error("x"))
        expect(linhasDeFalha()).toBe(3)
        expect(get(falhas)).toHaveLength(1)
        expect(get(falhas)[0]).toMatchObject({ origem: "a", mensagem: "x", vezes: 3 })
    })
    it("(2) 1.000 chamadas da mesma origem: no maximo 30 linhas, vezes 1000", () => {
        for (let i = 0; i < 1000; i++) falhaAlta("a", new Error("x"))
        expect(linhasDeFalha()).toBeLessThanOrEqual(30)
        expect(get(falhas)[0].vezes).toBe(1000)
    })
    it("(3) duas origens viram duas entradas", () => {
        falhaAlta("a", new Error("x"))
        falhaAlta("b", new Error("y"))
        expect(get(falhas).map((f) => f.origem)).toEqual(["a", "b"])
    })
    it("(4) erro que nao e Error vira texto", () => {
        falhaAlta("a", "so texto")
        falhaAlta("b", 42)
        falhaAlta("c", null)
        expect(get(falhas).map((f) => f.mensagem)).toEqual(["so texto", "42", "null"])
    })
    it("(5) erro com toString e message que lancam: nao lanca e cria a entrada", () => {
        const feio = {
            get message(): string {
                throw new Error("message")
            },
            toString() {
                throw new Error("toString")
            }
        }
        expect(() => falhaAlta("a", feio)).not.toThrow()
        expect(get(falhas)[0]).toMatchObject({ origem: "a", mensagem: "(mensagem ilegivel)", vezes: 1 })
    })
    it("(6) console.error que lanca: nao lanca e a contagem segue", () => {
        erro.mockImplementation(() => {
            throw new Error("console quebrado")
        })
        expect(() => falhaAlta("a", new Error("x"))).not.toThrow()
        expect(() => falhaAlta("a", new Error("x"))).not.toThrow()
        expect(get(falhas)[0].vezes).toBe(2)
    })
    it("(7) registro: 3 falhas da mesma origem = 1 chamada; 2 origens = 2 chamadas, com origem, mensagem e pilha", () => {
        const espiao = vi.fn()
        configurarRegistroDeFalha(espiao)
        for (let i = 0; i < 3; i++) falhaAlta("a", new Error("x"))
        expect(espiao).toHaveBeenCalledTimes(1)
        falhaAlta("b", new Error("y"))
        expect(espiao).toHaveBeenCalledTimes(2)
        expect(espiao.mock.calls[0][0]).toMatchObject({ origem: "a", mensagem: "x" })
        expect(espiao.mock.calls[0][0].pilha).toContain("Error")
        expect(espiao.mock.calls[1][0]).toMatchObject({ origem: "b", mensagem: "y" })
        expect(typeof espiao.mock.calls[1][0].pilha).toBe("string")
    })
    it("(7b) falha anterior ao registro nao perde o rastro: a proxima, ja com registro, grava", () => {
        falhaAlta("a", new Error("x"))
        const espiao = vi.fn()
        configurarRegistroDeFalha(espiao)
        falhaAlta("a", new Error("x"))
        expect(espiao).toHaveBeenCalledTimes(1)
    })
    it("(8) registro que lanca: nao lanca", () => {
        configurarRegistroDeFalha(() => {
            throw new Error("disco")
        })
        expect(() => falhaAlta("a", new Error("x"))).not.toThrow()
        expect(get(falhas)[0].vezes).toBe(1)
    })
    it("(9) _zerarFalhas limpa tudo", () => {
        const espiao = vi.fn()
        configurarRegistroDeFalha(espiao)
        falhaAlta("a", new Error("x"))
        _zerarFalhas()
        expect(get(falhas)).toEqual([])
        falhaAlta("a", new Error("x"))
        expect(get(falhas)[0].vezes).toBe(1)
        expect(espiao).toHaveBeenCalledTimes(1) // o registro tambem foi solto
        expect(linhasDeFalha()).toBe(2)
    })
})
