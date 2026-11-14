import { describe, expect, it } from "vitest"
import { anteriorNoGrupo, cortarComLinhas, cortarEntreLinhas, dadosDoFilhoNoLayout, dividirLinhasEmBlocos, gruposDaVista, juntarComAnterior, motivoDeNaoCortar, motivoDeNaoJuntar, motivoDeNaoRedividir, redividirGrupo, textoDaLinha, type RascunhoDoShow } from "./aliancaTesouraLogica"

const L = (texto: string, acordes: { pos: number; key: string }[] = []): any => ({ align: "", text: [{ value: texto, style: "" }], ...(acordes.length ? { chords: acordes.map((a, i) => ({ id: "c" + i, ...a })) } : {}) })
const caixa = (...linhas: any[]): any => ({ type: "text", style: "", lines: linhas })
const slide = (linhas: any[], extra: any = {}): any => ({ group: null, color: null, settings: {}, notes: "", items: [caixa(...linhas)], ...extra })
const textos = (s: any, i = 0) => (s.items[i].lines as any[]).map(textoDaLinha)

// Verso (pai v + filho v2) · Refrão (pai r + filho r2) aparece 3x no layout
function fixture(): RascunhoDoShow {
    return {
        slides: {
            v: slide([L("verso um", [{ pos: 0, key: "G" }]), L("verso dois"), L(""), L("verso tres", [{ pos: 6, key: "D" }])], { group: "Verso 1", globalGroup: "verse", children: ["v2"] }),
            v2: slide([L("verso quatro"), L("verso cinco")]),
            r: slide([L("refrao um", [{ pos: 3, key: "Em" }]), L("refrao dois"), L("refrao tres")], { group: "Refrão", globalGroup: "chorus", children: ["r2"] }),
            r2: slide([L("refrao quatro"), L("refrao cinco")])
        },
        layouts: { l: { slides: [{ id: "v" }, { id: "r" }, { id: "r" }, { id: "r" }] } }
    }
}
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x))

