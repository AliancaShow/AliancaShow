// Propriedades do Editar (C4): resumo da secao recolhida. Parte pura.
import { describe, expect, it } from "vitest"
import { resumoDaSecao, resumoDoGrupo } from "./aliancaResumoSecao"

describe("resumo da secao recolhida", () => {
    it("efeito sem mudanca diz desligado; o resto diz padrao", () => {
        expect(resumoDaSecao({ id: "outline", mudou: false, valores: [] })).toBe("desligado")
        expect(resumoDaSecao({ id: "text", mudou: false, valores: [] })).toBe("padrão")
    })
    it("com mudanca mostra ate quatro valores", () => {
        expect(resumoDaSecao({ id: "shadow", mudou: true, valores: [0, 2, 10, "#000000", 45] })).toBe("0 · 2 · 10 · #000000")
    })
    it("ignora vazio, nulo e booleano; sem nada util diz alterado", () => {
        expect(resumoDaSecao({ id: "shadow", mudou: true, valores: ["", null, undefined, true] })).toBe("alterado")
    })
    it("tira aspas de nome de fonte", () => {
        expect(resumoDaSecao({ id: "text", mudou: true, valores: ["'Montserrat'", 100] })).toBe("Montserrat · 100")
    })
})

describe("resumo do grupo fechado", () => {
    it("nada, um, dois e muitos", () => {
        expect(resumoDoGrupo([])).toBe("tudo no padrão")
        expect(resumoDoGrupo(["Sombra"])).toBe("Sombra alterado")
        expect(resumoDoGrupo(["Sombra", "Contorno"])).toBe("Sombra e Contorno alterados")
        expect(resumoDoGrupo(["a", "b", "c"])).toBe("3 seções alteradas")
    })
})
