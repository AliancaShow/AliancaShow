import { describe, expect, it } from "vitest"
import { PRAZO_ERRO_MS, avisoDaCaixa, conferirDuvida, duvidaDoEnvio } from "./aliancaMensagemPalcoLogica"

describe("M1: o erro nunca esconde a mensagem viva nem o Limpar", () => {
    it("o aviso e uma linha propria: a viva (e o Limpar) nao dependem dele", () => {
        // a viva mora na linha 1; esta funcao so decide o que vai na linha 2
        expect(avisoDaCaixa({ erro: "Sem rede.", enviando: false, avisoModo: "", motivo: "" })).toBe("Sem rede.")
        expect(avisoDaCaixa({ erro: "", enviando: true, avisoModo: "", motivo: "Esperando…" })).toBe("Enviando…")
        expect(avisoDaCaixa({ erro: "Sem rede.", enviando: true, avisoModo: "x", motivo: "y" })).toBe("Sem rede.")
        expect(avisoDaCaixa({ erro: "", enviando: false, avisoModo: "Modo.", motivo: "y" })).toBe("Modo.")
        expect(avisoDaCaixa({ erro: "", enviando: false, avisoModo: "", motivo: "y" })).toBe("y")
        expect(avisoDaCaixa({ erro: "", enviando: false, avisoModo: "", motivo: "" })).toBe("")
    })
    it("o erro vive ~6 s", () => {
        expect(PRAZO_ERRO_MS).toBe(6000)
    })
})

describe("M1: envio que estourou o tempo mas chegou", () => {
    const d = duvidaDoEnvio("Pastor, 5 min", 3, 1_000_000)
    it("a duvida so nasce do 'rede' e guarda o texto e o menor `ate` que o envio novo teria", () => {
        expect(d.texto).toBe("Pastor, 5 min")
        expect(d.minAteMs).toBe(1_000_000 + 3 * 60_000 - 15_000)
    })
    it("a proxima leitura do roteiro com a mesma mensagem viva resolve para 'viva'", () => {
        expect(conferirDuvida(d, { texto: "Pastor, 5 min", ateMs: 1_000_000 + 180_000 }, 1_010_000)).toBe("resolvida")
    })
    it("mensagem velha igual (ate de antes) nao resolve", () => {
        expect(conferirDuvida(d, { texto: "Pastor, 5 min", ateMs: 1_000_000 + 60_000 }, 1_010_000)).toBe("aberta")
    })
    it("outro texto no palco nao resolve; sem viva segue aberta; passou de 60 s vence (nunca fica para sempre)", () => {
        expect(conferirDuvida(d, { texto: "outra", ateMs: 9e12 }, 1_010_000)).toBe("aberta")
        expect(conferirDuvida(d, null, 1_010_000)).toBe("aberta")
        expect(conferirDuvida(d, null, 1_000_000 + 61_000)).toBe("vencida")
    })
})
