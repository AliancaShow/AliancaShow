import { describe, expect, it } from "vitest"
import { blocosDe, criarAnteparo, criarEngolidor, moverBloco, moverItem, renomearBloco, semDestino } from "./aliancaMenusBibliotecaLogica"

const S = (id: string) => ({ id, type: "section", name: id })
const I = (id: string) => ({ id, type: "show" })
const ids = (l: { id: string }[] | null) => (l ? l.map((x) => x.id).join(",") : null)

describe("moverItem", () => {
    it("troca com o vizinho e nao mexe na lista original", () => {
        const l = [I("a"), I("b"), I("c")]
        expect(ids(moverItem(l, 1, -1))).toBe("b,a,c")
        expect(ids(moverItem(l, 1, 1))).toBe("a,c,b")
        expect(ids(l)).toBe("a,b,c")
    })
    it("nas pontas e com indice ruim devolve null (nunca engole calado: quem chama avisa)", () => {
        const l = [I("a"), I("b")]
        expect(moverItem(l, 0, -1)).toBeNull()
        expect(moverItem(l, 1, 1)).toBeNull()
        expect(moverItem(l, 5, -1)).toBeNull()
        expect(moverItem(l, -1, 1)).toBeNull()
        expect(moverItem(l, 1.5, 1)).toBeNull()
    })
})

describe("moverBloco", () => {
    const lista = [I("solto"), S("A"), I("a1"), I("a2"), S("B"), I("b1"), S("C")]
    it("o bloco anda com os itens dele e os soltos do comeco ficam", () => {
        expect(ids(moverBloco(lista, 4, -1))).toBe("solto,B,b1,A,a1,a2,C")
        expect(ids(moverBloco(lista, 1, 1))).toBe("solto,B,b1,A,a1,a2,C")
        expect(ids(moverBloco(lista, 4, 1))).toBe("solto,A,a1,a2,S".replace("S", "C") + ",B,b1")
    })
    it("nas pontas, em item que nao e bloco e com bloco duplicado por referencia: null / certo", () => {
        expect(moverBloco(lista, 1, -1)).toBeNull()
        expect(moverBloco(lista, 6, 1)).toBeNull()
        expect(moverBloco(lista, 2, 1)).toBeNull()
    })
})

describe("renomearBloco / blocosDe", () => {
    it("renomeia so a section; vazio, igual e item comum dao null", () => {
        const l = [S("A"), I("a1")]
        expect((renomearBloco(l, 0, "  Louvor ") as any)[0].name).toBe("Louvor")
        expect(renomearBloco(l, 0, "   ")).toBeNull()
        expect(renomearBloco(l, 0, "A")).toBeNull()
        expect(renomearBloco(l, 1, "x")).toBeNull()
        expect((l[0] as any).name).toBe("A")
    })
    it("blocosDe separa os soltos do comeco", () => {
        const r = blocosDe([I("x"), S("A"), I("a1"), S("B")])
        expect(r.lead.map((i) => i.id)).toEqual(["x"])
        expect(r.blocos.map((b) => b.map((i) => i.id))).toEqual([["A", "a1"], ["B"]])
    })
})

describe("semDestino (nada some calado do menu antigo)", () => {
    it("item antigo fora do novo e sem declaracao e acusado; declarado nao; SEPARATOR nunca", () => {
        expect(semDestino(["a", "SEPARATOR", "b", "c"], ["a", "c"], {})).toEqual(["b"])
        expect(semDestino(["a", "b"], ["a"], { b: "foi para X" })).toEqual([])
        expect(semDestino(["a"], ["a", "novo"], {})).toEqual([])
    })
})

describe("criarEngolidor (o gesto repetido no mesmo item em < 400 ms nao dispara 2x)", () => {
    it("engole dentro da janela, deixa passar depois e por chave", () => {
        const e = criarEngolidor(400)
        expect(e("x", 1000)).toBe(false)
        expect(e("x", 1200)).toBe(true)
        expect(e("y", 1200)).toBe(false)
        expect(e("x", 1400)).toBe(false)
    })
})

describe("criarAnteparo (o 2o toque do duplo clique nao atravessa o menu que fechou)", () => {
    const menu = { left: 100, top: 200, right: 300, bottom: 400 }
    it("engole dentro do retangulo e da janela; passa fora do retangulo, antes de armar e depois do prazo", () => {
        const a = criarAnteparo(250)
        expect(a.engole({ x: 150, y: 250 }, 0)).toBe(false)
        a.armar(menu, 1000)
        expect(a.engole({ x: 150, y: 250 }, 1100)).toBe(true)
        expect(a.engole({ x: 99, y: 250 }, 1100)).toBe(false)
        expect(a.engole({ x: 150, y: 401 }, 1100)).toBe(false)
        expect(a.engole({ x: 150, y: 250 }, 1250)).toBe(false)
        expect(a.engole({ x: 150, y: 250 }, 1260)).toBe(false)
    })
    it("armar de novo troca o retangulo e reinicia o prazo", () => {
        const a = criarAnteparo(250)
        a.armar(menu, 0)
        a.armar({ left: 0, top: 0, right: 10, bottom: 10 }, 200)
        expect(a.engole({ x: 150, y: 250 }, 210)).toBe(false)
        expect(a.engole({ x: 5, y: 5 }, 400)).toBe(true)
    })
})
