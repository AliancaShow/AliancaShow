import { describe, expect, it } from "vitest"
import { alinhar, idsDaLista, mesmosIds, novaPosicao, reapontar } from "./aliancaPonteirosLogica"

const L = (s: string) => s.split("")

describe("reapontar: coerente (o ponteiro aponta o item da posição)", () => {
    it("inserir itens acima: o ponteiro desce junto (T3a)", () => {
        // o 4º item (índice 3) está no ar; entram 3 itens depois do índice 2
        expect(reapontar(L("abcPe"), L("abcxyzPe"), 3, "P")).toBe(6)
    })
    it("Ctrl+Z da inserção: o ponteiro volta", () => {
        expect(reapontar(L("abcxyzPe"), L("abcPe"), 6, "P")).toBe(3)
    })
    it("inserir abaixo não mexe", () => {
        expect(reapontar(L("abcPe"), L("abcPexyz"), 3, "P")).toBe(3)
    })
    it("tirar um item acima: o ponteiro sobe", () => {
        expect(reapontar(L("abcde"), L("bcde"), 2, "c")).toBe(1)
    })
    it("mover o item no ar para cima e para baixo", () => {
        expect(reapontar(L("abcde"), L("cabde"), 2, "c")).toBe(0)
        expect(reapontar(L("abcde"), L("abdec"), 2, "c")).toBe(4)
    })
    it("mover um item de cima para baixo do que está no ar", () => {
        expect(reapontar(L("abcde"), L("bcade"), 2, "c")).toBe(1)
    })
    it("tirar o PRÓPRIO item no ar: fica na posição dele (tirado, ainda no ar)", () => {
        expect(reapontar(L("abcde"), L("abde"), 2, "c")).toBe(2)
    })
    it("tirar o próprio e outros acima na mesma ação", () => {
        expect(reapontar(L("abcde"), L("bde"), 2, "c")).toBe(1)
    })
    it("item repetido: o ponteiro fica na MESMA ocorrência (inserir acima)", () => {
        expect(reapontar(L("xyx"), L("nxyx"), 2, "x")).toBe(3)
        expect(reapontar(L("xyx"), L("nxyx"), 0, "x")).toBe(1)
    })
    it("item repetido: tirar a primeira ocorrência leva a segunda para a frente", () => {
        expect(reapontar(L("xyx"), L("yx"), 2, "x")).toBe(1)
    })
    it("item repetido: tirar a segunda ocorrência com o ponteiro nela, fica na posição", () => {
        expect(reapontar(L("xxy"), L("xy"), 1, "x")).toBe(1)
    })
    it("sem id do ponteiro, vale o item da posição", () => {
        expect(reapontar(L("abcde"), L("bcde"), 2)).toBe(1)
    })
    it("lista igual: nada muda", () => {
        expect(reapontar(L("abc"), L("abc"), 1, "b")).toBe(1)
    })
})

describe("reapontar: ponteiro fora da lista de antes", () => {
    it("posição inválida não é tocada", () => {
        expect(reapontar(L("abc"), L("xabc"), 5, "z")).toBe(5)
        expect(reapontar(L("abc"), L("xabc"), -1, "a")).toBe(-1)
        expect(reapontar(L("abc"), L("xabc"), 1.5, "a")).toBe(1.5)
    })
    it("lista vazia", () => {
        expect(reapontar([], L("abc"), 0, "a")).toBe(0)
    })
})

describe("reapontar: órfão (o item no ar já tinha sido tirado)", () => {
    // [a,b,c,d,e], o `c` está no ar (índice 2)
    it("tirar outro item acima: segue o vizinho que ocupou a posição", () => {
        // depois de tirar o c: [a,b,d,e] e o ponteiro continua em 2 (id c); tira o `a`
        expect(reapontar(L("abde"), L("bde"), 2, "c")).toBe(1)
    })
    it("Ctrl+Z x2: tirar o no ar, tirar outro acima, desfazer, desfazer", () => {
        // 1) tira c
        let lista = L("abde")
        let p = reapontar(L("abcde"), lista, 2, "c")
        expect(p).toBe(2)
        // 2) tira a
        const sem = L("bde")
        p = reapontar(lista, sem, p, "c")
        expect(p).toBe(1)
        // 3) Ctrl+Z (a volta)
        p = reapontar(sem, L("abde"), p, "c")
        expect(p).toBe(2)
        // 4) Ctrl+Z (c volta, em 2): o ponteiro encontra o item de novo
        p = reapontar(L("abde"), L("abcde"), p, "c")
        expect(p).toBe(2)
    })
    it("Ctrl+Z que repõe o próprio item vai para a ocorrência nova", () => {
        expect(reapontar(L("abde"), L("abcde"), 2, "c")).toBe(2)
        // o item volta numa posição diferente da âncora
        expect(reapontar(L("abde"), L("cabde"), 2, "c")).toBe(0)
    })
    it("repor o item tirado antes de um duplicado: pega a ocorrência NOVA, não a antiga", () => {
        // [x,y] com x no ar na posição 0 ... o ponteiro órfão (id x) mas já havia um x
        expect(reapontar(L("yx"), L("xyx"), 0, "x")).toBe(0)
    })
    it("órfão no fim da lista (ponteiro além do último item) fica como está", () => {
        expect(reapontar(L("ab"), L("xab"), 2, "c")).toBe(2)
    })
})

describe("alinhar", () => {
    it("lista casada pela ordem", () => {
        expect(alinhar(L("abc"), L("abc"))).toEqual([0, 1, 2])
    })
    it("o que saiu fica -1", () => {
        expect(alinhar(L("abc"), L("ac"))).toEqual([0, -1, 1])
    })
    it("o item movido é casado com o mesmo id", () => {
        const c = alinhar(L("abc"), L("bca"))
        expect(c.every((j) => j >= 0)).toBe(true)
        expect(L("bca")[c[0]]).toBe("a")
    })
    it("listas gigantes não estouram", () => {
        const a = Array.from({ length: 3000 }, (_, i) => "i" + i)
        const b = [...a.slice(100), "novo", ...a.slice(0, 100)]
        const c = alinhar(a, b)
        expect(c[0]).toBe(b.indexOf("i0"))
    })
})

describe("novaPosicao e ids", () => {
    it("devolve null quando não muda", () => {
        const a = L("abc")
        expect(novaPosicao(a, a, alinhar(a, a), { index: 1, id: "b" })).toBeNull()
        expect(novaPosicao(a, a, alinhar(a, a), null)).toBeNull()
        expect(novaPosicao(a, a, alinhar(a, a), { index: null, id: "b" })).toBeNull()
    })
    it("devolve a posição nova", () => {
        const a = L("abc")
        const d = L("xabc")
        expect(novaPosicao(a, d, alinhar(a, d), { index: 1, id: "b" })).toBe(2)
    })
    it("idsDaLista e mesmosIds comparam por conteúdo", () => {
        const ids = idsDaLista([{ id: "a" }, { id: "b" }])
        expect(mesmosIds(ids, ["a", "b"])).toBe(true)
        expect(mesmosIds(ids, ["a", "c"])).toBe(false)
        expect(mesmosIds(ids, ["a"])).toBe(false)
        expect(idsDaLista(null)).toEqual([])
    })
})
