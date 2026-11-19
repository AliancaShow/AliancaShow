// Configuracoes > Telas e saidas (C4): mapa das telas e lista "Todas as saidas". Parte pura.
import { describe, expect, it } from "vitest"
import { estadoDaSaida, numeroDaTela, ocupaATela, ordenarTelas, podeMover, resumoDaSaida, resumoDeRede, rotuloDaTela, telaDaCabine } from "./aliancaSaidasLogica"

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

describe("podeMover e a tela da cabine (revisao do PR #41, achado 1)", () => {
    const T2 = (id: number, x: number, internal = false) => ({ id, internal, bounds: { x, y: 0, width: 1920, height: 1080 } })
    const ts = [T2(10, 0, true), T2(20, 1920), T2(30, 3840)]
    const saidas: any = { tel: { name: "Telão", screen: "20" }, ret: { name: "Retorno", screen: "30" }, ndi: { name: "NDI", invisible: true, ndi: true }, trav: { name: "Travada", screen: "20", boundsLocked: true }, off: { name: "Desligada", enabled: false, screen: "30" } }
    it("a cabine e a tela que contem o centro da janela principal; sem o centro, a interna", () => {
        expect(telaDaCabine(ts, { x: 2500, y: 400 })).toBe("20")
        expect(telaDaCabine(ts, null)).toBe("10")
        expect(telaDaCabine([T2(20, 1920)], null)).toBeNull()
    })
    it("1, 2 e 3 monitores, com x negativo e escala diferente: a cabine e a tela que tem o centro da janela", () => {
        const M = (id: number, x: number, y: number, w: number, h: number) => ({ id, internal: false, bounds: { x, y, width: w, height: h } })
        expect(telaDaCabine([M(1, 0, 0, 1920, 1080)], { x: 960, y: 516 })).toBe("1")
        const dois = [M(1, -1920, 0, 1920, 1080), M(2, 0, 0, 1920, 1080)]
        expect(telaDaCabine(dois, { x: -960, y: 500 })).toBe("1")
        expect(telaDaCabine(dois, { x: 960, y: 500 })).toBe("2")
        // 3 monitores como na cabine real: retrato a esquerda (x -1080), principal no meio, retrato a direita; a tela [0] NAO e a da cabine
        const tres = [M(7, -1080, -581, 1080, 1920), M(8, 0, 0, 1920, 1080), M(9, 1920, -581, 1080, 1920)]
        expect(telaDaCabine(tres, { x: 960, y: 516 })).toBe("8")
        expect(telaDaCabine(tres, { x: -540, y: 300 })).toBe("7")
        expect(telaDaCabine(tres, { x: 2400, y: 300 })).toBe("9")
        // escala 150%: bounds em pixels logicos (DIP), o centro da janela tambem
        expect(telaDaCabine([M(1, 0, 0, 1280, 720), M(2, 1280, 0, 1920, 1080)], { x: 640, y: 360 })).toBe("1")
    })
    it("centro fora de todas as telas: vale a mais perto (nunca nenhuma, em silencio)", () => {
        const tres = [{ id: 7, internal: false, bounds: { x: -1080, y: 0, width: 1080, height: 1920 } }, { id: 8, internal: false, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }]
        expect(telaDaCabine(tres, { x: 960, y: 516 })).toBe("7")
        expect(telaDaCabine(tres, { x: 1500, y: 516 })).toBe("8")
    })
    it("recusa a tela da cabine, dizendo por que", () => {
        const r: any = podeMover("tel", saidas, ts[0], ts, "10")
        expect(r.ok).toBe(false)
        expect(r.motivo).toMatch(/cabine/)
    })
    it("recusa a tela ja ocupada por outra saida ligada; saida desligada nao ocupa", () => {
        expect((podeMover("tel", saidas, ts[2], ts, "10") as any).motivo).toMatch(/Retorno/)
        expect(podeMover("tel", { ...saidas, ret: saidas.off }, ts[2], ts, "10")).toEqual({ ok: true })
    })
    it("recusa saida so de rede e saida com posicao travada", () => {
        expect((podeMover("ndi", saidas, ts[2], ts, "10") as any).motivo).toMatch(/só de rede/)
        expect((podeMover("trav", saidas, ts[2], ts, "10") as any).motivo).toMatch(/travada/)
    })
    it("recusa mover para onde ja esta; aceita tela livre", () => {
        expect(podeMover("tel", saidas, ts[1], ts, "10").ok).toBe(false)
        expect(podeMover("tel", { tel: saidas.tel }, ts[2], ts, "10")).toEqual({ ok: true })
    })
})

describe("estado da saida (vermelho so com conteudo no ar)", () => {
    it("desligada = sem ponto; habilitada vazia = verde mesmo com a janela ligada; so conteudo + janela = vermelho", () => {
        expect(estadoDaSaida({ enabled: false }, true)).toBe("")
        expect(estadoDaSaida({ enabled: true, out: {} }, true)).toBe("ligada")
        expect(estadoDaSaida({ enabled: true, out: { slide: null, background: null, overlays: [] } }, true)).toBe("ligada")
        expect(estadoDaSaida({ enabled: true, out: { slide: { id: "x" } } }, false)).toBe("ligada")
        expect(estadoDaSaida({ enabled: true, out: { slide: { id: "x" } } }, true)).toBe("ar")
        expect(estadoDaSaida({ enabled: true, out: { overlays: ["o"] } }, true)).toBe("ar")
    })
})
