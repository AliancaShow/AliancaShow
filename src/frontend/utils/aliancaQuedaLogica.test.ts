import { describe, expect, it } from "vitest"
import type { QuedaSaida } from "../../types/aliancaSaidaCanais"
import { VOLTOU_FICA_MS, aplicarAviso, comNomesAtuais, limparVencidos, linhaDaQueda, linhasDoQuadro, segundos } from "./aliancaQuedaLogica"

const a = (o: Partial<QuedaSaida>): QuedaSaida => ({ outputId: "t", nome: "Telão", estado: "caiu", motivo: "processo da tela caiu (crashed)", em: new Date(2026, 10, 22, 19, 5, 7).getTime(), ...o })

describe("faixa de queda (F1)", () => {
    it("guarda o ultimo aviso por saida", () => {
        let q = aplicarAviso({}, a({}))
        q = aplicarAviso(q, a({ estado: "voltou", ms: 1234 }))
        expect(Object.keys(q)).toEqual(["t"])
        expect(q.t.estado).toBe("voltou")
        expect(aplicarAviso(q, { ...a({}), outputId: "" })).toBe(q)
    })
    it("queda e trava sao graves e dizem a hora; voltou diz quanto tempo levou", () => {
        expect(linhaDaQueda(a({}))).toEqual({ outputId: "t", texto: "Telão CAIU às 19:05:07 — recriando a tela… (processo da tela caiu (crashed))", grave: true })
        expect(linhaDaQueda(a({ estado: "travou" })).grave).toBe(true)
        expect(linhaDaQueda(a({ estado: "fora", motivo: "x" })).texto).toContain("FORA DO AR")
        expect(linhaDaQueda(a({ estado: "voltou", ms: 1234 }))).toEqual({ outputId: "t", texto: "Telão caiu e voltou às 19:05:07 (1,2 s)", grave: false })
        expect(segundos(800)).toBe("0,8 s")
    })
    it("voltou/respondeu somem depois de VOLTOU_FICA_MS; queda fica", () => {
        const q = { t: a({ estado: "voltou", em: 0 }), r: a({ outputId: "r", estado: "caiu", em: 0 }) }
        expect(Object.keys(limparVencidos(q, VOLTOU_FICA_MS - 1))).toEqual(["t", "r"])
        expect(Object.keys(limparVencidos(q, VOLTOU_FICA_MS + 1))).toEqual(["r"])
    })
    it("graves primeiro", () => {
        const q = { t: a({ estado: "voltou" }), r: a({ outputId: "r", nome: "Retorno", estado: "travou" }) }
        expect(linhasDoQuadro(q).map((l) => l.outputId)).toEqual(["r", "t"])
    })
    it("vale o nome atual da saida, nao o titulo da janela na criacao", () => {
        const q = comNomesAtuais({ t: a({ nome: "Primary" }), r: a({ outputId: "r", nome: "Retorno" }) }, { t: { name: "Telão" } })
        expect(q.t.nome).toBe("Telão")
        expect(q.r.nome).toBe("Retorno")
    })
})
