import { beforeEach, describe, expect, it, vi } from "vitest"

const chamadas = vi.hoisted(() => ({ mandar: [] as any[], falhas: [] as any[] }))
vi.mock("../../utils/aliancaEditarAcoes", () => ({
    mandarSlideAoAr: (...a: any[]) => {
        chamadas.mandar.push(a)
        return true
    },
    prepararEdicaoDoShow: () => {}
}))
vi.mock("../../utils/aliancaFalha", () => ({
    falhaAlta: (...a: any[]) => {
        chamadas.falhas.push(a)
    }
}))

import { activeShow } from "../../stores"
import { trocarTela } from "../../utils/aliancaTela"
import { acaoDeEditar } from "./aliancaMenusEditar"

const slideEl = (indice: string | null) => ({ closest: () => ({ getAttribute: (n: string) => (n === "data-indice" ? indice : null) }) }) as any
const sel = (...indices: number[]) => ({ id: "slide", data: indices.map((index) => ({ index, showId: "show" })) })

beforeEach(() => {
    chamadas.mandar.length = 0
    chamadas.falhas.length = 0
    activeShow.set({ id: "show" } as any)
    trocarTela("edit", "botao-direito")
})

describe("botao direito de Editar age no slide CLICADO (achado 3)", () => {
    it("Ctrl+clique no 2 e no 5, botao direito no 5: Mandar pro ar leva o 5", () => {
        acaoDeEditar({ id: "alianca_ar", menu: {} as any, contextElem: slideEl("5"), sel: sel(2, 5) })
        expect(chamadas.mandar).toEqual([["show", 5]])
    })
    it("Mandar so para leva o slide clicado e a tela do menu", () => {
        acaoDeEditar({ id: "alianca_so", menu: { id: "B" } as any, contextElem: slideEl("2"), sel: sel(5, 2) })
        expect(chamadas.mandar).toEqual([["show", 2, "B"]])
    })
    it("slide clicado fora da selecao ou sem marca no elemento: nao manda e acende a falha", () => {
        acaoDeEditar({ id: "alianca_ar", menu: {} as any, contextElem: slideEl("7"), sel: sel(2, 5) })
        acaoDeEditar({ id: "alianca_ar", menu: {} as any, contextElem: slideEl(null), sel: sel(2, 5) })
        expect(chamadas.mandar).toEqual([])
        expect(chamadas.falhas.length).toBe(2)
    })
    it("um slide so selecionado e o clicado: segue como antes", () => {
        acaoDeEditar({ id: "alianca_ar", menu: {} as any, contextElem: slideEl("3"), sel: sel(3) })
        expect(chamadas.mandar).toEqual([["show", 3]])
    })
})
