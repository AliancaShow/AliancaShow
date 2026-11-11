import { describe, expect, it } from "vitest"
import { decidirEmbutido, planejarEmbutidos } from "./bundledShowsPlano"

const vazio = () => ({ resolvidos: {}, idsNaBiblioteca: new Set<string>(), arquivosNaBiblioteca: new Set<string>() })

describe("shows embutidos: cada um entra uma vez", () => {
    it("PC limpo: todos entram, uma vez", () => {
        const plano = planejarEmbutidos(
            [
                { arquivo: "Oceanos.show", id: "a1" },
                { arquivo: "Toda Terra.show", id: "a2" }
            ],
            vazio()
        )
        expect(plano.copiar).toEqual(["Oceanos.show", "Toda Terra.show"])
        expect(plano.resolvidos).toEqual({ "Oceanos.show": "a1", "Toda Terra.show": "a2" })

        // segunda abertura: nada a fazer
        const de_novo = planejarEmbutidos([{ arquivo: "Oceanos.show", id: "a1" }], { ...vazio(), resolvidos: plano.resolvidos, idsNaBiblioteca: new Set(["a1", "a2"]) })
        expect(de_novo.copiar).toEqual([])
        expect(de_novo.mudou).toBe(false)
    })

    it("apagada de propósito não volta na abertura seguinte", () => {
        // instalou, o usuário apagou: a biblioteca não tem mais nem o id nem o arquivo
        const plano = planejarEmbutidos([{ arquivo: "Oceanos.show", id: "a1" }], { ...vazio(), resolvidos: { "Oceanos.show": "a1" } })
        expect(plano.copiar).toEqual([])
    })

    it("renomeada não cria gêmea com o mesmo id", () => {
        // o arquivo virou "Oceanos (Hillsong).show", o id continua a1
        const d = decidirEmbutido({ arquivo: "Oceanos.show", id: "a1" }, { ...vazio(), idsNaBiblioteca: new Set(["a1"]), arquivosNaBiblioteca: new Set(["oceanos (hillsong).show"]) })
        expect(d).toBe("id_na_biblioteca")
    })

    it("PC que já tinha a biblioteca (versão antiga do instalador): nada é copiado, tudo fica anotado", () => {
        const plano = planejarEmbutidos(
            [
                { arquivo: "Oceanos.show", id: "a1" },
                { arquivo: "Toda Terra.show", id: "a2" }
            ],
            { ...vazio(), idsNaBiblioteca: new Set(["a1", "a2"]), arquivosNaBiblioteca: new Set(["oceanos.show", "toda terra.show"]) }
        )
        expect(plano.copiar).toEqual([])
        expect(plano.mudou).toBe(true)
        expect(Object.keys(plano.resolvidos).sort()).toEqual(["Oceanos.show", "Toda Terra.show"])
    })

    it("nunca sobrescreve um arquivo de mesmo nome com outro id", () => {
        expect(decidirEmbutido({ arquivo: "Oceanos.show", id: "a1" }, { ...vazio(), idsNaBiblioteca: new Set(["zz"]), arquivosNaBiblioteca: new Set(["oceanos.show"]) })).toBe("nome_ocupado")
    })

    it("id já anotado sob outro nome de arquivo (o pacote renomeou): não volta", () => {
        expect(decidirEmbutido({ arquivo: "Oceanos v2.show", id: "a1" }, { ...vazio(), resolvidos: { "Oceanos.show": "a1" } })).toBe("ja_resolvido")
    })

    it("dois embutidos com o mesmo id: só o primeiro entra", () => {
        const plano = planejarEmbutidos(
            [
                { arquivo: "Oceanos.show", id: "a1" },
                { arquivo: "Oceanos (cópia).show", id: "a1" }
            ],
            vazio()
        )
        expect(plano.copiar).toEqual(["Oceanos.show"])
    })

    it("arquivo sem id legível cai na regra do nome", () => {
        expect(decidirEmbutido({ arquivo: "Estranho.show", id: null }, vazio())).toBe("copiar")
        expect(decidirEmbutido({ arquivo: "Estranho.show", id: null }, { ...vazio(), arquivosNaBiblioteca: new Set(["estranho.show"]) })).toBe("nome_ocupado")
    })
})
