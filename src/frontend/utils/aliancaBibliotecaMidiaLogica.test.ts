import { describe, expect, it } from "vitest"
import { BIB, caminhosDaRaiz, categoriaDe, destinoDaPasta, NOME_BACKGROUNDS, pastaJaMigrada, planejarPasta, tagsAoImportar, tagsAoTirar } from "./aliancaBibliotecaMidiaLogica"

const PASTA = { name: "Aberturas", color: "", aliancaPasta: { fim: "parar", camada: "frente" } }

describe("biblioteca de mídia (cabine-5)", () => {
    it("raiz = na biblioteca e sem categoria", () => {
        const tags = { p1: PASTA, comum: { name: "x" } }
        const media = { a: { tags: [BIB] }, b: { tags: [BIB, "p1"] }, c: { tags: ["comum"] }, d: { tags: [BIB, "comum"] } }
        expect(caminhosDaRaiz(media, tags).sort()).toEqual(["a", "d"])
        expect(categoriaDe(["comum", "p1"], tags)).toBe("p1")
    })

    it("importar: entra a BIB e a categoria pedida, a categoria velha sai, as comuns ficam", () => {
        const tags = { p1: PASTA, p2: PASTA, comum: { name: "x" } }
        expect(tagsAoImportar(["comum", "p1"], tags, "p2")).toEqual(["comum", "p2", BIB])
        expect(tagsAoImportar(undefined, tags, null)).toEqual([BIB])
    })

    it("tirar: sai a BIB e a categoria, ficam as comuns", () => {
        expect(tagsAoTirar([BIB, "p1", "comum"], { p1: PASTA, comum: { name: "x" } })).toEqual(["comum"])
    })

    it("destino das pastas do disco (decisão do André, 19/nov)", () => {
        expect(destinoDaPasta({ id: "1", name: "Fundos" })).toEqual({ nome: NOME_BACKGROUNDS, comportamento: { fim: "repetir", camada: "fundo" } })
        expect(destinoDaPasta({ id: "2", name: "Fundos OneDrive" }).nome).toBe(NOME_BACKGROUNDS)
        expect(destinoDaPasta({ id: "3", name: "Institucional e logos", mediaType: "background" })).toEqual({ nome: "Institucional e logos", comportamento: { fim: "repetir", camada: "fundo" } })
        expect(destinoDaPasta({ id: "4", name: "Aberturas e contadores" })).toEqual({ nome: "Aberturas e contadores", comportamento: { fim: "parar", camada: "frente" } })
        expect(destinoDaPasta({ id: "5", name: "category.pictures", mediaType: "background" }).nome).toBe("Imagens")
    })

    it("plano: duas pastas de fundos caem na MESMA categoria Backgrounds; só vídeo/imagem entra", () => {
        let n = 0
        const novo = () => "c" + ++n
        const estado = { media: {}, mediaTags: {} }
        let plano = planejarPasta({ id: "f1", name: "Fundos" }, ["C:/a/1.mp4", "C:/a/sub/2.jpg", "C:/a/3.mp3"], estado, novo)
        plano = planejarPasta({ id: "f2", name: "Fundos OneDrive" }, ["C:/b/4.mov"], estado, novo, plano)
        expect(Object.keys(plano.mediaTags)).toEqual(["c1"])
        expect(plano.mediaTags.c1.aliancaDeDisco).toEqual(["f1", "f2"])
        expect(Object.keys(plano.midia).sort()).toEqual(["C:/a/1.mp4", "C:/a/sub/2.jpg", "C:/b/4.mov"])
        expect(plano.midia["C:/b/4.mov"]).toEqual(["c1", BIB])
        expect(pastaJaMigrada(plano.mediaTags, "f2")).toBe(true)
    })

    it("plano: mídia que já tem categoria não muda de categoria; pasta vazia não cria categoria", () => {
        const estado = { media: { "C:/x.mp4": { tags: ["p1"] } }, mediaTags: { p1: PASTA } }
        const plano = planejarPasta({ id: "f1", name: "Eventos" }, ["C:/x.mp4", "C:/y.mp4"], estado, () => "novo")
        expect(plano.midia["C:/x.mp4"]).toEqual(["p1", BIB])
        expect(plano.midia["C:/y.mp4"]).toEqual(["novo", BIB])
        // ja na biblioteca (importada na raiz antes da migracao): fica onde o André pos
        const ja = planejarPasta({ id: "f3", name: "Eventos" }, ["C:/z.mp4"], { media: { "C:/z.mp4": { tags: [BIB] } }, mediaTags: {} }, () => "novo")
        expect(ja.midia).toEqual({})
        // o mesmo arquivo com "/" no media e "\" vindo do disco: usa a chave que ja existe (nao duplica)
        const barra = planejarPasta({ id: "f2", name: "Eventos" }, ["C:\\x.mp4"], estado, () => "novo")
        expect(Object.keys(barra.midia)).toEqual(["C:/x.mp4"])
        const vazio = planejarPasta({ id: "v", name: "category.videos" }, [], { media: {}, mediaTags: {} }, () => "z")
        expect(vazio.mediaTags).toEqual({})
    })
})
