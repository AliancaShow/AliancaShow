import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { cabecalhoTrancado, COR_LAPIDE, naoSaiDoProjeto, horaDoBloco, ID_RODAPE, linkSeguro, NOME_RODAPE, papelDoItem, quantosDoOperador, reconciliar, resumirPendencia, textoDaPendencia, type BlocoParaProjeto } from "./aliancaSirvoProjeto"

// 10:00 em Sao Paulo, e cada bloco 15 min depois do anterior
const INICIO = "2026-11-08T13:00:00Z"
const bloco = (id: string, i = 0, extra: Partial<BlocoParaProjeto> = {}): BlocoParaProjeto => ({
    id,
    titulo: id.toUpperCase(),
    tipo: "louvor",
    cor: "#3366ff",
    duracao_min: 15,
    inicio_previsto: new Date(Date.parse("2026-11-08T13:00:00Z") + i * 15 * 60_000).toISOString(),
    responsavel: null,
    nota: null,
    link: null,
    ...extra
})
const roteiro = (...ids: string[]) => ids.map((id, i) => bloco(id, i))

const musica = (id: string): ProjectShowRef => ({ id, type: "show" })
const foto = (id: string): ProjectShowRef => ({ id: `C:\\fotos\\${id}.jpg`, type: "image" })
const secao = (id: string, name = id): ProjectShowRef => ({ id, type: "section", name })

/** a lista em texto curto: cabecalho "[A]", lapide "[x:A]", rodape "[fim]", secao comum "{s}", o resto pelo id */
const desenho = (itens: ProjectShowRef[]) =>
    itens.map((i) => {
        const papel = papelDoItem(i)
        if (papel === "cabecalho") return `[${i.id.slice(6)}]`
        if (papel === "lapide") return `[x:${i.id.slice(8)}]`
        if (papel === "rodape") return "[fim]"
        if (i.type === "section") return `{${i.id}}`
        return i.id.replace(/^C:\\fotos\\(.*)\.jpg$/, "$1")
    })

/** monta o projeto a partir do zero, como o Show faria no projeto vazio */
function montado(...ids: string[]) {
    return reconciliar([], roteiro(...ids), { comecaEm: INICIO }).itens
}

/** acha o item pelo desenho curto */
const item = (itens: ProjectShowRef[], d: string) => itens[desenho(itens).indexOf(d)]

describe("reconciliar: criar", () => {
    it("projeto vazio: um cabecalho por bloco, na ordem do Sirvo, e o rodape", () => {
        const r = reconciliar([], roteiro("a", "b", "c"), { comecaEm: INICIO })
        expect(desenho(r.itens)).toEqual(["[a]", "[b]", "[c]", "[fim]"])
        expect(r).toMatchObject({ mudouEstrutura: true, pendente: false, motivo: null })

        const [a] = r.itens
        expect(a).toMatchObject({ id: "sirvo_a", type: "section", name: "A", color: "#3366ff", data: { time: "10:00", sirvo: { blocoId: "a", tipo: "louvor", duracaoMin: 15, responsavel: null, nota: null, link: null } } })
        expect(a.notes).toBeUndefined() // nota em `notes` vira parada a mais no "proximo"
        expect(r.itens[1].data.time).toBe("10:15")
        expect(r.itens[3]).toEqual({ id: ID_RODAPE, type: "section", name: NOME_RODAPE })
    })

    it("o que o operador ja tinha fica todo no topo", () => {
        const r = reconciliar([musica("m1"), foto("f1")], roteiro("a", "b"))
        expect(desenho(r.itens)).toEqual(["m1", "f1", "[a]", "[b]", "[fim]"])
    })

    it("bloco novo entra logo depois do bloco anterior, sem mexer no resto", () => {
        const itens = montado("a", "c")
        itens.splice(1, 0, musica("m1")) // m1 debaixo de A
        const r = reconciliar(itens, roteiro("a", "b", "c"))
        expect(desenho(r.itens)).toEqual(["[a]", "m1", "[b]", "[c]", "[fim]"])
    })

    it("bloco novo no comeco entra antes do primeiro bloco, depois da cabeca", () => {
        const itens = [musica("vinheta"), ...montado("b")]
        const r = reconciliar(itens, roteiro("a", "b"))
        expect(desenho(r.itens)).toEqual(["vinheta", "[a]", "[b]", "[fim]"])
    })

    it("cor que nao e #rgb/#rrggbb nao entra (vai para um style)", () => {
        const r = reconciliar([], [bloco("a", 0, { cor: "red;background:url(x)" })])
        expect(r.itens[0].color).toBeUndefined()
    })
})

