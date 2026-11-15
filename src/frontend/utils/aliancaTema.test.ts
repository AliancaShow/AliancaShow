import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Os stores reais puxam o app inteiro; aqui entram stores de verdade (svelte/store) no lugar (vi.doMock), para poder espiar `subscribe`.
const stores = vi.hoisted(() => ({ current: null as any }))

type Doc = { body: { dataset: Record<string, string> }; fonts: { load: ReturnType<typeof vi.fn> } }
let doc: Doc
let liberar: (() => void)[] = []

async function carregar() {
    vi.resetModules()
    const { writable: w } = await import("svelte/store")
    stores.current = {
        currentWindow: w<string | null>(null),
        modoAlianca: w<string>("culto"),
        special: w<any>({}),
        theme: w<string>("default"),
        themes: w<any>({ default: { colors: { secondary: "#f21a27" }, font: { family: "" } } })
    }
    vi.doMock("../stores", () => stores.current)
    return await import("./aliancaTema")
}

beforeEach(() => {
    liberar = []
    doc = { body: { dataset: {} }, fonts: { load: vi.fn(() => new Promise<void>((r) => liberar.push(r))) } }
    ;(globalThis as any).document = doc
})
afterEach(() => {
    delete (globalThis as any).document
    vi.restoreAllMocks()
})

const espiar = (s: any) => vi.spyOn(s, "subscribe")

describe("iniciarTemaAlianca: janela principal", () => {
    it("escreve data-tema no tema de fábrica", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        expect(doc.body.dataset.tema).toBe("padrao")
        expect(doc.body.dataset.fonte).toBeUndefined()
    })

    it("o atributo segue o tema em tempo real e some com tema próprio", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        stores.current.theme.set("blue")
        stores.current.themes.update((t: any) => ({ ...t, blue: { colors: { secondary: "#0000ff" }, font: { family: "Trebuchet MS" } } }))
        expect(doc.body.dataset.tema).toBeUndefined()
        stores.current.theme.set("default")
        expect(doc.body.dataset.tema).toBe("padrao")
    })

    it("a chave técnica desliga em tempo real", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        stores.current.special.set({ aliancaVisual: false })
        expect(doc.body.dataset.tema).toBeUndefined()
        stores.current.special.set({})
        expect(doc.body.dataset.tema).toBe("padrao")
    })

    it("chamada dupla assina uma vez", async () => {
        const m = await carregar()
        const espioes = ["theme", "themes", "modoAlianca", "special"].map((k) => espiar(stores.current[k]))
        m.iniciarTemaAlianca()
        const depoisDaPrimeira = espioes.map((e) => e.mock.calls.length)
        expect(depoisDaPrimeira.every((n) => n > 0)).toBe(true)
        m.iniciarTemaAlianca()
        // a segunda chamada nao assina nada de novo (os get() de dentro do aplicar tambem contam, mas so rodam quando uma store muda)
        expect(espioes.map((e) => e.mock.calls.length)).toEqual(depoisDaPrimeira)
    })

    it("sem document.body não lança", async () => {
        const m = await carregar()
        ;(globalThis as any).document = { body: null, fonts: { load: vi.fn() } }
        expect(() => m.iniciarTemaAlianca()).not.toThrow()
        delete (globalThis as any).document
        expect(() => m.aplicarTemaAlianca()).not.toThrow()
    })

    it("caminho feliz não escreve em console", async () => {
        const m = await carregar()
        const log = vi.spyOn(console, "log")
        const err = vi.spyOn(console, "error")
        const warn = vi.spyOn(console, "warn")
        m.iniciarTemaAlianca()
        stores.current.modoAlianca.set("preparar")
        liberar.forEach((r) => r())
        await Promise.resolve()
        expect(log).not.toHaveBeenCalled()
        expect(err).not.toHaveBeenCalled()
        expect(warn).not.toHaveBeenCalled()
    })
})

describe("iniciarTemaAlianca: outras janelas", () => {
    for (const janela of ["output", "pdf", "stage"]) {
        it(`${janela}: não toca no body e não assina nenhuma store`, async () => {
            const m = await carregar()
            stores.current.currentWindow.set(janela)
            const espioes = ["theme", "themes", "modoAlianca", "special"].map((k) => espiar(stores.current[k]))
            m.iniciarTemaAlianca()
            expect(doc.body.dataset).toEqual({})
            for (const e of espioes) expect(e).not.toHaveBeenCalled()
            expect(doc.fonts.load).not.toHaveBeenCalled()
        })
    }
})

describe("a fonte do Preparar", () => {
    it("só entra depois do arquivo carregar", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        stores.current.modoAlianca.set("preparar")
        expect(doc.body.dataset.fonte).toBeUndefined()
        expect(doc.fonts.load).toHaveBeenCalledTimes(2)
        liberar.forEach((r) => r())
        await new Promise((r) => setTimeout(r, 0))
        expect(doc.body.dataset.fonte).toBe("prep")
    })

    it("sair do Preparar apaga na hora", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        stores.current.modoAlianca.set("preparar")
        liberar.forEach((r) => r())
        await new Promise((r) => setTimeout(r, 0))
        expect(doc.body.dataset.fonte).toBe("prep")
        stores.current.modoAlianca.set("culto")
        expect(doc.body.dataset.fonte).toBeUndefined()
    })

    it("CORRIDA: entrar no Preparar, voltar ao Culto e só então a fonte terminar de carregar NÃO liga o atributo", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        stores.current.modoAlianca.set("preparar")
        stores.current.modoAlianca.set("culto")
        liberar.forEach((r) => r())
        await new Promise((r) => setTimeout(r, 0))
        expect(doc.body.dataset.fonte).toBeUndefined()
    })

    it("CORRIDA com ida e volta e ida: só a última espera vale", async () => {
        const m = await carregar()
        m.iniciarTemaAlianca()
        stores.current.modoAlianca.set("preparar")
        stores.current.modoAlianca.set("culto")
        stores.current.modoAlianca.set("preparar")
        liberar.forEach((r) => r())
        await new Promise((r) => setTimeout(r, 0))
        expect(doc.body.dataset.fonte).toBe("prep")
        stores.current.modoAlianca.set("culto")
        expect(doc.body.dataset.fonte).toBeUndefined()
    })

    it("o teto de espera (400 ms) liga mesmo se o carregamento nunca resolve", async () => {
        vi.useFakeTimers()
        try {
            const m = await carregar()
            m.iniciarTemaAlianca()
            stores.current.modoAlianca.set("preparar")
            await vi.advanceTimersByTimeAsync(450)
            expect(doc.body.dataset.fonte).toBe("prep")
        } finally {
            vi.useRealTimers()
        }
    })

    it("tema com fonte própria não recebe data-fonte", async () => {
        const m = await carregar()
        stores.current.theme.set("dark")
        stores.current.themes.set({ dark: { colors: { secondary: "#f21a27" }, font: { family: "monospace" } } })
        m.iniciarTemaAlianca()
        stores.current.modoAlianca.set("preparar")
        liberar.forEach((r) => r())
        await new Promise((r) => setTimeout(r, 0))
        expect(doc.body.dataset.fonte).toBeUndefined()
        expect(doc.fonts.load).not.toHaveBeenCalled()
    })
})
