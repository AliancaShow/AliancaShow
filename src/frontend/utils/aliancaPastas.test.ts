import { get } from "svelte/store"
import { beforeEach, describe, expect, it } from "vitest"
import { folders, projects } from "../stores"
import { acharProjeto, acharProjetoEm, caminhoDoCultoSirvo, dataDoCulto, garantirPastas, ligadoAOutroCulto, projetoLigadoAoCulto } from "./aliancaPastas"

describe("garantirPastas", () => {
    beforeEach(() => folders.set({}))

    it("cria o caminho inteiro e depois so reaproveita", () => {
        const primeira = garantirPastas(["Alianca", "2026", "11-novembro"])
        expect(primeira.mudou).toBe(true)
        expect(Object.keys(get(folders))).toHaveLength(3)

        const segunda = garantirPastas(["Alianca", "2026", "11-novembro"])
        expect(segunda).toEqual({ id: primeira.id, mudou: false })
        expect(Object.keys(get(folders))).toHaveLength(3)
    })

    it("mesmo nome em pais diferentes sao pastas diferentes", () => {
        const a = garantirPastas(["Alianca", "2026"]).id
        const b = garantirPastas(["Impulso", "2026"]).id
        expect(a).not.toBe(b)
        expect(get(folders)[a].name).toBe("2026")
    })
})

describe("acharProjetoEm", () => {
    it("sem ligacao: o primeiro que bate no nome, como o Remote sempre fez", () => {
        const todos = {
            outro: { name: "08", parent: "out" },
            p1: { name: "15", parent: "nov" },
            p2: { name: "08", parent: "nov" },
            p3: { name: "08", parent: "nov" }
        }
        expect(acharProjetoEm(todos, "nov", "08")).toBe("p2")
        expect(acharProjetoEm(todos, "nov", "22")).toBeNull()
    })

    it("Extra: o dia no comeco do nome", () => {
        const todos = { p: { name: "07 - Rede de Mulheres", parent: "nov" }, q: { name: "070", parent: "nov" } }
        expect(acharProjetoEm(todos, "nov", "07")).toBe("p")
    })

    it("dois '08' (Ctrl+Z depois de o Remote recriar): vale o ligado ao Sirvo, com ou sem eventId", () => {
        const todos = {
            recriado: { name: "08", parent: "nov" },
            montado: { name: "08", parent: "nov", sirvo: { eventId: "ev-a" } }
        }
        expect(acharProjetoEm(todos, "nov", "08")).toBe("montado")
        expect(acharProjetoEm(todos, "nov", "08", "ev-a")).toBe("montado")
    })

    it("com eventId: acha o ligado mesmo renomeado com a hora", () => {
        const todos = {
            manha: { name: "08 · 08h", parent: "nov", sirvo: { eventId: "ev-manha" } },
            noite: { name: "08 · 10h", parent: "nov", sirvo: { eventId: "ev-dez" } }
        }
        expect(acharProjetoEm(todos, "nov", "08", "ev-dez")).toBe("noite")
        // o Remote (sem eventId) continua achando so pelo nome do Pedro
        expect(acharProjetoEm(todos, "nov", "08")).toBeNull()
    })

    it("arquivado ou apagado pela nuvem nao conta como ligado", () => {
        const todos = {
            comum: { name: "08", parent: "nov" },
            velho: { name: "08", parent: "nov", archived: true, sirvo: { eventId: "ev-a" } }
        }
        expect(acharProjetoEm(todos, "nov", "08", "ev-a")).toBe("comum")
    })

    it("o achado pelo nome pode ser de outro culto: quem chama confere", () => {
        const todos = { p: { name: "08", parent: "nov", sirvo: { eventId: "ev-a" } } }
        const achado = acharProjetoEm(todos, "nov", "08", "ev-b")
        expect(achado).toBe("p")
        expect(ligadoAOutroCulto(todos[achado!], "ev-b")).toBe(true)
        expect(ligadoAOutroCulto(todos[achado!], "ev-a")).toBe(false)
        expect(ligadoAOutroCulto({ name: "08" }, "ev-b")).toBe(false)
    })

    it("acharProjeto le o store", () => {
        projects.set({ p: { name: "08", parent: "nov", created: 0, shows: [] } })
        expect(acharProjeto("nov", "08")).toBe("p")
    })
})

describe("projetoLigadoAoCulto", () => {
    it("em qualquer pasta; com dois, o da pasta do dia", () => {
        const todos = {
            movido: { name: "08", parent: "ensaios", sirvo: { eventId: "ev" } },
            doDia: { name: "08", parent: "nov", sirvo: { eventId: "ev" } },
            outro: { name: "08", parent: "nov", sirvo: { eventId: "ev-b" } }
        }
        expect(projetoLigadoAoCulto(todos, "ev", "nov")).toBe("doDia")
        expect(projetoLigadoAoCulto(todos, "ev", "x")).toBe("movido")
        expect(projetoLigadoAoCulto(todos, "ev-c")).toBeNull()
    })
})

describe("caminhoDoCultoSirvo", () => {
    const manha = { event_id: "m", comeca_em: "2026-11-08T11:00:00Z" } // 08:00 em Sao Paulo
    const dez = { event_id: "d", comeca_em: "2026-11-08T13:00:00Z" } // 10:00
    const sabado = { event_id: "s", comeca_em: "2026-11-07T22:30:00Z" } // 19:30 do dia 07

    it("um culto no dia: so o dia, igual ao Remote", () => {
        expect(caminhoDoCultoSirvo(dez, [dez, sabado])).toEqual({ pastas: ["Alianca", "2026", "11-novembro"], dia: "08", projeto: "08" })
    })

    it("dois ou mais no dia: todos ganham a hora", () => {
        expect(caminhoDoCultoSirvo(manha, [manha, dez])?.projeto).toBe("08 · 08h")
        expect(caminhoDoCultoSirvo(dez, [manha, dez])?.projeto).toBe("08 · 10h")
    })

    it("minutos so quando nao sao :00", () => {
        const outra = { event_id: "o", comeca_em: "2026-11-07T23:00:00Z" } // 20:00 do dia 07
        expect(caminhoDoCultoSirvo(sabado, [sabado, outra])?.projeto).toBe("07 · 19h30")
        expect(caminhoDoCultoSirvo(outra, [sabado, outra])?.projeto).toBe("07 · 20h")
    })

    it("o proprio culto conta mesmo fora da lista, e nao conta duas vezes", () => {
        expect(caminhoDoCultoSirvo(manha, [])?.projeto).toBe("08")
        expect(caminhoDoCultoSirvo(manha, [manha, manha])?.projeto).toBe("08")
        expect(caminhoDoCultoSirvo(manha, [dez])?.projeto).toBe("08 · 08h")
    })

    it("a data e a de Sao Paulo, nao a UTC", () => {
        // 23h de sabado em Sao Paulo ja e domingo em UTC
        const tarde = { event_id: "t", comeca_em: "2026-11-08T02:00:00Z" }
        expect(dataDoCulto(tarde.comeca_em)).toBe("2026-11-07")
        expect(caminhoDoCultoSirvo(tarde, [tarde, sabado])?.projeto).toBe("07 · 23h")
    })

    it("data invalida: null", () => {
        expect(caminhoDoCultoSirvo({ event_id: "x", comeca_em: "" }, [])).toBeNull()
    })
})