describe("reconciliar: mover", () => {
    it("o cabecalho anda levando o que esta embaixo dele", () => {
        const itens = montado("a", "b", "c")
        itens.splice(1, 0, musica("m1"), musica("m2")) // debaixo de A
        itens.splice(4, 0, foto("f1")) // debaixo de B
        expect(desenho(itens)).toEqual(["[a]", "m1", "m2", "[b]", "f1", "[c]", "[fim]"])

        const r = reconciliar(itens, roteiro("b", "c", "a"))
        expect(desenho(r.itens)).toEqual(["[b]", "f1", "[c]", "[a]", "m1", "m2", "[fim]"])
        expect(r.mudouEstrutura).toBe(true)
    })

    it("os objetos sao os mesmos, so mudam de lugar", () => {
        const itens = montado("a", "b")
        const [a, b, fim] = itens
        const r = reconciliar(itens, roteiro("b", "a"))
        expect(r.itens[0]).toBe(b)
        expect(r.itens[1]).toBe(a)
        expect(r.itens[2]).toBe(fim)
    })

    it("secao do operador entre dois blocos anda com o bloco de cima", () => {
        const itens = montado("a", "b")
        itens.splice(1, 0, secao("minha"), musica("m1"))
        const r = reconciliar(itens, roteiro("b", "a"))
        expect(desenho(r.itens)).toEqual(["[b]", "[a]", "{minha}", "m1", "[fim]"])
    })
})

describe("reconciliar: cabeca e cauda", () => {
    it("o que esta acima do primeiro bloco e depois do rodape nao se move", () => {
        const itens = [musica("vinheta"), secao("avisos"), ...montado("a", "b")]
        itens.push(foto("remote1"), musica("extra"))
        const r = reconciliar(itens, roteiro("b", "a"))
        expect(desenho(r.itens)).toEqual(["vinheta", "{avisos}", "[b]", "[a]", "[fim]", "remote1", "extra"])
    })

    it("item do Remote acrescentado no fim fica na cauda, nao no ultimo bloco", () => {
        const itens = montado("a", "b")
        itens.push(foto("remote1")) // o Remote sempre acrescenta no fim
        const r = reconciliar(itens, roteiro("b", "a"))
        expect(desenho(r.itens)).toEqual(["[b]", "[a]", "[fim]", "remote1"])
    })

    it("sem o rodape (apagado ou projeto antigo), ele volta no fim", () => {
        const itens = montado("a", "b").filter((i) => i.id !== ID_RODAPE)
        itens.push(musica("m1"))
        const r = reconciliar(itens, roteiro("a", "b"))
        expect(desenho(r.itens)).toEqual(["[a]", "[b]", "m1", "[fim]"])
    })
})

