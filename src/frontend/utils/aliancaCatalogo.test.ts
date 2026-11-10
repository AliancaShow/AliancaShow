import { describe, expect, it } from "vitest"
import { hashDoCatalogo, itensParaSirvo, lerRespostaDoCatalogo, musicasDaBiblioteca } from "./aliancaCatalogo"

const categorias = { musicas: { name: "Músicas", icon: "song" }, impulso: { name: "Impulso", icon: "song" }, avisos: { name: "Avisos", icon: "info" } }
const shows = {
    b2: { name: "Toda Terra", category: "musicas", timestamps: { modified: 1731200000000 } },
    a1: { name: "Oceanos", category: "impulso", timestamps: { modified: null } },
    c3: { name: "Aviso de domingo", category: "avisos" },
    d4: { name: "Música privada", category: "musicas", private: true },
    e5: { name: "", category: "musicas" },
    f6: { name: "Sem categoria", category: null }
}

describe("catálogo de músicas", () => {
    it("só músicas (ícone song), não privadas, com nome, em ordem de id", () => {
        const lista = musicasDaBiblioteca(shows, categorias)
        expect(lista.map((m) => m.id)).toEqual(["a1", "b2"])
        expect(lista[0]).toEqual({ id: "a1", nome: "Oceanos", categoria: "Impulso", modificado: null })
        expect(lista[1].modificado).toBe(1731200000000)
    })

    it("o formato do Sirvo usa show_id e modificado_em", () => {
        expect(itensParaSirvo(musicasDaBiblioteca(shows, categorias))[1]).toEqual({ show_id: "b2", nome: "Toda Terra", categoria: "Músicas", modificado_em: 1731200000000 })
    })

    it("hash estável na ordem e sensível a nome e data", () => {
        const a = itensParaSirvo(musicasDaBiblioteca(shows, categorias))
        const b = itensParaSirvo(musicasDaBiblioteca({ a1: shows.a1, b2: shows.b2 }, categorias))
        expect(hashDoCatalogo(a)).toBe(hashDoCatalogo(b))
        const renomeado = itensParaSirvo(musicasDaBiblioteca({ ...shows, a1: { ...shows.a1, name: "Oceanos (Hillsong)" } }, categorias))
        expect(hashDoCatalogo(renomeado)).not.toBe(hashDoCatalogo(a))
        const editado = itensParaSirvo(musicasDaBiblioteca({ ...shows, b2: { ...shows.b2, timestamps: { modified: 1731200000001 } } }, categorias))
        expect(hashDoCatalogo(editado)).not.toBe(hashDoCatalogo(a))
        expect(hashDoCatalogo(a).length).toBeLessThanOrEqual(128)
    })

    it("F3: rascunho fica fora; aprovado e 'é esta?' levam sirvo_musicas, e o hash muda", () => {
        const rm = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0"
        const sn = "sn_0f1e2d3c4b5a69788796a5b4c3d2e1f0"
        const cats = { ...categorias, sirvo_novas: { name: "Novas do Sirvo", icon: "song" } }
        expect(musicasDaBiblioteca({ ...shows, [sn]: { name: "Canção Nova", category: "sirvo_novas" } }, cats).map((m) => m.id)).toEqual(["a1", "b2"])
        const aprovado = itensParaSirvo(musicasDaBiblioteca({ ...shows, [sn]: { name: "Canção Nova", category: "musicas" } }, cats))
        expect(aprovado.find((i) => i.show_id === sn)?.sirvo_musicas).toEqual([rm])
        const sem = itensParaSirvo(musicasDaBiblioteca(shows, categorias))
        const ligado = itensParaSirvo(musicasDaBiblioteca(shows, categorias), { "r-2": "a1", "r-1": "a1" })
        expect(ligado[0].sirvo_musicas).toEqual(["r-1", "r-2"])
        expect(ligado[1].sirvo_musicas).toBeUndefined()
        expect(hashDoCatalogo(ligado)).not.toBe(hashDoCatalogo(sem))
    })

    it("lê cada resposta do Sirvo", () => {
        expect(lerRespostaDoCatalogo({ ok: true, dados: { ok: true, igual: true } })).toEqual({ acao: "em_dia" })
        expect(lerRespostaDoCatalogo({ ok: true, dados: { ok: true, desatualizado: true } })).toEqual({ acao: "mandar_lista" })
        expect(lerRespostaDoCatalogo({ ok: true, dados: { ok: false, tente_em: 42 } })).toEqual({ acao: "reagendar", ms: 42_000 })
        expect(lerRespostaDoCatalogo({ ok: true, dados: { ok: false, motivo: "removeria_mais_da_metade", vivas: 10, removeria: 7 } })).toEqual({ acao: "recusado_metade", vivas: 10, removeria: 7 })
        expect(lerRespostaDoCatalogo({ ok: true, dados: { ok: true, recebidas: 3, aceitas: 2, novas: 1, removidas: 0, rejeitadas: [{ show_id: "x", motivo: "sem nome" }] } })).toEqual({
            acao: "publicado",
            novas: 1,
            removidas: 0,
            rejeitadas: [{ show_id: "x", motivo: "sem nome" }]
        })
        expect(lerRespostaDoCatalogo({ ok: false, codigo: "nao_publica", mensagem: "" })).toEqual({ acao: "nao_publica" })
        expect(lerRespostaDoCatalogo({ ok: false, codigo: "rede", mensagem: "Sem conexão" }).acao).toBe("falhou")
        // chave recusada não derruba nada aqui: só tenta mais tarde (quem cuida da chave é a ponte)
        expect(lerRespostaDoCatalogo({ ok: false, codigo: "chave_invalida", mensagem: "x" }).acao).toBe("falhou")
        expect(lerRespostaDoCatalogo(null).acao).toBe("falhou")
    })
})
