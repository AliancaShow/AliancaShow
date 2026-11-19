// Configuracoes > Telas e saidas (C4): mapa das telas e lista "Todas as saidas". Parte pura.
import { describe, expect, it } from "vitest"
import { numeroDaTela, ocupaATela, ordenarTelas, resumoDaSaida, resumoDeRede, rotuloDaTela } from "./aliancaSaidasLogica"

const T = (id: number, x: number, internal = false) => ({ id, internal, bounds: { x, y: 0, width: 1920, height: 1080 } })
const telas = [T(30, 3840), T(10, 0, true), T(20, 1920)]

describe("telas", () => {
    it("a interna primeiro, depois da esquerda para a direita", () => {
        expect(ordenarTelas(telas).map((t) => t.id)).toEqual([10, 20, 30])
    })
    it("a saida e dona da tela pelo id; sem id salvo, pelos limites iguais", () => {
        expect(ocupaATela({ screen: "20" }, telas[2])).toBe(true)
        expect(ocupaATela({ screen: "99" }, telas[2])).toBe(false)
        expect(ocupaATela({ screen: null, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }, telas[2])).toBe(true)
        expect(ocupaATela({ screen: null }, telas[2])).toBe(false)
    })
    it("numero da tela na ordem do mapa (0 = nenhuma)", () => {
        expect(numeroDaTela(telas, { screen: "30" })).toBe(3)
        expect(numeroDaTela(telas, { screen: "99" })).toBe(0)
    })
})

describe("rotulo da tela no mapa", () => {
    const saidas = { a: { name: "Telão", screen: "20" }, b: { name: "Retorno", screen: "30" }, c: { name: "Fora", screen: "30", enabled: false }, d: { name: "NDI", invisible: true, screen: "20" } }
    it("a tela da saida escolhida vem marcada", () => {
        expect(rotuloDaTela(telas[2], saidas, "a")).toEqual({ nome: "Telão", ocupadaPelaEscolhida: true })
    })
    it("tela de outra saida mostra o nome dela, sem marca", () => {
        expect(rotuloDaTela(telas[0], saidas, "a")).toEqual({ nome: "Retorno", ocupadaPelaEscolhida: false })
    })
    it("saida desligada ou so de rede nao ocupa tela; sem dona e Cabine (interna) ou Livre", () => {
        expect(rotuloDaTela(telas[1], saidas, "a").nome).toBe("Cabine")
        expect(rotuloDaTela(T(40, 5760), saidas, "a").nome).toBe("Livre")
    })
})

describe("resumo da saida", () => {
    it("monitor + redes", () => {
        expect(resumoDaSaida({ screen: "20", ndi: true }, telas)).toBe("Monitor 2 + NDI")
    })
    it("so rede: so NDI com resolucao e quadros", () => {
        expect(resumoDaSaida({ invisible: true, ndi: true, bounds: { height: 1080 }, ndiData: { framerate: "30" } }, telas)).toBe("só NDI · 1080p30")
    })
    it("retorno: monitor + palco", () => {
        expect(resumoDaSaida({ screen: "30", stageOutput: "x" }, telas, "Palavra")).toBe("Monitor 3 · palco “Palavra”")
    })
    it("sem nada = desligada", () => {
        expect(resumoDaSaida({ invisible: true }, telas)).toBe("desligada")
    })
})

describe("resumo das secoes raras", () => {
    it("blackmagic sem placa", () => expect(resumoDeRede("blackmagic", {}, 0)).toBe("nenhuma placa encontrada"))
    it("blackmagic com placas", () => expect(resumoDeRede("blackmagic", {}, 2)).toBe("2 placas encontradas"))
    it("rtmp desligado e com destinos", () => {
        expect(resumoDeRede("rtmp", {})).toBe("desligado")
        expect(resumoDeRede("rtmp", { rtmp: true, rtmpData: { destinations: [{ url: "a" }, { url: "" }, { url: "b" }] } })).toBe("2 destinos")
    })
    it("webrtc", () => {
        expect(resumoDeRede("webrtc", {})).toBe("desligado")
        expect(resumoDeRede("webrtc", { webrtc: true })).toBe("sem endereço")
    })
})
