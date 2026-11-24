import { describe, expect, it } from "vitest"
import { SEM_CATEGORIA, TODOS, categoriaDoNovo, categoriasDaLista, modelosDaLista, musicasDaBusca, nomeDaCategoria, nomeLivre } from "./aliancaModelosLogica"

const categorias = {
    scripture: { name: "category.scripture", default: true },
    ret: { name: "Modelos de retorno" },
    velha: { name: "Antigos", isArchive: true }
}
const modelos = {
    a: { name: "Aliança Letra", category: null },
    b: { name: "Bíblia Telão", category: "scripture" },
    c: { name: "Retorno banda", category: "ret" },
    d: { name: "Velho", category: "velha" },
    e: { name: "Só texto", settings: { mode: "text" } },
    f: { name: "Órfão", category: "apagada" }
}

describe("categoriasDaLista", () => {
    it("Todos, categorias em ordem (sem arquivadas, Bíblia traduzida) e Sem categoria com os órfãos", () => {
        const l = categoriasDaLista(modelos, categorias)
        expect(l.map((c) => [c.id, c.nome, c.total])).toEqual([
            [TODOS, "Todos", 4],
            ["scripture", "Bíblia", 1],
            ["ret", "Modelos de retorno", 1],
            [SEM_CATEGORIA, "Sem categoria", 2]
        ])
    })
    it("sem órfãos, não mostra Sem categoria", () => {
        expect(categoriasDaLista({ b: modelos.b }, categorias).map((c) => c.id)).toEqual([TODOS, "scripture", "ret"])
    })
})

describe("modelosDaLista", () => {
    it("filtra por categoria e por busca sem acento", () => {
        expect(modelosDaLista(modelos, categorias, { categoria: TODOS }).map((m) => m.id)).toEqual(["a", "b", "f", "c"])
        expect(modelosDaLista(modelos, categorias, { categoria: SEM_CATEGORIA }).map((m) => m.id)).toEqual(["a", "f"])
        expect(modelosDaLista(modelos, categorias, { categoria: TODOS, busca: "biblia" }).map((m) => m.id)).toEqual(["b"])
        expect(modelosDaLista(modelos, categorias, { categoria: "velha" }).map((m) => m.id)).toEqual(["d"])
    })
})

describe("pequenos", () => {
    it("categoria do novo, nome livre, nome da categoria", () => {
        expect(categoriaDoNovo("ret", categorias)).toBe("ret")
        expect(categoriaDoNovo(TODOS, categorias)).toBeNull()
        expect(categoriaDoNovo("nao_existe", categorias)).toBeNull()
        expect(nomeLivre("Novo modelo", ["Novo modelo", "novo modelo 2"])).toBe("Novo modelo 3")
        expect(nomeLivre("Retorno", [])).toBe("Retorno")
        expect(nomeDaCategoria({ name: "" })).toBe("Sem nome")
    })
    it("busca de música: começa-com primeiro, sem as privadas", () => {
        const shows = { 1: { name: "Grande é o Senhor" }, 2: { name: "Quão Grande" }, 3: { name: "Grandioso", private: true } }
        expect(musicasDaBusca(shows, "grande").map((s) => s.id)).toEqual(["1", "2"])
    })
})
