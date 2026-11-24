import { describe, expect, it } from "vitest"
import { categoriasComModeloFixo, musicasDaCategoria } from "./aliancaModelosLogica"

describe("modelo da categoria = aplicar uma vez", () => {
    it("acha as categorias com modelo fixo e as músicas de uma categoria", () => {
        expect(categoriasComModeloFixo({ song: { template: "teste" }, presentation: { template: "" }, x: {} })).toEqual(["song"])
        expect(categoriasComModeloFixo(null)).toEqual([])
        expect(musicasDaCategoria({ a: { category: "song" }, b: { category: "impulso" }, c: { category: "song" } }, "song")).toEqual(["a", "c"])
    })
})
