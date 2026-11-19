import { describe, expect, it } from "vitest"
import { deveParaOSpotify, entraramComSom, instanciasComSom, videoSoando } from "./aliancaSpotifyComSomLogica"

const nenhum = new Set<string>()
const v = (o: object = {}) => ({ inst: {}, path: "a.mp4", muted: false, paused: false, saidas: ["telao"], ...o })

describe("videoSoando", () => {
    it("fundo mudo, pausado, terminado, congelado ou sem volume NAO soa", () => {
        for (const o of [{ muted: true }, { paused: true }, { ended: true }, { congelado: true }, { volume: 0 }]) expect(videoSoando(v(o), nenhum)).toBe(false)
    })
    it("tocando, com som e com volume soa", () => {
        expect(videoSoando(v(), nenhum)).toBe(true)
        expect(videoSoando(v({ volume: 0.4 }), nenhum)).toBe(true)
    })
    it("so em saida de retorno nao conta; retorno + telao conta", () => {
        const ret = new Set(["ret"])
        expect(videoSoando(v({ saidas: ["ret"] }), ret)).toBe(false)
        expect(videoSoando(v({ saidas: ["ret", "telao"] }), ret)).toBe(true)
    })
})

describe("instanciasComSom", () => {
    it("audio: toca conta; pausado e microfone nao", () => {
        const x = {}
        const c = instanciasComSom(
            [],
            [
                { inst: x, paused: false },
                { inst: {}, paused: true },
                { inst: {}, paused: false, isMic: true }
            ],
            nenhum
        )
        expect([...c]).toEqual([x])
    })
})

describe("borda e decisao", () => {
    it("video que entra PAUSADO nao soa; ao despausar, e borda de subida", () => {
        const inst = {}
        const a0 = instanciasComSom([v({ inst, paused: true })], [], nenhum)
        expect(entraramComSom(new Set(), a0)).toEqual([])
        const a1 = instanciasComSom([v({ inst, paused: false })], [], nenhum)
        expect(entraramComSom(a0, a1)).toEqual([inst])
    })
    it("tirar o mudo e borda; o mesmo video reexibido (outra instancia) e borda mesmo com o mesmo caminho", () => {
        const i1 = {}
        const mudo = instanciasComSom([v({ inst: i1, muted: true })], [], nenhum)
        const som = instanciasComSom([v({ inst: i1 })], [], nenhum)
        expect(entraramComSom(mudo, som)).toEqual([i1])
        const i2 = {}
        expect(entraramComSom(som, instanciasComSom([v({ inst: i2 })], [], nenhum))).toEqual([i2])
    })
    it("quem ja soava nao e borda", () => {
        const i = {}
        const s = instanciasComSom([v({ inst: i })], [], nenhum)
        expect(entraramComSom(s, s)).toEqual([])
    })
    it("para com qualquer entrada, desde que nao haja fade em curso (estado do Spotify nao entra na conta)", () => {
        expect(deveParaOSpotify([{}], false)).toBe(true)
        expect(deveParaOSpotify([{}], true)).toBe(false)
        expect(deveParaOSpotify([], false)).toBe(false)
    })
})
