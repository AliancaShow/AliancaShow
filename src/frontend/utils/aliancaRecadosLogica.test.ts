import { describe, expect, it } from "vitest"
import { OUTRAS_ABERTA_PADRAO, RECADOS_ABERTO_PADRAO, pilulasDosRecados } from "./aliancaRecadosLogica"

describe("Recados: pilulas do titulo", () => {
    const agora = 1_000_000
    it("nada no ar = nenhuma pilula", () => {
        expect(pilulasDosRecados({ palco: null, chamada: null, agoraMs: agora })).toEqual([])
    })
    it("chamada com tempo mostra o nome e a contagem", () => {
        const [p] = pilulasDosRecados({ palco: null, chamada: { texto: "Pais da criança 23", ateMs: agora + 42_000 }, nomeChamada: "Kids", agoraMs: agora })
        expect(p).toMatchObject({ tipo: "chamadas", rotulo: "Kids", tempo: "0:42" })
        expect(p.titulo).toContain("Pais da criança 23")
    })
    it("chamada 'ate tirar' fica sem contagem", () => {
        const [p] = pilulasDosRecados({ palco: null, chamada: { texto: "x", ateMs: null }, nomeChamada: "Estacionamento", agoraMs: agora })
        expect(p.tempo).toBeNull()
    })
    it("palco e chamada juntos: Palco primeiro", () => {
        const r = pilulasDosRecados({ palco: { texto: "5 min", ateMs: agora + 161_000 }, chamada: { texto: "x", ateMs: null }, nomeChamada: "", agoraMs: agora })
        expect(r.map((x) => x.tipo)).toEqual(["palco", "chamadas"])
        expect(r[0].tempo).toBe("2:41")
        expect(r[1].rotulo).toBe("Chamada")
    })
    it("primeira abertura: Outras telas aberta, Recados recolhido (Andre, 25/nov)", () => {
        expect(OUTRAS_ABERTA_PADRAO).toBe(true)
        expect(RECADOS_ABERTO_PADRAO).toBe(false)
    })
})
