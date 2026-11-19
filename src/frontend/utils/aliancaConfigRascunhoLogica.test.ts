// Configuracoes (C4): "N alteracoes nao salvas" e Descartar. Parte pura.
import { describe, expect, it } from "vitest"
import { contarMudancas, lojasMudadas, mudancasDaLoja, restaurarSaidas, textoDeAlteracoes, vistaDasSaidas } from "./aliancaConfigRascunhoLogica"

describe("mudancasDaLoja", () => {
    it("igual = nada mudou", () => {
        expect(mudancasDaLoja({ a: 1 }, { a: 1 })).toEqual([])
        expect(mudancasDaLoja("pt", "pt")).toEqual([])
    })
    it("objeto simples conta chave por chave, inclusive entrada nova e apagada", () => {
        expect(mudancasDaLoja({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 }).sort()).toEqual(["b", "c"])
        expect(mudancasDaLoja({ a: 1, b: 2 }, { a: 1 })).toEqual(["b"])
    })
    it("valor solto ou lista conta 1", () => {
        expect(mudancasDaLoja("pt", "en")).toHaveLength(1)
        expect(mudancasDaLoja([1, 2], [1, 2, 3])).toHaveLength(1)
    })
    it("undefined e null sao a mesma coisa (nao e alteracao)", () => {
        expect(mudancasDaLoja({ a: undefined }, { a: null })).toEqual([])
    })
})

describe("contagem", () => {
    it("soma as lojas e so as lojas da foto", () => {
        const foto = { language: "pt", styles: { x: { n: 1 }, y: { n: 1 } }, ports: { remote: 1 } }
        const agora = { language: "en", styles: { x: { n: 2 }, y: { n: 1 }, z: { n: 9 } }, ports: { remote: 1 }, outraLoja: 1 }
        expect(contarMudancas(foto, agora)).toBe(3) // language, styles.x, styles.z
        expect(lojasMudadas(foto, agora).sort()).toEqual(["language", "styles"])
    })
    it("sem diferenca = zero", () => {
        const f = { a: { b: 1 } }
        expect(contarMudancas(f, JSON.parse(JSON.stringify(f)))).toBe(0)
    })
})

describe("texto do cabecalho", () => {
    it("some com zero, singular e plural", () => {
        expect(textoDeAlteracoes(0)).toBe("")
        expect(textoDeAlteracoes(1)).toBe("1 alteração não salva")
        expect(textoDeAlteracoes(2)).toBe("2 alterações não salvas")
    })
})

describe("vista das saidas", () => {
    it("so guarda as chaves que o Descartar sabe desfazer; estado vivo e janela ficam de fora", () => {
        const v = vistaDasSaidas({ default: { name: "Telão", color: "#f00", style: "s1", enabled: true, out: { slide: 1 }, bounds: { x: 0 }, ndi: true } })
        expect(v).toEqual({ default: { name: "Telão", color: "#f00", style: "s1" } })
    })
    it("mudar o estado vivo nao conta como alteracao", () => {
        const antes = vistaDasSaidas({ a: { name: "A", out: { slide: 1 } } })
        const depois = vistaDasSaidas({ a: { name: "A", out: { slide: 2 } } })
        expect(contarMudancas({ outputs: antes }, { outputs: depois })).toBe(0)
    })
    it("renomear conta 1", () => {
        const antes = vistaDasSaidas({ a: { name: "A" } })
        const depois = vistaDasSaidas({ a: { name: "B" } })
        expect(contarMudancas({ outputs: antes }, { outputs: depois })).toBe(1)
    })
})

describe("vista das saidas (C4, correcao da revisao)", () => {
    it("cobre alwaysOnTop, ndiData, rtmpData e webrtcData; o estado vivo `streaming` fica fora", () => {
        const v = vistaDasSaidas({ a: { name: "A", alwaysOnTop: false, ndiData: { name: "X" }, rtmpData: { fps: 30, destinations: [{ url: "u" }], streaming: true }, webrtcData: { url: "w", streaming: true } } })
        expect(v.a.alwaysOnTop).toBe(false)
        expect(v.a.ndiData).toEqual({ name: "X" })
        expect(v.a.rtmpData).toEqual({ fps: 30, destinations: [{ url: "u" }] })
        expect(v.a.webrtcData).toEqual({ url: "w" })
    })
    it("ligar/desligar (enabled, ndi, rtmp, blackmagic, invisible, transparent) e tela/limites nao entram", () => {
        const base = { a: { name: "A", enabled: true, ndi: false, invisible: false, bounds: { x: 0 }, screen: "1" } }
        const depois = { a: { name: "A", enabled: false, ndi: true, invisible: true, transparent: true, blackmagic: true, bounds: { x: 1920 }, screen: "2" } }
        expect(contarMudancas({ outputs: vistaDasSaidas(base) }, { outputs: vistaDasSaidas(depois) })).toBe(0)
    })
    it("saida criada ou apagada depois da foto NAO conta (vale na hora)", () => {
        const foto = { outputs: vistaDasSaidas({ a: { name: "A" } }) }
        expect(contarMudancas(foto, { outputs: vistaDasSaidas({ a: { name: "A" }, b: { name: "B" } }) })).toBe(0)
        expect(contarMudancas(foto, { outputs: vistaDasSaidas({}) })).toBe(0)
        expect(lojasMudadas(foto, { outputs: vistaDasSaidas({ a: { name: "A" }, b: { name: "B" } }) })).toEqual([])
    })
    it("mudar so a saida que existe nos dois lados conta, mesmo com outra criada", () => {
        const foto = { outputs: vistaDasSaidas({ a: { name: "A" } }) }
        expect(contarMudancas(foto, { outputs: vistaDasSaidas({ a: { name: "A2" }, b: { name: "B" } }) })).toBe(1)
    })
})

describe("restaurarSaidas", () => {
    it("devolve varias chaves, preserva `streaming` vivo, apaga chave que a foto nao tinha e ignora saida nova/apagada", () => {
        const foto = vistaDasSaidas({ a: { name: "A", alwaysOnTop: true, style: "s1", rtmpData: { fps: 30, destinations: [] } }, apagada: { name: "Velha" } })
        const vivo: any = { a: { name: "Z", alwaysOnTop: false, style: "s2", ndiData: { name: "novo" }, rtmpData: { fps: 60, destinations: [{ url: "x" }], streaming: true }, enabled: true }, nova: { name: "Nova" } }
        const ef = restaurarSaidas(vivo, foto)
        expect(vivo.a.name).toBe("A")
        expect(vivo.a.alwaysOnTop).toBe(true)
        expect(vivo.a.style).toBe("s1")
        expect(vivo.a.ndiData).toBeUndefined()
        expect(vivo.a.rtmpData).toEqual({ fps: 30, destinations: [], streaming: true })
        expect(vivo.a.enabled).toBe(true) // vale na hora: nao e tocado
        expect(vivo.nova).toEqual({ name: "Nova" }) // saida criada depois: segue existindo
        expect(vivo.apagada).toBeUndefined() // saida apagada depois: nao volta
        expect(ef.estilo).toBe(true)
        expect(ef.sempreNoTopo).toEqual([{ id: "a", valor: true }])
        // e depois de restaurar a contagem e zero
        expect(contarMudancas({ outputs: foto }, { outputs: vistaDasSaidas(vivo) })).toBe(0)
    })
})
