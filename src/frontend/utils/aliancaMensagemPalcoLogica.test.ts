import { describe, expect, it } from "vitest"
import { PRAZO_ERRO_MS, acompanharEnvio, avisoDaCaixa, campoEstaNoPalco, chavesDaMensagem, conferirDuvida, duvidaDoEnvio, rotuloNoPalco, textoDaVariavel } from "./aliancaMensagemPalcoLogica"

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

import { campoAposEnvio, envioAceito } from "./aliancaMensagemPalcoLogica"

describe("M3: a resposta do envio nao apaga o que foi digitado depois", () => {
    it("esvazia so se o campo ainda e o que foi enviado", () => {
        expect(campoAposEnvio("Pastor, 5 min", "Pastor, 5 min")).toBe("")
        expect(campoAposEnvio("Pastor, 5 min e a proxima ja digitada", "Pastor, 5 min")).toBe("Pastor, 5 min e a proxima ja digitada")
        expect(campoAposEnvio("outra", "Pastor, 5 min")).toBe("outra")
    })
})

describe("M6: Enter so solta o foco quando o envio e aceito para sair", () => {
    it("texto invalido, sem caminho ou com envio em curso: o foco fica no campo", () => {
        expect(envioAceito("oi", "", false)).toBe(true)
        expect(envioAceito("   ", "", false)).toBe(false)
        expect(envioAceito("", "", false)).toBe(false)
        expect(envioAceito("a".repeat(121), "", false)).toBe(false)
        expect(envioAceito("oi", "Nenhum culto do Sirvo sendo seguido.", false)).toBe(false)
        expect(envioAceito("oi", "", true)).toBe(false)
    })
})

describe("A3: o texto fica no campo enquanto a mensagem esta no palco", () => {
    const e = { campo: "Pastor, 5 min", texto: "Pastor, 5 min", visto: false, venceEm: 1_000_000 + 15_000 }
    it("o rotulo e 'no palco · m:ss'", () => {
        expect(rotuloNoPalco(1_000_000 + 161_000, 1_000_000)).toBe("no palco · 2:41")
    })
    it("o campo acende como 'no palco' so quando e o MESMO texto da viva (ignora espacos duplos)", () => {
        expect(campoEstaNoPalco("Pastor,   5 min", { texto: "Pastor, 5 min" })).toBe(true)
        expect(campoEstaNoPalco("outra", { texto: "Pastor, 5 min" })).toBe(false)
        expect(campoEstaNoPalco("Pastor, 5 min", null)).toBe(false)
        expect(campoEstaNoPalco("", { texto: "" })).toBe(false)
    })
    it("antes de a viva aparecer o envio ESPERA (o campo nao esvazia); com ela, esta no palco", () => {
        expect(acompanharEnvio(e, null, 1_001_000)).toBe("esperando")
        expect(acompanharEnvio(e, { texto: "Pastor, 5 min" }, 1_002_000)).toBe("noPalco")
    })
    it("visto e depois sumiu = SAIU (esvazia o campo); nunca visto dentro do prazo = perdeu (o campo fica)", () => {
        expect(acompanharEnvio({ ...e, visto: true }, null, 1_100_000)).toBe("saiu")
        expect(acompanharEnvio(e, null, 1_000_000 + 16_000)).toBe("perdeu")
        expect(acompanharEnvio(e, { texto: "outra" }, 1_001_000)).toBe("esperando")
    })
})

describe("A2: a mensagem viva alimenta a variavel do layout de palco", () => {
    it("acha as variaveis de texto pelo NOME (como o FreeShow) ou pela chave: 'Mensagem palco', sirvo_mensagem", () => {
        const v = { a1: { name: "Mensagem palco", type: "text" }, sirvo_mensagem: { name: "sirvo_mensagem", type: "text" }, x: { name: "Outra", type: "text" }, n: { name: "mensagem_palco", type: "number" }, u: { name: " Mensagem Palco " } }
        expect(chavesDaMensagem(v).sort()).toEqual(["a1", "sirvo_mensagem", "u"])
        expect(chavesDaMensagem(null)).toEqual([])
    })
    it("o texto vira variavel sem HTML nem chaves (como o Sirvo faz com sirvo_mensagem)", () => {
        expect(textoDaVariavel("Pastor <b>{x}</b>\n5 min")).toBe("Pastor ‹b›(x)‹/b› 5 min")
        expect(textoDaVariavel("a".repeat(300)).length).toBe(200)
        expect(textoDaVariavel(null)).toBe("")
    })
})
