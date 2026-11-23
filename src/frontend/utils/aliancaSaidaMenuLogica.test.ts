import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { criarMaquinaDaSaida, derivarEstado, ESPERA_STORE_MS, INERTE_MS, itemDesabilitado, JANELA_MS, ROTULOS, rotuloCurtoDoTelao, temSaidaHabilitada, TRAVA_MS, type EntradaSaida, type EstadoSaida } from "./aliancaSaidaMenuLogica"

let mundo: EntradaSaida
const chamadas = { ligar: 0, desligar: 0, config: 0, fechar: 0, erro: [] as any[], estados: [] as EstadoSaida[] }
const nova = () =>
    criarMaquinaDaSaida({
        ligar: () => chamadas.ligar++,
        desligar: () => chamadas.desligar++,
        abrirConfig: () => chamadas.config++,
        fecharMenu: () => chamadas.fechar++,
        ler: () => ({ ...mundo }),
        aoMudar: (s) => chamadas.estados.push(s),
        erro: (...a) => chamadas.erro.push(a)
    })
const aberta = (m: Partial<EntradaSaida> = {}) => {
    mundo = { outputDisplay: false, semTelaFisica: false, temSaida: true, noAr: false, desenho: false, ...m }
    const x = nova()
    x.abrir()
    return x
}

beforeEach(() => {
    vi.useFakeTimers()
    chamadas.ligar = chamadas.desligar = chamadas.config = chamadas.fechar = 0
    chamadas.erro = []
    chamadas.estados = []
})
afterEach(() => vi.useRealTimers())

describe("estado ao abrir (derivado)", () => {
    it("semTela sem tela fisica", () => expect(aberta({ semTelaFisica: true }).estado).toBe("semTela"))
    it("semTela com tela mas sem saida habilitada", () => expect(aberta({ temSaida: false }).estado).toBe("semTela"))
    it("desligado, ligado", () => {
        expect(aberta().estado).toBe("desligado")
        expect(aberta({ outputDisplay: true }).estado).toBe("ligado")
    })
    it("desligado com algo no ar ou com desenho: nao liga", () => {
        const a = aberta({ noAr: true })
        expect(a.estado).toBe("desligadoNoAr")
        a.cliqueNoItem()
        expect(chamadas.ligar).toBe(0)
        const b = aberta({ desenho: true })
        expect(b.estado).toBe("desligadoDesenho")
        b.cliqueNoItem()
        expect(chamadas.ligar).toBe(0)
        expect(ROTULOS.desligadoNoAr).toBe("Há conteúdo carregado. Ligue o telão pelo Culto.")
        expect(ROTULOS.desligadoDesenho).toBe("Há desenho ativo. Ligue o telão pelo Culto.")
        expect(itemDesabilitado("desligadoNoAr")).toBe(true)
    })
    it("semTela: clique abre as configuracoes e fecha o menu", () => {
        const m = aberta({ semTelaFisica: true })
        m.cliqueNoItem()
        expect(chamadas.config).toBe(1)
        expect(chamadas.fechar).toBe(1)
        expect(ROTULOS.semTela).toBe("Sem tela de saída: configurar")
    })
})

describe("ligar", () => {
    it("liga com state true, vai a ligando, e a resposta leva a ligado", () => {
        const m = aberta()
        m.cliqueNoItem()
        expect(chamadas.ligar).toBe(1)
        expect(m.estado).toBe("ligando")
        mundo.outputDisplay = true
        m.mundoMudou()
        expect(m.estado).toBe("ligado")
    })
    it("sem resposta em ESPERA_STORE_MS vai a semResposta (e NAO volta a desligado), com console.error", () => {
        const m = aberta()
        m.cliqueNoItem()
        vi.advanceTimersByTime(ESPERA_STORE_MS - 1)
        expect(m.estado).toBe("ligando")
        vi.advanceTimersByTime(1)
        expect(m.estado).toBe("semResposta")
        expect(chamadas.erro).toHaveLength(1)
        expect(String(chamadas.erro[0][0])).toContain("o telao nao respondeu")
        vi.advanceTimersByTime(60000)
        expect(m.estado).toBe("semResposta")
        m.cliqueNoItem()
        expect(chamadas.ligar).toBe(1)
    })
    it("em semResposta, outputDisplay virar true leva a ligado na hora", () => {
        const m = aberta()
        m.cliqueNoItem()
        vi.advanceTimersByTime(ESPERA_STORE_MS)
        mundo.outputDisplay = true
        m.mundoMudou()
        expect(m.estado).toBe("ligado")
    })
    it("fechar e reabrir em semResposta deriva", () => {
        const m = aberta()
        m.cliqueNoItem()
        vi.advanceTimersByTime(ESPERA_STORE_MS)
        m.cancelar()
        expect(m.estado).toBe("desligado")
    })
})

