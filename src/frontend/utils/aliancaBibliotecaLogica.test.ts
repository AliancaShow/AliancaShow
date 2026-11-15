import { describe, expect, it } from "vitest"
import { abasEscondidasNaBiblioteca, edicaoDoShow, idsNoCulto, inserirShowNoFim, itensDoMenuNovo, listarBiblioteca, motivoSemEditar, resumoDaBiblioteca, textoVazio, toqueRepetido } from "./aliancaBibliotecaLogica"
import { ABAS_DO_EDITOR, abasEscondidasNoEditor } from "./aliancaGavetaLogica"

const categorias = { song: { icon: "song" }, impulso: { icon: "song" }, presentation: { icon: "slide" }, scripture: { icon: "scripture", isArchive: true }, privada: { icon: "slide" } }
const shows: any = {
    a: { name: "Ao Teu Redor", category: "song" },
    b: { name: "água viva", category: "impulso" },
    c: { name: "Zeta", category: "song" },
    d: { name: "Aviso", category: "presentation" },
    e: { name: "Sem categoria", category: null },
    f: { name: "Categoria sumida", category: "nao-existe" },
    g: { name: "Genesis 1", category: "scripture" },
    h: { name: "Segredo", category: "song", private: true },
    i: { name: "Proibida", category: "privada" }
}
const base = { shows, categorias, acesso: { privada: "none" }, ehSemLetraDe: (id: string) => id === "c" }

describe("listarBiblioteca", () => {
    it("Músicas: só categoria de ícone song, em ordem pt sem acento nem caixa", () => {
        expect(listarBiblioteca({ ...base, tipo: "musicas" }).map((l) => l.id)).toEqual(["b", "a", "c"]) // "água viva" vem antes de "Ao Teu" (agua < ao)
    })
    it("a ordem ignora acento e caixa", () => {
        const l = listarBiblioteca({ ...base, shows: { x: { name: "Éden", category: "song" }, y: { name: "eco", category: "song" }, z: { name: "Dom", category: "song" } }, tipo: "musicas" })
        expect(l.map((x) => x.nome)).toEqual(["Dom", "eco", "Éden"])
    })
    it("Apresentações: o resto, inclusive sem categoria e com categoria que não existe; sem arquivada, privada ou acesso none", () => {
        expect(
            listarBiblioteca({ ...base, tipo: "apresentacoes" })
                .map((l) => l.id)
                .sort()
        ).toEqual(["d", "e", "f"])
    })
    it("show privado nunca aparece, nem em Músicas", () => {
        expect(listarBiblioteca({ ...base, tipo: "musicas" }).some((l) => l.id === "h")).toBe(false)
    })
    it("soSemLetra usa a conta injetada e só vale em Músicas", () => {
        expect(listarBiblioteca({ ...base, tipo: "musicas", soSemLetra: true }).map((l) => l.id)).toEqual(["c"])
        expect(listarBiblioteca({ ...base, tipo: "apresentacoes", soSemLetra: true })).toEqual([])
    })
    it("semLetra vem marcado nas linhas de música", () => {
        expect(listarBiblioteca({ ...base, tipo: "musicas" }).find((l) => l.id === "c")?.semLetra).toBe(true)
        expect(listarBiblioteca({ ...base, tipo: "apresentacoes" }).every((l) => !l.semLetra)).toBe(true)
    })
    it("entradas nulas e índice vazio não quebram", () => {
        expect(listarBiblioteca({ ...base, shows: null, tipo: "musicas" })).toEqual([])
        expect(listarBiblioteca({ ...base, shows: { x: null }, categorias: null, acesso: null, tipo: "apresentacoes" })).toEqual([])
    })
})

describe("resumoDaBiblioteca", () => {
    it("as contagens batem com as listas", () => {
        const r = resumoDaBiblioteca(base)
        expect(r).toEqual({ musicas: 3, apresentacoes: 3, semLetra: 1 })
    })
})

describe("idsNoCulto", () => {
    const projetos: any = {
        p: {
            shows: [
                { id: "a", type: "show" },
                { id: "a", type: "show" },
                { id: "m", type: "media" },
                { id: "b", type: "show" }
            ]
        }
    }
    it("só type show, sem duplicar", () => expect([...idsNoCulto(projetos, "p", false)].sort()).toEqual(["a", "b"]))
    it("modelo, sem culto ou projeto que não existe = vazio", () => {
        expect(idsNoCulto(projetos, "p", true).size).toBe(0)
        expect(idsNoCulto(projetos, null, false).size).toBe(0)
        expect(idsNoCulto(projetos, "zz", false).size).toBe(0)
        expect(idsNoCulto(null, "p", false).size).toBe(0)
    })
})

describe("toqueRepetido", () => {
    it("primeira chamada é falsa; mesma chave em menos de 500 ms é verdadeira", () => {
        expect(toqueRepetido(null, "a", 1000)).toBe(false)
        expect(toqueRepetido({ chave: "a", em: 1000 }, "a", 1100)).toBe(true)
        expect(toqueRepetido({ chave: "a", em: 1000 }, "a", 1499)).toBe(true)
    })
    it("outra chave, ou 500 ms depois, é falsa", () => {
        expect(toqueRepetido({ chave: "a", em: 1000 }, "b", 1100)).toBe(false)
        expect(toqueRepetido({ chave: "a", em: 1000 }, "a", 1500)).toBe(false)
    })
})

