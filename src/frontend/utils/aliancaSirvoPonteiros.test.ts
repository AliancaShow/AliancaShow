import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { reconciliar, type BlocoParaProjeto } from "./aliancaSirvoProjeto"
import { desfazListaDoProjeto, ondeFoiParar, remapearPonteiros } from "./aliancaSirvoPonteiros"

const bloco = (id: string): BlocoParaProjeto => ({ id, titulo: id.toUpperCase(), tipo: "louvor", cor: "#3366ff", duracao_min: 15 })
const roteiro = (...ids: string[]) => ids.map(bloco)
const musica = (id: string): ProjectShowRef => ({ id, type: "show" })

describe("ondeFoiParar", () => {
    it("acha pelo objeto, nao pelo id", () => {
        const a1 = musica("A")
        const a2 = musica("A")
        const antes = [a1, a2]
        const depois = [a2, a1]
        expect(ondeFoiParar(antes, depois, 0)).toBe(1)
        expect(ondeFoiParar(antes, depois, 1)).toBe(0)
    })

    it("posicao invalida ou item que sumiu: -1", () => {
        const a = musica("A")
        expect(ondeFoiParar([a], [a], -1)).toBe(-1)
        expect(ondeFoiParar([a], [a], 1)).toBe(-1)
        expect(ondeFoiParar([a], [a], 0.5)).toBe(-1)
        expect(ondeFoiParar([a], [a], undefined)).toBe(-1)
        expect(ondeFoiParar([a], [], 0)).toBe(-1)
    })
})

describe("remapearPonteiros", () => {
    it("nada mudou de lugar: nenhum ponteiro e tocado", () => {
        const lista = [musica("A"), musica("B")]
        const r = remapearPonteiros(lista, [...lista], { ativo: { index: 1, id: "B" }, foco: { index: 0, id: "A" }, saidas: { o1: 1 } })
        expect(r).toEqual({ ativo: null, foco: null, saidas: {}, perdidos: 0 })
    })

    it("so a saida cuja posicao mudou entra no resultado", () => {
        const a = musica("A")
        const b = musica("B")
        const c = musica("C")
        const r = remapearPonteiros([a, b, c], [b, a, c], { saidas: { o1: 0, o2: 2, palco: undefined } })
        expect(r.saidas).toEqual({ o1: 1 })
    })

    it("item que trocou de id no lugar (virou lapide) leva o id novo", () => {
        const h = { id: "sirvo_a", type: "section", name: "A" } as ProjectShowRef
        const lista = [h]
        h.id = "sirvo_x_a"
        const r = remapearPonteiros(lista, lista, { ativo: { index: 0, id: "sirvo_a" } })
        expect(r.ativo).toEqual({ index: 0, id: "sirvo_x_a" })
    })

    it("ponteiro que aponta para item que sumiu: nao mexe e conta como perdido", () => {
        const a = musica("A")
        const b = musica("B")
        const r = remapearPonteiros([a, b], [a], { ativo: { index: 1, id: "B" }, saidas: { o1: 1 } })
        expect(r).toEqual({ ativo: null, foco: null, saidas: {}, perdidos: 2 })
    })
})