describe("reconciliar: apagar", () => {
    it("bloco apagado com o cabecalho vazio: some", () => {
        const r = reconciliar(montado("a", "b", "c"), roteiro("a", "c"))
        expect(desenho(r.itens)).toEqual(["[a]", "[c]", "[fim]"])
        expect(r.sumiram).toBe(1)
    })

    it("cabecalho vazio que esta no ar nao some: vira lapide", () => {
        const itens = montado("a", "b", "c")
        const r = reconciliar(itens, roteiro("a", "c"), { ativos: [1] })
        expect(desenho(r.itens)).toEqual(["[a]", "[x:b]", "[c]", "[fim]"])
    })

    it("bloco apagado com conteudo: vira lapide e fica no lugar", () => {
        const itens = montado("a", "b", "c")
        itens.splice(2, 0, musica("m1")) // debaixo de B
        itens[1].data.settings = { triggerAction: "x" }
        const b = itens[1]

        const r = reconciliar(itens, roteiro("a", "c"))
        expect(desenho(r.itens)).toEqual(["[a]", "[x:b]", "m1", "[c]", "[fim]"])
        expect(r.itens[1]).toBe(b)
        expect(b).toMatchObject({ id: "sirvo_x_b", name: "(removido no Sirvo) B", color: COR_LAPIDE })
        expect(b.data.sirvo).toBeUndefined()
        expect(b.data.settings).toEqual({ triggerAction: "x" })
        expect(r.mudouCampos).toBe(true)
    })

    it("na proxima reorganizacao a lapide desce para depois do rodape, com o conteudo", () => {
        const itens = montado("a", "b", "c", "d")
        itens.splice(2, 0, musica("m1"))
        itens.push(foto("remote1"))
        const passo1 = reconciliar(itens, roteiro("a", "c", "d")).itens
        expect(desenho(passo1)).toEqual(["[a]", "[x:b]", "m1", "[c]", "[d]", "[fim]", "remote1"])

        const passo2 = reconciliar(passo1, roteiro("c", "a", "d")).itens
        expect(desenho(passo2)).toEqual(["[c]", "[a]", "[d]", "[fim]", "[x:b]", "m1", "remote1"])

        // e la fica: a cauda nao se reorganiza
        const passo3 = reconciliar(passo2, roteiro("d", "c", "a"))
        expect(desenho(passo3.itens)).toEqual(["[d]", "[c]", "[a]", "[fim]", "[x:b]", "m1", "remote1"])
    })

    it("lapide e destrancada: seu id nao e de cabecalho", () => {
        expect(papelDoItem({ id: "sirvo_x_b", type: "section" })).toBe("lapide")
        expect(papelDoItem({ id: "sirvo_b", type: "section" })).toBe("cabecalho")
        expect(papelDoItem({ id: "sirvo_b", type: "show" })).toBeNull()
    })
})

describe("reconciliar: duplicata", () => {
    it("a primeira copia e a oficial; a outra vira secao comum e nunca e apagada", () => {
        const itens = montado("a", "b")
        const copia: ProjectShowRef = JSON.parse(JSON.stringify(itens[0]))
        itens.push(copia, musica("m1")) // colado na cauda

        const r = reconciliar(itens, roteiro("a", "b"), { novoId: () => "novo1" })
        expect(desenho(r.itens)).toEqual(["[a]", "[b]", "[fim]", "{novo1}", "m1"])
        expect(copia.id).toBe("novo1")
        expect(copia.data.sirvo).toBeUndefined()
        expect(copia.name).toBe("A")
        expect(r.mudouCampos).toBe(true)
        expect(r.mudouEstrutura).toBe(false)
    })

    it("rodape duplicado: o de baixo vira secao comum", () => {
        const itens = montado("a")
        itens.push(musica("m1"), { id: ID_RODAPE, type: "section", name: NOME_RODAPE })
        const r = reconciliar(itens, roteiro("a"), { novoId: () => "novo2" })
        expect(desenho(r.itens)).toEqual(["[a]", "[fim]", "m1", "{novo2}"])
    })

    it("bloco repetido na resposta do Sirvo entra uma vez so", () => {
        const r = reconciliar([], [bloco("a"), bloco("b"), bloco("a")])
        expect(desenho(r.itens)).toEqual(["[a]", "[b]", "[fim]"])
    })
})

