import { describe, expect, it } from "vitest"
import { comConferido, hashDaMusica, MAX_CULTOS_CONFERIDOS, precisaConferir, type Conferidos } from "./aliancaConferirLogica"

describe("hashDaMusica", () => {
    it("com letra: muda quando a letra muda", () => {
        expect(hashDaMusica({ letra: "a\nb" })).toBe(hashDaMusica({ letra: "a\nb", show_id: "x" }))
        expect(hashDaMusica({ letra: "a\nb" })).not.toBe(hashDaMusica({ letra: "a\nc" }))
    })
    it("sem letra: vale o show da biblioteca", () => {
        expect(hashDaMusica({ show_id: "oceanos" })).toBe("show:oceanos")
        expect(hashDaMusica({ letra: null, show_id: null })).toBe("show:")
        expect(hashDaMusica(null)).toBe("")
    })
})

describe("precisaConferir", () => {
    const m = { letra: "oi", show_id: null }
    it("nasce pedindo; depois de conferir nao pede mais; letra nova pede de novo", () => {
        expect(precisaConferir({}, "ev", "r1", m)).toBe(true)
        const c = comConferido({}, "ev", "r1", hashDaMusica(m), 1)
        expect(precisaConferir(c, "ev", "r1", m)).toBe(false)
        expect(precisaConferir(c, "ev", "r1", { letra: "oi 2" })).toBe(true)
    })
    it("outro culto ou outra linha continuam pedindo", () => {
        const c = comConferido({}, "ev", "r1", hashDaMusica(m), 1)
        expect(precisaConferir(c, "ev2", "r1", m)).toBe(true)
        expect(precisaConferir(c, "ev", "r2", m)).toBe(true)
    })
    it("linha que nao existe no roteiro nao pede", () => {
        expect(precisaConferir({}, "ev", "r1", null)).toBe(false)
    })
})

describe("comConferido: poda", () => {
    it("guarda so os cultos mais recentes", () => {
        let c: Conferidos = {}
        for (let i = 0; i < MAX_CULTOS_CONFERIDOS + 3; i++) c = comConferido(c, `ev${i}`, "r", "h", 100 + i)
        expect(Object.keys(c)).toHaveLength(MAX_CULTOS_CONFERIDOS)
        expect(c.ev0).toBeUndefined()
        expect(c[`ev${MAX_CULTOS_CONFERIDOS + 2}`]).toBeDefined()
    })
    it("poda marcas cuja linha saiu do roteiro", () => {
        let c = comConferido({}, "ev", "r1", "h1", 1)
        c = comConferido(c, "ev", "r2", "h2", 2)
        c = comConferido(c, "ev", "r3", "h3", 3, new Set(["r2", "r3"]))
        expect(Object.keys(c.ev.marcas).sort()).toEqual(["r2", "r3"])
    })
    it("nao muda o objeto de entrada", () => {
        const c: Conferidos = { ev: { em: 1, marcas: { r1: "h" } } }
        comConferido(c, "ev", "r2", "h2", 2)
        expect(c.ev.marcas).toEqual({ r1: "h" })
    })
})
