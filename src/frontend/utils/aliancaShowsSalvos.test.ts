import { describe, expect, it } from "vitest"
import { RastreioDeSalvos } from "./aliancaShowsSalvos"

const c = (o: { [id: string]: number }) => Object.fromEntries(Object.entries(o).map(([id, m]) => [id, { timestamps: { modified: m } }]))

describe("rastreio de shows editados e não salvos", () => {
    it("show que veio do disco só é 'não salvo' depois que o modified sobe", () => {
        const r = new RastreioDeSalvos()
        r.observar(c({ a: 100 }), () => true)
        expect(r.naoSalvo("a", c({ a: 100 }))).toBe(false)
        expect(r.naoSalvo("a", c({ a: 200 }))).toBe(true)
    })

    it("depois de salvar, volta a ser salvo; edição durante o envio continua não salva", () => {
        const r = new RastreioDeSalvos()
        r.observar(c({ a: 100 }), () => true)
        r.salvando(c({ a: 200 }))
        // editou de novo enquanto gravava
        expect(r.naoSalvo("a", c({ a: 300 }))).toBe(true)
        r.salvo()
        expect(r.naoSalvo("a", c({ a: 200 }))).toBe(false)
        expect(r.naoSalvo("a", c({ a: 300 }))).toBe(true)
    })

    it("sem confirmação do main (salvo() não chamado) continua não salvo", () => {
        const r = new RastreioDeSalvos()
        r.observar(c({ a: 100 }), () => true)
        r.salvando(c({ a: 200 }))
        expect(r.naoSalvo("a", c({ a: 200 }))).toBe(true)
    })

    it("show criado nesta sessão (não veio do disco) é não salvo até gravar", () => {
        const r = new RastreioDeSalvos()
        r.observar(c({ n: 500 }), () => false)
        expect(r.naoSalvo("n", c({ n: 500 }))).toBe(true)
        r.salvando(c({ n: 500 }))
        r.salvo()
        expect(r.naoSalvo("n", c({ n: 500 }))).toBe(false)
    })

    it("show que nunca foi visto ou saiu do cache não é não salvo", () => {
        const r = new RastreioDeSalvos()
        expect(r.naoSalvo("x", c({ x: 5 }))).toBe(false)
        r.observar(c({ a: 1 }), () => true)
        r.observar({}, () => true)
        expect(r.naoSalvo("a", c({ a: 9 }))).toBe(false)
    })
})
