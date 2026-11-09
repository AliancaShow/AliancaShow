import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { apenasAcrescenta, copiaSemSirvo, decidirProjeto, eventosNoDia, pastaPeloCaminho, soltarDoSirvo, type EntradaDecisao } from "./aliancaSirvoMontagem"

// Alianca/2026/11-novembro, e o culto de domingo 08/11 as 10h (13h UTC)
const pastas = {
    p1: { name: "Alianca", parent: "/" },
    p2: { name: "2026", parent: "p1" },
    p3: { name: "11-novembro", parent: "p2" },
    imp: { name: "Impulso", parent: "/" }
}
const CULTO = { event_id: "ev1", comeca_em: "2026-11-08T13:00:00Z" }

function entrada(extra: Partial<EntradaDecisao> = {}): EntradaDecisao {
    return { eventId: "ev1", comecaEm: CULTO.comeca_em, blocos: 3, cultos: [CULTO], projetos: {}, pastas, montados: {}, ...extra }
}
const musica: ProjectShowRef = { id: "m1", type: "show" }

describe("pastaPeloCaminho", () => {
    it("acha sem criar, e null quando falta uma parte", () => {
        expect(pastaPeloCaminho(pastas, ["Alianca", "2026", "11-novembro"])).toBe("p3")
        expect(pastaPeloCaminho(pastas, ["Alianca", "2026", "12-dezembro"])).toBeNull()
        expect(pastaPeloCaminho(pastas, ["2026"])).toBeNull() // nao e raiz
    })
})

describe("eventosNoDia", () => {
    it("conta todo evento da mesma data em Sao Paulo, e o proprio culto mesmo fora da lista", () => {
        expect(eventosNoDia("ev1", CULTO.comeca_em, [])).toBe(1)
        // 08/11 as 08h e 10h; o sabado 07/11 as 22h (01h UTC do dia 08) e de OUTRO dia
        const cultos = [CULTO, { event_id: "ev0", comeca_em: "2026-11-08T11:00:00Z" }, { event_id: "sab", comeca_em: "2026-11-08T01:00:00Z" }]
        expect(eventosNoDia("ev1", CULTO.comeca_em, cultos)).toBe(2)
    })
})

describe("decidirProjeto", () => {
    it("sem projeto do dia: cria na pasta da data, com o nome do Pedro", () => {
        expect(decidirProjeto(entrada())).toEqual({ acao: "criar", pastas: ["Alianca", "2026", "11-novembro"], nome: "08" })
        // nem as pastas existem ainda: cria do mesmo jeito
        expect(decidirProjeto(entrada({ pastas: {} }))).toMatchObject({ acao: "criar", nome: "08" })
    })

    it("projeto do dia vazio: monta sozinho", () => {
        const projetos = { d: { name: "08", parent: "p3", shows: [] } }
        expect(decidirProjeto(entrada({ projetos }))).toEqual({ acao: "montar", projetoId: "d" })
    })

    it("projeto do dia com conteudo do operador: pergunta", () => {
        const projetos = { d: { name: "08", parent: "p3", shows: [musica] } }
        expect(decidirProjeto(entrada({ projetos }))).toEqual({ acao: "perguntar", projetoId: "d", motivo: "tem_conteudo" })
    })

    it("o projeto ligado a este culto vence, em qualquer pasta e com qualquer nome", () => {
        const projetos = {
            d: { name: "08", parent: "p3", shows: [] },
            movido: { name: "culto especial", parent: "outra", shows: [musica], sirvo: { eventId: "ev1" } }
        }
        expect(decidirProjeto(entrada({ projetos }))).toEqual({ acao: "reconciliar", projetoId: "movido" })
    })

    it("ligado a este culto mas arquivado nao conta como ligado", () => {
        const projetos = { d: { name: "08", parent: "p3", shows: [musica], archived: true, sirvo: { eventId: "ev1" } } }
        expect(decidirProjeto(entrada({ projetos }))).toEqual({ acao: "nada", motivo: "arquivado" })
    })

    it("o projeto do dia ja e de outro culto: para e pergunta, nunca cria um segundo 08", () => {
        const projetos = { d: { name: "08", parent: "p3", shows: [], sirvo: { eventId: "outro" } } }
        expect(decidirProjeto(entrada({ projetos }))).toEqual({ acao: "perguntar", projetoId: "d", motivo: "outro_culto" })
    })

    it("ja montado antes e o projeto sumiu: nao recria nem remonta sozinho", () => {
        expect(decidirProjeto(entrada({ montados: { ev1: "velho" } }))).toEqual({ acao: "nada", motivo: "apagado" })
    })

    it("ja montado antes e o Remote recriou o 08 vazio: pergunta 'montar de novo?'", () => {
        const projetos = { novo: { name: "08", parent: "p3", shows: [] } }
        expect(decidirProjeto(entrada({ projetos, montados: { ev1: "velho" } }))).toEqual({ acao: "perguntar", projetoId: "novo", motivo: "montado_antes" })
    })

    it("dois eventos no dia (com roteiro ou nao): nao cria nem monta, e diz qual projeto mostra a faixa", () => {
        const cultos = [CULTO, { event_id: "ev0", comeca_em: "2026-11-08T11:00:00Z" }]
        expect(decidirProjeto(entrada({ cultos }))).toEqual({ acao: "varios_no_dia", projetoId: null, quantos: 2 })

        const projetos = { d: { name: "08", parent: "p3", shows: [] } }
        expect(decidirProjeto(entrada({ cultos, projetos }))).toEqual({ acao: "varios_no_dia", projetoId: "d", quantos: 2 })
    })

    it("dois eventos no dia, mas o projeto ja estava ligado a este culto: continua se atualizando", () => {
        const cultos = [CULTO, { event_id: "ev0", comeca_em: "2026-11-08T11:00:00Z" }]
        const projetos = { d: { name: "08", parent: "p3", shows: [], sirvo: { eventId: "ev1" } } }
        expect(decidirProjeto(entrada({ cultos, projetos }))).toEqual({ acao: "reconciliar", projetoId: "d" })
    })

    it("roteiro sem blocos: nao cria nem monta nada", () => {
        expect(decidirProjeto(entrada({ blocos: 0 }))).toEqual({ acao: "nada", motivo: "roteiro_vazio" })
        const projetos = { d: { name: "08", parent: "p3", shows: [] } }
        expect(decidirProjeto(entrada({ blocos: 0, projetos }))).toEqual({ acao: "nada", motivo: "roteiro_vazio" })
    })

    it("data invalida: nada", () => {
        expect(decidirProjeto(entrada({ comecaEm: "" }))).toEqual({ acao: "nada", motivo: "sem_data" })
    })
})

