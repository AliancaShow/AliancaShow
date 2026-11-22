import { describe, expect, it } from "vitest"
import { VigiaDeSaidas, assinaturaDasSaidas } from "./aliancaSaidasSalvas"

const led = { name: "Telão", enabled: true, screen: null, bounds: { x: 1920, y: 0, width: 896, height: 320 }, boundsLocked: true, style: "led" }

describe("configuração das saídas marca 'não salvo' (cabine 6, fatia 1a)", () => {
    it("a primeira leitura é a base: o que veio do disco não é alteração", () => {
        const v = new VigiaDeSaidas()
        expect(v.mudou({ a: led })).toBe(false)
        expect(v.mudou({ a: { ...led } })).toBe(false)
    })

    it("mudar posição, tamanho, monitor, cadeado, recorte ou estilo é alteração", () => {
        const v = new VigiaDeSaidas()
        v.mudou({ a: led })
        expect(v.mudou({ a: { ...led, bounds: { ...led.bounds, width: 1024 } } })).toBe(true)
        expect(v.mudou({ a: { ...led, bounds: { ...led.bounds, width: 1024 }, screen: "2" } })).toBe(true)
        expect(v.mudou({ a: { ...led, bounds: { ...led.bounds, width: 1024 }, screen: "2", boundsLocked: false } })).toBe(true)
        expect(v.mudou({ a: { ...led, bounds: { ...led.bounds, width: 1024 }, screen: "2", boundsLocked: false, cropping: { right: 128 } } })).toBe(true)
        expect(v.mudou({ a: { ...led, bounds: { ...led.bounds, width: 1024 }, screen: "2", boundsLocked: false, cropping: { right: 128 }, style: "x" } })).toBe(true)
    })

    it("criar ou apagar uma saída é alteração", () => {
        const v = new VigiaDeSaidas()
        v.mudou({ a: led })
        expect(v.mudou({ a: led, b: { ...led, name: "Retorno" } })).toBe(true)
        expect(v.mudou({ a: led })).toBe(true)
    })

    it("o estado ao vivo (slide no ar, ligar/desligar, transmitindo) não é alteração", () => {
        const v = new VigiaDeSaidas()
        v.mudou({ a: led })
        expect(v.mudou({ a: { ...led, out: { slide: { id: "s1", index: 3 } } } })).toBe(false)
        expect(v.mudou({ a: { ...led, out: { slide: { id: "s1", index: 4 } }, active: true } })).toBe(false)
        expect(v.mudou({ a: { ...led, active: false, rtmpData: { streaming: true }, webrtcData: { streaming: true } } })).toBe(false)
    })

    it("a ordem das chaves não conta", () => {
        expect(assinaturaDasSaidas({ b: { bounds: { y: 0, x: 1 } }, a: { name: "A" } })).toBe(assinaturaDasSaidas({ a: { name: "A" }, b: { bounds: { x: 1, y: 0 } } }))
    })

    it("sem saídas não compara", () => {
        expect(assinaturaDasSaidas(null)).toBe(null)
        expect(new VigiaDeSaidas().mudou(undefined)).toBe(false)
    })
})