describe("Aplicar a ordem nova com a musica no telao", () => {
    // [A] m1 [B] x1 [C] m1' [fim] — a mesma musica (m1) duas vezes, uma no bloco A e outra no C
    function projeto() {
        const itens = reconciliar([], roteiro("a", "b", "c"), {}).itens
        const m1 = musica("m1")
        const x1 = musica("x1")
        const m1Copia = musica("m1")
        itens.splice(1, 0, m1)
        itens.splice(3, 0, x1)
        itens.splice(5, 0, m1Copia)
        return { itens, m1, x1, m1Copia }
    }

    it("o telao mostra a SEGUNDA copia da musica repetida: depois de mover o bloco A para o fim, segue a segunda copia", () => {
        const { itens, m1, m1Copia } = projeto()
        expect(itens.map((i) => i.id)).toEqual(["sirvo_a", "m1", "sirvo_b", "x1", "sirvo_c", "m1", "sirvo_fim"])
        const noAr = itens.indexOf(m1Copia) // 5

        const r = reconciliar(itens, roteiro("b", "c", "a"), { ativos: [noAr], protegido: true, forcar: true })
        expect(r.itens.map((i) => i.id)).toEqual(["sirvo_b", "x1", "sirvo_c", "m1", "sirvo_a", "m1", "sirvo_fim"])

        const p = remapearPonteiros(itens, r.itens, { ativo: { index: noAr, id: "m1" }, saidas: { telao: noAr } })
        expect(p.ativo).toEqual({ index: 3, id: "m1" })
        expect(p.saidas).toEqual({ telao: 3 })
        expect(r.itens[3]).toBe(m1Copia)
        expect(r.itens[5]).toBe(m1)

        // o "proximo" (posicao + 1, pulando o cabecalho sem nota) vai para o bloco que agora vem depois
        expect(r.itens[p.saidas.telao + 1].id).toBe("sirvo_a")
        expect(r.itens[p.saidas.telao + 2]).toBe(m1)
    })

    it("o telao mostra a PRIMEIRA copia: ela vai junto com o bloco A, e nao para a outra copia", () => {
        const { itens, m1, m1Copia } = projeto()
        const noAr = itens.indexOf(m1) // 1
        const r = reconciliar(itens, roteiro("b", "c", "a"), { ativos: [noAr], protegido: true, forcar: true })
        const p = remapearPonteiros(itens, r.itens, { ativo: { index: noAr, id: "m1" }, saidas: { telao: noAr } })
        expect(p.saidas.telao).toBe(5)
        expect(r.itens[5]).toBe(m1)
        expect(r.itens[p.saidas.telao]).not.toBe(m1Copia)
    })

    it("item aberto e item no telao diferentes: cada um segue o seu", () => {
        const { itens, m1, x1 } = projeto()
        const r = reconciliar(itens, roteiro("c", "a", "b"), { ativos: [1, 3], protegido: true, forcar: true })
        const p = remapearPonteiros(itens, r.itens, { ativo: { index: 3, id: "x1" }, foco: { index: 1, id: "m1" }, saidas: { telao: 1 } })
        expect(r.itens[p.ativo!.index]).toBe(x1)
        expect(r.itens[p.foco!.index]).toBe(m1)
        expect(r.itens[p.saidas.telao]).toBe(m1)
    })

    it("bloco novo no fim, com o culto no ar: aplica sozinho e nenhum ponteiro muda", () => {
        const { itens, m1Copia } = projeto()
        const noAr = itens.indexOf(m1Copia)
        const r = reconciliar(itens, roteiro("a", "b", "c", "d"), { ativos: [noAr], protegido: true })
        expect(r.pendente).toBe(false)
        expect(r.itens.map((i) => i.id)).toEqual(["sirvo_a", "m1", "sirvo_b", "x1", "sirvo_c", "m1", "sirvo_d", "sirvo_fim"])
        const p = remapearPonteiros(itens, r.itens, { ativo: { index: noAr, id: "m1" }, saidas: { telao: noAr } })
        expect(p).toEqual({ ativo: null, foco: null, saidas: {}, perdidos: 0 })
    })

    it("bloco movido ANTES do que esta no ar, sem Aplicar: pendente e a lista nao muda", () => {
        const { itens, m1Copia } = projeto()
        const noAr = itens.indexOf(m1Copia)
        const r = reconciliar(itens, roteiro("b", "a", "c"), { ativos: [noAr], protegido: true })
        expect(r).toMatchObject({ pendente: true, motivo: "no_ar", mudouEstrutura: false })
        expect(r.itens).toBe(itens)
    })
})

describe("desfazListaDoProjeto (Ctrl+Z que devolveria a ordem velha)", () => {
    it("so a mudanca da lista deste projeto", () => {
        expect(desfazListaDoProjeto({ id: "UPDATE", newData: { key: "shows", data: [] }, oldData: { id: "p1" } }, "p1")).toBe(true)
        expect(desfazListaDoProjeto({ id: "UPDATE", newData: { id: "p1" }, oldData: { key: "shows" } }, "p1")).toBe(true) // ja desfeita uma vez: os lados trocam
        expect(desfazListaDoProjeto({ id: "UPDATE", newData: { key: "shows" }, oldData: null }, "p1")).toBe(true) // sem id: o projeto aberto
        expect(desfazListaDoProjeto({ id: "UPDATE", newData: { key: "shows" }, oldData: { id: "p2" } }, "p1")).toBe(false)
        expect(desfazListaDoProjeto({ id: "UPDATE", newData: { key: "name" }, oldData: { id: "p1" } }, "p1")).toBe(false)
        expect(desfazListaDoProjeto({ id: "SLIDES", newData: { key: "shows" }, oldData: { id: "p1" } }, "p1")).toBe(false)
        expect(desfazListaDoProjeto({ version: 1, type: "store_update", value: {} }, "p1")).toBe(false)
        expect(desfazListaDoProjeto(null, "p1")).toBe(false)
    })
})
