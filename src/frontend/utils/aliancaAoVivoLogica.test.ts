import { describe, expect, it } from "vitest"
import { algoNoArEm, faixaAoVivo } from "./aliancaAoVivoLogica"

describe("faixaAoVivo", () => {
    it("acende so com o telao ligado E algo no ar", () => {
        expect(faixaAoVivo({ telaoLigado: true, algoNoAr: true })).toEqual({ aceso: true, motivo: "telão no ar" })
        expect(faixaAoVivo({ telaoLigado: true, algoNoAr: false }).aceso).toBe(false)
        expect(faixaAoVivo({ telaoLigado: false, algoNoAr: true }).aceso).toBe(false)
    })
})

describe("algoNoArEm", () => {
    const o = (out: any, extra: any = {}) => ({ default: { enabled: true, out, ...extra } })
    it("slide, fundo ou sobreposicao contam", () => {
        expect(algoNoArEm(o({ slide: { id: "x" } }))).toBe(true)
        expect(algoNoArEm(o({ background: { path: "a.png" } }))).toBe(true)
        expect(algoNoArEm(o({ overlays: ["ov"] }))).toBe(true)
    })
    it("vazio, desligado, chave e palco nao contam", () => {
        expect(algoNoArEm(o({}))).toBe(false)
        expect(algoNoArEm(o({ slide: { id: "x" } }, { enabled: false }))).toBe(false)
        expect(algoNoArEm(o({ slide: { id: "x" } }, { isKeyOutput: true }))).toBe(false)
        expect(algoNoArEm(o({ slide: { id: "x" } }, { stageOutput: "s" }))).toBe(false)
        expect(algoNoArEm(null)).toBe(false)
    })
})
