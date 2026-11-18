import { describe, expect, it } from "vitest"
import { motivoVoltarLimpo } from "./aliancaVoltarLimpoLogica"

describe("menu do telao: voltar o que foi limpo", () => {
    it("explica por que esta indisponivel", () => {
        expect(motivoVoltarLimpo({ travada: true, haCache: true, pronto: true })).toContain("travada")
        expect(motivoVoltarLimpo({ travada: false, haCache: false, pronto: false })).toBe("Nada foi limpo ainda.")
        expect(motivoVoltarLimpo({ travada: false, haCache: true, pronto: false })).toBe("Espere um instante.")
        expect(motivoVoltarLimpo({ travada: false, haCache: true, pronto: true })).toBe("")
    })
})
