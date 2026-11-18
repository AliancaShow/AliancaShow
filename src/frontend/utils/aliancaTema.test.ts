import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Os stores reais puxam o app inteiro; aqui entram stores de verdade (svelte/store) no lugar (vi.doMock).
const stores = vi.hoisted(() => ({ current: null as any }))
let doc: { body: { dataset: Record<string, string> } }

async function carregar() {
    vi.resetModules()
    const { writable: w } = await import("svelte/store")
    stores.current = { currentWindow: w<string | null>(null) }
    vi.doMock("../stores", () => stores.current)
    return await import("./aliancaTema")
}

beforeEach(() => {
    doc = { body: { dataset: {} } }
    ;(globalThis as any).document = doc
})
afterEach(() => {
    delete (globalThis as any).document
    vi.doUnmock("../stores")
})

describe("tema Luz de Projecao (uma aparencia so)", () => {
    it("a janela principal recebe data-tema=luz, sempre", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        expect(doc.body.dataset.tema).toBe("luz")
    })
    it("a saida (currentWindow definido) nunca recebe o atributo", async () => {
        const m = await carregar()
        stores.current.currentWindow.set("output")
        m.iniciarTemaAlianca()
        expect(doc.body.dataset.tema).toBeUndefined()
    })
    it("nao existe fonte do Preparar nem tema padrao: so o atributo tema", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        expect(Object.keys(doc.body.dataset)).toEqual(["tema"])
    })
    it("idempotente e sem lancar", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        expect(() => m.iniciarTemaAlianca()).not.toThrow()
        expect(() => m.aplicarTemaAlianca()).not.toThrow()
    })
})
