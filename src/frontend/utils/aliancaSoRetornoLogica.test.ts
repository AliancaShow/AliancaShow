import { describe, expect, it } from "vitest"
import { MARCA, aceitaNoModo, descreverRetorno, devolverFonte, ehEnvio, idDeLeitura, idsDeRetorno, outVazio, porQueNaoLigar, roteamento, slideDoTelao, temMarca, trocarFonte } from "./aliancaSoRetornoLogica"

describe("idsDeRetorno", () => {
    it("so saida habilitada com stageOutput", () => {
        const outs = { a: { enabled: true }, b: { enabled: true, stageOutput: "L1" }, c: { enabled: false, stageOutput: "L2" }, d: { enabled: true, stageOutput: "" } }
        expect(idsDeRetorno(outs)).toEqual(["b"])
        expect(idsDeRetorno(null)).toEqual([])
    })
})

describe("porQueNaoLigar", () => {
    it("sem retorno: o motivo escrito; com retorno: vazio", () => {
        expect(porQueNaoLigar([])).toContain("Nenhum monitor de retorno")
        expect(porQueNaoLigar(["b"])).toBe("")
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

describe("roteamento (o ponto unico do desvio)", () => {
    it("desligado, dentro de semDesvio ou limpeza: nunca desvia", () => {
        expect(roteamento(false, 0, ["r"], { id: "x" }).desvia).toBe(false)
        expect(roteamento(true, 1, ["r"], { id: "x" }).desvia).toBe(false)
        expect(roteamento(true, 0, ["r"], null).desvia).toBe(false)
        expect(roteamento(true, 0, ["r"], []).desvia).toBe(false)
        expect(roteamento(true, 0, ["r"], undefined).desvia).toBe(false)
    })
    it("ligado e envio: so os retornos, e a lista vazia continua sendo desvio (descarta, nunca vai ao telao)", () => {
        expect(roteamento(true, 0, ["r"], { id: "x" })).toEqual({ desvia: true, ids: ["r"] })
        expect(roteamento(true, 0, ["r"], "overlay1")).toEqual({ desvia: true, ids: ["r"] })
        expect(roteamento(true, 0, [], { id: "x" })).toEqual({ desvia: true, ids: [] })
    })
    it("ehEnvio", () => {
        expect(ehEnvio({})).toBe(true)
        expect(ehEnvio(["a"])).toBe(true)
        expect(ehEnvio([])).toBe(false)
        expect(ehEnvio(null)).toBe(false)
    })
})

describe("leitura, semente e descricao", () => {
    it("as setas leem do retorno so no modo", () => {
        expect(idDeLeitura(true, ["r"], "telao")).toBe("r")
        expect(idDeLeitura(false, ["r"], "telao")).toBe("telao")
        expect(idDeLeitura(true, [], "telao")).toBe("telao")
    })
    it("slideDoTelao: a saida normal ativa, nunca o retorno", () => {
        const outs = { r: { enabled: true, stageOutput: "L", out: { slide: { id: "retorno" } } }, t: { enabled: true, active: true, out: { slide: { id: "a", index: 2 } } } }
        expect(slideDoTelao(outs)).toEqual({ id: "a", index: 2 })
        expect(slideDoTelao({ t: { enabled: true, out: {} } })).toBe(null)
    })
    it("outVazio zera tudo e descreverRetorno diz o que ha", () => {
        expect(outVazio()).toEqual({ slide: null, background: null, overlays: [], effects: [], transition: null })
        const outs = { r: { enabled: true, stageOutput: "L", out: { slide: { id: "s1", index: 0 } } } }
        expect(descreverRetorno(outs, () => "Grande e o Senhor")).toBe("Grande e o Senhor · slide 1")
        expect(descreverRetorno({ r: { enabled: true, stageOutput: "L", out: {} } }, () => "")).toBe("nada")
    })
})

describe("D1: o modo aceita SO slide de texto", () => {
    it('aceita slide de letra, de versiculo temporario e de show com tipo "show"', () => {
        expect(aceitaNoModo("slide", { id: "s", layout: "l", index: 2, line: 0 })).toBe(true)
        expect(aceitaNoModo("slide", { id: "temp", tempItems: [] })).toBe(true)
        expect(aceitaNoModo("slide", { id: "s", type: "show", index: 0 })).toBe(true)
    })
    it("recusa PDF, PowerPoint e qualquer slide que nao e de texto", () => {
        expect(aceitaNoModo("slide", { type: "pdf", id: "a.pdf", page: 0 })).toBe(false)
        expect(aceitaNoModo("slide", { type: "ppt", id: "p" })).toBe(false)
        expect(aceitaNoModo("slide", { type: "folder", id: "f" })).toBe(false)
    })
    it("recusa fundo/video, sobreposicao, efeito e temporizador de transicao", () => {
        for (const t of ["background", "overlays", "effects", "transition"]) expect(aceitaNoModo(t, { x: 1 })).toBe(false)
    })
    it("slide de texto com VIDEO dentro (item de midia) tambem e recusado: o tocador nao pode nascer", () => {
        expect(aceitaNoModo("slide", { id: "s", index: 0 }, true)).toBe(false)
    })
})
