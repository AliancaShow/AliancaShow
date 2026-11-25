import { describe, expect, it } from "vitest"
import { CAMPOS_DO_AJUSTE, abaDaPasta, ajusteDaPasta, audioRepete, aplicarEstado, camadaNaHora, capturar, etiquetasComuns, idDaAba, listarPastas, membrosPorPasta, moverTags, pastaDaMidia, resolverFim, tagsSemPasta, type TagsDeMidia } from "./aliancaPastasMidiaLogica"

const mediaTags: TagsDeMidia = {
    c1: { name: "Comum", color: "#fff" },
    p1: { name: "Lentos", color: "#000", aliancaPasta: { fim: "repetir", camada: "fundo" } },
    p2: { name: "Vinhetas", color: "#000", aliancaPasta: { fim: "parar", camada: "frente" } }
}

describe("pastas são etiquetas", () => {
    it("acha a pasta da mídia (a primeira, se houver duas) e ignora etiqueta comum", () => {
        expect(pastaDaMidia(["c1", "p2", "p1"], mediaTags)).toBe("p2")
        expect(pastaDaMidia(["c1"], mediaTags)).toBeNull()
        expect(pastaDaMidia(undefined, mediaTags)).toBeNull()
        expect(pastaDaMidia(["sumiu"], mediaTags)).toBeNull()
    })
    it("mover troca só a etiqueta-pasta e limpa a sobra", () => {
        expect(moverTags(["c1", "p1", "p2"], mediaTags, "p2")).toEqual(["c1", "p2"])
        expect(moverTags(["c1", "p1"], mediaTags, null)).toEqual(["c1"])
        expect(moverTags(undefined, mediaTags, "p1")).toEqual(["p1"])
    })
    it("etiquetas comuns e selo escondem as pastas; a lista de pastas sai por nome", () => {
        expect(Object.keys(etiquetasComuns(mediaTags))).toEqual(["c1"])
        expect(tagsSemPasta(["c1", "p1"], mediaTags)).toEqual(["c1"])
        expect(listarPastas(mediaTags).map((p) => p.id)).toEqual(["p1", "p2"])
    })
    it("agrupa as mídias por pasta", () => {
        const m = { A: { tags: ["p1"] }, B: { tags: ["c1", "p2"] }, C: { tags: ["c1"] }, D: {} }
        expect(membrosPorPasta(m, mediaTags)).toEqual({ p1: ["A"], p2: ["B"] })
    })
    it("ids de aba", () => {
        expect(abaDaPasta("p1")).toBe("pasta:p1")
        expect(idDaAba("pasta:p1")).toBe("p1")
        expect(idDaAba("pasta:raiz")).toBeNull()
        expect(idDaAba("pasta:sirvo")).toBeNull()
        expect(idDaAba("all")).toBeNull()
    })
})

describe("camada na hora de tocar", () => {
    it("o objeto que vem de getMediaStyle (videoType vazio, sem tags) não esconde a pasta: quem lê é o store", () => {
        const doStore = { tags: ["p2"] }
        expect(camadaNaHora(doStore, mediaTags)).toBe("foreground")
        expect(camadaNaHora({ tags: ["p1"] }, mediaTags)).toBe("background")
    })
    it("o ajuste próprio vence a pasta; sem pasta nem ajuste, null (vale o disco)", () => {
        expect(camadaNaHora({ tags: ["p2"], videoType: "background" }, mediaTags)).toBe("background")
        expect(camadaNaHora({ tags: ["p1"], videoType: "" }, mediaTags)).toBe("background")
        expect(camadaNaHora({}, mediaTags)).toBeNull()
        expect(camadaNaHora(undefined, mediaTags)).toBeNull()
    })
})

describe("fim do vídeo: precedência completa", () => {
    const naPastaRepetir = { tags: ["p1"] }
    const naPastaParar = { tags: ["p2"] }

    it("1. ajuste próprio vence tudo (aliancaFim e o loop antigo do FreeShow)", () => {
        const r = resolverFim({ midia: { tags: ["p1"], aliancaFim: "parar" }, mediaTags, loopDoItem: true, loopPedido: true })
        expect(r).toEqual({ loop: false, origem: "proprio", podeCongelar: true })
        const r2 = resolverFim({ midia: { tags: ["p2"], loop: true }, mediaTags, loopDoItem: false })
        expect(r2.loop).toBe(true)
        expect(r2.origem).toBe("proprio")
        expect(resolverFim({ midia: { aliancaFim: "repetir" }, mediaTags }).loop).toBe(true)
    })
    it("2. o item do culto vence a pasta", () => {
        expect(resolverFim({ midia: naPastaRepetir, mediaTags, loopDoItem: false })).toMatchObject({ loop: false, origem: "item" })
        expect(resolverFim({ midia: naPastaParar, mediaTags, loopDoItem: true })).toMatchObject({ loop: true, origem: "item" })
    })
    it("3. sem item, a pasta vence o que quem chamou pediu (o drop do slide copia loop:true)", () => {
        expect(resolverFim({ midia: naPastaParar, mediaTags, loopPedido: true })).toEqual({ loop: false, origem: "pasta", podeCongelar: true })
        expect(resolverFim({ midia: naPastaRepetir, mediaTags, loopPedido: false })).toMatchObject({ loop: true, origem: "pasta" })
    })
    it("4. sem pasta, vale o pedido; sem nada, o padrão de hoje (undefined) e nunca congela", () => {
        expect(resolverFim({ midia: {}, mediaTags, loopPedido: true })).toEqual({ loop: true, origem: "pedido", podeCongelar: false })
        expect(resolverFim({ midia: undefined, mediaTags })).toEqual({ loop: undefined, origem: "hoje", podeCongelar: false })
    })
    it("semPasta pula só o passo da pasta (porta que não segue pasta)", () => {
        expect(resolverFim({ midia: naPastaParar, mediaTags, loopPedido: true, semPasta: true })).toEqual({ loop: true, origem: "pedido", podeCongelar: false })
        expect(resolverFim({ midia: { tags: ["p2"], aliancaFim: "repetir" }, mediaTags, semPasta: true }).loop).toBe(true)
    })
    it("quem não usa pasta não muda: loop:false antigo continua sumindo (não congela)", () => {
        expect(resolverFim({ midia: { loop: false }, mediaTags })).toEqual({ loop: false, origem: "proprio", podeCongelar: false })
    })
    it("podeCongelar vale para mídia de pasta mesmo se o item desliga o repetir à mão", () => {
        expect(resolverFim({ midia: naPastaRepetir, mediaTags, loopDoItem: false }).podeCongelar).toBe(true)
    })
})

