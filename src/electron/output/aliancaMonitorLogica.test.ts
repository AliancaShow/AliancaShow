import { describe, expect, it } from "vitest"
import { carimboDoMonitorInteiro, destinoDaSaida, monitorDaJanela, type Monitor } from "./aliancaMonitorLogica"

// a cabine de 23/nov: cabine | retorno | LED (e a ordem trocada que o Windows fez)
const CABINE: Monitor = { id: 3717067799, label: "E2241", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }
const RETORNO: Monitor = { id: 662987242, label: "T27C310", bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }
const LED: Monitor = { id: 2307139946, label: "NOVA HD CARD", bounds: { x: 3840, y: 0, width: 1024, height: 768 }, scaleFactor: 1 }
const ORDEM_A = [CABINE, RETORNO, LED]
// LED no meio, retorno a direita: mesmos ids, outras coordenadas
const ORDEM_B: Monitor[] = [CABINE, { ...LED, bounds: { ...LED.bounds, x: 1920 } }, { ...RETORNO, bounds: { ...RETORNO.bounds, x: 2944 } }]
// retorno desconectado: o Windows puxa o LED para o lugar dele
const SEM_RETORNO: Monitor[] = [CABINE, { ...LED, bounds: { ...LED.bounds, x: 1920 } }]

const ledComMonitor = { screen: null, bounds: { x: 3840, y: 0, width: 896, height: 320 }, aliancaMonitor: { id: "2307139946", nome: "NOVA HD CARD", dx: 0, dy: 0, escala: 1 } }

describe("destinoDaSaida", () => {
    it("screen salvo e ligado: o monitor inteiro, onde quer que ele esteja", () => {
        expect(destinoDaSaida({ screen: "662987242", bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }, ORDEM_A)).toMatchObject({ tipo: "monitor-inteiro", bounds: RETORNO.bounds })
        expect(destinoDaSaida({ screen: "662987242", bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }, ORDEM_B)).toMatchObject({ tipo: "monitor-inteiro", bounds: { x: 2944, y: 0, width: 1920, height: 1080 } })
    })

    it("screen salvo e ausente (o 3010161637 do Retorno): DESCONECTADO, nunca as coordenadas soltas", () => {
        expect(destinoDaSaida({ screen: "3010161637", bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }, ORDEM_A)).toEqual({ tipo: "desconectado", monitor: "3010161637" })
    })

    it("screen ausente com o carimbo do mesmo monitor: o aviso diz o NOME", () => {
        const s = { screen: "662987242", aliancaMonitor: { id: "662987242", nome: "T27C310", dx: 0, dy: 0 } }
        expect(destinoDaSaida(s, SEM_RETORNO)).toEqual({ tipo: "desconectado", monitor: "T27C310" })
    })

    it("tamanho proprio: segue o monitor quando o Windows troca a ordem", () => {
        expect(destinoDaSaida(ledComMonitor, ORDEM_A)).toMatchObject({ tipo: "dentro-do-monitor", bounds: { x: 3840, y: 0, width: 896, height: 320 } })
        expect(destinoDaSaida(ledComMonitor, ORDEM_B)).toMatchObject({ tipo: "dentro-do-monitor", bounds: { x: 1920, y: 0, width: 896, height: 320 } })
    })

    it("tamanho proprio com deslocamento dentro do monitor", () => {
        const s = { ...ledComMonitor, aliancaMonitor: { ...ledComMonitor.aliancaMonitor, dx: 64, dy: 10 } }
        expect(destinoDaSaida(s, ORDEM_B)).toMatchObject({ bounds: { x: 1984, y: 10, width: 896, height: 320 } })
    })

    it("tamanho proprio e o monitor desconectado: DESCONECTADO (nao vai para quem ficou no lugar)", () => {
        const retornoProprio = { screen: null, bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, aliancaMonitor: { id: "662987242", nome: "T27C310", dx: 0, dy: 0 } }
        expect(destinoDaSaida(retornoProprio, SEM_RETORNO)).toEqual({ tipo: "desconectado", monitor: "T27C310" })
    })

    it("o monitor volta com o mesmo id: volta para ele", () => {
        expect(destinoDaSaida(ledComMonitor, SEM_RETORNO)).toMatchObject({ tipo: "dentro-do-monitor", bounds: { x: 1920 } })
    })

    it("outro monitor no mesmo lugar (id diferente): DESCONECTADO", () => {
        const outro: Monitor = { id: 999, label: "OUTRO", bounds: { x: 3840, y: 0, width: 1024, height: 768 } }
        expect(destinoDaSaida(ledComMonitor, [CABINE, RETORNO, outro])).toEqual({ tipo: "desconectado", monitor: "NOVA HD CARD" })
    })

    it("screen manda sobre o carimbo (mapa grava screen; o carimbo pode estar velho)", () => {
        const s = { screen: "662987242", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, aliancaMonitor: { id: "2307139946", nome: "NOVA HD CARD", dx: 0, dy: 0 } }
        expect(destinoDaSaida(s, ORDEM_A)).toMatchObject({ tipo: "monitor-inteiro", bounds: RETORNO.bounds })
    })

    it("config antiga (sem screen e sem carimbo): 'antigo'", () => {
        expect(destinoDaSaida({ screen: null, bounds: { x: 1920, y: 0, width: 896, height: 320 } }, ORDEM_A)).toEqual({ tipo: "antigo" })
        expect(destinoDaSaida({ bounds: { x: 0, y: 0, width: 1, height: 1 }, aliancaMonitor: null }, ORDEM_A)).toEqual({ tipo: "antigo" })
        expect(destinoDaSaida({ screen: "", bounds: null }, ORDEM_A)).toEqual({ tipo: "antigo" })
    })

    it("escala diferente da gravada: marca escalaMudou", () => {
        const s = { ...ledComMonitor, aliancaMonitor: { ...ledComMonitor.aliancaMonitor, escala: 1.25 } }
        expect(destinoDaSaida(s, ORDEM_A)).toMatchObject({ escalaMudou: true })
        expect(destinoDaSaida(ledComMonitor, ORDEM_A)).toMatchObject({ escalaMudou: false })
    })

    it("coordenadas negativas (monitor a esquerda da cabine)", () => {
        const esq: Monitor = { id: 5, label: "ESQ", bounds: { x: -1920, y: -200, width: 1920, height: 1080 } }
        const s = { bounds: { x: 0, y: 0, width: 800, height: 600 }, aliancaMonitor: { id: "5", nome: "ESQ", dx: 100, dy: 50 } }
        expect(destinoDaSaida(s, [CABINE, esq])).toMatchObject({ bounds: { x: -1820, y: -150, width: 800, height: 600 } })
    })
})

