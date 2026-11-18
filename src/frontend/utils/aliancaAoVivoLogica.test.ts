import { describe, expect, it } from "vitest"
import { faixaAoVivo } from "./aliancaAoVivoLogica"

describe("faixaAoVivo", () => {
    it("acende so com o telao ligado", () => {
        expect(faixaAoVivo({ telaoLigado: true })).toEqual({ aceso: true, motivo: "telão ligado" })
        expect(faixaAoVivo({ telaoLigado: false }).aceso).toBe(false)
    })
})