describe("reconciliar: trava de sanidade", () => {
    it("roteiro vazio nao se aplica sozinho", () => {
        const itens = montado("a", "b")
        const antes = [...itens]
        const r = reconciliar(itens, [])
        expect(r).toMatchObject({ pendente: true, motivo: "roteiro_vazio", sumiram: 2, mudouEstrutura: false })
        expect(r.itens).toBe(itens)
        expect(itens).toEqual(antes)
        expect(desenho(itens)).toEqual(["[a]", "[b]", "[fim]"])
    })

    it("roteiro vazio num projeto sem blocos: nada a fazer, sem aviso", () => {
        const itens = [musica("m1")]
        expect(reconciliar(itens, [])).toMatchObject({ itens, pendente: false, motivo: null, mudouCampos: false, mudouEstrutura: false })
    })

    it("mais da metade sumindo de uma vez: pendente, nada apagado nem virado lapide", () => {
        const itens = montado("a", "b", "c")
        itens.splice(1, 0, musica("m1"))
        const r = reconciliar(itens, roteiro("c", "d"))
        expect(r).toMatchObject({ pendente: true, motivo: "muitos_sumiram", sumiram: 2, mudouEstrutura: false })
        expect(desenho(r.itens)).toEqual(["[a]", "m1", "[b]", "[c]", "[fim]"])
    })

    it("metade exata passa", () => {
        const r = reconciliar(montado("a", "b"), roteiro("a"))
        expect(r.pendente).toBe(false)
        expect(desenho(r.itens)).toEqual(["[a]", "[fim]"])
    })

    it("com Aplicar (forcar) passa por cima da trava", () => {
        const itens = montado("a", "b", "c")
        itens.splice(1, 0, musica("m1"))
        const r = reconciliar(itens, roteiro("c", "d"), { forcar: true })
        expect(r.pendente).toBe(false)
        expect(desenho(r.itens)).toEqual(["[c]", "[d]", "[fim]", "[x:a]", "m1"])
    })
})

describe("reconciliar: momento protegido (culto ao vivo)", () => {
    it("mudanca de ordem antes do item no ar fica pendente, e os campos aplicam", () => {
        const itens = montado("a", "b", "c")
        itens.splice(2, 0, musica("m1")) // m1 debaixo de B, no telao (posicao 2)
        const r = reconciliar(itens, [bloco("b", 0, { titulo: "Louvor" }), bloco("a", 1), bloco("c", 2)], { protegido: true, ativos: [2] })
        expect(r).toMatchObject({ pendente: true, motivo: "no_ar", mudouEstrutura: false, mudouCampos: true })
        expect(r.itens).toBe(itens)
        expect(item(itens, "[b]").name).toBe("Louvor")
    })

    it("bloco novo depois do que esta no ar entra sozinho", () => {
        const itens = montado("a", "b")
        itens.splice(1, 0, musica("m1"))
        const r = reconciliar(itens, roteiro("a", "b", "c"), { protegido: true, ativos: [1] })
        expect(r.pendente).toBe(false)
        expect(desenho(r.itens)).toEqual(["[a]", "m1", "[b]", "[c]", "[fim]"])
    })

    it("Aplicar passa por cima do momento protegido", () => {
        const itens = montado("a", "b")
        const r = reconciliar(itens, roteiro("b", "a"), { protegido: true, ativos: [1], forcar: true })
        expect(desenho(r.itens)).toEqual(["[b]", "[a]", "[fim]"])
    })
})

