import { describe, expect, it } from "vitest"
import { atributosDoTema, fonteDoTemaEhLivre } from "./aliancaTemaLogica"

const padrao = { colors: { secondary: "#f21a27" }, font: { family: "" } }

describe("atributosDoTema", () => {
    it("tema de fábrica com o acento original liga o laranja (maiúsculo ou minúsculo)", () => {
        expect(atributosDoTema({ id: "default", tema: padrao, modo: "culto" }).tema).toBe("padrao")
        expect(atributosDoTema({ id: "default", tema: { colors: { secondary: "#F21A27" } }, modo: "culto" }).tema).toBe("padrao")
    })

    it("acento editado, outro tema, tema vazio ou ausente não ligam", () => {
        expect(atributosDoTema({ id: "default", tema: { colors: { secondary: "#e6349c" } }, modo: "culto" }).tema).toBeNull()
        expect(atributosDoTema({ id: "blue", tema: { colors: { secondary: "#f21a27" } }, modo: "culto" }).tema).toBeNull()
        expect(atributosDoTema({ id: "default", tema: {}, modo: "culto" }).tema).toBeNull()
        expect(atributosDoTema({ id: "default", tema: undefined, modo: "preparar" })).toEqual({ tema: null, fonte: null })
        expect(atributosDoTema({ id: "default", tema: null, modo: "preparar" })).toEqual({ tema: null, fonte: null })
    })

    it("a fonte liga só no Preparar e só se o tema não fixou fonte", () => {
        expect(atributosDoTema({ id: "default", tema: padrao, modo: "preparar" }).fonte).toBe("prep")
        expect(atributosDoTema({ id: "default", tema: padrao, modo: "culto" }).fonte).toBeNull()
        expect(atributosDoTema({ id: "x", tema: { colors: { secondary: "#123456" }, font: { family: "sans-serif" } }, modo: "preparar" }).fonte).toBe("prep")
        expect(atributosDoTema({ id: "x", tema: { colors: { secondary: "#123456" } }, modo: "preparar" }).fonte).toBe("prep")
        expect(atributosDoTema({ id: "dark", tema: { colors: { secondary: "#f21a27" }, font: { family: "monospace" } }, modo: "preparar" }).fonte).toBeNull()
        expect(atributosDoTema({ id: "blue", tema: { colors: { secondary: "#0000ff" }, font: { family: "Trebuchet MS" } }, modo: "preparar" }).fonte).toBeNull()
    })

    it("a fonte independe do laranja: tema próprio sem fonte fixa recebe só a fonte", () => {
        expect(atributosDoTema({ id: "meu", tema: { colors: { secondary: "#00ff00" }, font: { family: "" } }, modo: "preparar" })).toEqual({ tema: null, fonte: "prep" })
    })

    it("modo desconhecido vira null", () => {
        expect(atributosDoTema({ id: "default", tema: padrao, modo: "qualquer" }).fonte).toBeNull()
        expect(atributosDoTema({ id: "default", tema: padrao, modo: "" }).fonte).toBeNull()
    })

    it("a chave técnica desliga tudo", () => {
        expect(atributosDoTema({ id: "default", tema: padrao, modo: "preparar", desligado: true })).toEqual({ tema: null, fonte: null })
        expect(atributosDoTema({ id: "default", tema: padrao, modo: "preparar", desligado: false })).toEqual({ tema: "padrao", fonte: "prep" })
    })

    it("fonteDoTemaEhLivre", () => {
        expect(fonteDoTemaEhLivre("")).toBe(true)
        expect(fonteDoTemaEhLivre(undefined)).toBe(true)
        expect(fonteDoTemaEhLivre("sans-serif")).toBe(true)
        expect(fonteDoTemaEhLivre("monospace")).toBe(false)
    })
})
