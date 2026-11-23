// Cabine 6 (Andre, 23/nov): o app abre com o telao ligado. O padrao e aplicado UMA vez por perfil; depois quem manda e o operador.
import { get } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./language", () => ({ setLanguage: vi.fn() }))
vi.mock("../components/helpers/output", () => ({ refreshOut: vi.fn() }))
vi.mock("../IPC/main", () => ({ sendMain: vi.fn() }))
vi.mock("./request", () => ({ send: vi.fn() }))
vi.mock("./updateSettings", () => ({ updateThemeValues: vi.fn() }))
vi.mock("./save", async () => {
    const s = await import("../stores")
    return { getSyncedSettings: () => ({ styles: s.styles }) }
})

import { autoOutput, special } from "../stores"
import { alteracoesNaoSalvas, iniciarRascunho, pararRascunho, tirarFoto } from "./aliancaConfigRascunho"
import { aplicarPadraoDaPartida, MARCA_PARTIDA, precisaPadraoDaPartida } from "./aliancaTelaoPartida"

beforeEach(() => {
    pararRascunho()
    autoOutput.set(false)
    special.set({ outra: 1 })
    tirarFoto()
})

describe("telao ligado na partida", () => {
    it("perfil sem a marca: liga 'Mostrar tela de saida ao iniciar' e marca", () => {
        expect(precisaPadraoDaPartida(get(special))).toBe(true)
        expect(aplicarPadraoDaPartida()).toBe(true)
        expect(get(autoOutput)).toBe(true)
        expect(get(special)[MARCA_PARTIDA]).toBe(true)
        expect(get(special).outra).toBe(1)
    })
    it("so uma vez: se o operador desligou a opcao depois, ela fica desligada (nada volta sozinho)", () => {
        aplicarPadraoDaPartida()
        autoOutput.set(false)
        expect(aplicarPadraoDaPartida()).toBe(false)
        expect(get(autoOutput)).toBe(false)
    })
    it("com Configuracoes aberta nao conta como alteracao nao salva", async () => {
        iniciarRascunho()
        aplicarPadraoDaPartida()
        await new Promise((r) => setTimeout(r, 200))
        expect(get(alteracoesNaoSalvas)).toBe(0)
    })
})
