import { describe, expect, it } from "vitest"
import type { FonteSaida } from "../../types/aliancaSaidaCanais"
import { capturaContinua, espelhoDeSiMesmo, estadoDaFonte, limitesDaCaptura, mostraSelo, motivoDesenhavel, proximoDesenho, textoParado } from "./aliancaCapturaLogica"

const f = (o: Partial<FonteSaida> = {}): FonteSaida => ({ outputId: "a", fonteId: "window:123:0", existe: true, visivel: true, minimizada: false, caida: false, ...o })

describe("previa por captura (fatia A)", () => {
    it("janela visivel: ao vivo com a fonte DA JANELA (id vindo do processo principal)", () => {
        expect(estadoDaFonte(f())).toEqual({ aoVivo: true, fonteId: "window:123:0" })
    })
    it("sem resposta, sem janela, escondida, minimizada, caida: quadro parado com o motivo (nunca decodifica)", () => {
        expect(estadoDaFonte(null)).toEqual({ aoVivo: false, motivo: "erro" })
        expect(estadoDaFonte(f({ existe: false, fonteId: null }))).toEqual({ aoVivo: false, motivo: "sem-janela" })
        expect(estadoDaFonte(f({ visivel: false }))).toEqual({ aoVivo: false, motivo: "desligada" })
        expect(estadoDaFonte(f({ minimizada: true }))).toEqual({ aoVivo: false, motivo: "minimizada" })
        expect(estadoDaFonte(f({ caida: true }))).toEqual({ aoVivo: false, motivo: "caida" })
    })
    it("queda vence os outros estados", () => {
        expect(estadoDaFonte(f({ caida: true, visivel: false, minimizada: true }))).toEqual({ aoVivo: false, motivo: "caida" })
    })
    it("so reabre a captura quando a janela mudou ou a trilha morreu", () => {
        const vivo = estadoDaFonte(f())
        expect(capturaContinua("window:123:0", true, vivo)).toBe(true)
        expect(capturaContinua("window:123:0", false, vivo)).toBe(false)
        expect(capturaContinua("window:999:0", true, vivo)).toBe(false)
        expect(capturaContinua("window:123:0", true, estadoDaFonte(f({ visivel: false })))).toBe(false)
    })
    it("tom: neutro para estado normal, laranja para problema, vermelho para queda", () => {
        expect(textoParado("desligada", "Telão")).toEqual({ texto: "Telão desligado · sem imagem ao vivo", tom: "neutro" })
        expect(textoParado("desligada", "NDI", true).texto).toContain("só captura")
        expect(textoParado("minimizada", "Telão").tom).toBe("alerta")
        expect(textoParado("erro", "Telão").tom).toBe("alerta")
        expect(textoParado("caida", "Telão")).toEqual({ texto: "Telão caiu · recriando", tom: "queda" })
        expect(textoParado("sem-janela", "").texto).toContain("Saída")
    })
    it("previa pede no maximo 960x540; espelho do retorno ate 1080p; 30 fps", () => {
        expect(limitesDaCaptura("previa")).toEqual({ maxWidth: 960, maxHeight: 540, maxFrameRate: 30 })
        expect(limitesDaCaptura("espelho")).toEqual({ maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 })
    })
    it("espelho mirando a propria janela nao captura a si mesmo", () => {
        expect(espelhoDeSiMesmo("ret", "ret")).toBe(true)
        expect(espelhoDeSiMesmo("telao", "ret")).toBe(false)
        expect(espelhoDeSiMesmo("telao", null)).toBe(false)
        expect(espelhoDeSiMesmo("", "")).toBe(false)
    })
    it("(b) desligada / sem janela / carregando: a previa desenha; problema nao", () => {
        expect(motivoDesenhavel("desligada")).toBe(true)
        expect(motivoDesenhavel("sem-janela")).toBe(true)
        expect(motivoDesenhavel("carregando")).toBe(true)
        expect(motivoDesenhavel("minimizada")).toBe(false)
        expect(motivoDesenhavel("caida")).toBe(false)
        expect(motivoDesenhavel("erro")).toBe(false)
        expect(motivoDesenhavel(null)).toBe(false)
    })
    it("(b) troca sem piscar: liga o desenho na hora; so desliga no 1o quadro capturado", () => {
        expect(proximoDesenho(false, "desligada", true, false)).toBe(true)
        expect(proximoDesenho(true, null, true, false)).toBe(true)
        expect(proximoDesenho(true, null, true, true)).toBe(false)
        expect(proximoDesenho(false, null, true, false)).toBe(false)
    })
    it("(b) problema nao troca a camada de baixo; sem slot (espelho do retorno) nunca desenha", () => {
        expect(proximoDesenho(true, "erro", true, false)).toBe(true)
        expect(proximoDesenho(false, "caida", true, false)).toBe(false)
        expect(proximoDesenho(false, "minimizada", true, false)).toBe(false)
        expect(proximoDesenho(true, "desligada", false, false)).toBe(false)
    })
    it("(b) selo: desenhada + neutro some (como antes); problema sempre aparece", () => {
        expect(mostraSelo("neutro", true)).toBe(false)
        expect(mostraSelo("neutro", false)).toBe(true)
        expect(mostraSelo("alerta", true)).toBe(true)
        expect(mostraSelo("queda", true)).toBe(true)
    })
})
