import { describe, expect, it } from "vitest"
import { destinoDaRevisao, ehRascunhoDoSirvo, opcoesDeCategoria, trocarAvisoPelaMusica } from "./aliancaFichaLogica"

const cats = { song: { name: "category.song", icon: "song" }, louvor: { name: "Louvor", icon: "song" }, sirvo_novas: { name: "Novas do Sirvo", icon: "song" }, apres: { name: "Apresentações", icon: "presentation" } }

describe("ficha da musica", () => {
    it("o rascunho revisado vai para uma categoria de musica, nunca de volta para Novas do Sirvo", () => {
        expect(destinoDaRevisao("louvor", cats)).toBe("louvor")
        expect(destinoDaRevisao("sirvo_novas", cats)).toBe("song")
        expect(destinoDaRevisao(null, cats)).toBe("song")
        expect(destinoDaRevisao(null, { louvor: cats.louvor, sirvo_novas: cats.sirvo_novas })).toBe("louvor")
        expect(destinoDaRevisao("sumiu", {})).toBeNull()
    })
    it("Novas do Sirvo so aparece no seletor enquanto a musica esta nela", () => {
        const t = (k: string) => (k === "category.song" ? "Canções" : k)
        expect(opcoesDeCategoria(cats, "song", t).map((o) => o.id)).toEqual(["apres", "song", "louvor"])
        expect(opcoesDeCategoria(cats, "sirvo_novas", t).map((o) => o.id)).toContain("sirvo_novas")
        expect(ehRascunhoDoSirvo("sirvo_novas")).toBe(true)
        expect(ehRascunhoDoSirvo("song")).toBe(false)
    })
    it("Revisada troca o aviso de rascunho desta musica pela musica, com a mesma marca do Sirvo", () => {
        const rm = "4f83e89f-2600-4a07-bda1-1a03363be0c3"
        const show = "sn_4f83e89f26004a07bda11a03363be0c3"
        const itens = [
            { id: "x", type: "show", data: { sirvoMusica: "a" } },
            { id: "smf_" + rm, type: "section", name: "✎ Rascunho: o dia", data: { sirvoMusica: rm, sirvoFalta: true } },
            { id: "smf_outra", type: "section", name: "✎ Rascunho: outra", data: { sirvoMusica: "outra", sirvoFalta: true } }
        ]
        const nova = trocarAvisoPelaMusica(itens, show)!
        expect(nova[1]).toEqual({ id: show, type: "show", data: { sirvoMusica: rm } })
        expect(nova[0]).toBe(itens[0])
        expect(nova[2]).toBe(itens[2])
        expect(trocarAvisoPelaMusica(itens, "sn_nada")).toBeNull()
    })
})