describe("cortar entre linhas (B4)", () => {
    it("usa as linhas como estao: a vazia e os acordes dela ficam onde estavam", () => {
        const s = fixture()
        const r = cortarEntreLinhas(s, "v", 0, 3, "novo") // corta entre a linha vazia e "verso tres"
        expect(r).not.toBeNull()
        expect(textos(s.slides.v)).toEqual(["verso um", "verso dois", ""])
        expect(textos(s.slides.novo)).toEqual(["verso tres"])
        expect(s.slides.v.items[0].lines[0].chords).toEqual([{ id: "c0", pos: 0, key: "G" }])
        expect(s.slides.novo.items[0].lines[0].chords).toEqual([{ id: "c0", pos: 6, key: "D" }]) // o acorde nao pula de linha
    })

    it("corte logo antes da linha vazia: a vazia vai inteira para a 2a metade", () => {
        const s = fixture()
        cortarEntreLinhas(s, "v", 0, 2, "novo")
        expect(textos(s.slides.v)).toEqual(["verso um", "verso dois"])
        expect(textos(s.slides.novo)).toEqual(["", "verso tres"])
    })

    it("o novo e filho do pai, logo depois do cortado, e o layout nao muda (3 ocorrencias do refrao)", () => {
        const s = fixture()
        const layoutAntes = copia(s.layouts)
        cortarEntreLinhas(s, "r", 0, 1, "n1")
        expect(s.slides.r.children).toEqual(["n1", "r2"])
        cortarEntreLinhas(s, "r2", 0, 1, "n2")
        expect(s.slides.r.children).toEqual(["n1", "r2", "n2"])
        expect(s.layouts).toEqual(layoutAntes)
        expect(s.slides.n1.group).toBeNull()
        expect(s.slides.n1.globalGroup).toBeUndefined()
        expect(s.slides.n1.id).toBeUndefined()
    })

    it("nao corta antes da 1a nem depois da ultima linha", () => {
        const s = fixture()
        expect(cortarEntreLinhas(s, "v", 0, 0, "x")).toBeNull()
        expect(cortarEntreLinhas(s, "v", 0, 4, "x")).toBeNull()
        expect(s.slides.x).toBeUndefined()
    })

    it("a camada solta (midia) vai para as duas metades", () => {
        const s = fixture()
        s.slides.r.items.push({ type: "media", style: "", src: "foto.jpg" } as any)
        cortarEntreLinhas(s, "r", 0, 2, "n")
        expect(s.slides.n.items.some((i: any) => i.type === "media")).toBe(true)
        expect(s.slides.r.items.some((i: any) => i.type === "media")).toBe(true)
    })

    it("slide escondido cortado continua escondido (I4), nas mesmas ocorrencias, e `end` vai para a 2a metade", () => {
        const s = fixture()
        s.layouts.l.slides[1] = { id: "r", disabled: true, end: true } as any
        s.layouts.l.slides[3] = { id: "r", children: { r2: { disabled: true } } } as any
        const a = cortarComLinhas(s, "r", 0, s.slides.r.items[0].lines.slice(0, 1), s.slides.r.items[0].lines.slice(1), "n")
        expect(a.mexeuNoLayout).toBe(true)
        expect((s.layouts.l.slides[1] as any).children.n).toEqual({ disabled: true, end: true })
        expect((s.layouts.l.slides[1] as any).end).toBeUndefined()
        expect(s.layouts.l.slides[2].children).toBeUndefined()
        // cortar o filho escondido (r2) na 3a ocorrencia
        cortarEntreLinhas(s, "r2", 0, 1, "m")
        expect((s.layouts.l.slides[3] as any).children.m).toEqual({ disabled: true })
        expect((s.layouts.l.slides[3] as any).children.r2).toEqual({ disabled: true })
    })

    it("motivos de nao cortar: duas caixas, travado, Biblia", () => {
        const s = fixture()
        expect(motivoDeNaoCortar(s, "v")).toBeNull()
        s.slides.v.items.push(caixa(L("traducao")))
        expect(motivoDeNaoCortar(s, "v")).toMatch(/mais de uma caixa/)
        s.slides.r.locked = true
        expect(motivoDeNaoCortar(s, "r")).toMatch(/travado/)
        expect(motivoDeNaoCortar(s, "r2")).toMatch(/travado/) // o filho herda a trava do grupo
        s.slides.v2.customDynamicValues = { x: "y" }
        expect(motivoDeNaoCortar(s, "v2")).toMatch(/Bíblia/)
    })
})