describe("reconciliar: idempotencia e escrita minima", () => {
    it("rodar duas vezes nao muda nada", () => {
        const itens = [musica("vinheta"), ...montado("a", "b", "c", "d")]
        itens.splice(3, 0, musica("m1"))
        itens.push(foto("remote1"))
        const novo = [bloco("d", 0), bloco("a", 1, { titulo: "Abertura" }), bloco("e", 2), bloco("c", 3)]

        const primeira = reconciliar(itens, novo)
        const copia = JSON.stringify(primeira.itens)
        const segunda = reconciliar(primeira.itens, novo)
        expect(segunda).toMatchObject({ mudouCampos: false, mudouEstrutura: false, pendente: false })
        expect(segunda.itens).toBe(primeira.itens)
        expect(JSON.stringify(segunda.itens)).toBe(copia)
    })

    it("campos iguais: nada escrito, mesma lista e mesmos objetos (inclusive o data)", () => {
        const itens = montado("a", "b")
        const objetos = [...itens]
        const datas = itens.map((i) => i.data)
        const r = reconciliar(itens, roteiro("a", "b"))
        expect(r).toMatchObject({ mudouCampos: false, mudouEstrutura: false, pendente: false })
        expect(r.itens).toBe(itens)
        r.itens.forEach((i, n) => {
            expect(i).toBe(objetos[n])
            expect(i.data).toBe(datas[n])
        })
    })

    it("o estado e o fim previsto do bloco nao sao guardados: concluir um bloco nao escreve nada", () => {
        const itens = montado("a", "b")
        const r = reconciliar(
            itens,
            roteiro("a", "b").map((b) => ({ ...b, estado: "concluido", fim_previsto: "2026-11-08T13:20:00Z", concluido_em: "2026-11-08T13:20:00Z" }))
        )
        expect(r.mudouCampos).toBe(false)
    })

    it("bloco concluido (inicio_previsto anda) NAO escreve nada: a hora e a do plano", () => {
        const itens = montado("a", "b")
        const [a, b] = itens
        const dataA = a.data
        const dataB = b.data
        const novo = [bloco("a", 0), bloco("b", 0, { inicio_previsto: "2026-11-08T13:20:30Z" })]
        const r = reconciliar(itens, novo, { comecaEm: INICIO })
        expect(r.mudouCampos).toBe(false)
        expect(a.data).toBe(dataA)
        expect(b.data).toBe(dataB)
        expect(b.data.time).toBe("10:15")
    })

    it("duracao que muda no plano desloca a hora so dos cabecalhos de baixo", () => {
        const itens = montado("a", "b", "c")
        const [a, b, c] = itens
        const dataA = a.data
        const r = reconciliar(itens, [bloco("a", 0, { duracao_min: 20 }), bloco("b", 1), bloco("c", 2)], { comecaEm: INICIO })
        expect(r.mudouCampos).toBe(true)
        expect(r.mudouEstrutura).toBe(false)
        expect(a.data.time).toBe("10:00")
        expect(b.data.time).toBe("10:20")
        expect(c.data.time).toBe("10:35")
        expect(dataA).not.toBe(a.data) // a mudou so a duracao guardada em data.sirvo
    })

    it("o data do operador e preservado na atualizacao", () => {
        const itens = montado("a")
        itens[0].data.settings = { triggerAction: "minha_acao" }
        itens[0].data.outro = 1
        reconciliar(itens, [bloco("a", 0, { responsavel: "Pr. Joao", nota: "ler Sl 23", link: "https://x" })], { comecaEm: INICIO })
        expect(itens[0].data).toMatchObject({ settings: { triggerAction: "minha_acao" }, outro: 1, time: "10:00", sirvo: { responsavel: "Pr. Joao", nota: "ler Sl 23", link: "https://x" } })
    })

    it("sem o inicio do culto, a hora que ja estava fica", () => {
        const itens = montado("a")
        reconciliar(itens, [bloco("a", 0)])
        expect(itens[0].data.time).toBe("10:00")
    })
})

describe("horaDoBloco", () => {
    it("HH:MM em Sao Paulo", () => {
        expect(horaDoBloco("2026-11-08T22:05:00Z")).toBe("19:05")
        expect(horaDoBloco("")).toBe("")
        expect(horaDoBloco("nao e data")).toBe("")
    })
})

