// 1b, D7/D8: a conta pura da moldura. Sem store: tudo entra por parametro.
import { describe, expect, it } from "vitest"
import { PAGINAS_DA_BUSCA_NO_PREPARAR } from "./aliancaQuickSearchLogica"
import { alvoDeVoltar, molduraDaPagina, nomeDoEditado, PAGINAS_DO_PREPARAR, paginaAnteriorDepois, paginaPermitida, textoDaRecusa, textoDoCrumb, tipoDoCrumb } from "./aliancaMolduraLogica"

const OITO = ["show", "edit", "reflow", "draw", "stage", "scripture", "calendar", "settings"]
const INVENTADA = "pagina-que-nao-existe"

describe("PAGINAS_DO_PREPARAR", () => {
    it("sao as quatro do plano", () => expect([...PAGINAS_DO_PREPARAR]).toEqual(["show", "edit", "stage", "settings"]))
    it("e igual a lista de main_page permitida na busca", () => expect([...PAGINAS_DO_PREPARAR]).toEqual([...PAGINAS_DA_BUSCA_NO_PREPARAR]))
})

describe("paginaPermitida", () => {
    it("no Culto todas, inclusive a inventada", () => {
        for (const p of [...OITO, INVENTADA]) expect(paginaPermitida("culto", p)).toBe(true)
    })
    it("no Preparar so as quatro", () => {
        for (const p of OITO) expect(paginaPermitida("preparar", p)).toBe(["show", "edit", "stage", "settings"].includes(p))
        expect(paginaPermitida("preparar", INVENTADA)).toBe(false)
        expect(paginaPermitida("preparar", undefined)).toBe(false)
        expect(paginaPermitida("preparar", null)).toBe(false)
    })
    it("'reflow' na lista reprova (mutacao do plano)", () => expect((PAGINAS_DO_PREPARAR as readonly string[]).includes("reflow")).toBe(false))
})

describe("molduraDaPagina: modo x pagina", () => {
    it("Culto: nunca moldura, em nenhuma pagina", () => {
        for (const p of [...OITO, INVENTADA]) expect(molduraDaPagina({ modo: "culto", pagina: p })).toBeNull()
    })
    it("Preparar show: a barra de culto (null)", () => expect(molduraDaPagina({ modo: "preparar", pagina: "show" })).toBeNull())
    it("Preparar edit: editor, volta ao culto", () => expect(molduraDaPagina({ modo: "preparar", pagina: "edit" })).toEqual({ tipo: "editor", titulo: "", rotuloVoltar: "← Voltar ao culto" }))
    it("Preparar edit vindo da biblioteca: volta a biblioteca", () => expect(molduraDaPagina({ modo: "preparar", pagina: "edit", abaLateral: "biblioteca" })?.rotuloVoltar).toBe("← Voltar à biblioteca"))
    it("Preparar stage e settings: pagina com titulo", () => {
        expect(molduraDaPagina({ modo: "preparar", pagina: "stage" })).toEqual({ tipo: "pagina", titulo: "Palco", rotuloVoltar: "← Voltar" })
        expect(molduraDaPagina({ modo: "preparar", pagina: "settings" })).toEqual({ tipo: "pagina", titulo: "Configurações", rotuloVoltar: "← Voltar" })
    })
    it("Preparar em qualquer outra pagina (e uma inventada): fora, sempre com Voltar", () => {
        for (const p of ["draw", "scripture", "reflow", "calendar", INVENTADA]) {
            const m = molduraDaPagina({ modo: "preparar", pagina: p })
            expect(m?.tipo).toBe("fora")
            expect(m?.rotuloVoltar).toBe("← Voltar")
        }
    })
    it("toda moldura tem rotulo de voltar", () => {
        for (const p of [...OITO, INVENTADA]) {
            const m = molduraDaPagina({ modo: "preparar", pagina: p })
            if (m) expect(m.rotuloVoltar.length).toBeGreaterThan(0)
        }
    })
})

describe("alvoDeVoltar", () => {
    it("origem valida e diferente da atual", () => {
        expect(alvoDeVoltar({ pagina: "stage", anterior: "settings" })).toBe("settings")
        expect(alvoDeVoltar({ pagina: "settings", anterior: "edit" })).toBe("edit")
    })
    it("origem invalida ou igual cai em show", () => {
        expect(alvoDeVoltar({ pagina: "settings", anterior: "draw" })).toBe("show")
        expect(alvoDeVoltar({ pagina: "settings", anterior: "settings" })).toBe("show")
        expect(alvoDeVoltar({ pagina: "settings", anterior: null })).toBe("show")
    })
    it("o alvo de edit e sempre show", () => {
        expect(alvoDeVoltar({ pagina: "edit", anterior: "settings" })).toBe("show")
        expect(alvoDeVoltar({ pagina: "edit", anterior: null })).toBe("show")
    })
})

describe("paginaAnteriorDepois", () => {
    it("Preparar: entrar em stage/settings lembra de onde veio", () => {
        expect(paginaAnteriorDepois({ modo: "preparar", de: "show", para: "settings", atual: null })).toBe("show")
        expect(paginaAnteriorDepois({ modo: "preparar", de: "settings", para: "stage", atual: "show" })).toBe("settings")
    })
    it("A igual a B ou A fora da lista: mantem", () => {
        expect(paginaAnteriorDepois({ modo: "preparar", de: "settings", para: "settings", atual: "show" })).toBe("show")
        expect(paginaAnteriorDepois({ modo: "preparar", de: "draw", para: "settings", atual: "edit" })).toBe("edit")
    })
    it("ir para show/edit esquece; Culto nunca lembra", () => {
        expect(paginaAnteriorDepois({ modo: "preparar", de: "settings", para: "show", atual: "edit" })).toBeNull()
        expect(paginaAnteriorDepois({ modo: "culto", de: "show", para: "settings", atual: null })).toBeNull()
    })
})

