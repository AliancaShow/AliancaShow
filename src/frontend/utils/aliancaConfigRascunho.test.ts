// Configuracoes (C4): o Descartar de verdade, falando com as lojas do app (a parte pura esta em aliancaConfigRascunhoLogica.test.ts).
import { get } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"

const efeitos = vi.hoisted(() => ({ setLanguage: vi.fn(), refreshOut: vi.fn(), sendMain: vi.fn(), send: vi.fn(), updateThemeValues: vi.fn() }))
vi.mock("./language", () => ({ setLanguage: efeitos.setLanguage }))
vi.mock("../components/helpers/output", () => ({ refreshOut: efeitos.refreshOut }))
vi.mock("../IPC/main", () => ({ sendMain: efeitos.sendMain }))
vi.mock("./request", () => ({ send: efeitos.send }))
vi.mock("./updateSettings", () => ({ updateThemeValues: efeitos.updateThemeValues }))
vi.mock("./save", async () => {
    const s = await import("../stores")
    return { getSyncedSettings: () => ({ styles: s.styles, companion: s.companion }) }
})

import { labelsDisabled, language, outputs, special, styles, theme, themes, disabledServers } from "../stores"
import { alteracoesNaoSalvas, descartarAlteracoes, pararRascunho, iniciarRascunho, tirarFoto } from "./aliancaConfigRascunho"

beforeEach(() => {
    vi.clearAllMocks()
    efeitos.setLanguage.mockImplementation((l: string) => language.set(l)) // o setLanguage real grava a loja e carrega o dicionario
    pararRascunho()
    labelsDisabled.set(false)
    language.set("pt")
    special.set({ a: 1 })
    theme.set("default")
    themes.set({ default: { name: "d" } as any })
    disabledServers.set({})
    styles.set({ s1: { name: "S1" } as any })
    outputs.set({ a: { name: "Telão", style: "s1", enabled: true, alwaysOnTop: true } as any })
    tirarFoto()
})

describe("descartarAlteracoes", () => {
    it("varias chaves de uma vez: lojas simples, special, idioma, tema e saida; o contador volta a 0 de verdade", () => {
        iniciarRascunho()
        labelsDisabled.set(true)
        special.set({ a: 2 })
        language.set("en")
        disabledServers.set({ remote: true })
        outputs.update((o: any) => ({ ...o, a: { ...o.a, name: "Outro", alwaysOnTop: false, style: "" } }))
        const r = descartarAlteracoes()
        expect(r.restantes).toBe(0)
        expect(r.desfeitas).toBe(5)
        expect(get(labelsDisabled)).toBe(false)
        expect(get(special)).toEqual({ a: 1 })
        expect(get(outputs).a.name).toBe("Telão")
        expect(get(outputs).a.alwaysOnTop).toBe(true)
        expect(get(outputs).a.style).toBe("s1")
        expect(get(alteracoesNaoSalvas)).toBe(0)
        // efeitos refeitos: idioma pelo caminho da aba, servidores reiniciados, sempre-no-topo reenviado a janela
        expect(efeitos.setLanguage).toHaveBeenCalledWith("pt")
        expect(efeitos.sendMain).toHaveBeenCalledTimes(1)
        expect(efeitos.send).toHaveBeenCalledWith("OUTPUT", ["SET_VALUE"], { id: "a", key: "alwaysOnTop", value: true })
    })

    it("saida CRIADA depois da foto nao conta, nao e removida e o Descartar nao fica preso", () => {
        iniciarRascunho()
        outputs.update((o: any) => ({ ...o, nova: { name: "Nova", enabled: false } }))
        expect(descartarAlteracoes()).toEqual({ desfeitas: 0, restantes: 0 })
        expect(get(outputs).nova).toBeDefined()
        expect(get(alteracoesNaoSalvas)).toBe(0)
    })

    it("saida APAGADA depois da foto nao volta e nao conta", () => {
        iniciarRascunho()
        outputs.set({})
        expect(descartarAlteracoes()).toEqual({ desfeitas: 0, restantes: 0 })
        expect(get(outputs).a).toBeUndefined()
    })

    it("ligar/desligar a saida vale na hora: nao conta e nao e desfeito", () => {
        iniciarRascunho()
        outputs.update((o: any) => ({ ...o, a: { ...o.a, enabled: false, ndi: true } }))
        expect(descartarAlteracoes().desfeitas).toBe(0)
        expect(get(outputs).a.enabled).toBe(false)
    })

    it("reabrir a pagina nao renova a foto: a mudanca segue pendente e ainda e descartavel", () => {
        iniciarRascunho()
        labelsDisabled.set(true)
        pararRascunho() // fechou Configuracoes
        iniciarRascunho() // reabriu
        expect(get(alteracoesNaoSalvas)).toBe(1)
        expect(descartarAlteracoes().restantes).toBe(0)
        expect(get(labelsDisabled)).toBe(false)
    })
})
