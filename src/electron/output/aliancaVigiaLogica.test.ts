import { describe, expect, it } from "vitest"
import { JANELA_MS, MAX_RECRIAR, RECUPERANDO_MAX_MS, concluirRecuperacao, decidirQueda, quedaDeVerdade } from "./aliancaVigiaLogica"

describe("vigia de queda (F1)", () => {
    it("primeira queda recria e abre a recuperacao", () => {
        const r = decidirQueda(undefined, 1000)
        expect(r.acao).toBe("recriar")
        expect(r.registro).toEqual({ recuperando: true, desde: 1000, tentativas: [1000] })
    })
    it("queda duplicada durante a recuperacao conta uma vez", () => {
        const a = decidirQueda(undefined, 1000).registro
        const b = decidirQueda(a, 1200)
        expect(b.acao).toBe("ignorar")
        expect(b.registro.tentativas).toEqual([1000])
    })
    it("recuperacao que nunca terminou deixa de segurar depois de RECUPERANDO_MAX_MS", () => {
        const a = decidirQueda(undefined, 0).registro
        expect(decidirQueda(a, RECUPERANDO_MAX_MS + 1).acao).toBe("recriar")
    })
    it("concluir mede o tempo e fecha; sem recuperacao aberta devolve null", () => {
        const a = decidirQueda(undefined, 1000).registro
        const c = concluirRecuperacao(a, 1750)
        expect(c.ms).toBe(750)
        expect(c.registro.recuperando).toBe(false)
        expect(concluirRecuperacao(c.registro, 2000).ms).toBeNull()
        expect(concluirRecuperacao(undefined, 2000).ms).toBeNull()
    })
    it(`mais de ${MAX_RECRIAR} quedas em 60 s: desiste (fora do ar), sem laco`, () => {
        let reg: any = undefined
        let t = 0
        for (let i = 0; i < MAX_RECRIAR; i++) {
            const d = decidirQueda(reg, t)
            expect(d.acao).toBe("recriar")
            reg = concluirRecuperacao(d.registro, t + 500).registro
            t += 5000
        }
        const fim = decidirQueda(reg, t)
        expect(fim.acao).toBe("desistir")
        expect(fim.registro.recuperando).toBe(false)
    })
    it("tentativas antigas (fora da janela de 60 s) nao contam", () => {
        let reg: any = undefined
        for (let i = 0; i < MAX_RECRIAR; i++) reg = concluirRecuperacao(decidirQueda(reg, i * 1000).registro, i * 1000 + 10).registro
        expect(decidirQueda(reg, JANELA_MS + 5000).acao).toBe("recriar")
    })
    it("clean-exit (fechar janela/sair) nao e queda", () => {
        expect(quedaDeVerdade("clean-exit")).toBe(false)
        expect(quedaDeVerdade("crashed")).toBe(true)
        expect(quedaDeVerdade("killed")).toBe(true)
        expect(quedaDeVerdade(undefined)).toBe(true)
    })
})
