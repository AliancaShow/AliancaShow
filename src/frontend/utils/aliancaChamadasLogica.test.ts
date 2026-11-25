import { describe, expect, it } from "vitest"
import { camposDoModelo, caixaDaPosicao, corDaCaixa, itensDaChamada, montarTexto, nomeNovo, prontaParaChamar, restante, saidasDaChamada } from "./aliancaChamadasLogica"

describe("campos e texto", () => {
    it("acha os [campos] na ordem, sem repetir", () => {
        expect(camposDoModelo("Dono do [carro] placa [placa], [Carro] de novo")).toEqual(["carro", "placa"])
        expect(camposDoModelo("Sem campos")).toEqual([])
        expect(camposDoModelo("[ ] vazio [x]")).toEqual(["x"])
    })
    it("monta o texto com os valores (vazio vira __)", () => {
        expect(montarTexto("Pais da criança [número], favor comparecer ao Kids", { número: " 23 " })).toBe("Pais da criança 23, favor comparecer ao Kids")
        expect(montarTexto("Dono do [carro] placa [placa]", { carro: "Gol" })).toBe("Dono do Gol placa __")
    })
    it("pronta só com todos os campos", () => {
        expect(prontaParaChamar("[a] e [b]", { a: "1" })).toBe(false)
        expect(prontaParaChamar("[a] e [b]", { a: "1", b: "2" })).toBe(true)
        expect(prontaParaChamar("Fixa", {})).toBe(true)
        expect(prontaParaChamar("  ", {})).toBe(false)
    })
})

describe("caixa da sobreposição", () => {
    it("posições prontas geram uma caixa de texto; livre mantém a caixa e só troca o texto", () => {
        expect(caixaDaPosicao("livre", "#000")).toBeNull()
        const faixa = itensDaChamada(undefined, "faixa", "#123456", "Oi")
        expect(faixa).toHaveLength(1)
        expect(faixa[0].style).toContain("top:880px")
        expect(corDaCaixa(faixa)).toBe("#123456")
        expect(faixa[0].lines[0].text[0].value).toBe("Oi")
        const ajustada = [{ ...faixa[0], style: "top:10px;left:10px;width:300px;height:100px;background-color:#00ff00;", lines: [{ align: "text-align: left;", text: [{ value: "x", style: "font-size:20px;" }] }] }]
        const livre = itensDaChamada(ajustada, "livre", "#00ff00", "Novo")
        expect(livre[0].style).toBe(ajustada[0].style)
        expect(livre[0].lines[0]).toEqual({ align: "text-align: left;", text: [{ value: "Novo", style: "font-size:20px;" }] })
        expect(ajustada[0].lines[0].text[0].value).toBe("x")
    })
})

describe("saídas, tempo e nome", () => {
    const todas = { a: { name: "LED" }, b: { name: "NDI" }, r: { name: "Retorno", stageOutput: "x" } }
    it("só saídas normais; sem escolha = todas as normais", () => {
        expect(saidasDaChamada([], todas)).toEqual(["a", "b"])
        expect(saidasDaChamada(["b", "r", "sumiu"], todas)).toEqual(["b"])
        expect(saidasDaChamada(["sumiu"], todas)).toEqual([])
    })
    it("contagem e nome livre", () => {
        expect(restante(null, 0)).toBeNull()
        expect(restante(58_200, 0)).toBe("0:59")
        expect(restante(1000, 5000)).toBe("0:00")
        expect(nomeNovo(["Chamada", "chamada 2"])).toBe("Chamada 3")
    })
})
