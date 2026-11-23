import { describe, expect, it } from "vitest"
import { gestosDoOperador, precisaEscolherMonitor, registroDaSaida, registrosMudados, textoDoMonitor, trocaDoStoreInteiro } from "./aliancaMonitorVigiaLogica"

const led = { name: "Painel LED", screen: null, bounds: { x: 1920, y: 0, width: 896, height: 320 }, alwaysOnTop: true }
const retorno = { name: "Retorno", screen: "3010161637", bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
const ndi = { name: "NDI", invisible: true, screen: null, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }

describe("gestosDoOperador", () => {
    it("carga inicial: nunca carimba (o LED antigo estava em cima do retorno)", () => {
        expect(gestosDoOperador(null, { led, retorno })).toEqual({ peloScreen: [], pelaJanela: [] })
    })

    it("escolheu a tela no mapa (screen mudou): carimba pelo screen", () => {
        expect(gestosDoOperador({ retorno }, { retorno: { ...retorno, screen: "662987242" } })).toEqual({ peloScreen: ["retorno"], pelaJanela: [] })
    })

    it("valores a mao (screen apagado, bounds mudou): carimba pela janela", () => {
        expect(gestosDoOperador({ led }, { led: { ...led, bounds: { ...led.bounds, x: 3840 } } })).toEqual({ peloScreen: [], pelaJanela: ["led"] })
        expect(gestosDoOperador({ retorno }, { retorno: { ...retorno, screen: null } })).toEqual({ peloScreen: [], pelaJanela: ["retorno"] })
    })

    it("so o carimbo mudou (o proprio vigia escreveu): nada", () => {
        expect(gestosDoOperador({ led }, { led: { ...led, aliancaMonitor: { id: "1", nome: "X", dx: 0, dy: 0 } } })).toEqual({ peloScreen: [], pelaJanela: [] })
    })

    it("saida so de rede e saida nova: nada", () => {
        expect(gestosDoOperador({ ndi }, { ndi: { ...ndi, bounds: { ...ndi.bounds, width: 1280 } } })).toEqual({ peloScreen: [], pelaJanela: [] })
        expect(gestosDoOperador({}, { led })).toEqual({ peloScreen: [], pelaJanela: [] })
    })

    it("nome ou outro campo mudou: nada", () => {
        expect(gestosDoOperador({ led }, { led: { ...led, name: "LED" } })).toEqual({ peloScreen: [], pelaJanela: [] })
    })
})

describe("trocaDoStoreInteiro", () => {
    it("outro perfil (ids quase todos outros): sim; uma saida nova ou apagada: nao", () => {
        expect(trocaDoStoreInteiro({ a: 1, b: 1, c: 1 }, { x: 1, y: 1, z: 1 })).toBe(true)
        expect(trocaDoStoreInteiro({ a: 1, b: 1, c: 1 }, { a: 1, b: 1, c: 1, d: 1 })).toBe(false)
        expect(trocaDoStoreInteiro({ a: 1, b: 1 }, { a: 1 })).toBe(false)
    })
})

describe("precisaEscolherMonitor", () => {
    it("so janela habilitada sem screen e sem carimbo", () => {
        expect(precisaEscolherMonitor(led)).toBe(true)
        expect(precisaEscolherMonitor({ ...led, aliancaMonitor: { id: "1", nome: "", dx: 0, dy: 0 } })).toBe(false)
        expect(precisaEscolherMonitor(retorno)).toBe(false)
        expect(precisaEscolherMonitor(ndi)).toBe(false)
        expect(precisaEscolherMonitor({ ...led, enabled: false })).toBe(false)
    })
})

describe("registro", () => {
    it("leva so o que o processo principal usa", () => {
        expect(registroDaSaida("led", led)).toEqual({ outputId: "led", nome: "Painel LED", screen: null, aliancaMonitor: null, bounds: { x: 1920, y: 0, width: 896, height: 320 }, invisible: false, enabled: true, alwaysOnTop: true })
    })
    it("mudados: so quem mudou campo relevante; tudo na carga inicial", () => {
        expect(registrosMudados(null, { led, retorno })).toEqual(["led", "retorno"])
        expect(registrosMudados({ led, retorno }, { led: { ...led, name: "LED" }, retorno })).toEqual(["led"])
        expect(registrosMudados({ led, retorno }, { led: { ...led, out: { slide: 1 } } as any, retorno })).toEqual([])
    })
})

describe("textoDoMonitor", () => {
    it("desconectado e erro fixo; voltou e info; desconhecido e null", () => {
        expect(textoDoMonitor("desconectado", "Retorno", "T27C310")).toMatchObject({ nivel: "erro", fixo: true })
        expect(textoDoMonitor("voltou", "Retorno", "T27C310")).toMatchObject({ nivel: "info", fixo: false })
        expect(textoDoMonitor("xyz", "Retorno", "T27C310")).toBeNull()
    })
})
