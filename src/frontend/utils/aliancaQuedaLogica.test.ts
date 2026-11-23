import { describe, expect, it } from "vitest"
import type { QuedaSaida } from "../../types/aliancaSaidaCanais"
import { acrescentar, principal, tirarChave, tirarId, type Aviso } from "./aliancaAvisosLogica"
import { VOLTOU_FICA_MS, avisoDaQueda, chaveDaQueda, quedasSemSaida, segundos, textoDaQueda } from "./aliancaQuedaLogica"

const a = (o: Partial<QuedaSaida>): QuedaSaida => ({ outputId: "t", nome: "Telão", estado: "caiu", motivo: "processo da tela caiu (crashed)", em: new Date(2026, 10, 22, 19, 5, 7).getTime(), ...o })

/** passa uma sequencia de eventos do vigia pela fila dos avisos, como aliancaQuedaAvisos faz */
function fila(eventos: QuedaSaida[], nomes: { [id: string]: string } = {}): Aviso[] {
    let l: Aviso[] = []
    const ultimo: { [id: string]: QuedaSaida } = {}
    eventos.forEach((e, i) => {
        const r = avisoDaQueda(e, nomes[e.outputId], ultimo[e.outputId]?.estado)!
        ultimo[e.outputId] = e
        l = acrescentar(l, r.novo, i + 1, i)
    })
    return l
}

describe("queda da saida na linha de avisos (F1)", () => {
    it("mesmas informacoes da antiga faixa: hora, motivo, quanto levou para voltar", () => {
        expect(textoDaQueda(a({}))).toBe("Telão CAIU às 19:05:07 — recriando a tela… (processo da tela caiu (crashed))")
        expect(textoDaQueda(a({ estado: "travou" }))).toBe("Telão TRAVOU às 19:05:07 — se não voltar em 5 s, a tela é recriada")
        expect(textoDaQueda(a({ estado: "fora", motivo: "x" }))).toBe("Telão FORA DO AR desde 19:05:07 — x. Feche e abra a saída.")
        expect(textoDaQueda(a({ estado: "voltou", ms: 1234 }))).toBe("Telão caiu e voltou às 19:05:07 (1,2 s)")
        expect(textoDaQueda(a({ estado: "respondeu" }))).toBe("Telão travou e voltou a responder às 19:05:07")
        expect(segundos(800)).toBe("0,8 s")
    })
    it("todo estado e ERRO (vermelho); enquanto a saida esta fora o aviso e fixo (sem x) e nao some sozinho", () => {
        for (const estado of ["caiu", "travou", "fora"] as const) {
            const r = avisoDaQueda(a({ estado }))!
            expect(r.novo).toMatchObject({ chave: "queda-saida:t", nivel: "erro", fixo: true })
            expect(r.someEm).toBeNull()
        }
        for (const estado of ["voltou", "respondeu"] as const) {
            const r = avisoDaQueda(a({ estado }))!
            expect(r.novo).toMatchObject({ nivel: "erro", fixo: false })
            expect(r.someEm).toBe(VOLTOU_FICA_MS)
        }
    })
    it("aviso torto (sem saida ou estado desconhecido) nao entra: o chamador acende a falha alta", () => {
        expect(avisoDaQueda(a({ outputId: "" }))).toBeNull()
        expect(avisoDaQueda(a({ estado: "explodiu" as any }))).toBeNull()
    })
    it("FORA DO AR nao sai pelo x; so resolvendo", () => {
        const l = fila([a({}), a({ estado: "voltou", ms: 900 }), a({ estado: "fora", motivo: "caiu de novo" })])
        expect(l).toHaveLength(1)
        expect(l[0]).toMatchObject({ fixo: true, nivel: "erro" })
        expect(l[0].texto).toContain("FORA DO AR")
        expect(tirarId(l, l[0].id)).toBe(l)
        expect(tirarChave(l, chaveDaQueda("t"))).toEqual([])
    })
    it("caiu -> voltou troca o mesmo aviso no lugar; o x volta; so episodio novo conta outra vez", () => {
        let l = fila([a({}), a({ estado: "voltou", ms: 1234 })])
        expect(l).toHaveLength(1)
        expect(l[0]).toMatchObject({ texto: "Telão caiu e voltou às 19:05:07 (1,2 s)", vezes: 1 })
        expect(l[0].fixo).toBeUndefined()
        expect(tirarId(l, l[0].id)).toEqual([])
        l = fila([a({}), a({ estado: "voltou" }), a({}), a({ estado: "voltou" })])
        expect(l[0].vezes).toBe(2)
        // travou -> caiu (o vigia derruba a tela travada) -> voltou: um episodio so
        expect(fila([a({ estado: "travou" }), a({}), a({ estado: "voltou" })])[0].vezes).toBe(1)
        // 3 quedas que voltaram e a 4a vira "fora do ar" direto (o vigia desiste): 4 episodios; caiu -> fora (recarga falhou): o mesmo
        expect(fila([a({}), a({ estado: "voltou" }), a({}), a({ estado: "voltou" }), a({}), a({ estado: "voltou" }), a({ estado: "fora" })])[0].vezes).toBe(4)
        expect(fila([a({}), a({ estado: "fora" })])[0].vezes).toBe(1)
    })
    it("vale o nome atual da saida, nao o titulo da janela na criacao; uma linha por saida, erro na frente", () => {
        const l = fila([a({ nome: "Primary" }), a({ outputId: "r", nome: "Retorno", estado: "travou" })], { t: "Telão" })
        expect(l.map((v) => v.chave)).toEqual(["queda-saida:t", "queda-saida:r"])
        expect(l[0].texto.startsWith("Telão CAIU")).toBe(true)
        const p = principal([...l, { id: 9, chave: "x", texto: "info nova", nivel: "info", em: 99, vezes: 1 }])
        expect(p.aviso!.nivel).toBe("erro")
        expect(p.outros).toBe(2)
    })
    it("saida apagada ou desabilitada solta o aviso dela", () => {
        expect(quedasSemSaida(["t", "r", "x"], { t: { enabled: true }, r: { enabled: false } })).toEqual(["r", "x"])
    })
})
