import { describe, expect, it } from "vitest"
import { modoTrocaFundo, trocaFundo } from "./aliancaTrocaFundo"

describe("troca de fundo: corte seco ou fade (cabine-5)", () => {
    it("le o modo da transicao global de midia", () => {
        expect(modoTrocaFundo(undefined)).toBe("fade")
        expect(modoTrocaFundo({ type: "fade", duration: 800, easing: "sine" })).toBe("fade")
        expect(modoTrocaFundo({ type: "none", duration: 800, easing: "sine" })).toBe("corte")
        expect(modoTrocaFundo({ type: "fade", duration: 0, easing: "sine" })).toBe("corte")
    })

    it("corte seco zera tipo E duracao (o audio do video le a duracao global)", () => {
        const t = trocaFundo({ type: "fade", duration: 1200, easing: "linear" }, "corte")
        expect(t.type).toBe("none")
        expect(t.duration).toBe(0)
    })

    it("voltar ao fade mantem a duracao ajustada; sem ajuste, usa 800 ms", () => {
        expect(trocaFundo({ type: "fade", duration: 1200, easing: "linear" }, "fade")).toEqual({ type: "fade", duration: 1200, easing: "linear" })
        expect(trocaFundo({ type: "none", duration: 0, easing: "sine" }, "fade")).toEqual({ type: "fade", duration: 800, easing: "sine" })
        expect(trocaFundo({ type: "blur", duration: 500, easing: "sine" }, "fade")).toEqual({ type: "fade", duration: 800, easing: "sine" })
    })
})
