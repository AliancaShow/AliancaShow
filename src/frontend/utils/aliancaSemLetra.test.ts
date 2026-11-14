import { describe, expect, it } from "vitest"
import { ehSemLetra, temTexto, textoDasPendencias } from "./aliancaSemLetraLogica"

const comTexto = { slides: { a: { items: [{ lines: [{ text: [{ value: "Santo" }] }] }] } } }
const vazio = { slides: {} }
const soEspaco = { slides: { a: { items: [{ lines: [{ text: [{ value: "  " }] }] }] } } }

describe("ehSemLetra", () => {
    it("carregado: vale o texto dos slides", () => {
        expect(ehSemLetra({ ehMusica: true, carregado: vazio, textoDoCache: "santo" })).toBe(true)
        expect(ehSemLetra({ ehMusica: true, carregado: soEspaco, textoDoCache: undefined })).toBe(true)
        expect(ehSemLetra({ ehMusica: true, carregado: comTexto, textoDoCache: "" })).toBe(false)
    })
    it("não carregado: vale o textCache; sem cache não sabe, não conta", () => {
        expect(ehSemLetra({ ehMusica: true, carregado: undefined, textoDoCache: "" })).toBe(true)
        expect(ehSemLetra({ ehMusica: true, carregado: undefined, textoDoCache: " " })).toBe(true)
        expect(ehSemLetra({ ehMusica: true, carregado: undefined, textoDoCache: "oi" })).toBe(false)
        expect(ehSemLetra({ ehMusica: true, carregado: undefined, textoDoCache: undefined })).toBe(false)
    })
    it("só categoria de música conta", () => {
        expect(ehSemLetra({ ehMusica: false, carregado: vazio, textoDoCache: "" })).toBe(false)
    })
    it("temTexto", () => {
        expect(temTexto(null)).toBe(false)
        expect(temTexto(comTexto)).toBe(true)
    })
})

describe("textoDasPendencias", () => {
    it("na ordem 'N pra conferir · K sem letra', só o que existe", () => {
        expect(textoDasPendencias({ conferir: 2, semLetra: 3 })).toBe("2 pra conferir · 3 sem letra")
        expect(textoDasPendencias({ conferir: 0, semLetra: 3 })).toBe("3 sem letra")
        expect(textoDasPendencias({ conferir: 2, semLetra: 0 })).toBe("2 pra conferir")
        expect(textoDasPendencias({ conferir: 0, semLetra: 0 })).toBe("")
    })
})