describe("apenasAcrescenta", () => {
    it("so vale quando todo item antigo fica na mesma posicao", () => {
        const a: ProjectShowRef = { id: "a", type: "show" }
        const b: ProjectShowRef = { id: "b", type: "show" }
        const c: ProjectShowRef = { id: "c", type: "section" }
        expect(apenasAcrescenta([a, b], [a, b, c])).toBe(true)
        expect(apenasAcrescenta([], [c])).toBe(true)
        expect(apenasAcrescenta([a, b], [b, a, c])).toBe(false)
        expect(apenasAcrescenta([a, b], [a])).toBe(false)
        // mesmo id, outro objeto: nao e o mesmo item
        expect(apenasAcrescenta([a], [{ ...a }])).toBe(false)
    })
})

describe("soltarDoSirvo", () => {
    it("cabecalho, lapide e rodape viram secao comum no lugar; o data do operador fica", () => {
        const itens: ProjectShowRef[] = [
            { id: "m1", type: "show" },
            { id: "sirvo_a", type: "section", name: "A", data: { time: "10:00", settings: { triggerAction: "x" }, sirvo: { blocoId: "a" } } },
            { id: "sirvo_x_b", type: "section", name: "(removido no Sirvo) B" },
            { id: "s1", type: "section", name: "minha" },
            { id: "sirvo_fim", type: "section", name: "Fora do roteiro" }
        ]
        let n = 0
        expect(soltarDoSirvo(itens, () => `novo${++n}`)).toBe(3)
        expect(itens.map((i) => i.id)).toEqual(["m1", "novo1", "novo2", "s1", "novo3"])
        expect(itens[1].data).toEqual({ time: "10:00", settings: { triggerAction: "x" } })
        expect(itens[1].name).toBe("A")
    })
})

describe("copiaSemSirvo (modelo e projeto duplicado)", () => {
    it("tira a ligacao e transforma os itens do Sirvo em secoes comuns, sem mexer no resto", () => {
        const copia = {
            name: "09",
            sirvo: { eventId: "ev1", montadoEm: 1 },
            shows: [
                { id: "m1", type: "show" },
                { id: "sirvo_a", type: "section", name: "Louvor", data: { time: "10:00", settings: { triggerAction: "x" }, sirvo: { blocoId: "a" } } },
                { id: "sirvo_fim", type: "section", name: "Fora do roteiro" }
            ] as ProjectShowRef[]
        }
        let n = 0
        copiaSemSirvo(copia, () => `novo${++n}`)
        expect("sirvo" in copia).toBe(false)
        expect(copia.shows.map((i) => i.id)).toEqual(["m1", "novo1", "novo2"])
        expect(copia.shows[1]).toMatchObject({ name: "Louvor", data: { time: "10:00", settings: { triggerAction: "x" } } })
        expect(copia.shows[1].data.sirvo).toBeUndefined()
    })

    it("projeto sem shows nao quebra", () => {
        expect(copiaSemSirvo({ sirvo: null } as any, () => "x")).toEqual({})
    })
})