describe("áudio", () => {
    it("padrão em pasta: não repete; só repete se a pasta liga repetirAudio; o loop próprio vence", () => {
        expect(audioRepete({ tags: ["p1"] }, mediaTags)).toBeUndefined()
        const comAudio = { ...mediaTags, p1: { ...mediaTags.p1, aliancaPasta: { fim: "repetir", camada: "fundo", repetirAudio: true } } } as TagsDeMidia
        expect(audioRepete({ tags: ["p1"] }, comAudio)).toBe(true)
        expect(audioRepete({ tags: ["p1"], loop: false }, comAudio)).toBe(false)
        expect(audioRepete({}, comAudio)).toBeUndefined()
    })
})

describe("estado do histórico", () => {
    const alvo = () => ({ mediaTags: JSON.parse(JSON.stringify(mediaTags)) as TagsDeMidia, media: { A: { tags: ["p1"], aliancaFim: "parar", info: { codec: "x" } }, B: { tags: ["c1"] } } as any })

    it("captura só os 5 campos (o `fit` entrou em 25/nov, aprovo ajuste-pasta), nunca o objeto inteiro", () => {
        const e = capturar(alvo(), ["p1", "novo"], ["A", "Z"])
        expect(e.mediaTags).toEqual({ p1: mediaTags.p1, novo: null })
        expect(e.midia!.A).toEqual({ tags: ["p1"], aliancaFim: "parar", videoType: null, loop: null, fit: null })
        expect(e.midia!.Z).toEqual({ tags: null, aliancaFim: null, videoType: null, loop: null, fit: null })
    })
    it("aplicar e desfazer devolvem tudo, e o `info` que chegou no meio sobrevive", () => {
        const a = alvo()
        const antes = capturar(a, ["p1"], ["A", "B"])
        const depois = { mediaTags: { p1: null }, midia: { A: { tags: null, aliancaFim: null }, B: { tags: ["c1"] } } }
        aplicarEstado(depois as any, a)
        expect(a.mediaTags.p1).toBeUndefined()
        expect(a.media.A.tags).toBeUndefined()
        expect(a.media.A.aliancaFim).toBeUndefined()
        expect(a.media.A.info).toEqual({ codec: "x" })
        a.media.A.creationTime = 99 // chegou em segundo plano
        aplicarEstado(antes, a)
        expect(a.mediaTags.p1).toEqual(mediaTags.p1)
        expect(a.media.A.tags).toEqual(["p1"])
        expect(a.media.A.aliancaFim).toBe("parar")
        expect(a.media.A.creationTime).toBe(99)
        expect(a.media.A.info).toEqual({ codec: "x" })
    })
})

describe("ajuste na tela pela pasta (André 25/nov, aprovo ajuste-pasta)", () => {
    const tags: any = { bg: { name: "Backgrounds", color: "", aliancaPasta: { fim: "repetir", camada: "fundo", ajuste: "cover" } }, ev: { name: "Eventos", color: "", aliancaPasta: { fim: "parar", camada: "frente" } }, comum: { name: "x", color: "" } }
    it("a pasta que pede um ajuste o devolve", () => {
        expect(ajusteDaPasta({ tags: ["comum", "bg"] }, tags)).toBe("cover")
    })
    it("pasta sem ajuste, midia sem pasta ou valor estranho: null (vale a Tela)", () => {
        expect(ajusteDaPasta({ tags: ["ev"] }, tags)).toBeNull()
        expect(ajusteDaPasta({ tags: ["comum"] }, tags)).toBeNull()
        expect(ajusteDaPasta(undefined, tags)).toBeNull()
        expect(ajusteDaPasta({ tags: ["x"] }, { x: { name: "x", color: "", aliancaPasta: { fim: "parar", camada: "fundo", ajuste: "zoom" } } } as any)).toBeNull()
    })
    it("o ajuste proprio entra no desfazer (CAMPOS_DO_AJUSTE)", () => {
        expect(CAMPOS_DO_AJUSTE).toContain("fit")
    })
})
