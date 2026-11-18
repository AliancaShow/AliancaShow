import { describe, expect, it } from "vitest"
import { marcadoDoSegmentado } from "./aliancaSegmentadoLogica"

describe("marcadoDoSegmentado", () => {
    it("pagina e modo concordam: a aba da pagina, sem alerta", () => {
        expect(marcadoDoSegmentado("show", "culto")).toEqual({ marcado: "mostrar", cruzado: false })
        expect(marcadoDoSegmentado("edit", "preparar")).toEqual({ marcado: "editar", cruzado: false })
    })
    it("estado cruzado: a aba segue o MODO (o que o teclado obedece) e acende o alerta", () => {
        expect(marcadoDoSegmentado("show", "preparar")).toEqual({ marcado: "editar", cruzado: true })
        expect(marcadoDoSegmentado("edit", "culto")).toEqual({ marcado: "mostrar", cruzado: true })
    })
    it("paginas do menu: nenhuma aba acesa", () => {
        for (const p of ["settings", "stage", "draw"]) expect(marcadoDoSegmentado(p, "culto")).toEqual({ marcado: null, cruzado: false })
    })
})
