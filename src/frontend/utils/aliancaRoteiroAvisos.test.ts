import { describe, expect, it } from "vitest"
import { avisoDoRoteiro, contarAvisos, ehAvisoDeMusica } from "./aliancaRoteiroAvisos"

const aviso = (name: string) => ({ type: "section", name, data: { sirvoMusica: "r1", sirvoFalta: true } })

describe("avisos de música no roteiro", () => {
    it("rascunho vira só o nome, com a marca ✎", () => {
        const a = avisoDoRoteiro(aviso("✎ Rascunho: Tua alegria - Drops INA — revise em Novas do Sirvo"))
        expect(a).toMatchObject({ tipo: "rascunho", nome: "Tua alegria - Drops INA", marca: "✎" })
        expect(a?.dica).toContain("Novas do Sirvo")
    })
    it("faltas viram ⚠ com o nome", () => {
        expect(avisoDoRoteiro(aviso("⚠ Falta criar: primavera"))).toMatchObject({ tipo: "falta_criar", nome: "primavera" })
        expect(avisoDoRoteiro(aviso("⚠ Falta no PC: Tenhas tudo"))).toMatchObject({ tipo: "falta_pc", nome: "Tenhas tudo" })
    })
    it("bloco comum não é aviso", () => {
        expect(ehAvisoDeMusica({ type: "section", name: "Louvor", data: {} })).toBe(false)
        expect(avisoDoRoteiro({ type: "show", name: "x" })).toBeNull()
    })
    it("conta rascunhos e faltas", () => {
        const itens = [aviso("✎ Rascunho: a — revise em Novas do Sirvo"), aviso("✎ Rascunho: b — revise em Novas do Sirvo"), aviso("⚠ Falta criar: c"), { type: "section", name: "Louvor" }]
        expect(contarAvisos(itens)).toEqual({ rascunhos: 2, faltas: 1 })
    })
})
