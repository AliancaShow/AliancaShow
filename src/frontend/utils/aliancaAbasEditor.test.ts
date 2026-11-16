import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _zerarFalhas, falhas } from "./aliancaFalha"

// A gaveta esta em "shows" e o editor esconde essa aba: iniciarAbasDoEditor troca para outra, e o `set` da aba lanca.
vi.mock("../stores", () => {
    const modoAlianca = writable("preparar")
    const activePage = writable("show")
    const activeEdit = writable<any>({ type: "show" })
    const activeDrawerTab = {
        subscribe: writable("shows").subscribe,
        set: () => {
            throw new Error("aba quebrada")
        },
        update: () => {}
    }
    return { modoAlianca, activePage, activeEdit, activeDrawerTab, currentWindow: writable(null), drawerTabsData: { culto: writable({}) } }
})
vi.mock("./aliancaPastasMidiaEstado", () => ({ pastas: writable([]) }))

import { activePage } from "../stores"
import { iniciarAbasDoEditor } from "./aliancaAbasEditor"

let erro: ReturnType<typeof vi.spyOn>
beforeEach(() => {
    _zerarFalhas()
    erro = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
    erro.mockRestore()
    _zerarFalhas()
})

describe("iniciarAbasDoEditor: falha", () => {
    it("trocar a aba lanca: nenhuma excecao sobe e a falha fica alta (abas-do-editor)", () => {
        expect(() => {
            iniciarAbasDoEditor()
            ;(activePage as any).set("edit")
        }).not.toThrow()
        expect(get(falhas).map((f) => f.origem)).toContain("abas-do-editor")
    })
})
