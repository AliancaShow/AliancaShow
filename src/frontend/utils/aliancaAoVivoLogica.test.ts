import { describe, expect, it } from "vitest"
import { algoNoArEm, faixaAoVivo, telaoLigadoEm } from "./aliancaAoVivoLogica"

describe("faixaAoVivo", () => {
    it("acende so com o telao ligado E algo no ar", () => {
        expect(faixaAoVivo({ telaoLigado: true, algoNoAr: true })).toEqual({ aceso: true, motivo: "telão no ar" })
        expect(faixaAoVivo({ telaoLigado: true, algoNoAr: false }).aceso).toBe(false)
        expect(faixaAoVivo({ telaoLigado: false, algoNoAr: true }).aceso).toBe(false)
    })
})

const on = (id: string) => ({ id, active: true as const })
const off = (id: string) => ({ id, active: false as const })

describe("algoNoArEm (por saida, com outputState)", () => {
    const o = (out: any, extra: any = {}, id = "default") => ({ [id]: { enabled: true, out, ...extra } })
    it("slide, fundo, sobreposicao ou efeito contam, com a saida ligada", () => {
        expect(algoNoArEm(o({ slide: { id: "x" } }), [on("default")])).toBe(true)
        expect(algoNoArEm(o({ background: { path: "a.png" } }), [on("default")])).toBe(true)
        expect(algoNoArEm(o({ overlays: ["ov"] }), [on("default")])).toBe(true)
        expect(algoNoArEm(o({ effects: ["fx"] }), [on("default")])).toBe(true)
    })
    it("vazio, desligado, chave e palco nao contam", () => {
        expect(algoNoArEm(o({}), [on("default")])).toBe(false)
        expect(algoNoArEm(o({ slide: { id: "x" } }, { enabled: false }), [on("default")])).toBe(false)
        expect(algoNoArEm(o({ slide: { id: "x" } }, { isKeyOutput: true }), [on("default")])).toBe(false)
        expect(algoNoArEm(o({ slide: { id: "x" } }, { stageOutput: "s" }), [on("default")])).toBe(false)
        expect(algoNoArEm(null, [])).toBe(false)
    })
    it("saida com conteudo mas DESLIGADA (estado por saida) nao conta", () => {
        expect(algoNoArEm(o({ slide: { id: "x" } }), [off("default")])).toBe(false)
        expect(algoNoArEm(o({ slide: { id: "x" } }), [])).toBe(false)
    })
    it("estado misto: so a saida ligada conta (o outputDisplay global congelaria)", () => {
        const saidas = { ...o({ slide: { id: "x" } }, {}, "a"), ...o({}, {}, "b") }
        expect(algoNoArEm(saidas, [on("a"), off("b")])).toBe(true)
        const saidas2 = { ...o({ slide: { id: "x" } }, {}, "a"), ...o({}, {}, "b") }
        expect(algoNoArEm(saidas2, [off("a"), on("b")])).toBe(false)
    })
    it("desenho ou audio contam como soltando algo, mas so com o telao ligado", () => {
        expect(algoNoArEm(o({}), [on("default")], { desenho: true, audio: false })).toBe(true)
        expect(algoNoArEm(o({}), [on("default")], { desenho: false, audio: true })).toBe(true)
        expect(algoNoArEm(o({}), [off("default")], { desenho: true, audio: true })).toBe(false)
    })
})

describe("telaoLigadoEm (por saida, nao por outputDisplay)", () => {
    const saidas = { a: { enabled: true, out: {} }, b: { enabled: true, out: {} } }
    it("basta uma saida de tela ligada (estado misto)", () => {
        expect(telaoLigadoEm(saidas, [on("a"), off("b")])).toBe(true)
        expect(telaoLigadoEm(saidas, [off("a"), off("b")])).toBe(false)
    })
    it("invisible (so NDI), palco e chave nao sao telao", () => {
        expect(telaoLigadoEm(saidas, [{ id: "a", active: "invisible" }, off("b")])).toBe(false)
        expect(telaoLigadoEm({ p: { enabled: true, stageOutput: "s" } }, [on("p")])).toBe(false)
        expect(telaoLigadoEm({ k: { enabled: true, isKeyOutput: true } }, [on("k")])).toBe(false)
    })
})
