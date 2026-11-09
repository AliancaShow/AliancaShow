import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { blocoDaPosicao, posicaoNaSaida, sugerirAvanco, type RoteiroParaSugestao } from "./aliancaSirvoSugestao"

const cab = (b: string) => ({ id: `sirvo_${b}`, type: "section", name: b }) as unknown as ProjectShowRef
const lapide = (b: string) => ({ id: `sirvo_x_${b}`, type: "section", name: b }) as unknown as ProjectShowRef
const rodape = () => ({ id: "sirvo_fim", type: "section", name: "Fora do roteiro" }) as unknown as ProjectShowRef
const show = (id: string) => ({ id, type: "show" }) as unknown as ProjectShowRef

// solto | A: musica1 | B: musica2, aviso | C: musica1 (de novo) | lápide D: x | rodapé: y
const itens = [show("solto"), cab("a"), show("musica1"), cab("b"), show("musica2"), show("aviso"), cab("c"), show("musica1"), lapide("d"), show("x"), rodape(), show("y")]

const noAr = (blocoNoAr: string, feitos: string[] = []): RoteiroParaSugestao => ({ noAr: true, blocoNoAr, ordem: ["a", "b", "c", "d"].map((id) => ({ id, feito: feitos.includes(id) })) })

describe("posicaoNaSaida", () => {
    it("usa o projectIndex quando bate com o id", () => {
        expect(posicaoNaSaida(itens, { id: "musica1", projectIndex: 7 })).toBe(7)
    })
    it("projectIndex que não bate com o id: sem certeza", () => {
        expect(posicaoNaSaida(itens, { id: "musica2", projectIndex: 7 })).toBeNull()
    })
    it("sem posição: só pelo id se ele aparece uma vez", () => {
        expect(posicaoNaSaida(itens, { id: "musica2" })).toBe(4)
        expect(posicaoNaSaida(itens, { id: "musica1" })).toBeNull()
        expect(posicaoNaSaida(itens, { id: "nao-existe" })).toBeNull()
    })
})

describe("blocoDaPosicao", () => {
    it("o cabeçalho acima do item", () => {
        expect(blocoDaPosicao(itens, 5)).toBe("b")
        expect(blocoDaPosicao(itens, 3)).toBe("b")
    })
    it("antes do 1º cabeçalho, lápide e rodapé: nada", () => {
        expect(blocoDaPosicao(itens, 0)).toBeNull()
        expect(blocoDaPosicao(itens, 9)).toBeNull()
        expect(blocoDaPosicao(itens, 11)).toBeNull()
    })
})

describe("sugerirAvanco", () => {
    it("a saída num bloco depois do que está no ar: sugere", () => {
        expect(sugerirAvanco(itens, [{ id: "musica2", projectIndex: 4 }], noAr("a"))).toEqual({ destino: "b", pulados: 1 })
        expect(sugerirAvanco(itens, [{ id: "musica1", projectIndex: 7 }], noAr("a"))).toEqual({ destino: "c", pulados: 2 })
    })
    it("a saída no próprio bloco no ar, ou antes dele: nada", () => {
        expect(sugerirAvanco(itens, [{ id: "musica2", projectIndex: 4 }], noAr("b"))).toBeNull()
        expect(sugerirAvanco(itens, [{ id: "musica1", projectIndex: 2 }], noAr("b"))).toBeNull()
    })
    it("culto fora do ar ou saída limpa: nada", () => {
        expect(sugerirAvanco(itens, [{ id: "musica2", projectIndex: 4 }], { ...noAr("a"), noAr: false })).toBeNull()
        expect(sugerirAvanco(itens, [null, undefined], noAr("a"))).toBeNull()
    })
    it("saídas discordando: nada; concordando: sugere", () => {
        expect(
            sugerirAvanco(
                itens,
                [
                    { id: "musica2", projectIndex: 4 },
                    { id: "musica1", projectIndex: 7 }
                ],
                noAr("a")
            )
        ).toBeNull()
        expect(sugerirAvanco(itens, [{ id: "musica2", projectIndex: 4 }, { id: "aviso" }], noAr("a"))).toEqual({ destino: "b", pulados: 1 })
    })
    it("uma saída sem certeza derruba a sugestão", () => {
        expect(sugerirAvanco(itens, [{ id: "musica2", projectIndex: 4 }, { id: "musica1" }], noAr("a"))).toBeNull()
    })
    it("lápide, rodapé e item solto: nada", () => {
        expect(sugerirAvanco(itens, [{ id: "x", projectIndex: 9 }], noAr("a"))).toBeNull()
        expect(sugerirAvanco(itens, [{ id: "y", projectIndex: 11 }], noAr("a"))).toBeNull()
        expect(sugerirAvanco(itens, [{ id: "solto", projectIndex: 0 }], noAr("a"))).toBeNull()
    })
    it("bloco que já passou não vira destino", () => {
        expect(sugerirAvanco(itens, [{ id: "musica1", projectIndex: 7 }], noAr("a", ["c"]))).toBeNull()
    })
    it("bloco que não está no roteiro: nada", () => {
        expect(sugerirAvanco(itens, [{ id: "musica2", projectIndex: 4 }], { noAr: true, blocoNoAr: "a", ordem: [{ id: "a", feito: false }] })).toBeNull()
    })
})