describe("edicaoDoShow", () => {
    it("o mesmo show mantém o slide", () => expect(edicaoDoShow({ showId: "a", slide: 3 }, "a")).toEqual({ type: "show", slide: 3, items: [], showId: "a" }))
    it("outro show, indefinido ou negativo = slide 0", () => {
        expect(edicaoDoShow({ showId: "b", slide: 3 }, "a").slide).toBe(0)
        expect(edicaoDoShow(undefined, "a").slide).toBe(0)
        expect(edicaoDoShow({ showId: "a", slide: -1 }, "a").slide).toBe(0)
        expect(edicaoDoShow({ showId: "a", slide: null }, "a").slide).toBe(0)
    })
    it("sempre items vazio", () => expect(edicaoDoShow({ showId: "a", slide: 2 }, "a").items).toEqual([]))
})

describe("itensDoMenuNovo", () => {
    const itens = itensDoMenuNovo()
    it("ordem exata: 4 entradas e 2 separadores", () => {
        expect(itens.map((i) => (i === "separador" ? "—" : i.id))).toEqual(["musica", "varias", "—", "apresentacao", "—", "importar"])
        expect(itens.filter((i) => i === "separador").length).toBe(2)
    })
    it("nenhum rótulo de coisa que não existe", () => {
        const rotulos = itens.filter((i) => i !== "separador").map((i: any) => i.rotulo)
        expect(rotulos).toEqual(["Música (colar letra)", "Várias músicas", "Apresentação em branco", "Importar arquivo"])
        for (const r of rotulos) {
            expect(r).not.toMatch(/Prega|Tema|fotos/i)
        }
    })
})

describe("inserirShowNoFim", () => {
    const item = (id: string, type = "show") => ({ id, type }) as any
    it("põe no fim e diz se já estava", () => {
        const r = inserirShowNoFim([item("a"), item("b")], "a")
        expect(r.lista.map((i) => i.id)).toEqual(["a", "b", "a"])
        expect(r.pos).toBe(2)
        expect(r.jaEstava).toBe(true)
        expect(inserirShowNoFim([item("a")], "z").jaEstava).toBe(false)
    })
    it("culto vazio", () => expect(inserirShowNoFim([], "a")).toMatchObject({ pos: 0, jaEstava: false }))
    it("não muda a lista original", () => {
        const v = [item("a")]
        inserirShowNoFim(v, "b")
        expect(v.length).toBe(1)
    })
    it("entra ANTES do rodapé do Sirvo, quando houver", () => {
        const rodape = { id: "sirvo_fim", type: "section" } as any
        const r = inserirShowNoFim([item("a"), rodape], "b")
        expect(r.pos).toBe(1)
        expect(r.lista.map((i) => i.id)).toEqual(["a", "b", "sirvo_fim"])
    })
})

describe("abasEscondidasNaBiblioteca", () => {
    const TODAS = ["shows", "media", "audio", "scripture", "templates", "overlays", "calendar", "functions"]
    it("fora do Preparar é [] em TODAS as combinações", () => {
        for (const naBiblioteca of [true, false]) for (const noEditor of [true, false]) for (const tipoEditado of [undefined, "show", "template", "overlay"]) expect(abasEscondidasNaBiblioteca(TODAS, { preparar: false, naBiblioteca, noEditor, tipoEditado })).toEqual([])
    })
    it("na Biblioteca (Preparar, página show) sobram Mídia, Áudio e Bíblia", () => {
        const esc = abasEscondidasNaBiblioteca(TODAS, { preparar: true, naBiblioteca: true, noEditor: false, tipoEditado: undefined })
        expect(TODAS.filter((t) => !esc.includes(t))).toEqual(ABAS_DO_EDITOR.filter((t) => TODAS.includes(t)))
    })
    it("na aba Culto, fora do editor: nada escondido", () => {
        expect(abasEscondidasNaBiblioteca(TODAS, { preparar: true, naBiblioteca: false, noEditor: false, tipoEditado: undefined })).toEqual([])
    })
    it("editor de tema/overlay com a lateral na Biblioteca: [] (as abas escolhem o que editar)", () => {
        for (const tipo of ["template", "overlay", "effect"]) expect(abasEscondidasNaBiblioteca(TODAS, { preparar: true, naBiblioteca: false, noEditor: true, tipoEditado: tipo })).toEqual([])
    })
    it("compatível com a regra do editor existente", () => {
        for (const noEditor of [true, false]) for (const tipoEditado of [undefined, "show", "template"]) expect(abasEscondidasNaBiblioteca(TODAS, { preparar: true, naBiblioteca: false, noEditor, tipoEditado })).toEqual(abasEscondidasNoEditor(TODAS, { preparar: true, noEditor, tipoEditado }))
    })
})

describe("textoVazio / motivoSemEditar", () => {
    it("textos", () => {
        expect(textoVazio({ tipo: "musicas", filtrando: false })).toBe("Nenhuma música ainda.")
        expect(textoVazio({ tipo: "apresentacoes", filtrando: false })).toBe("Nenhuma apresentação ainda.")
        expect(textoVazio({ tipo: "musicas", filtrando: true })).toBe("Nada encontrado.")
    })
    it("motivoSemEditar", () => {
        expect(motivoSemEditar({ carregado: false, bloqueado: false, acesso: {}, categoria: "x" })).toMatch(/carregando/)
        expect(motivoSemEditar({ carregado: true, bloqueado: true, acesso: {}, categoria: "x" })).toMatch(/bloqueado/)
        expect(motivoSemEditar({ carregado: true, bloqueado: false, acesso: { global: "read" }, categoria: "x" })).toMatch(/ler/)
        expect(motivoSemEditar({ carregado: true, bloqueado: false, acesso: { x: "read" }, categoria: "x" })).toMatch(/ler/)
        expect(motivoSemEditar({ carregado: true, bloqueado: false, acesso: { y: "read" }, categoria: "x" })).toBeNull()
        expect(motivoSemEditar({ carregado: true, bloqueado: false, acesso: null, categoria: null })).toBeNull()
    })
})
