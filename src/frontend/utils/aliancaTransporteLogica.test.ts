import { describe, expect, it } from "vitest"
import { faixaAberta, fracao, limiteBusca, prenderBusca, restante, tempoCurto, timersNaFaixa, valorNaBarra } from "./aliancaTransporteLogica"

describe("tempoCurto", () => {
    it.each([
        [0, "0:00"],
        [5.9, "0:05"],
        [65, "1:05"],
        [3600, "1:00:00"],
        [3725, "1:02:05"],
        [-3, "0:00"],
        [NaN, "0:00"],
        [Infinity, "0:00"]
    ])("%s -> %s", (s, esperado) => expect(tempoCurto(s as number)).toBe(esperado))
})

describe("restante e fracao", () => {
    it("sem duracao nao inventa", () => {
        expect(restante(0, 10)).toBe(0)
        expect(fracao(10, 0)).toBe(0)
    })
    it("nunca negativo nem acima de 1", () => {
        expect(restante(60, 90)).toBe(0)
        expect(fracao(90, 60)).toBe(1)
        expect(fracao(-5, 60)).toBe(0)
    })
    it("conta normal", () => {
        expect(restante(60, 20.7)).toBe(40)
        expect(fracao(30, 60)).toBe(0.5)
    })
})

describe("valorNaBarra", () => {
    it("meio, pontas e fora", () => {
        expect(valorNaBarra(150, 100, 100, 60)).toBe(30)
        expect(valorNaBarra(50, 100, 100, 60)).toBe(0)
        expect(valorNaBarra(500, 100, 100, 60)).toBe(60)
    })
    it("largura ou max zero = 0", () => {
        expect(valorNaBarra(150, 100, 0, 60)).toBe(0)
        expect(valorNaBarra(150, 100, 100, 0)).toBe(0)
    })
})

describe("timersNaFaixa", () => {
    const timers = { a: { type: "counter", name: "Pregacao" }, b: { type: "clock", name: "Hora" }, c: { type: "sirvo_live", name: "Bloco" }, d: { type: "counter", name: "Abertura" }, e: { type: "counter", name: "Parado" } }
    it("so os ativos, so counter/pco_live, sem o contador do bloco do Sirvo, por nome", () => {
        const r = timersNaFaixa(timers, [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }])
        expect(r.map((x) => x.id)).toEqual(["d", "a"])
    })
    it("nada ativo = nada", () => expect(timersNaFaixa(timers, [])).toEqual([]))
})

describe("faixaAberta", () => {
    it("fechada sem nada", () => expect(faixaAberta({ video: false, audio: false, timers: 0, spotify: false })).toBe(false))
    it.each([{ video: true }, { audio: true }, { timers: 1 }, { spotify: true }])("abre com %o", (p) => expect(faixaAberta({ video: false, audio: false, timers: 0, spotify: false, ...p })).toBe(true))
})

// Guarda de TEXTO (o DOM so existe no app): a faixa e a linha ficam fora da trava de clique repetido e fora da tela No ar (nao e camada).
import { readFileSync } from "fs"
import { join } from "path"
const ler = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n")
describe("faixa de transporte (guarda de texto)", () => {
    it("a faixa e a linha levam data-sem-trava", () => {
        expect(ler("components/main/AliancaTransporte.svelte")).toMatch(/class="faixa"[^>]*data-sem-trava/)
        expect(ler("components/main/AliancaTransporteLinha.svelte")).toMatch(/class="linha"[^>]*data-sem-trava/)
    })
    it("mora no No ar, entre a tela e as outras telas, e nao e posicionada sobre ela", () => {
        expect(ler("components/main/AliancaNoAr.svelte")).toMatch(/<AliancaCamadas \/>\s*<\/div>\s*<AliancaTransporte \/>\s*<AliancaOutrasTelas/)
        expect(ler("components/main/AliancaTransporte.svelte")).not.toMatch(/position:\s*(absolute|fixed)/)
    })
    it("nenhuma tecla nova: a faixa nao escuta o teclado", () => {
        for (const a of ["AliancaTransporte", "AliancaTransporteLinha", "AliancaBarra"]) expect(ler(`components/main/${a}.svelte`)).not.toMatch(/on:keydown|svelte:window|svelte:body/)
    })
})

describe("busca nunca chega ao fim (revisao da fatia 7, achado 1)", () => {
    it("o limite e o fim menos 0,25 s", () => {
        expect(limiteBusca(10)).toBe(9.75)
        expect(limiteBusca(10, 0)).toBe(9.75)
    })
    it("com `toTime` proprio, vale o fim do trecho", () => {
        expect(limiteBusca(10, 6)).toBe(5.75)
        expect(limiteBusca(10, 40)).toBe(9.75) // toTime alem da duracao: vale a duracao
    })
    it("sem duracao nao ha para onde buscar", () => {
        expect(limiteBusca(0)).toBe(0)
        expect(limiteBusca(NaN)).toBe(0)
    })
    it("arrastar alem da ponta direita prende antes do fim; o meio passa como veio", () => {
        expect(prenderBusca(10, 10)).toBe(9.75)
        expect(prenderBusca(99, 10, 6)).toBe(5.75)
        expect(prenderBusca(4, 10)).toBe(4)
        expect(prenderBusca(-3, 10)).toBe(0)
    })
    it("clipe curtissimo nao fica negativo", () => {
        expect(prenderBusca(0.2, 0.1)).toBe(0)
    })
})
