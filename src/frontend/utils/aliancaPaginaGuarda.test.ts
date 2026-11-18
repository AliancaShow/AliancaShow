import { get, writable } from "svelte/store"
import { beforeEach, describe, expect, it } from "vitest"
import { _zerarFalhas, falhas } from "./aliancaFalha"
import { classeDaPagina, guardarPagina, pelaPorta } from "./aliancaPaginaGuarda"

beforeEach(() => _zerarFalhas())

describe("classeDaPagina", () => {
    it("show = mostrar, edit = editar, settings/stage/draw = pagina, o resto nao tem classe", () => {
        expect(classeDaPagina("show")).toBe("mostrar")
        expect(classeDaPagina("edit")).toBe("editar")
        for (const p of ["settings", "stage", "draw"]) expect(classeDaPagina(p)).toBe("pagina")
        for (const p of ["scripture", "calendar", "reflow", "inventada"]) expect(classeDaPagina(p)).toBeNull()
    })
})

describe("guardarPagina (janela principal)", () => {
    const nova = () => guardarPagina(writable<string>("show"), () => true)
    it("as cinco paginas com lugar passam PELA PORTA", () => {
        const p = nova()
        for (const v of ["edit", "settings", "stage", "draw", "show"]) {
            pelaPorta(() => p.set(v))
            expect(get(p)).toBe(v)
        }
        expect(get(falhas)).toEqual([])
    })
    it("de fora da porta: so passa o que nao muda a classe da tela", () => {
        const p = nova()
        p.set("show")
        expect(get(p)).toBe("show")
        pelaPorta(() => p.set("settings"))
        p.set("stage")
        expect(get(p)).toBe("stage")
        p.set("edit")
        expect(get(p)).toBe("stage")
        expect(get(falhas)).toHaveLength(1)
        expect(get(falhas)[0]).toMatchObject({ origem: "troca-de-tela-recusada", mensagem: "stage -> edit" })
    })
    it("scripture, calendar, reflow e valor inventado NAO sao escritos (nem pela porta) e acendem a faixa com o nome", () => {
        const p = nova()
        pelaPorta(() => p.set("edit"))
        for (const v of ["scripture", "calendar", "reflow", "inventada"]) {
            pelaPorta(() => p.set(v))
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
        expect(get(p)).toBe("show")
        pelaPorta(() => p.update(() => "edit"))
        expect(get(p)).toBe("edit")
        expect(get(falhas).map((f) => f.origem).sort()).toEqual(["pagina-sem-lugar", "troca-de-tela-recusada"])
    })
    it("a porta fecha sozinha, tambem quando a funcao lanca", () => {
        const p = nova()
        expect(() =>
            pelaPorta(() => {
                throw new Error("x")
            })
        ).toThrow()
        p.set("edit")
        expect(get(p)).toBe("show")
    })
})

describe("guardarPagina (fora da janela principal)", () => {
    it("devolve o valor sem olhar e nunca acende a faixa", () => {
        const p = guardarPagina(writable<string>("show"), () => false)
        p.set("scripture")
        expect(get(p)).toBe("scripture")
        p.update(() => "calendar")
        expect(get(p)).toBe("calendar")
        p.set("edit")
        expect(get(p)).toBe("edit")
        expect(get(falhas)).toEqual([])
    })
})

describe("mutacao: a guarda morde", () => {
    it("sem a checagem, scripture e a troca de classe passariam (os testes acima so passam porque a guarda recusa)", () => {
        const sem = writable<string>("show")
        sem.set("scripture")
        expect(get(sem)).toBe("scripture")
        sem.set("edit")
        expect(get(sem)).toBe("edit")
    })
})
