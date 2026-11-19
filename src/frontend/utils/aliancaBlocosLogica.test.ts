import { describe, expect, it } from "vitest"
import { abertoPorPadrao, blocoAberto, chaveDoBloco, comBloco, lerBlocos, serializarBlocos } from "./aliancaBlocosLogica"

describe("blocos das propriedades do Editar", () => {
    it("a vista nasce aberta; Mais e Avancado (e o que tem dentro) nascem recolhidos", () => {
        expect(abertoPorPadrao("vista")).toBe(true)
        expect(abertoPorPadrao("mais")).toBe(false)
        expect(abertoPorPadrao("avancado")).toBe(false)
        expect(abertoPorPadrao(null)).toBe(false)
    })
    it("a escolha do operador manda; sem escolha vale o padrao", () => {
        const e = { "text|vista:default": false, "text|mais:shadow": true }
        expect(blocoAberto(e, "text|vista:default", true)).toBe(false)
        expect(blocoAberto(e, "text|mais:shadow", false)).toBe(true)
        expect(blocoAberto(e, "text|vista:lines", true)).toBe(true)
        expect(blocoAberto({}, "x", false)).toBe(false)
    })
    it("ida e volta pelo texto guardado (o que sobrevive a fechar o app)", () => {
        let e = {}
        e = comBloco(e, chaveDoBloco("text", "mais:shadow"), true)
        e = comBloco(e, chaveDoBloco("text", "vista:align"), false)
        expect(lerBlocos(serializarBlocos(e))).toEqual(e)
    })
    it("comBloco nao muda o estado de entrada", () => {
        const e = { a: true }
        comBloco(e, "b", false)
        expect(e).toEqual({ a: true })
    })
    it("lixo guardado nunca quebra: JSON ruim, tipo errado, valores que nao sao booleanos", () => {
        expect(lerBlocos(null)).toEqual({})
        expect(lerBlocos("{quebrado")).toEqual({})
        expect(lerBlocos("[1,2]")).toEqual({})
        expect(lerBlocos('"x"')).toEqual({})
        expect(lerBlocos('{"a":true,"b":"sim","c":1,"d":false}')).toEqual({ a: true, d: false })
    })
    it("a chave separa o tipo: a Sombra do texto nao e a Sombra da caixa", () => {
        expect(chaveDoBloco("text", "mais:shadow")).not.toBe(chaveDoBloco("item", "avancado:shadow"))
        expect(chaveDoBloco("", "a")).toBe("x|a")
    })
})
