import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _zerarFalhas, falhas } from "./aliancaFalha"

// `modoAlianca` cujo `get` lanca: a escolha do lado nao pode calar
vi.mock("../stores", () => ({
    modoAlianca: {
        subscribe: () => {
            throw new Error("modo quebrado")
        }
    },
    activePage: writable("show"),
    currentWindow: writable(null),
    drawerTabsData: { culto: writable({}) }
}))
vi.mock("./aliancaPastasMidiaEstado", () => ({ pastas: writable([]) }))

import { chaveDoModo } from "./aliancaLayoutEstado"

let erro: ReturnType<typeof vi.spyOn>
beforeEach(() => {
    _zerarFalhas()
    erro = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
    erro.mockRestore()
    _zerarFalhas()
})

describe("chaveDoModo: falha", () => {
    it("modo que lanca: devolve o Culto e a falha fica alta (chave-do-modo)", () => {
        expect(chaveDoModo()).toBe("culto")
        expect(get(falhas)).toHaveLength(1)
        expect(get(falhas)[0]).toMatchObject({ origem: "chave-do-modo", vezes: 1 })
    })
    it("a cada chamada conta (nao avisa so uma vez)", () => {
        chaveDoModo()
        chaveDoModo()
        expect(get(falhas)[0].vezes).toBe(2)
    })
})
