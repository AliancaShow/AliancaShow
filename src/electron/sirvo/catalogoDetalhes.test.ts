import { describe, expect, it } from "vitest"
import { detalhesDoShow, LETRA_MAX, letraDoShow, textoCurto } from "./catalogoDetalhes"

const linha = (value: string) => ({ align: "", text: [{ value, style: "" }] })

describe("detalhes da música para o catálogo", () => {
    it("primeira linha do layout ativo, artista, CCLI e o trecho (2 linhas do verso + 1 do refrão)", () => {
        const show = {
            meta: { artist: "Hillsong", key: "D", CCLI: "6428767" },
            settings: { activeLayout: "L1" },
            layouts: { L1: { slides: [{ id: "s0", disabled: true }, { id: "s1" }, { id: "s2" }, { id: "s3" }] } },
            slides: {
                s0: { group: "Verso", globalGroup: "verse", items: [{ lines: [linha("Desativado")] }] },
                s1: { group: "Intro", items: [{ lines: [linha("")] }] },
                s2: { group: "Verso 1", globalGroup: "verse", items: [{ lines: [linha(""), linha("Tu me chamas sobre as <b>águas</b>")] }], children: ["s2a"] },
                s2a: { items: [{ lines: [linha("onde os pés podem falhar"), linha("terceira")] }] },
                s3: { group: "", globalGroup: "chorus", items: [{ lines: [linha("E ao Teu nome clamarei"), linha("segunda")] }] }
            }
        }
        expect(detalhesDoShow(show)).toEqual({
            primeira_linha: "Tu me chamas sobre as águas",
            artista: "Hillsong",
            ccli: "6428767",
            letra: "Tu me chamas sobre as águas\n\nonde os pés podem falhar\nterceira\n\nE ao Teu nome clamarei\nsegunda",
            trecho: [
                { grupo: "Verso 1", linhas: ["Tu me chamas sobre as águas", "onde os pés podem falhar"] },
                { grupo: "Refrão", linhas: ["E ao Teu nome clamarei"] }
            ]
        })
    })

    it("sem grupo global: verso e refrão pelo nome escrito; sem verso, o primeiro slide faz de verso", () => {
        const show = {
            layouts: { L: { slides: [{ id: "a" }, { id: "b" }] } },
            slides: { a: { group: "Coro", items: [{ lines: [linha("Santo")] }] }, b: { group: "Estrofe", items: [{ lines: [linha("um"), linha("dois")] }] } }
        }
        expect(detalhesDoShow(show).trecho).toEqual([
            { grupo: "Estrofe", linhas: ["um", "dois"] },
            { grupo: "Coro", linhas: ["Santo"] }
        ])
        const soUm = { layouts: { L: { slides: [{ id: "a" }] } }, slides: { a: { items: [{ lines: [linha("só isso")] }] } } }
        expect(detalhesDoShow(soUm).trecho).toEqual([{ grupo: "Verso", linhas: ["só isso"] }])
    })

    it("show sem nada vira tudo nulo", () => {
        expect(detalhesDoShow({})).toEqual({ primeira_linha: null, artista: null, ccli: null, trecho: null, letra: null })
        expect(detalhesDoShow(null)).toEqual({ primeira_linha: null, artista: null, ccli: null, trecho: null, letra: null })
    })

    it("texto curto: corta, tira controle e marcação", () => {
        expect(textoCurto("  a\u0007b\n c  ", 10)).toBe("a b c")
        expect(textoCurto("x".repeat(200), 120)?.length).toBe(120)
        expect(textoCurto("<i></i>", 10)).toBeNull()
        expect(textoCurto(undefined, 10)).toBeNull()
    })

    it("letra: refrão repetido (mesmo id) entra uma vez; filhos em ordem; desativado fora; slides separados por linha em branco", () => {
        const show = {
            layouts: { L: { slides: [{ id: "v" }, { id: "c" }, { id: "x", disabled: true }, { id: "v2" }, { id: "c" }] } },
            slides: {
                v: { items: [{ lines: [linha("um"), linha("dois")] }], children: ["v1"] },
                v1: { items: [{ lines: [linha("três")] }] },
                c: { items: [{ lines: [linha("refrão")] }] },
                x: { items: [{ lines: [linha("fora")] }] },
                // mesmo texto do refrão, id diferente: NÃO deduplica por texto
                v2: { items: [{ lines: [linha("refrão")] }] }
            }
        }
        expect(letraDoShow(show)).toBe("um\ndois\n\ntrês\n\nrefrão\n\nrefrão")
    })

    it("letra: usa o layout ativo e corta em 4000 numa quebra de linha", () => {
        const ids = Array.from({ length: 200 }, (_, i) => `s${i}`)
        const slides: any = {}
        for (const id of ids) slides[id] = { items: [{ lines: [linha(id + " " + "a".repeat(40)), linha("b".repeat(40))] }] }
        const show = { settings: { activeLayout: "B" }, layouts: { A: { slides: [{ id: "s0" }] }, B: { slides: ids.map((id) => ({ id })) } }, slides }
        const letra = letraDoShow(show)!
        expect(letra.length).toBeLessThanOrEqual(LETRA_MAX)
        expect(letra.length).toBeGreaterThan(LETRA_MAX - 200)
        expect(letra.startsWith("s0 ")).toBe(true)
        // terminou numa linha inteira
        expect(letra.endsWith("b".repeat(40)) || /a{40}$/.test(letra)).toBe(true)
        expect(letraDoShow({})).toBeNull()
    })
})