describe("desligar", () => {
    it("ligado + clique so pergunta; Desligar mesmo e inerte por INERTE_MS", () => {
        const m = aberta({ outputDisplay: true })
        m.cliqueNoItem()
        expect(m.estado).toBe("perguntando")
        expect(chamadas.desligar).toBe(0)
        for (const t of [0, 300, 600, 900]) {
            vi.advanceTimersByTime(t === 0 ? 0 : 300)
            m.cliqueDesligarMesmo()
        }
        expect(chamadas.desligar).toBe(0)
        expect(m.estado).toBe("perguntando")
        vi.advanceTimersByTime(100)
        expect(m.estado).toBe("armado")
        m.cliqueDesligarMesmo()
        expect(chamadas.desligar).toBe(1)
        expect(m.estado).toBe("desligando")
    })
    it("depois de desligar: trava de 800 ms e volta derivado", () => {
        const m = aberta({ outputDisplay: true })
        m.cliqueNoItem()
        vi.advanceTimersByTime(INERTE_MS)
        m.cliqueDesligarMesmo()
        mundo.outputDisplay = false
        m.mundoMudou()
        expect(m.estado).toBe("trava")
        m.cliqueNoItem()
        expect(chamadas.ligar).toBe(0)
        vi.advanceTimersByTime(TRAVA_MS - 1)
        expect(m.estado).toBe("trava")
        vi.advanceTimersByTime(1)
        expect(m.estado).toBe("desligado")
    })
    it("desligando sem mudanca vai a semResposta", () => {
        const m = aberta({ outputDisplay: true })
        m.cliqueNoItem()
        vi.advanceTimersByTime(INERTE_MS)
        m.cliqueDesligarMesmo()
        vi.advanceTimersByTime(ESPERA_STORE_MS)
        expect(m.estado).toBe("semResposta")
    })
    it("expira JANELA_MS depois de armar", () => {
        const m = aberta({ outputDisplay: true })
        m.cliqueNoItem()
        vi.advanceTimersByTime(INERTE_MS)
        expect(m.estado).toBe("armado")
        vi.advanceTimersByTime(JANELA_MS - 1)
        expect(m.estado).toBe("armado")
        vi.advanceTimersByTime(1)
        expect(m.estado).toBe("ligado")
        expect(chamadas.desligar).toBe(0)
    })
    it("fechar, Esc e troca de modo cancelam (perguntando e armado)", () => {
        for (const avanco of [0, INERTE_MS]) {
            const m = aberta({ outputDisplay: true })
            m.cliqueNoItem()
            vi.advanceTimersByTime(avanco)
            m.cancelar()
            expect(m.estado).toBe("ligado")
            vi.advanceTimersByTime(60000)
            m.cliqueDesligarMesmo()
            expect(chamadas.desligar).toBe(0)
        }
    })
    it("clique em Desligar mesmo fora de armado nao faz nada", () => {
        const m = aberta({ outputDisplay: true })
        m.cliqueDesligarMesmo()
        expect(chamadas.desligar).toBe(0)
    })
    it("so mouse: a maquina nao tem caminho de teclado (Enter e Espaco sao ignorados pelo componente)", () => {
        const m = aberta({ outputDisplay: true }) as any
        expect(m.tecla).toBeUndefined()
    })
    it("destruir limpa os timers", () => {
        const m = aberta({ outputDisplay: true })
        m.cliqueNoItem()
        m.destruir()
        vi.advanceTimersByTime(60000)
        expect(m.estado).toBe("perguntando")
    })
})

describe("temSaidaHabilitada (a condicao de toggleOutputs)", () => {
    it("ao menos uma enabled === true", () => {
        expect(temSaidaHabilitada({ a: { enabled: true } })).toBe(true)
        expect(temSaidaHabilitada({ a: { enabled: false }, b: { enabled: true } })).toBe(true)
        expect(temSaidaHabilitada({ a: { enabled: false } })).toBe(false)
        expect(temSaidaHabilitada({ a: {} })).toBe(false)
        expect(temSaidaHabilitada({})).toBe(false)
        expect(temSaidaHabilitada(null)).toBe(false)
    })
    it("derivarEstado so por semTelaFisica ignoraria a saida habilitada: o teste de contraste", () => {
        expect(derivarEstado({ outputDisplay: false, semTelaFisica: false, temSaida: false, noAr: false, desenho: false })).toBe("semTela")
    })
})

describe("botao unico do telao (cabine 6, 23/nov): estado curto", () => {
    it("ligado = No ar (vermelho); ligado + congelado = Congelado (gelo); a pergunta de desligar segue mostrando o que esta no ar", () => {
        expect(rotuloCurtoDoTelao("ligado", false)).toEqual({ texto: "No ar", tom: "noAr" })
        expect(rotuloCurtoDoTelao("ligado", true)).toEqual({ texto: "Congelado", tom: "congelado" })
        expect(rotuloCurtoDoTelao("armado", true).tom).toBe("congelado")
        expect(rotuloCurtoDoTelao("perguntando", false).tom).toBe("noAr")
    })
    it("todo desligado e Desligado (apagado), mesmo congelado; transicoes e erro tem texto proprio", () => {
        for (const e of ["desligado", "desligadoNoAr", "desligadoDesenho", "trava"] as EstadoSaida[]) expect(rotuloCurtoDoTelao(e, true)).toEqual({ texto: "Desligado", tom: "desligado" })
        expect(rotuloCurtoDoTelao("ligando", false).texto).toBe("Ligando…")
        expect(rotuloCurtoDoTelao("desligando", false).texto).toBe("Desligando…")
        expect(rotuloCurtoDoTelao("semResposta", false).tom).toBe("erro")
        expect(rotuloCurtoDoTelao("semTela", false).texto).toBe("Sem tela")
    })
})
