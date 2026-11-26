import { describe, expect, it } from "vitest"
import { deveAbrir, slideDeShowNoAr } from "./aliancaSegueTeclado"

const tela = (slide: any, extra: any = {}) => ({ a: { enabled: true, out: { slide }, ...extra } })

describe("segue o teclado", () => {
    it("acha o slide de show no ar e ignora retorno e texto temporario", () => {
        expect(slideDeShowNoAr(tela({ id: "s1", layout: "L", index: 2 }))).toEqual({ id: "s1", layout: "L", index: 2, projectIndex: undefined })
        expect(slideDeShowNoAr(tela({ id: "s1", index: 0 }, { stageOutput: "x" }))).toBeNull()
        expect(slideDeShowNoAr(tela({ id: "temp", index: 0 }))).toBeNull()
        expect(slideDeShowNoAr({})).toBeNull()
    })

    it("abre o show so logo depois de uma tecla, em Mostrar, quando nao esta aberto", () => {
        const noAr = { id: "s1", layout: "", index: 0 }
        expect(deveAbrir(noAr, null, null, 100, "mostrar")).toBe(true)
        expect(deveAbrir(noAr, null, { id: "s1" }, 100, "mostrar")).toBe(false)
        expect(deveAbrir(noAr, null, null, 5000, "mostrar")).toBe(false)
        expect(deveAbrir(noAr, null, null, -1, "mostrar")).toBe(false)
        expect(deveAbrir(noAr, null, null, 100, "editar")).toBe(false)
        expect(deveAbrir(noAr, { id: "s1", layout: "", index: 0 }, null, 100, "mostrar")).toBe(false)
        expect(deveAbrir(null, null, null, 100, "mostrar")).toBe(false)
    })
})