describe("de toda pagina alcancavel, show em no maximo 2 Voltar", () => {
    // simulador: cada Voltar usa alvoDeVoltar com a regra de lembranca
    function voltas(inicio: string[]): number {
        let pagina = inicio[0]
        let anterior: string | null = null
        for (const p of inicio.slice(1)) {
            anterior = paginaAnteriorDepois({ modo: "preparar", de: pagina, para: p, atual: anterior })
            pagina = p
        }
        let n = 0
        while (pagina !== "show" && n < 10) {
            const alvo = alvoDeVoltar({ pagina, anterior })
            anterior = paginaAnteriorDepois({ modo: "preparar", de: pagina, para: alvo, atual: anterior })
            anterior = null // voltarDaPagina zera depois do set
            pagina = alvo
            n++
        }
        return n
    }
    it("caminhos reais", () => {
        for (const caminho of [
            ["show", "edit"],
            ["show", "stage"],
            ["show", "settings"],
            ["show", "settings", "stage"],
            ["show", "stage", "settings"],
            ["show", "edit", "settings"],
            ["show", "edit", "stage", "settings"],
            ["show", "settings", "stage", "settings"]
        ]) {
            expect(voltas(caminho), caminho.join(">")).toBeLessThanOrEqual(2)
        }
    })
})

describe("crumb", () => {
    const base = { nome: "Grande e o Senhor", slide: 2, total: 9, ehMusica: true }
    it("cada tipo", () => {
        expect(textoDoCrumb({ ...base, tipo: "show" })).toBe("Música · Grande e o Senhor · slide 3 de 9")
        expect(textoDoCrumb({ ...base, tipo: undefined, ehMusica: false })).toBe("Apresentação · Grande e o Senhor · slide 3 de 9")
        expect(textoDoCrumb({ ...base, tipo: "media" })?.startsWith("Mídia · ")).toBe(true)
        expect(textoDoCrumb({ ...base, tipo: "camera" })?.startsWith("Mídia · ")).toBe(true)
        expect(textoDoCrumb({ ...base, tipo: "template" })?.startsWith("Modelo · ")).toBe(true)
        expect(textoDoCrumb({ ...base, tipo: "overlay" })?.startsWith("Sobreposição · ")).toBe(true)
        expect(textoDoCrumb({ ...base, tipo: "effect" })?.startsWith("Efeito · ")).toBe(true)
        expect(textoDoCrumb({ ...base, tipo: "audio" })?.startsWith("Áudio · ")).toBe(true)
    })
    it("sem slide ou sem layout: sem slides", () => {
        expect(textoDoCrumb({ ...base, tipo: "show", slide: undefined })).toBe("Música · Grande e o Senhor · sem slides")
        expect(textoDoCrumb({ ...base, tipo: "show", total: 0 })).toBe("Música · Grande e o Senhor · sem slides")
        expect(textoDoCrumb({ ...base, tipo: "show", slide: null as any })).toBe("Música · Grande e o Senhor · sem slides")
    })
    it("slide 0 e o primeiro; o ultimo e N de N", () => {
        expect(textoDoCrumb({ ...base, tipo: "show", slide: 0 })).toBe("Música · Grande e o Senhor · slide 1 de 9")
        expect(textoDoCrumb({ ...base, tipo: "show", slide: 8 })).toBe("Música · Grande e o Senhor · slide 9 de 9")
    })
    it("tipo desconhecido: null (quem chama faz falhaAlta, nunca um texto inventado)", () => {
        expect(tipoDoCrumb("coisa-nova", false)).toBeNull()
        expect(textoDoCrumb({ ...base, tipo: "coisa-nova" })).toBeNull()
    })
    it("nomeDoEditado", () => {
        const fontes = { activeShowId: "s1", shows: { s1: { name: "Música X" } }, templates: { t1: { name: "Modelo Y" } }, overlays: { o1: { name: "Sobre Z" } }, effects: { e1: { name: "Efeito W" } } }
        expect(nomeDoEditado({ type: "show" }, fontes)).toBe("Música X")
        expect(nomeDoEditado({}, fontes)).toBe("Música X")
        expect(nomeDoEditado({ type: "template", id: "t1" }, fontes)).toBe("Modelo Y")
        expect(nomeDoEditado({ type: "overlay", id: "o1" }, fontes)).toBe("Sobre Z")
        expect(nomeDoEditado({ type: "effect", id: "e1" }, fontes)).toBe("Efeito W")
        expect(nomeDoEditado({ type: "media", id: "C:\\midia\\foto%201.jpg" }, fontes)).toBe("foto 1.jpg")
        expect(nomeDoEditado({ type: "audio", id: "/a/b/musica.mp3" }, fontes)).toBe("musica.mp3")
        expect(nomeDoEditado(null, fontes)).toBe("")
    })
})

describe("textoDaRecusa", () => {
    it("draw e scripture: o texto de Desenhar e Biblia; o resto, o generico", () => {
        expect(textoDaRecusa("draw")).toBe("Desenhar e Bíblia em tela cheia ficam no Culto.")
        expect(textoDaRecusa("scripture")).toBe("Desenhar e Bíblia em tela cheia ficam no Culto.")
        expect(textoDaRecusa("calendar")).toBe("Essa página não abre no Preparar.")
        expect(textoDaRecusa(INVENTADA)).toBe("Essa página não abre no Preparar.")
    })
})