describe("juntar com o anterior", () => {
    it("junta o filho no pai: mantem o id do pai, acordes junto, e TODAS as ocorrencias do refrao continuam", () => {
        const s = fixture()
        s.slides.r2.items[0].lines[0] = L("refrao quatro", [{ pos: 1, key: "A" }])
        const layoutAntes = copia(s.layouts)
        const r = juntarComAnterior(s, "r2")
        expect(r?.anteriorId).toBe("r")
        expect(textos(s.slides.r)).toEqual(["refrao um", "refrao dois", "refrao tres", "refrao quatro", "refrao cinco"])
        expect(s.slides.r.items[0].lines[3].chords).toEqual([{ id: "c0", pos: 1, key: "A" }])
        expect(s.slides.r.items[0].lines[0].chords).toEqual([{ id: "c0", pos: 3, key: "Em" }])
        expect(s.slides.r.children).toEqual([])
        expect(s.slides.r2).toBeUndefined()
        expect(s.layouts).toEqual(layoutAntes) // contraprova: mergeSlides apagaria 2 das 3 ocorrencias
        expect(s.layouts.l.slides.filter((e) => e.id === "r").length).toBe(3)
    })

    it("junta no filho anterior quando ha mais de um", () => {
        const s = fixture()
        s.slides.r.children = ["r2", "r3"]
        s.slides.r3 = slide([L("refrao seis")])
        expect(anteriorNoGrupo(s, "r3")).toBe("r2")
        juntarComAnterior(s, "r3")
        expect(textos(s.slides.r2)).toEqual(["refrao quatro", "refrao cinco", "refrao seis"])
        expect(s.slides.r.children).toEqual(["r2"])
    })

    it("pai nao junta (e o primeiro do grupo) e nao cruza grupos", () => {
        const s = fixture()
        expect(motivoDeNaoJuntar(s, "r")).toMatch(/primeiro do grupo/)
        expect(juntarComAnterior(s, "r")).toBeNull()
        expect(motivoDeNaoJuntar(s, "r2")).toBeNull()
    })

    it("avisa quando o filho tem dados proprios no layout, e os apaga ao juntar", () => {
        const s = fixture()
        expect(dadosDoFilhoNoLayout(s, "r2")).toBe(false)
        s.layouts.l.slides[2] = { id: "r", children: { r2: { background: "fundo.jpg" } } } as any
        expect(dadosDoFilhoNoLayout(s, "r2")).toBe(true)
        const r = juntarComAnterior(s, "r2")
        expect(r?.mexeuNoLayout).toBe(true)
        expect((s.layouts.l.slides[2] as any).children.r2).toBeUndefined()
    })

    it("itens que nao sao texto: dedupe; notas concatenadas", () => {
        const s = fixture()
        const media: any = { type: "media", style: "", src: "a.jpg" }
        s.slides.r.items.push(copia(media))
        s.slides.r2.items.push(copia(media), { type: "shape", style: "x" } as any)
        s.slides.r.notes = "nota 1"
        s.slides.r2.notes = "nota 2"
        juntarComAnterior(s, "r2")
        expect(s.slides.r.items.filter((i: any) => i.type === "media").length).toBe(1)
        expect(s.slides.r.items.filter((i: any) => i.type === "shape").length).toBe(1)
        expect(s.slides.r.notes).toBe("nota 1\nnota 2")
    })

    it("numero de caixas diferente ou Biblia: desabilitado", () => {
        const s = fixture()
        s.slides.r2.items.push(caixa(L("x")))
        expect(motivoDeNaoJuntar(s, "r2")).toMatch(/números diferentes/)
        const t = fixture()
        t.slides.r2.customDynamicValues = { a: "b" }
        expect(motivoDeNaoJuntar(t, "r2")).toMatch(/Bíblia/)
        const u = fixture()
        u.locked = true
        expect(motivoDeNaoJuntar(u, "r2")).toMatch(/travado/)
    })
})

describe("cortar e juntar de volta", () => {
    it("cortar entre linhas e juntar de volta devolve o mesmo texto e acordes", () => {
        const s = fixture()
        const antes = copia(s.slides.v.items[0].lines)
        cortarEntreLinhas(s, "v", 0, 1, "n")
        juntarComAnterior(s, "n")
        expect(s.slides.v.items[0].lines).toEqual(antes)
    })
})

