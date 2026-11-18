import { describe, expect, it } from "vitest"
import { marcadoDoSegmentado } from "./aliancaSegmentadoLogica"

describe("marcadoDoSegmentado", () => {
    it("a aba acesa e a da tela", () => {
        expect(marcadoDoSegmentado("mostrar")).toBe("mostrar")
        expect(marcadoDoSegmentado("editar")).toBe("editar")
    })
    it("paginas do menu: nenhuma aba acesa", () => {
        expect(marcadoDoSegmentado("pagina")).toBeNull()
    })
})
