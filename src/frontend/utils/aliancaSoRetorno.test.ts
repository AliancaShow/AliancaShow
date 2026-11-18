import { get } from "svelte/store"
import { beforeEach, describe, expect, it } from "vitest"
import { outputs, stageShows } from "../stores"
import { desligarSoRetorno, destinoDoEnvio, iniciarSoRetorno, ligarSoRetorno, saidaDeLeitura, semDesvio, soRetorno } from "./aliancaSoRetorno"

const base = () => ({
    telao: { enabled: true, active: true, name: "Telao", out: { slide: { id: "s", index: 3 }, background: { path: "v.mp4" } } },
    ret: { enabled: true, stageOutput: "L1", name: "Retorno", out: { slide: { id: "velho" }, overlays: ["o"] } }
})

beforeEach(() => {
    if (get(soRetorno)) desligarSoRetorno()
    outputs.set(base() as any)
    stageShows.set({ L1: { name: "Retorno", settings: { color: "#000" } } } as any)
})

describe("ligar / desligar (integracao com as stores)", () => {
    it("R1: ligar com o assinante de recuperacao montado NAO desfaz a troca de fonte", () => {
        const parar = iniciarSoRetorno()
        expect(ligarSoRetorno().ok).toBe(true)
        expect((get(stageShows) as any).L1.settings.output).toBe("ret")
        parar()
    })
    it("R3: o retorno e semeado com o slide do telao; o telao nao e tocado", () => {
        ligarSoRetorno()
        const o = get(outputs) as any
        expect(o.ret.out.slide).toEqual({ id: "s", index: 3 })
        expect(o.ret.out.overlays).toEqual([])
        expect(o.telao.out).toEqual({ slide: { id: "s", index: 3 }, background: { path: "v.mp4" } })
    })
    it("R5: desligar esvazia o out inteiro do retorno e devolve a fonte; o telao segue intacto", () => {
        ligarSoRetorno()
        ;(get(outputs) as any).ret.out.effects = ["x"]
        desligarSoRetorno()
        const o = get(outputs) as any
        expect(o.ret.out).toEqual({ slide: null, background: null, overlays: [], effects: [], transition: null })
        expect((get(stageShows) as any).L1.settings.output).toBeUndefined()
        expect(o.telao.out.slide).toEqual({ id: "s", index: 3 })
    })
    it("destino: so envio, so ligado, nunca dentro de semDesvio; leitura das setas vai ao retorno", () => {
        expect(destinoDoEnvio({ id: "x" })).toBe(null)
        ligarSoRetorno()
        expect(destinoDoEnvio({ id: "x" })).toEqual(["ret"])
        expect(destinoDoEnvio(null)).toBe(null)
        expect(semDesvio(() => destinoDoEnvio({ id: "x" }))).toBe(null)
        expect(saidaDeLeitura("telao")).toBe("ret")
    })
    it("R4: o retorno some com o modo ligado: desliga sozinho e avisa", () => {
        let aviso = ""
        const parar = iniciarSoRetorno((m) => (aviso = m))
        ligarSoRetorno()
        outputs.update((a: any) => {
            a.ret.enabled = false
            return a
        })
        expect(get(soRetorno)).toBe(false)
        expect(aviso).toContain("retorno")
        expect((get(stageShows) as any).L1.settings.output).toBeUndefined()
        parar()
    })
    it("sem retorno nao liga, com o motivo", () => {
        outputs.set({ telao: base().telao } as any)
        const r = ligarSoRetorno()
        expect(r.ok).toBe(false)
        expect(r.motivo).toContain("Nenhum monitor")
    })
})
