import { describe, expect, it } from "vitest"
import { AGENDAS, caminhoDoCulto, diasDoMes } from "./agendas"

const [alianca, impulso, extra] = AGENDAS

describe("diasDoMes", () => {
    it("Aliança: todos os domingos do mes", () => {
        // setembro de 2026: domingos 6, 13, 20, 27
        expect(diasDoMes(alianca, 2026, 8)).toEqual(["06", "13", "20", "27"])
    })

    it("Impulso: nada antes da ancora de 19/09/2026", () => {
        expect(diasDoMes(impulso, 2026, 7)).toEqual([])
    })

    it("Impulso: a partir da ancora, sabado sim, sabado nao", () => {
        expect(diasDoMes(impulso, 2026, 8)).toEqual(["19"])
        expect(diasDoMes(impulso, 2026, 9)).toEqual(["03", "17", "31"])
        expect(diasDoMes(impulso, 2026, 10)).toEqual(["14", "28"])
    })

    it("Impulso: a conta atravessa o ano", () => {
        // 26/12/2026 + 14 = 09/01/2027
        expect(diasDoMes(impulso, 2026, 11)).toEqual(["12", "26"])
        expect(diasDoMes(impulso, 2027, 0)).toEqual(["09", "23"])
    })

    it("Extra: sem cadencia, nenhum dia previsto", () => {
        expect(diasDoMes(extra, 2026, 10)).toEqual([])
    })
})

describe("caminhoDoCulto", () => {
    it("mesma arvore do Storage", () => {
        expect(caminhoDoCulto(alianca, "2026-09-06")).toEqual({ pastas: ["Alianca", "2026", "09-setembro"], dia: "06", projeto: "06" })
        expect(caminhoDoCulto(impulso, "2026-10-03")?.pastas).toEqual(["Impulso", "2026", "10-outubro"])
    })

    it("Extra leva o nome do evento no projeto, mas nao na pasta", () => {
        expect(caminhoDoCulto(extra, "2026-11-07", "Rede de Mulheres")).toEqual({ pastas: ["Extra", "2026", "11-novembro"], dia: "07", projeto: "07 - Rede de Mulheres" })
    })

    it("Aliança ignora nome: o projeto e so o dia", () => {
        expect(caminhoDoCulto(alianca, "2026-09-06", "qualquer")?.projeto).toBe("06")
    })

    it("id que nao e data e recusado", () => {
        expect(caminhoDoCulto(alianca, "acampa-sexta")).toBeNull()
    })
})
