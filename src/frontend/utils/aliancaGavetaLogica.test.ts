import { describe, expect, it } from "vitest"
import { alternar, avisoDoQueFicou, cargaDoArrasto, chaveDaBiblia, chaveDe, chaveUnica, contagem, estaMarcado, fotos, garantir, MAX_MARCADOS, paraItensDoProjeto, porTipo, posicaoDeEntradaNoCulto, remover, tipoDoArquivo, type Marcado } from "./aliancaGavetaLogica"

const foto = (path: string): Marcado => ({ tipo: "media", chave: path, dado: { name: path.split("/").pop(), path, type: "image", contentProvider: false } })
const video = (path: string): Marcado => ({ tipo: "media", chave: path, dado: { name: path.split("/").pop(), path, type: "video" } })
const audio = (path: string): Marcado => ({ tipo: "audio", chave: path, dado: { path, name: path.split("/").pop() } })
const show = (id: string): Marcado => ({ tipo: "show", chave: id, dado: { id } })

describe("chave e tipo", () => {
    it("o tipo vem da extensão, e o mesmo caminho em tipos diferentes não colide", () => {
        expect(tipoDoArquivo("audio")).toBe("audio")
        expect(tipoDoArquivo("image")).toBe("media")
        expect(tipoDoArquivo("video")).toBe("media")
        expect(tipoDoArquivo("pdf")).toBe("media")
        expect(tipoDoArquivo("ppt")).toBeNull()
        expect(chaveDe(audio("a.mp3"))).not.toBe(chaveDe({ tipo: "media", chave: "a.mp3" }))
        expect(chaveUnica("show", "x")).toBe("show:x")
    })
    it("a chave da Bíblia leva aba, livro, capítulos e versos (com subverso)", () => {
        expect(chaveDaBiblia("ARA", "JHN", [3], [[16, 17]])).toBe("ARA|JHN|3|16,17")
        expect(chaveDaBiblia("ARA", "JHN", [3], [["16_2"]])).toBe("ARA|JHN|3|16_2")
        expect(chaveDaBiblia("ARA", "JHN", [3], [[16]])).not.toBe(chaveDaBiblia("NVI", "JHN", [3], [[16]]))
    })
})

describe("alternar e garantir", () => {
    it("alternar marca e desmarca", () => {
        const r1 = alternar([], foto("a.jpg"))
        expect(r1.efeito).toBe("marcou")
        expect(r1.lista).toHaveLength(1)
        const r2 = alternar(r1.lista, foto("a.jpg"))
        expect(r2.efeito).toBe("desmarcou")
        expect(r2.lista).toHaveLength(0)
    })
    it("garantir é idempotente: nunca duplica nem desmarca (duplo clique)", () => {
        let l: Marcado[] = []
        l = garantir(l, show("s1")).lista
        const r = garantir(l, show("s1"))
        expect(r.efeito).toBe("ja")
        expect(r.lista).toBe(l)
        expect(l).toHaveLength(1)
    })
    it("clique + clique + duplo clique termina marcado", () => {
        let l: Marcado[] = []
        l = alternar(l, foto("a.jpg")).lista // marca
        l = garantir(l, foto("a.jpg")).lista // dblclick
        expect(estaMarcado(l, "media", "a.jpg")).toBe(true)
    })
    it("limite de 100", () => {
        let l: Marcado[] = []
        for (let i = 0; i < MAX_MARCADOS; i++) l = alternar(l, foto("f" + i + ".jpg")).lista
        expect(l).toHaveLength(MAX_MARCADOS)
        expect(alternar(l, foto("extra.jpg")).efeito).toBe("cheio")
        expect(garantir(l, foto("extra.jpg")).efeito).toBe("cheio")
        // desmarcar ainda funciona cheio
        expect(alternar(l, foto("f0.jpg")).efeito).toBe("desmarcou")
    })
    it("o mesmo caminho como mídia e como áudio são marcações diferentes", () => {
        let l: Marcado[] = []
        l = garantir(l, { tipo: "media", chave: "x.mp3", dado: { path: "x.mp3", type: "video" } }).lista
        l = garantir(l, audio("x.mp3")).lista
        expect(l).toHaveLength(2)
    })
})

describe("filtros e contagem", () => {
    const l = [foto("a.jpg"), video("v.mp4"), audio("m.mp3"), show("s1"), foto("b.jpg")]
    it("fotos só pega imagem", () => {
        expect(fotos(l).map((m) => m.chave)).toEqual(["a.jpg", "b.jpg"])
    })
    it("porTipo e contagem", () => {
        expect(porTipo(l, "media")).toHaveLength(3)
        expect(contagem(l)).toEqual({ total: 5, fotos: 2, midias: 3, audios: 1, shows: 1, biblia: 0 })
    })
    it("remover pela chave única", () => {
        expect(remover(l, [chaveDe(foto("a.jpg")), chaveDe(show("s1"))]).map((m) => m.chave)).toEqual(["v.mp4", "m.mp3", "b.jpg"])
    })
})

describe("paraItensDoProjeto (mesmo formato do drop)", () => {
    it("mídia, áudio e show", () => {
        const itens = paraItensDoProjeto([foto("pasta/a.jpg"), audio("pasta/m.mp3"), show("s1")], (n) => n.replace(/\.[^.]+$/, ""))
        expect(itens).toEqual([
            { id: "pasta/a.jpg", name: "a", type: "image" },
            { id: "pasta/m.mp3", name: "m", type: "audio" },
            { id: "s1", type: "show" }
        ])
    })
    it("a Bíblia não entra (vira show antes)", () => {
        expect(paraItensDoProjeto([{ tipo: "scripture", chave: "x", dado: [] }])).toEqual([])
    })
})

describe("arrasto", () => {
    const l = [foto("a.jpg"), foto("b.jpg"), foto("c.jpg"), audio("m.mp3"), audio("n.mp3")]
    it("o arrastado marcado leva todos do mesmo tipo", () => {
        const r = cargaDoArrasto(l, { tipo: "media", chave: "b.jpg" })!
        expect(r.carga.map((m) => m.chave)).toEqual(["a.jpg", "b.jpg", "c.jpg"])
        expect(r.ficam.map((m) => m.chave)).toEqual(["m.mp3", "n.mp3"])
        expect(avisoDoQueFicou(r.carga, r.ficam)).toBe("só 3 foram; 2 áudios continuam marcados")
    })
    it("arrastado não marcado: não muda nada (null)", () => {
        expect(cargaDoArrasto(l, { tipo: "media", chave: "z.jpg" })).toBeNull()
    })
    it("sem sobra, sem aviso", () => {
        expect(avisoDoQueFicou(l, [])).toBe("")
    })
})

describe("posição de entrada no culto", () => {
    it("depois do último selecionado", () => {
        expect(posicaoDeEntradaNoCulto("depois", 10, 2, 9)).toBe(3)
    })
    it("sem referência ou referência velha: no fim (antes do rodapé)", () => {
        expect(posicaoDeEntradaNoCulto("depois", 10, null, 9)).toBe(9)
        expect(posicaoDeEntradaNoCulto("depois", 10, 40, 9)).toBe(9)
        expect(posicaoDeEntradaNoCulto("fim", 10, 2, 9)).toBe(9)
    })
})
