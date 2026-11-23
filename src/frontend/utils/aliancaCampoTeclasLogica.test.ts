import { describe, expect, it } from "vitest"
import { teclaNoCampo } from "./aliancaCampoTeclasLogica"

describe("Esc e panico nos campos da coluna No ar (cabine 6, 23/nov)", () => {
    it("o 1o Esc solta o cursor (o campo nunca o engole calado)", () => {
        expect(teclaNoCampo({ key: "Escape" })).toBe("soltar")
    })
    it("F1-F5 passam mesmo digitando", () => {
        for (const k of ["F1", "F2", "F3", "F4", "F5"]) expect(teclaNoCampo({ key: k })).toBe("passar")
        expect(teclaNoCampo({ key: "F6" })).toBe("campo")
        expect(teclaNoCampo({ key: "F11" })).toBe("campo")
    })
    it("Ctrl+L (congelar) passa; L sozinho e Ctrl+Alt+L sao do campo", () => {
        expect(teclaNoCampo({ key: "l", ctrlKey: true })).toBe("passar")
        expect(teclaNoCampo({ key: "L", ctrlKey: true })).toBe("passar")
        expect(teclaNoCampo({ key: "l", metaKey: true })).toBe("passar")
        expect(teclaNoCampo({ key: "l" })).toBe("campo")
        expect(teclaNoCampo({ key: "l", ctrlKey: true, altKey: true })).toBe("campo")
    })
    it("digitar, espaco, setas e Enter ficam no campo", () => {
        for (const k of ["a", " ", "ArrowRight", "ArrowLeft", "Enter", "Backspace"]) expect(teclaNoCampo({ key: k })).toBe("campo")
    })
    it("compondo (IME) tudo e do campo", () => {
        expect(teclaNoCampo({ key: "Escape", isComposing: true })).toBe("campo")
    })
})
