import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { durante, desfazendoAgora, indiceAposRepor, indiceAposTirar, limitar, MAX_RASTROS, novosRastros, podar, posicaoDoRastro, posicaoNoBloco, semDormindoRepetido, sinteticosDoSirvo, type Tirado } from "./aliancaTiradosLogica"

const show = (id: string, marca?: string): ProjectShowRef => ({ id, type: "show", ...(marca ? { data: { sirvoMusica: marca } } : {}) })
const secao = (id: string): ProjectShowRef => ({ id, type: "section", name: id })
let n = 0
const nasce = (itens: ProjectShowRef[], indexes: number[], noAr = false) => novosRastros("p1", itens, indexes, { agora: 1000, chaves: () => `c${++n}`, noAr: () => noAr })
const armar = (r: Tirado): Tirado => ({ ...r, armado: true })

describe("novosRastros", () => {
    it("guarda o vizinho vivo anterior e a posicao", () => {
        const itens = [show("a"), show("b"), show("c")]
        const [r] = nasce(itens, [1])
        expect(r.depoisDe).toEqual({ id: "a", type: "show", ocorrencia: 1 })
        expect(r.indice).toBe(1)
        expect(r.contagemAntes).toBe(1)
        expect(r.item.id).toBe("b")
    })
    it("o primeiro item nao tem vizinho", () => {
        const [r] = nasce([show("a"), show("b")], [0])
        expect(r.depoisDe).toBeNull()
        expect(posicaoDoRastro([show("b")], r)).toBe(0)
    })
    it("tirar varios de uma vez: cada um aponta pro vizinho vivo, pulando os que sairam junto", () => {
        const itens = [show("a"), show("b"), show("c"), show("d")]
        const rs = nasce(itens, [1, 2])
        expect(rs.map((r) => r.depoisDe?.id)).toEqual(["a", "a"])
        const vivos = [itens[0], itens[3]]
        expect(rs.map((r) => posicaoDoRastro(vivos, r))).toEqual([1, 1])
    })
    it("tira o index/played que o FreeShow escreve no objeto da lista", () => {
        const item: any = { ...show("a"), index: 4, played: true }
        const [r] = nasce([item], [0])
        expect((r.item as any).index).toBeUndefined()
        expect(r.item.played).toBeUndefined()
    })
    it("guarda a marca do Sirvo e se estava no ar", () => {
        const [r] = nasce([show("a", "r1")], [0], true)
        expect(r.rmId).toBe("r1")
        expect(r.noAr).toBe(true)
    })
})

describe("show repetido (F9)", () => {
    const itens = [show("a"), show("x"), show("a"), show("b")]
    it("a enesima ocorrencia do vizinho", () => {
        const [r] = nasce(itens, [3])
        // vizinho vivo anterior: o 2o "a"
        expect(r.depoisDe).toEqual({ id: "a", type: "show", ocorrencia: 2 })
        expect(posicaoDoRastro(itens.slice(0, 3), r)).toBe(3)
    })
    it("contagem: tirar um de dois so some do rastro quando voltam a ser dois", () => {
        const dois = [show("a"), show("b"), show("a")]
        const [r] = nasce(dois, [2])
        expect(r.contagemAntes).toBe(2)
        let [x] = podar([r], [show("a"), show("b")], false).lista
        expect(x.armado).toBe(true)
        expect(x.dormindo).toBe(false)
        // outro "a" colado: continua 2 de 2? nao: voltou a ter 2
        x = podar([x], [show("a"), show("b"), show("a")], false).lista[0]
        expect(x.dormindo).toBe(true)
    })
    it("os dois iguais saem juntos: o ultimo esconde primeiro", () => {
        const dois = [show("a"), show("a"), show("b")]
        const rs = nasce(dois, [0, 1])
        expect(rs.map((r) => r.contagemAntes)).toEqual([2, 1])
        const armados = podar(rs, [show("b")], false).lista
        // um "a" volta
        const depois = podar(armados, [show("a"), show("b")], false).lista
        expect(depois.map((r) => r.dormindo)).toEqual([false, true])
    })
    it("posicao: sem o vizinho cai no indice, limitado ao tamanho", () => {
        const r: any = { depoisDe: { id: "z", type: "show", ocorrencia: 1 }, indice: 9 }
        expect(posicaoDoRastro([show("a")], r)).toBe(1)
    })
})

describe("podar", () => {
    const itens = [show("a"), show("b"), show("c")]
    it("antes de armar, a lista com o item nao conta como volta (o rastro nasce antes da escrita)", () => {
        const [r] = nasce(itens, [1])
        const p = podar([r], itens, false)
        expect(p.lista[0].dormindo).toBe(false)
        expect(p.lista[0].armado).toBe(false)
    })
    it("volta (Ctrl+Z, colar, Desfazer): dorme; sai de novo por undo: acorda", () => {
        let [r] = nasce(itens, [1])
        r = podar([r], [itens[0], itens[2]], false).lista[0]
        expect(r.armado).toBe(true)
        r = podar([r], itens, false).lista[0]
        expect(r.dormindo).toBe(true)
        r = podar([r], [itens[0], itens[2]], true).lista[0]
        expect(r.dormindo).toBe(false)
    })
    it("dormindo e o item sai por outro caminho (nao undo): o rastro e descartado", () => {
        const r = { ...armar(nasce(itens, [1])[0]), dormindo: true }
        const p = podar([r], [itens[0], itens[2]], false)
        expect(p.lista).toEqual([])
        expect(p.mudou).toBe(true)
    })
    it("com marca do Sirvo: so a marca no projeto conta", () => {
        const com = [show("m1", "r1"), show("m2", "r2")]
        let [r] = nasce(com, [0])
        r = podar([r], [com[1]], false).lista[0]
        expect(r.armado).toBe(true)
        // outro show qualquer com o mesmo id mas sem marca nao basta
        expect(podar([r], [show("m1"), com[1]], false).lista[0].dormindo).toBe(false)
        expect(podar([r], [show("m1", "r1"), com[1]], false).lista[0].dormindo).toBe(true)
    })
    it("projeto apagado: o rastro cai", () => {
        const r = armar(nasce(itens, [1])[0])
        expect(podar([r], null, false)).toEqual({ lista: [], mudou: true })
    })
    it("devolve a MESMA lista quando nada muda", () => {
        const r = armar(nasce(itens, [1])[0])
        const lista = [r]
        expect(podar(lista, [itens[0], itens[2]], false).lista).toBe(lista)
    })
})

