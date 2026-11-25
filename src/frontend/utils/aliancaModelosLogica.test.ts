import { describe, expect, it } from "vitest"
import { SEM_CATEGORIA, TODOS, categoriaDoNovo, deveColarModelo, categoriasDaLista, modelosDaLista, musicasDaBusca, nomeDaCategoria, nomeLivre, usosDoModelo } from "./aliancaModelosLogica"

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

describe("deveColarModelo", () => {
    it("cola na primeira vez e quando o modelo escolhido muda; editar o mesmo modelo não recola", () => {
        expect(deveColarModelo("letras", undefined)).toBe(true)
        expect(deveColarModelo("letras", "letras")).toBe(false)
        expect(deveColarModelo("teste", "letras")).toBe(true)
        expect(deveColarModelo("", "letras")).toBe(true)
    })
})

describe("apagar modelo: onde ele esta em uso (André 25/nov)", () => {
    it("sem uso: lista vazia (pode apagar)", () => {
        expect(usosDoModelo("m1", { visuais: [{ nome: "Culto", saidas: { a: { musica: "m2", biblia: "slide" } } }], estilos: { s: { name: "LED", template: "m2" } } })).toEqual([])
    })
    it("um Visual que veste o modelo em qualquer coluna (inclusive as de 2-4 versoes) bloqueia", () => {
        expect(usosDoModelo("m1", { visuais: [{ nome: "Culto", saidas: { a: { biblia3: "m1" } } }] })).toEqual(["Visual “Culto”"])
    })
    it("estilo, outro modelo (versoes ou primeiro slide), Biblia padrao e categoria de musica", () => {
        const r = usosDoModelo("m1", {
            estilos: { s: { name: "TELÃO LED", templateScripture_2: "m1" } },
            modelos: { m1: { name: "Ele mesmo", settings: { firstSlideTemplate: "m1" } }, b: { name: "Bíblia", settings: { aliancaVersoes: { "2": "m1" } } } },
            bibliaPadrao: "m1",
            categoriasDeMusica: { c: { name: "Louvor", template: "m1" } }
        })
        expect(r).toEqual(["estilo “TELÃO LED”", "modelo “Bíblia”", "modelo padrão da Bíblia", "categoria “Louvor”"])
    })
    it("a aparencia do Visual nao e coluna de modelo", () => {
        expect(usosDoModelo("m1", { visuais: [{ nome: "X", saidas: { a: { aparencia: "m1" } } }] })).toEqual([])
    })
})
