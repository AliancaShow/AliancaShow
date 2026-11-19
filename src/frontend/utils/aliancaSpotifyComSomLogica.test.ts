import { describe, expect, it } from "vitest"
import { chavesComSom, deveParaOSpotify, entraramComSom } from "./aliancaSpotifyComSomLogica"

const nenhum = new Set<string>()

describe("chavesComSom", () => {
    it("video de fundo mudo em repeticao NAO faz som", () => {
        expect(chavesComSom([{ path: "a.mp4", muted: true, saidas: ["telao"] }], {}, nenhum).size).toBe(0)
    })
    it("video nao mudo faz som; terminado nao", () => {
        expect(chavesComSom([{ path: "a.mp4", muted: false, saidas: ["telao"] }], {}, nenhum).has("v:a.mp4")).toBe(true)
        expect(chavesComSom([{ path: "a.mp4", muted: false, ended: true, saidas: ["telao"] }], {}, nenhum).size).toBe(0)
    })
    it("so em saida de retorno nao conta; retorno + telao conta", () => {
        const ret = new Set(["ret"])
        expect(chavesComSom([{ path: "a.mp4", muted: false, saidas: ["ret"] }], {}, ret).size).toBe(0)
        expect(chavesComSom([{ path: "a.mp4", muted: false, saidas: ["ret", "telao"] }], {}, ret).size).toBe(1)
    })
    it("audio: toca conta; pausado e microfone nao", () => {
        const c = chavesComSom([], { x: { paused: false }, y: { paused: true }, z: { paused: false, isMic: true } }, nenhum)
        expect([...c]).toEqual(["a:x"])
    })
})

describe("borda e decisao", () => {
    it("so o que entrou", () => {
        expect(entraramComSom(new Set(["v:a"]), new Set(["v:a", "a:x"]))).toEqual(["a:x"])
        expect(entraramComSom(new Set(["v:a"]), new Set(["v:a"]))).toEqual([])
    })
    it("para so com Spotify tocando e fora de fade", () => {
        expect(deveParaOSpotify(["v:a"], true, false)).toBe(true)
        expect(deveParaOSpotify(["v:a"], false, false)).toBe(false)
        expect(deveParaOSpotify(["v:a"], true, true)).toBe(false)
        expect(deveParaOSpotify([], true, false)).toBe(false)
    })
})
