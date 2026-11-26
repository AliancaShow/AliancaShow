import { describe, expect, it } from "vitest"
import { avisoDoRoteiro, contarAvisos, ehAvisoDeMusica } from "./aliancaRoteiroAvisos"

const aviso = (name: string) => ({ type: "section", name, data: { sirvoMusica: "r1", sirvoFalta: true } })

describe("rascunho abre no Editar", () => {
    it("o aviso de rascunho aponta para o show-rascunho da linha do Sirvo", async () => {
        const { showDoRascunho } = await import("./aliancaRoteiroAvisos")
        const rm = "4f83e89f-2600-4a07-bda1-1a03363be0c3"
        expect(showDoRascunho({ type: "section", name: "✎ Rascunho: o dia — revise em Novas do Sirvo", data: { sirvoFalta: true, sirvoMusica: rm } })).toBe("sn_4f83e89f26004a07bda11a03363be0c3")
        expect(showDoRascunho({ type: "section", name: "⚠ Falta criar: x", data: { sirvoFalta: true, sirvoMusica: rm } })).toBeNull()
        expect(showDoRascunho({ type: "show", name: "x" })).toBeNull()
    })
})

describe("avisos de música no roteiro", () => {
    it("rascunho vira só o nome, com a marca ✎", () => {
        const a = avisoDoRoteiro(aviso("✎ Rascunho: Tua alegria - Drops INA — revise em Novas do Sirvo"))
        expect(a).toMatchObject({ tipo: "rascunho", nome: "Tua alegria - Drops INA", marca: "✎" })
        expect(a?.dica).toContain("revisar no Editar")
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