describe("registrar de novo e limite", () => {
    it("tirar de novo apaga o rastro dormindo do mesmo item (rmId ou id+type)", () => {
        const dorme = { ...armar(nasce([show("a"), show("b")], [1])[0]), dormindo: true }
        const [novo] = nasce([show("a"), show("b")], [1])
        expect(semDormindoRepetido([dorme], [novo])).toEqual([])
        const [outro] = nasce([show("a"), show("c")], [1])
        expect(semDormindoRepetido([dorme], [outro])).toEqual([dorme])
    })
    it("passou do limite: sai primeiro o dormindo mais velho, nunca o visivel", () => {
        const base = (em: number, dormindo: boolean) => ({ ...armar(nasce([show("a")], [0])[0]), em, dormindo })
        const lista = [base(1, true), ...Array.from({ length: MAX_RASTROS }, (_, i) => base(10 + i, false))]
        const l = limitar(lista)
        expect(l).toHaveLength(MAX_RASTROS)
        expect(l.every((r) => !r.dormindo)).toBe(true)
        // so visiveis: o limite nao descarta (ate o limite duro)
        expect(limitar([...l, base(99, false)])).toHaveLength(MAX_RASTROS + 1)
    })
})

describe("flag do Ctrl+Z", () => {
    it("liga so durante e volta ao que era, mesmo com erro", () => {
        expect(desfazendoAgora()).toBe(false)
        expect(durante(() => desfazendoAgora())).toBe(true)
        expect(() =>
            durante(() => {
                throw new Error("x")
            })
        ).toThrow()
        expect(desfazendoAgora()).toBe(false)
    })
})

describe("ponteiros por posicao (F5)", () => {
    it("tirar acima do que esta no ar: desce 1; abaixo: igual", () => {
        expect(indiceAposTirar(5, [2])).toBe(4)
        expect(indiceAposTirar(5, [7])).toBe(5)
        expect(indiceAposTirar(5, [1, 2, 8])).toBe(3)
    })
    it("tirar o proprio item no ar: a posicao fica (aponta pro que ocupou o lugar)", () => {
        expect(indiceAposTirar(3, [3])).toBe(3)
    })
    it("repor acima ou na mesma posicao: sobe 1", () => {
        expect(indiceAposRepor(3, 1)).toBe(4)
        expect(indiceAposRepor(3, 3)).toBe(4)
        expect(indiceAposRepor(3, 4)).toBe(3)
    })
})

describe("rastro que vem do Sirvo (depois de reabrir)", () => {
    const lista = [secao("sirvo_louvor"), show("m1", "r1"), secao("sirvo_palavra"), show("m4", "r4"), secao("sirvo_fim")]
    const bloco = (blocoId: string) => blocoId === "louvor" || blocoId === "palavra"
    const d = (rmId: string, blocoId: string, envio: string) => ({ rmId, blocoId, nome: `n_${rmId}`, envio })
    it("fica no fim da familia do bloco", () => {
        expect(posicaoNoBloco(lista, "louvor")).toBe(2)
        expect(posicaoNoBloco(lista, "palavra")).toBe(4)
    })
    it("bloco ausente: antes do rodapé; sem rodapé: no fim", () => {
        expect(posicaoNoBloco(lista, "sumiu")).toBe(4)
        expect(posicaoNoBloco(lista.slice(0, 4), null)).toBe(4)
    })
    it("so as dispensas que ainda nao foram ao Sirvo (ou ja foram: sem botao); devolver nao tem rastro", () => {
        const s = sinteticosDoSirvo([d("r2", "louvor", "aguardando"), d("r3", "louvor", "fila"), d("r5", "palavra", "local"), d("r6", "palavra", "enviada"), d("r7", "palavra", "devolver"), d("r8", "palavra", "confirmar")], lista, new Set(), bloco)
        expect(s.map((x) => [x.rmId, x.semBotao])).toEqual([
            ["r2", false],
            ["r3", false],
            ["r5", false],
            ["r6", true],
            ["r8", false]
        ])
        expect(s[0].pos).toBe(2)
        expect(s[2].pos).toBe(4)
    })
    it("marca que esta no projeto ou ja tem rastro da sessao nao duplica", () => {
        const s = sinteticosDoSirvo([d("r1", "louvor", "aguardando"), d("r2", "louvor", "aguardando")], lista, new Set(["r2"]), bloco)
        expect(s).toEqual([])
    })
    it("roteiro nao carregado (null): vai antes do rodapé", () => {
        const s = sinteticosDoSirvo([d("r2", "louvor", "aguardando")], lista, new Set(), () => null)
        expect(s[0].pos).toBe(4)
    })
})
