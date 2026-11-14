import { describe, expect, it } from "vitest"
import { indiceDaFoto, mesmoSlideDaFoto, ocorrenciaNoLayout, outSemFoto, podeTerFoto } from "./aliancaFotoLogica"

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

    it("B1: com a ocorrencia gravada, a n-esima vez do slide vale (cortar refrao colado em outro refrao)", () => {
        // layout V Vc R Rc R Rc, no ar o Rc de idx 5 (2a ocorrencia do Rc). Cortam o R: entra Rx depois de cada R
        const foto = { slideId: "Rc", ocorrencia: 1 }
        const antes = ref("V", "Vc", "R", "Rc", "R", "Rc")
        expect(ocorrenciaNoLayout(antes as any, 5)).toBe(1)
        expect(indiceDaFoto(foto, 5, antes)).toBe(5)
        const depois = ref("V", "Vc", "R", "Rx", "Rc", "R", "Rx", "Rc") // Rc agora em 4 e 7
        expect(indiceDaFoto(foto, 5, depois)).toBe(7) // "mais proxima" daria 4 (|4-5|=1 contra |7-5|=2)
        expect(indiceDaFoto({ slideId: "Rc" }, 5, depois)).toBe(4) // foto antiga, sem ocorrencia: o fallback de sempre
    })

    it("B1: juntar um slide numa ocorrencia nao faz o indice antigo passar por valido", () => {
        // R A B repetido 3x, no ar o B da 3a ocorrencia (idx 8); sai um slide antes: o idx 8 agora e outra coisa
        const foto = { slideId: "B", ocorrencia: 2 }
        const depois = ref("R", "B", "R", "B", "R", "B")
        expect(indiceDaFoto(foto, 8, depois)).toBe(5)
        // mesmo com o id batendo no indice antigo (idx 3 e a 2a ocorrencia, nao a 3a)
        expect(indiceDaFoto({ slideId: "B", ocorrencia: 2 }, 3, depois)).toBe(5)
        expect(indiceDaFoto({ slideId: "B" }, 3, depois)).toBe(3) // sem ocorrencia, o comportamento antigo
    })

    it("B1: a ocorrencia que nao existe mais cai na mais proxima", () => {
        expect(indiceDaFoto({ slideId: "r", ocorrencia: 2 }, 4, ref("r", "a", "r"))).toBe(2)
        expect(indiceDaFoto({ slideId: "z", ocorrencia: 0 }, 1, ref("a", "b"))).toBe(-1)
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
