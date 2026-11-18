import { describe, expect, it } from "vitest"
import { decidirEscrita, NOS, sanearNaCarga, temNo } from "./aliancaArvoreLogica"

describe("arvore da biblioteca", () => {
    it("tem as seis do prototipo mais Funcoes e Calendario, sem metronomo e sem timers", () => {
        expect(NOS.map((n) => n.id)).toEqual(["shows", "media", "audio", "scripture", "overlays", "templates", "functions", "calendar"])
        expect(temNo("timers")).toBe(false)
    })
    it("na carga, aba sem no vira shows sem reclamar", () => {
        expect(sanearNaCarga("timers")).toBe("shows")
        expect(sanearNaCarga(undefined)).toBe("shows")
        expect(sanearNaCarga("audio")).toBe("audio")
    })
    it("em uso, escrita sem no e recusada e a arvore volta ao ultimo valido", () => {
        expect(decidirEscrita("effects", "audio")).toEqual({ ok: false, voltarPara: "audio", nome: "effects" })
        expect(decidirEscrita("media", "audio")).toEqual({ ok: true, aba: "media" })
    })
})