describe("trava por item", () => {
    const ligado = { sirvo: { eventId: "ev1" } }
    it("so o cabecalho de bloco, e so com o projeto ligado", () => {
        expect(cabecalhoTrancado(ligado, secao("sirvo_a"))).toBe(true)
        expect(cabecalhoTrancado(ligado, secao("sirvo_x_a"))).toBe(false) // lapide
        expect(cabecalhoTrancado(ligado, secao(ID_RODAPE))).toBe(false)
        expect(cabecalhoTrancado(ligado, secao("s1"))).toBe(false) // secao do operador
        expect(cabecalhoTrancado(ligado, { id: "sirvo_a", type: "show" })).toBe(false)
        expect(cabecalhoTrancado({ sirvo: null }, secao("sirvo_a"))).toBe(false) // desligado
        expect(cabecalhoTrancado(null, secao("sirvo_a"))).toBe(false)
    })
    it("apagar: cabecalho e rodape ficam; lapide e o resto saem", () => {
        expect(naoSaiDoProjeto(ligado, secao("sirvo_a"))).toBe(true)
        expect(naoSaiDoProjeto(ligado, secao(ID_RODAPE))).toBe(true)
        expect(naoSaiDoProjeto(ligado, secao("sirvo_x_a"))).toBe(false)
        expect(naoSaiDoProjeto(ligado, secao("s1"))).toBe(false)
        expect(naoSaiDoProjeto({ sirvo: null }, secao(ID_RODAPE))).toBe(false)
    })
})

describe("quantosDoOperador (o pontinho 'tem material')", () => {
    it("cabecalhos, lapides e rodape nao contam", () => {
        expect(quantosDoOperador(montado("a", "b"))).toBe(0)
        expect(quantosDoOperador([...montado("a"), foto("f1"), secao("sirvo_x_b"), secao("s1")])).toBe(2)
        expect(quantosDoOperador(undefined)).toBe(0)
    })
})

describe("linkSeguro", () => {
    it("so https de verdade", () => {
        expect(linkSeguro("https://docs.google.com/x?y=1")).toBe("https://docs.google.com/x?y=1")
        expect(linkSeguro("  https://a.com  ")).toBe("https://a.com/")
        expect(linkSeguro("http://a.com")).toBe("")
        expect(linkSeguro("javascript:alert(1)")).toBe("")
        expect(linkSeguro("file:///C:/Windows/system32/calc.exe")).toBe("")
        expect(linkSeguro("https://user:senha@a.com")).toBe("")
        expect(linkSeguro("a.com")).toBe("")
        expect(linkSeguro(null)).toBe("")
    })
})

describe("resumirPendencia (a faixa diz o que mudou)", () => {
    it("um bloco movido aparece sozinho, nao todos os do meio", () => {
        const r = resumirPendencia(montado("a", "b", "c", "d"), roteiro("b", "c", "d", "a"))
        expect(r).toEqual({ movidos: ["A"], novos: [], sumidos: [] })
        expect(textoDaPendencia(r)).toBe("A mudou de lugar")
    })

    it("bloco novo e bloco que saiu", () => {
        const itens = montado("a", "b")
        itens.splice(2, 0, musica("m1")) // b tem conteudo
        const r = resumirPendencia(itens, roteiro("a", "n"))
        expect(r).toEqual({ movidos: [], novos: ["N"], sumidos: ["B"] })
        expect(textoDaPendencia(r)).toBe("bloco novo: N · saiu do Sirvo: B")
    })

    it("muitos: conta em vez de listar", () => {
        const r = resumirPendencia(montado("a", "b", "c", "d"), roteiro("d", "c", "b", "a", "x", "y", "z"))
        expect(r.movidos).toHaveLength(3)
        expect(textoDaPendencia(r)).toBe("3 blocos mudaram de lugar · 3 blocos novos")
    })

    it("dois trocados de lugar", () => {
        expect(textoDaPendencia(resumirPendencia(montado("a", "b"), roteiro("b", "a")))).toMatch(/^(A|B) mudou de lugar$/)
    })

    it("nada mudou: texto vazio", () => {
        expect(textoDaPendencia(resumirPendencia(montado("a", "b"), roteiro("a", "b")))).toBe("")
    })
})
