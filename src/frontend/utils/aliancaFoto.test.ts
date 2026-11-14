import { describe, expect, it } from "vitest"
import { indiceDaFoto, mesmoSlideDaFoto, outSemFoto, podeTerFoto } from "./aliancaFotoLogica"

const ref = (...ids: string[]) => ids.map((id) => ({ id })) as any[]

describe("aliancaFoto", () => {
    it("so show de verdade tem foto", () => {
        expect(podeTerFoto({ id: "abc" })).toBe(true)
        expect(podeTerFoto({ id: "abc", type: "show" })).toBe(true)
        expect(podeTerFoto({ id: "temp" })).toBe(false)
        expect(podeTerFoto({ id: "tempText" })).toBe(false)
        expect(podeTerFoto({ id: "/x.pdf", type: "pdf" })).toBe(false)
        expect(podeTerFoto({ id: "/x.pptx", type: "ppt" })).toBe(false)
        expect(podeTerFoto(null)).toBe(false)
    })

    it("acha o slide da foto no layout vivo (C11)", () => {
        const foto = { slideId: "b" }
        expect(indiceDaFoto(foto, 1, ref("a", "b", "c"))).toBe(1) // nao andou
        expect(indiceDaFoto(foto, 1, ref("a", "x", "b", "c"))).toBe(2) // inseriram antes
        expect(indiceDaFoto(foto, 3, ref("a", "b", "c"))).toBe(1) // tiraram slides
        expect(indiceDaFoto(foto, 1, ref("a", "c"))).toBe(-1) // sumiu
    })

    it("refrao repetido: pega a ocorrencia mais proxima do index antigo", () => {
        const foto = { slideId: "r" }
        expect(indiceDaFoto(foto, 4, ref("r", "a", "r", "b", "r"))).toBe(4)
        expect(indiceDaFoto(foto, 5, ref("a", "r", "b", "r", "c"))).toBe(3) // 2a ocorrencia andou de 5 pra 3
        expect(indiceDaFoto(foto, 0, ref("r", "a", "r"))).toBe(0)
    })

    it("sem foto, devolve o index", () => {
        expect(indiceDaFoto(undefined, 2, ref("a", "b", "c"))).toBe(2)
    })

    it("mesmo slide so herda a foto se o slide da posicao for o da foto (C7)", () => {
        const atual: any = { id: "s", layout: "l", index: 2, foto: { slideId: "b" } }
        expect(mesmoSlideDaFoto(atual, { id: "s", layout: "l", index: 2, line: 1 }, ref("a", "x", "b"))).toBe(true)
        // o layout andou: no mesmo index agora ha outro slide
        expect(mesmoSlideDaFoto(atual, { id: "s", layout: "l", index: 2 }, ref("a", "b", "c"))).toBe(false)
        expect(mesmoSlideDaFoto(atual, { id: "s", layout: "l", index: 3 }, ref("a", "b", "c", "b"))).toBe(false)
        expect(mesmoSlideDaFoto({ id: "s", layout: "l", index: 2 } as any, { id: "s", layout: "l", index: 2 }, ref("a", "x", "b"))).toBe(false)
    })

    it("outSemFoto tira a foto sem mexer no resto", () => {
        const out = { slide: { id: "s", index: 1, foto: { slideId: "b" } }, background: { path: "x" } }
        expect(outSemFoto(out)).toEqual({ slide: { id: "s", index: 1 }, background: { path: "x" } })
        expect(out.slide.foto).toBeTruthy() // nao muta
        const limpo = { slide: { id: "s" } }
        expect(outSemFoto(limpo)).toBe(limpo)
    })
})
