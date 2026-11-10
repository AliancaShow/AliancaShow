import { describe, expect, it } from "vitest"
import { detalhesDoShow, textoCurto } from "./catalogoDetalhes"

const linha = (value: string) => ({ align: "", text: [{ value, style: "" }] })

describe("detalhes da música para o catálogo", () => {
    it("primeira linha do layout ativo, artista, tom, CCLI e slides", () => {
        const show = {
            meta: { artist: "Hillsong", key: "D", CCLI: "6428767" },
            settings: { activeLayout: "L1" },
            layouts: { L1: { slides: [{ id: "s0", disabled: true }, { id: "s1" }, { id: "s2" }] } },
            slides: {
                s0: { items: [{ lines: [linha("Desativado")] }] },
                s1: { items: [{ lines: [linha(""), linha("Tu me chamas sobre as <b>águas</b>")] }], children: ["s1a"] },
                s1a: { items: [{ lines: [linha("filho")] }] },
                s2: { items: [{ lines: [linha("Segundo")] }] }
            }
        }
        expect(detalhesDoShow(show)).toEqual({ primeira_linha: "Tu me chamas sobre as águas", artista: "Hillsong", tom: "D", ccli: "6428767", slides: 3 })
    })

    it("show sem nada vira tudo nulo", () => {
        expect(detalhesDoShow({})).toEqual({ primeira_linha: null, artista: null, tom: null, ccli: null, slides: null })
        expect(detalhesDoShow(null)).toEqual({ primeira_linha: null, artista: null, tom: null, ccli: null, slides: null })
    })

    it("texto curto: corta, tira controle e marcação", () => {
        expect(textoCurto("  a\u0007b\n c  ", 10)).toBe("a b c")
        expect(textoCurto("x".repeat(200), 120)?.length).toBe(120)
        expect(textoCurto("<i></i>", 10)).toBeNull()
        expect(textoCurto(undefined, 10)).toBeNull()
    })
})
