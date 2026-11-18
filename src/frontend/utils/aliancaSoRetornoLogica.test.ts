import { describe, expect, it } from "vitest"
import { MARCA, devolverFonte, idsDeRetorno, porQueNaoLigar, temMarca, trocarFonte } from "./aliancaSoRetornoLogica"

describe("idsDeRetorno", () => {
    it("so saida habilitada com stageOutput", () => {
        const outs = { a: { enabled: true }, b: { enabled: true, stageOutput: "L1" }, c: { enabled: false, stageOutput: "L2" }, d: { enabled: true, stageOutput: "" } }
        expect(idsDeRetorno(outs)).toEqual(["b"])
        expect(idsDeRetorno(null)).toEqual([])
    })
})

describe("porQueNaoLigar", () => {
    it("sem retorno: o motivo escrito; sem a saida respeitando o modo: o motivo; senao vazio", () => {
        expect(porQueNaoLigar([], true)).toContain("Nenhum monitor de retorno")
        expect(porQueNaoLigar(["b"], false)).toContain("output.ts")
        expect(porQueNaoLigar(["b"], true)).toBe("")
    })
})

describe("trocarFonte / devolverFonte", () => {
    const layouts = { L1: { name: "Retorno", settings: { color: "#000" } }, L2: { name: "Outro", settings: { output: "x" } } }
    it("aponta a fonte para a propria saida e devolve igual ao que era (sem output)", () => {
        const t = trocarFonte(layouts, [{ id: "b", layout: "L1" }])
        expect(t.L1.settings.output).toBe("b")
        expect(temMarca(t)).toBe(true)
        expect(devolverFonte(t)).toEqual(layouts)
        expect(temMarca(devolverFonte(t))).toBe(false)
    })
    it("devolve o output que o layout ja tinha", () => {
        const t = trocarFonte(layouts, [{ id: "b", layout: "L2" }])
        expect(t.L2.settings.output).toBe("b")
        expect(t.L2.settings[MARCA].antes).toBe("x")
        expect(devolverFonte(t)).toEqual(layouts)
    })
    it("ligar duas vezes nao perde o valor de antes", () => {
        const t = trocarFonte(trocarFonte(layouts, [{ id: "b", layout: "L2" }]), [{ id: "b", layout: "L2" }])
        expect(devolverFonte(t)).toEqual(layouts)
    })
    it("nao muda o objeto de entrada e ignora layout inexistente", () => {
        const copia = JSON.parse(JSON.stringify(layouts))
        trocarFonte(layouts, [
            { id: "b", layout: "L1" },
            { id: "z", layout: "nada" }
        ])
        expect(layouts).toEqual(copia)
    })
})
