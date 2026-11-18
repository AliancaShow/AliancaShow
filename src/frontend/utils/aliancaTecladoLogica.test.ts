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
    it("em Editar morre sempre", () => {
        expect(tecladoVivo("editar", false)).toBe(false)
        expect(tecladoVivo("editar", true)).toBe(false)
    })
})
