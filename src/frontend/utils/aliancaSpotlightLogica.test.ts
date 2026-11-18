import { describe, expect, it } from "vitest"
import { acaoDaTecla, ACOES_DO_APP, andar, enterRepetido, ESPERA_ENTER_MS, filtrarAcoes, LIVROS, lerReferencia, normalizar, rotuloDaReferencia, versiculosParaAbrir } from "./aliancaSpotlightLogica"

describe("spotlight: referencia de versiculo", () => {
    it("os 66 livros, em ordem, sem numero repetido", () => {
        expect(LIVROS.map((l) => l.n)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1))
    })
    it('"Rm 8:28", "Romanos 8 28" e "Jo 3.16"', () => {
        expect(lerReferencia("Rm 8:28")).toEqual({ livro: 45, nomeDoLivro: "Romanos", capitulo: 8, versiculos: [28, 28] })
        expect(lerReferencia("Romanos 8 28")).toEqual({ livro: 45, nomeDoLivro: "Romanos", capitulo: 8, versiculos: [28, 28] })
        expect(lerReferencia("Jo 3.16")).toEqual({ livro: 43, nomeDoLivro: "João", capitulo: 3, versiculos: [16, 16] })
        expect(lerReferencia("jo 3,16")?.livro).toBe(43)
    })
    it("livro numerado, intervalo, capitulo inteiro e comeco do nome", () => {
        expect(lerReferencia("1 Co 13:4-7")).toEqual({ livro: 46, nomeDoLivro: "1 Coríntios", capitulo: 13, versiculos: [4, 7] })
        expect(lerReferencia("1co13")?.livro).toBe(46)
        expect(lerReferencia("1 João 4:8")?.livro).toBe(62)
        expect(lerReferencia("Salmos 23")).toEqual({ livro: 19, nomeDoLivro: "Salmos", capitulo: 23, versiculos: null })
        expect(lerReferencia("rom 12:1")?.livro).toBe(45)
        expect(lerReferencia("Apoc 21:4")?.livro).toBe(66)
        expect(lerReferencia("Gn 1:1")?.livro).toBe(1)
    })
    it("Jó com acento e Jo sem acento", () => {
        expect(lerReferencia("Jó 1:1")?.livro).toBe(18)
        expect(lerReferencia("Job 1:1")?.livro).toBe(18)
        expect(lerReferencia("Jo 1:1")?.livro).toBe(43)
    })
    it("o que nao e referencia vira nulo", () => {
        for (const t of ["", "Romanos", "bondade de deus", "Jesus 3", "Rm 0", "Rm 8:0", "8:28", "Aos Teus Pés 2"]) expect(lerReferencia(t), t).toBeNull()
    })
    it("versiculo final menor que o inicial vira so o inicial", () => {
        expect(lerReferencia("Rm 8:28-5")?.versiculos).toEqual([28, 28])
    })
    it("rotulo e versiculos a abrir", () => {
        expect(rotuloDaReferencia(lerReferencia("Rm 8:28-30")!)).toBe("Romanos 8:28-30")
        expect(rotuloDaReferencia(lerReferencia("Rm 8:28")!)).toBe("Romanos 8:28")
        expect(rotuloDaReferencia(lerReferencia("Sl 23")!)).toBe("Salmos 23")
        expect(versiculosParaAbrir(lerReferencia("Rm 8:28-30")!)).toEqual([[28, 29, 30]])
        expect(versiculosParaAbrir(lerReferencia("Sl 23")!)).toEqual([[1]])
    })
})

describe("spotlight: acoes do app", () => {
    it("acha pelo nome e pelo apelido, sem acento", () => {
        expect(filtrarAcoes("config")[0].id).toBe("settings")
        expect(filtrarAcoes("telas")[0].id).toBe("display_settings")
        expect(filtrarAcoes("telão").map((a) => a.id)).toContain("display_settings")
        expect(filtrarAcoes("tela cheia")[0].id).toBe("fullscreen")
        expect(filtrarAcoes("historico")[0].id).toBe("history")
    })
    it("todas as palavras precisam bater; vazio nao acha nada", () => {
        expect(filtrarAcoes("telas zzz")).toEqual([])
        expect(filtrarAcoes("   ")).toEqual([])
    })
    it("nao oferece trocar de tela (so o segmentado troca Mostrar | Editar)", () => {
        expect(ACOES_DO_APP.some((a) => /^(mostrar|editar)$/.test(normalizar(a.nome)))).toBe(false)
        expect(filtrarAcoes("mostrar")).toEqual([])
    })
    it("ids unicos", () => {
        expect(new Set(ACOES_DO_APP.map((a) => a.id)).size).toBe(ACOES_DO_APP.length)
    })
})

describe("spotlight: o que cada tecla faz", () => {
    it("show em Mostrar: Enter poe no roteiro, Ctrl+Enter manda ao ar", () => {
        expect(acaoDaTecla("show", "mostrar", false)).toBe("roteiro")
        expect(acaoDaTecla("show", "mostrar", true)).toBe("tocar")
    })
    it("show em Editar: Enter abre no editor, Ctrl+Enter poe no roteiro, nunca ao ar", () => {
        expect(acaoDaTecla("show", "editar", false)).toBe("abrir-editar")
        expect(acaoDaTecla("show", "editar", true)).toBe("roteiro")
    })
    it("versiculo: Enter ao ar so em Mostrar e com versiculo certo", () => {
        expect(acaoDaTecla("versiculo", "mostrar", false)).toBe("ao-ar")
        expect(acaoDaTecla("versiculo", "mostrar", true)).toBe("abrir-biblia")
        expect(acaoDaTecla("versiculo", "editar", false)).toBe("abrir-biblia")
        expect(acaoDaTecla("versiculo", "pagina", false)).toBe("abrir-biblia")
        expect(acaoDaTecla("versiculo", "mostrar", false, false)).toBe("abrir-biblia")
    })
    it("midia, audio e acao", () => {
        expect(acaoDaTecla("midia", "mostrar", false)).toBe("abrir-midia")
        expect(acaoDaTecla("audio", "editar", true)).toBe("abrir-midia")
        expect(acaoDaTecla("acao", "editar", false)).toBe("executar")
    })
    it("nenhuma combinacao em Editar ou numa pagina manda ao ar", () => {
        for (const tipo of ["show", "midia", "audio", "versiculo", "acao"] as const)
            for (const tela of ["editar", "pagina"] as const)
                for (const alt of [false, true]) expect(["tocar", "ao-ar"], `${tipo}/${tela}/${alt}`).not.toContain(acaoDaTecla(tipo, tela, alt))
    })
})

describe("spotlight: Enter repetido e seta", () => {
    it("o segundo Enter no mesmo resultado dentro de 400 ms e engolido", () => {
        expect(ESPERA_ENTER_MS).toBe(400)
        expect(enterRepetido(null, "a", 1000)).toBe(false)
        expect(enterRepetido({ chave: "a", em: 1000 }, "a", 1399)).toBe(true)
        expect(enterRepetido({ chave: "a", em: 1000 }, "a", 1400)).toBe(false)
        expect(enterRepetido({ chave: "a", em: 1000 }, "b", 1100)).toBe(false)
    })
    it("a seta para no fim", () => {
        expect(andar(0, -1, 3)).toBe(0)
        expect(andar(2, 1, 3)).toBe(2)
        expect(andar(0, 1, 3)).toBe(1)
        expect(andar(0, 1, 0)).toBe(-1)
    })
})
