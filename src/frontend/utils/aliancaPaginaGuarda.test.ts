import { get, writable } from "svelte/store"
import { beforeEach, describe, expect, it } from "vitest"
import { _zerarFalhas, falhas } from "./aliancaFalha"
import { guardarPagina } from "./aliancaPaginaGuarda"

beforeEach(() => _zerarFalhas())

describe("guardarPagina (janela principal)", () => {
    const nova = () => guardarPagina(writable<string>("show"), () => true)
    it("as cinco paginas com lugar passam", () => {
        const p = nova()
        for (const v of ["edit", "settings", "stage", "draw", "show"]) {
            p.set(v)
            expect(get(p)).toBe(v)
        }
        expect(get(falhas)).toEqual([])
    })
    it("scripture, calendar, reflow e valor inventado NAO sao escritos e acendem a faixa com o nome", () => {
        const p = nova()
        p.set("edit")
        for (const v of ["scripture", "calendar", "reflow", "inventada"]) {
            p.set(v)
            expect(get(p), v).toBe("edit")
        }
        // a faixa junta as repeticoes da mesma origem: o nome da primeira pagina e a contagem das 4
        expect(get(falhas)).toHaveLength(1)
        expect(get(falhas)[0]).toMatchObject({ origem: "pagina-sem-lugar", mensagem: "scripture", vezes: 4 })
    })
    it("update recusa do mesmo jeito e devolve o valor de antes", () => {
        const p = nova()
        p.update(() => "calendar")
        expect(get(p)).toBe("show")
        p.update((a) => (a === "show" ? "edit" : a))
        expect(get(p)).toBe("edit")
        expect(get(falhas)).toHaveLength(1)
    })
})

describe("guardarPagina (fora da janela principal)", () => {
    it("devolve o valor sem olhar e nunca acende a faixa", () => {
        const p = guardarPagina(writable<string>("show"), () => false)
        p.set("scripture")
        expect(get(p)).toBe("scripture")
        p.update(() => "calendar")
        expect(get(p)).toBe("calendar")
        expect(get(falhas)).toEqual([])
    })
})

describe("mutacao: a guarda morde", () => {
    it("sem a checagem, scripture passaria (o teste acima so passa porque a guarda recusa)", () => {
        const sem = writable<string>("show")
        sem.set("scripture")
        expect(get(sem)).toBe("scripture")
    })
})