describe("dividir de novo", () => {
    it("blocos: paragrafo consome a linha vazia; linha e N descartam vazias", () => {
        const linhas = [L("a"), L("b"), L(""), L("c"), L(""), L(""), L("d")]
        expect(dividirLinhasEmBlocos(linhas, "paragrafo", 2).map((b) => b.map(textoDaLinha))).toEqual([["a", "b"], ["c"], ["d"]])
        expect(dividirLinhasEmBlocos(linhas, "linha", 2).map((b) => b.map(textoDaLinha))).toEqual([["a"], ["b"], ["c"], ["d"]])
        expect(dividirLinhasEmBlocos(linhas, "n", 2).map((b) => b.map(textoDaLinha))).toEqual([["a", "b"], ["c", "d"]])
    })

    it("a cada 2 linhas: o pai mantem o id, os filhos sao reaproveitados, acordes seguem, layout intacto", () => {
        const s = fixture()
        const layoutAntes = copia(s.layouts)
        let n = 0
        const r = redividirGrupo(s, "r", "n", 2, () => "novo" + ++n)
        expect(r).toEqual({ apagados: [], antes: 2, depois: 3 })
        expect(textos(s.slides.r)).toEqual(["refrao um", "refrao dois"])
        expect(s.slides.r.items[0].lines[0].chords).toEqual([{ id: "c0", pos: 3, key: "Em" }])
        expect(s.slides.r.children).toEqual(["r2", "novo1"])
        expect(textos(s.slides.r2)).toEqual(["refrao tres", "refrao quatro"])
        expect(textos(s.slides.novo1)).toEqual(["refrao cinco"])
        expect(s.layouts).toEqual(layoutAntes)
    })

    it("quando sobram filhos, apaga os que sobram", () => {
        const s = fixture()
        const r = redividirGrupo(s, "r", "n", 5, () => "x")
        expect(r).toEqual({ apagados: ["r2"], antes: 2, depois: 1 })
        expect(s.slides.r.children).toEqual([])
        expect(s.slides.r2).toBeUndefined()
        expect(textos(s.slides.r).length).toBe(5)
    })

    it("por paragrafo so habilita se houver linha vazia", () => {
        const s = fixture()
        expect(motivoDeNaoRedividir(s, "r", "paragrafo")).toMatch(/linha vazia/)
        expect(motivoDeNaoRedividir(s, "v", "paragrafo")).toBeNull()
        const r = redividirGrupo(s, "v", "paragrafo", 2, () => "p1")
        expect(r?.depois).toBe(2)
        expect(textos(s.slides.v)).toEqual(["verso um", "verso dois"])
        expect(textos(s.slides.v2)).toEqual(["verso tres", "verso quatro", "verso cinco"])
    })

    it("desabilitada com midia, ajuste proprio, notas, dados de layout, trava", () => {
        const a = fixture()
        a.slides.r.items.push({ type: "media", style: "", src: "x.jpg" } as any)
        expect(motivoDeNaoRedividir(a, "r")).toMatch(/mídia ou ajuste/)
        const b = fixture()
        b.slides.r2.settings = { color: "red" }
        expect(motivoDeNaoRedividir(b, "r")).toMatch(/ajustes diferentes/)
        const c = fixture()
        c.slides.r2.notes = "nota"
        expect(motivoDeNaoRedividir(c, "r")).toMatch(/notas/)
        const d = fixture()
        d.layouts.l.slides[1] = { id: "r", children: { r2: { disabled: true } } } as any
        expect(motivoDeNaoRedividir(d, "r")).toMatch(/mídia ou ajuste/)
        const e = fixture()
        e.slides.r.locked = true
        expect(motivoDeNaoRedividir(e, "r")).toMatch(/travado/)
        const f = fixture()
        f.slides.r2.items[0].style = "outro"
        expect(motivoDeNaoRedividir(f, "r")).toMatch(/estilo diferente/)
    })
})

describe("a vista Dividir", () => {
    it("mostra cada grupo uma vez, com quantas vezes aparece", () => {
        const g = gruposDaVista(fixture(), "l")
        expect(g.map((x) => [x.paiId, x.ocorrencias, x.slides.map((s) => s.id)])).toEqual([
            ["v", 1, ["v", "v2"]],
            ["r", 3, ["r", "r2"]]
        ])
        expect(g[1].slides[1].motivoJuntar).toBeNull()
        expect(g[1].slides[0].motivoJuntar).toBeNull() // o pai nao tem vao de juntar
    })

    it("escondido = escondido em todas as ocorrencias", () => {
        const s = fixture()
        s.layouts.l.slides[1] = { id: "r", disabled: true } as any
        expect(gruposDaVista(s, "l")[1].slides[0].escondido).toBe(false)
        s.layouts.l.slides[2] = { id: "r", disabled: true } as any
        s.layouts.l.slides[3] = { id: "r", disabled: true } as any
        expect(gruposDaVista(s, "l")[1].slides[0].escondido).toBe(true)
    })
})
