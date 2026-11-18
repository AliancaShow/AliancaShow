import { describe, expect, it } from "vitest"
import { alturaDaFaixa, arrastar, CENTRO_MIN_LARGURA, colunasDaGrade, FAIXA_MIN_ALTURA, larguraDoCentro, LIMITES, prender } from "./aliancaTelaLogica"

const PADRAO = { esq: 280, dir: 330, bib: 260 }

describe("prender", () => {
    it("1920x1080: o padrao passa inteiro e o centro absorve a sobra", () => {
        const v = prender(PADRAO, { w: 1920, h: 1080 })
        expect(v).toEqual(PADRAO)
        expect(larguraDoCentro(1920, v)).toBe(1274)
    })
    it("1920x976 (cabine real): a altura da faixa de cima fica folgada", () => {
        const v = prender(PADRAO, { w: 1920, h: 976 })
        expect(v).toEqual(PADRAO)
        expect(alturaDaFaixa(976, v)).toBeGreaterThanOrEqual(FAIXA_MIN_ALTURA)
    })
    it("1440x900: padrao", () => {
        const v = prender(PADRAO, { w: 1440, h: 900 })
        expect(v).toEqual(PADRAO)
        expect(larguraDoCentro(1440, v)).toBeGreaterThanOrEqual(CENTRO_MIN_LARGURA)
    })
    it("valor fora dos limites e preso", () => {
        expect(prender({ esq: 10, dir: 9999, bib: -4 }, { w: 3000, h: 2000 })).toEqual({ esq: 200, dir: 460, bib: 140 })
        expect(prender({ esq: NaN, dir: NaN, bib: NaN } as any, { w: 1920, h: 1080 })).toEqual(PADRAO)
    })
    it("janela estreita: cede primeiro a esquerda, depois a direita, nunca abaixo do minimo", () => {
        const v = prender({ esq: 460, dir: 460, bib: 260 }, { w: 1000, h: 900 })
        expect(v.esq).toBe(LIMITES.esq[0])
        expect(v.dir).toBeGreaterThanOrEqual(LIMITES.dir[0])
        expect(larguraDoCentro(1000, v)).toBeGreaterThanOrEqual(CENTRO_MIN_LARGURA - 1)
        const w2 = prender({ esq: 460, dir: 330, bib: 260 }, { w: 1100, h: 900 })
        expect(w2.dir).toBe(330) // a esquerda deu o que faltava
    })
    it("janela baixa: cede a biblioteca ate 140", () => {
        const v = prender({ esq: 280, dir: 330, bib: 560 }, { w: 1920, h: 640 })
        expect(alturaDaFaixa(640, v)).toBeGreaterThanOrEqual(FAIXA_MIN_ALTURA)
        expect(v.bib).toBeGreaterThanOrEqual(140)
    })
})

describe("arrastar", () => {
    it("a esquerda cresce com o mouse; direita e biblioteca encolhem", () => {
        expect(arrastar("esq", PADRAO, 280, 50, { w: 1920, h: 1080 }).esq).toBe(330)
        expect(arrastar("dir", PADRAO, 330, 50, { w: 1920, h: 1080 }).dir).toBe(280)
        expect(arrastar("bib", PADRAO, 260, -40, { w: 1920, h: 1080 }).bib).toBe(300)
    })
    it("para na divisoria arrastada: nunca passa do limite nem invade o minimo do centro", () => {
        expect(arrastar("esq", PADRAO, 280, 9999, { w: 1920, h: 1080 }).esq).toBe(460)
        const v = arrastar("esq", PADRAO, 280, 9999, { w: 1100, h: 1080 })
        expect(larguraDoCentro(1100, v)).toBeGreaterThanOrEqual(CENTRO_MIN_LARGURA)
        expect(v.dir).toBe(330)
        expect(arrastar("bib", PADRAO, 260, 9999, { w: 1920, h: 1080 }).bib).toBe(140)
    })
})

describe("colunasDaGrade", () => {
    it("a 1920 (centro de 1274) sao 6 colunas", () => expect(colunasDaGrade(1274)).toBe(6))
    it("nunca menos de 1", () => expect(colunasDaGrade(10)).toBe(1))
})
