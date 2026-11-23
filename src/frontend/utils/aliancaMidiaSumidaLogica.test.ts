import { describe, expect, it } from "vitest"
import { avisoDeOffline, chaveDeOffline, chaveDeVerificacao, decidirMidia } from "./aliancaMidiaSumidaLogica"

describe("midia sumida nunca vai ao ar (cabine 6, 23/nov)", () => {
    it("local que nao existe: offline; local que existe: ao ar", () => {
        expect(decidirMidia({ local: true, existe: false })).toBe("offline")
        expect(decidirMidia({ local: true, existe: true })).toBe("ao-ar")
    })
    it("online/provedor nao e perguntado ao disco", () => {
        expect(decidirMidia({ local: false, existe: false })).toBe("ao-ar")
    })
    it("o aviso persistente diz o nome e o caminho, com chave por arquivo", () => {
        const a = avisoDeOffline("sumiu", "C:/m/sumiu.mp4")
        expect(a.chave).toBe(chaveDeOffline("C:/m/sumiu.mp4"))
        expect(a.texto).toContain('"sumiu"')
        expect(a.texto).toContain("C:/m/sumiu.mp4")
        expect(a.texto).toMatch(/offline/i)
    })
    it("a biblioteca pergunta de novo so quando a pasta muda", () => {
        const e0 = { vista: null as string | null, geracao: 0 }
        const r1 = chaveDeVerificacao(e0, "pasta:a", "x.mp4")
        expect(r1.geracao).toBe(1)
        const e1 = { vista: "pasta:a", geracao: r1.geracao }
        expect(chaveDeVerificacao(e1, "pasta:a", "x.mp4")).toEqual(r1)
        const r2 = chaveDeVerificacao(e1, "pasta:b", "x.mp4")
        expect(r2.geracao).toBe(2)
        expect(r2.chave).not.toBe(r1.chave)
    })
})
