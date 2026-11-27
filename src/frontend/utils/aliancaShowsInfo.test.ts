import { describe, expect, it } from "vitest"
import { artistaDoShow, ordenarShows, proximaOrdem, quandoFoi, usadoEm } from "./aliancaShowsInfo"

describe("aliancaShowsInfo", () => {
    it("cantor: o show aberto vence a lista leve; sem nada fica vazio", () => {
        expect(artistaDoShow({ quickAccess: { artista: " Theo Rubia " } })).toBe("Theo Rubia")
        expect(artistaDoShow({ quickAccess: { artista: "Antigo" } }, { meta: { artist: "Novo" } })).toBe("Novo")
        expect(artistaDoShow({ quickAccess: { artista: "Antigo" } }, { meta: { artist: "" } })).toBe("")
        expect(artistaDoShow({ quickAccess: {} }, { meta: {} })).toBe("")
        expect(artistaDoShow(undefined)).toBe("")
    })

    it("ultima vez no ar: o show aberto vence", () => {
        expect(usadoEm({ timestamps: { used: 5 } })).toBe(5)
        expect(usadoEm({ timestamps: { used: 5 } }, { timestamps: { used: 9 } })).toBe(9)
        expect(usadoEm({ timestamps: { used: null } })).toBe(0)
    })

    it("quando foi: hoje, ontem, dias e data", () => {
        const agora = new Date(2026, 10, 27, 15, 0).getTime()
        expect(quandoFoi(0, agora)).toBe("")
        expect(quandoFoi(new Date(2026, 10, 27, 8, 0).getTime(), agora)).toBe("hoje")
        expect(quandoFoi(new Date(2026, 10, 26, 23, 0).getTime(), agora)).toBe("ontem")
        expect(quandoFoi(new Date(2026, 10, 23, 10, 0).getTime(), agora)).toBe("há 4 dias")
        expect(quandoFoi(new Date(2026, 9, 5, 10, 0).getTime(), agora)).toBe("05/10/2026")
    })

    it("clicar na coluna alterna o sentido", () => {
        expect(proximaOrdem("nome", "nome")).toBe("nome_des")
        expect(proximaOrdem("nome_des", "nome")).toBe("nome")
        expect(proximaOrdem("nome", "usado")).toBe("usado")
        expect(proximaOrdem("usado", "usado")).toBe("usado_asc")
        expect(proximaOrdem("criado", "cantor")).toBe("cantor")
    })

    it("ordena com vazios no fim e desempate pelo nome", () => {
        const l = [
            { nome: "Bondade", cantor: "", usado: 0, criado: 3 },
            { nome: "Aleluia", cantor: "Zeca", usado: 10, criado: 1 },
            { nome: "Cordeiro", cantor: "Ana", usado: 30, criado: 2 },
            { nome: "Aleluia", cantor: "Ana", usado: 0, criado: 4 }
        ]
        expect(ordenarShows(l, "cantor").map((a) => a.nome + a.cantor)).toEqual(["AleluiaAna", "CordeiroAna", "AleluiaZeca", "Bondade"])
        expect(ordenarShows(l, "usado").map((a) => a.nome)).toEqual(["Cordeiro", "Aleluia", "Aleluia", "Bondade"])
        expect(ordenarShows(l, "criado_asc").map((a) => a.criado)).toEqual([1, 2, 3, 4])
        expect(ordenarShows(l, "nome_des").map((a) => a.nome)).toEqual(["Cordeiro", "Bondade", "Aleluia", "Aleluia"])
    })
})
