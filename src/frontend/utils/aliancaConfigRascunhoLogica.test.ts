// Configuracoes (C4): "N alteracoes nao salvas" e Descartar. Parte pura.
import { describe, expect, it } from "vitest"
import { contarMudancas, lojasMudadas, mudancasDaLoja, textoDeAlteracoes, vistaDasSaidas } from "./aliancaConfigRascunhoLogica"

describe("mudancasDaLoja", () => {
    it("igual = nada mudou", () => {
        expect(mudancasDaLoja({ a: 1 }, { a: 1 })).toEqual([])
        expect(mudancasDaLoja("pt", "pt")).toEqual([])
    })
    it("objeto simples conta chave por chave, inclusive entrada nova e apagada", () => {
        expect(mudancasDaLoja({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 }).sort()).toEqual(["b", "c"])
        expect(mudancasDaLoja({ a: 1, b: 2 }, { a: 1 })).toEqual(["b"])
    })
    it("valor solto ou lista conta 1", () => {
        expect(mudancasDaLoja("pt", "en")).toHaveLength(1)
        expect(mudancasDaLoja([1, 2], [1, 2, 3])).toHaveLength(1)
    })
    it("undefined e null sao a mesma coisa (nao e alteracao)", () => {
        expect(mudancasDaLoja({ a: undefined }, { a: null })).toEqual([])
    })
})

describe("contagem", () => {
    it("soma as lojas e so as lojas da foto", () => {
        const foto = { language: "pt", styles: { x: { n: 1 }, y: { n: 1 } }, ports: { remote: 1 } }
        const agora = { language: "en", styles: { x: { n: 2 }, y: { n: 1 }, z: { n: 9 } }, ports: { remote: 1 }, outraLoja: 1 }
        expect(contarMudancas(foto, agora)).toBe(3) // language, styles.x, styles.z
        expect(lojasMudadas(foto, agora).sort()).toEqual(["language", "styles"])
    })
    it("sem diferenca = zero", () => {
        const f = { a: { b: 1 } }
        expect(contarMudancas(f, JSON.parse(JSON.stringify(f)))).toBe(0)
    })
})

describe("texto do cabecalho", () => {
    it("some com zero, singular e plural", () => {
        expect(textoDeAlteracoes(0)).toBe("")
        expect(textoDeAlteracoes(1)).toBe("1 alteração não salva")
        expect(textoDeAlteracoes(2)).toBe("2 alterações não salvas")
    })
})

describe("vista das saidas", () => {
    it("so guarda as chaves que o Descartar sabe desfazer; estado vivo e janela ficam de fora", () => {
        const v = vistaDasSaidas({ default: { name: "Telão", color: "#f00", style: "s1", enabled: true, out: { slide: 1 }, bounds: { x: 0 }, ndi: true } })
        expect(v).toEqual({ default: { name: "Telão", color: "#f00", style: "s1" } })
    })
    it("mudar o estado vivo nao conta como alteracao", () => {
        const antes = vistaDasSaidas({ a: { name: "A", out: { slide: 1 } } })
        const depois = vistaDasSaidas({ a: { name: "A", out: { slide: 2 } } })
        expect(contarMudancas({ outputs: antes }, { outputs: depois })).toBe(0)
    })
    it("renomear conta 1", () => {
        const antes = vistaDasSaidas({ a: { name: "A" } })
        const depois = vistaDasSaidas({ a: { name: "B" } })
        expect(contarMudancas({ outputs: antes }, { outputs: depois })).toBe(1)
    })
})