describe("monitorDaJanela", () => {
    it("pelo canto superior esquerdo", () => {
        expect(monitorDaJanela({ x: 3840, y: 0, width: 896, height: 320 }, ORDEM_A)).toEqual({ id: "2307139946", nome: "NOVA HD CARD", dx: 0, dy: 0, escala: 1 })
        // uma janela larga que comeca no LED e vaza: e do LED (o canto), nao do centro
        expect(monitorDaJanela({ x: 1920, y: 0, width: 1920, height: 1080 }, ORDEM_B)).toMatchObject({ id: "2307139946", dx: 0 })
        expect(monitorDaJanela({ x: 1984, y: 10, width: 896, height: 320 }, ORDEM_B)).toMatchObject({ id: "2307139946", dx: 64, dy: 10 })
    })

    it("fora de qualquer monitor: null (nao carimba)", () => {
        expect(monitorDaJanela({ x: 5000, y: 0, width: 100, height: 100 }, ORDEM_A)).toBeNull()
        expect(monitorDaJanela({ x: -10, y: 0, width: 100, height: 100 }, ORDEM_A)).toBeNull()
    })

    it("borda direita do monitor e exclusiva", () => {
        expect(monitorDaJanela({ x: 1920, y: 0, width: 10, height: 10 }, ORDEM_A)).toMatchObject({ id: "662987242" })
    })
})

describe("carimboDoMonitorInteiro", () => {
    it("dx/dy 0, com nome e escala", () => {
        expect(carimboDoMonitorInteiro(RETORNO)).toEqual({ id: "662987242", nome: "T27C310", dx: 0, dy: 0, escala: 1 })
    })
})
