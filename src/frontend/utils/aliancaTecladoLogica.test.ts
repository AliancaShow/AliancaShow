import { describe, expect, it } from "vitest"
import { tecladoVivo } from "./aliancaTecladoLogica"

describe("teclado da saida por tela (decisao provisoria, revisao da fatia 2)", () => {
    it("em Mostrar vive, com ou sem campo de texto (o resto do Preview ja trata o campo)", () => {
        expect(tecladoVivo("mostrar", false)).toBe(true)
        expect(tecladoVivo("mostrar", true)).toBe(true)
    })
    it("em pagina do menu (Configuracoes, Telas, Ferramentas) vive: o passador do pastor e o Esc de panico funcionam", () => {
        expect(tecladoVivo("pagina", false)).toBe(true)
    })
    it("em pagina do menu com o foco num campo de texto a tecla e do campo", () => {
        expect(tecladoVivo("pagina", true)).toBe(false)
    })
    it("em Editar morre, exceto o Esc (fatia 3): setas, Espaco, PageDown e F1-F5 seguem mortos", () => {
        expect(tecladoVivo("editar", false)).toBe(false)
        expect(tecladoVivo("editar", true)).toBe(false)
        for (const k of ["ArrowRight", "ArrowLeft", " ", "PageDown", "PageUp", "Home", "End", "F1", "F2", "F3", "F4", "F5", "."]) expect(tecladoVivo("editar", false, k)).toBe(false)
        expect(tecladoVivo("editar", false, "Escape")).toBe(true)
    })
    it("em Editar, Esc com o foco num campo de texto e do campo (so tira o foco)", () => {
        expect(tecladoVivo("editar", true, "Escape")).toBe(false)
    })
    it("o Esc nao muda nada em Mostrar e nas paginas", () => {
        expect(tecladoVivo("mostrar", false, "Escape")).toBe(true)
        expect(tecladoVivo("pagina", false, "Escape")).toBe(true)
        expect(tecladoVivo("pagina", true, "Escape")).toBe(false)
    })
})
