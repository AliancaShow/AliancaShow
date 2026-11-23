import { describe, expect, it } from "vitest"
import { casaDe, COLUNAS, divergencias, duplicar, identidadeDoSlide, lerVisuais, linhaDeOrigem, migrar, novoVisual, Pendencias, planoDeEscrita, precisaDeEstiloProprio, visualAtivo, type Visual } from "./aliancaVisualLogica"

const saidas = () => ({
    tel: { name: "Telão", style: "s1", enabled: true },
    led: { name: "Telão LED", style: "s2", enabled: true },
    ret: { name: "Retorno", stageOutput: "palco1", enabled: true },
    key: { name: "Chave", isKeyOutput: true, enabled: true }
})
const estilos = () => ({ s1: { name: "Telão" }, s2: { name: "LED", template: "letraLed", templateScripture: "versLed" } })
const modelos = { letraLed: { name: "Letra LED" }, versLed: { name: "Versículo LED" }, outro: { name: "Outro" } }
const leiautes = { palco1: { name: "Só texto" }, palco2: { name: "Espelho" } }

const visual = (saidasV: Visual["saidas"], retorno: Visual["retorno"] = {}): Visual => ({ id: "v", nome: "V", saidas: saidasV, retorno })

describe("colunas", () => {
    it("V1 tem Música e avisos (template) e Bíblia (templateScripture)", () => {
        expect(COLUNAS.map((c) => [c.rotulo, c.campo])).toEqual([
            ["Música e avisos", "template"],
            ["Bíblia", "templateScripture"]
        ])
    })
})

describe("migrar", () => {
    it("lê os estilos e o retorno de hoje; saída sem modelo fica em 'usa o slide'; retorno e chave não viram linha", () => {
        const m = migrar({}, saidas(), estilos(), "id1")!
        expect(m.aliancaVisualAtivo).toBe("id1")
        expect(m.aliancaVisuais).toHaveLength(1)
        const v = m.aliancaVisuais[0]
        expect(v.nome).toBe("Culto padrão")
        expect(v.saidas).toEqual({ tel: { musica: "slide", biblia: "slide" }, led: { musica: "letraLed", biblia: "versLed" } })
        expect(v.retorno).toEqual({ ret: "palco1" })
    })
    it("perfil sem estilos: tudo em 'usa o slide'", () => {
        const v = migrar({}, saidas(), {}, "x")!.aliancaVisuais[0]
        expect(v.saidas.led).toEqual({ musica: "slide", biblia: "slide" })
    })
    it("estilo dividido: as duas saídas herdam o mesmo valor (sem conflito)", () => {
        const o = { ...saidas(), tel: { name: "Telão", style: "s2" } }
        const v = migrar({}, o, estilos(), "x")!.aliancaVisuais[0]
        expect(v.saidas.tel).toEqual(v.saidas.led)
        expect(planoDeEscrita(v, o, estilos(), modelos, leiautes)).toEqual({ escritas: [], problemas: [] })
    })
    it("nunca refaz: com lista existente (mesmo vazia) devolve null", () => {
        expect(migrar({ aliancaVisuais: [] }, saidas(), estilos(), "x")).toBeNull()
    })
    it("o perfil migrado não pede escrita nenhuma (nada muda na tela)", () => {
        const v = migrar({}, saidas(), estilos(), "x")!.aliancaVisuais[0]
        expect(planoDeEscrita(v, saidas(), estilos(), modelos, leiautes).escritas).toEqual([])
    })
})

describe("lerVisuais / visualAtivo / casaDe", () => {
    it("ignora lixo e acha o ativo", () => {
        const s = { aliancaVisuais: [null, { id: "" }, { id: "a", nome: "A" }], aliancaVisualAtivo: "a" }
        expect(lerVisuais(s).map((v) => v.id)).toEqual(["a"])
        expect(visualAtivo(s)?.nome).toBe("A")
        expect(visualAtivo({ aliancaVisuais: [{ id: "a" }], aliancaVisualAtivo: "b" })).toBeNull()
    })
    it("saída criada depois do Visual = 'usa o slide'", () => {
        expect(casaDe(visual({}), "nova", "musica")).toBe("slide")
    })
    it("duplicar copia fundo e dá nome livre; novo começa em 'usa o slide'", () => {
        const a = visual({ led: { musica: "letraLed" } }, { ret: "palco1" })
        const d = duplicar(a, [a], "d")
        expect(d.nome).toBe("V (cópia)")
        d.saidas.led.musica = "outro"
        expect(a.saidas.led.musica).toBe("letraLed")
        const n = novoVisual([a], saidas(), "n")
        expect(n.saidas).toEqual({ tel: { musica: "slide", biblia: "slide" }, led: { musica: "slide", biblia: "slide" } })
        expect(n.retorno).toEqual({ ret: "palco1" })
    })
})

describe("planoDeEscrita", () => {
    it("modelo -> template/templateScripture; 'slide' -> limpa (undefined); retorno -> stageOutput", () => {
        const v = visual({ tel: { musica: "outro", biblia: "slide" }, led: { musica: "slide", biblia: "versLed" } }, { ret: "palco2" })
        const p = planoDeEscrita(v, saidas(), estilos(), modelos, leiautes)
        expect(p.problemas).toEqual([])
        expect(p.escritas).toEqual([
            { tipo: "estilo", estilo: "s1", campo: "template", valor: "outro", saidas: ["tel"] },
            { tipo: "estilo", estilo: "s2", campo: "template", valor: undefined, saidas: ["led"] },
            { tipo: "retorno", saida: "ret", valor: "palco2" }
        ])
    })
    it("estilo dividido com pedidos diferentes: PROBLEMA e nada escrito naquele campo (o outro campo segue)", () => {
        const o = { ...saidas(), tel: { name: "Telão", style: "s2" } }
        const v = visual({ tel: { musica: "slide", biblia: "versLed" }, led: { musica: "letraLed", biblia: "versLed" } })
        const p = planoDeEscrita(v, o, estilos(), modelos, leiautes)
        expect(p.problemas).toEqual([{ tipo: "estiloDividido", estilo: "s2", coluna: "musica", saidas: ["tel", "led"] }])
        expect(p.escritas.filter((e) => e.tipo === "estilo")).toEqual([])
    })
    it("saída sem estilo pedindo modelo = problema semEstilo; em 'usa o slide' não é problema", () => {
        const o = { ...saidas(), tel: { name: "Telão" } }
        expect(planoDeEscrita(visual({ tel: { musica: "outro" } }), o, estilos(), modelos).problemas).toContainEqual({ tipo: "semEstilo", saida: "tel", coluna: "musica" })
        expect(planoDeEscrita(visual({}), o, estilos(), modelos).problemas.filter((p) => p.tipo === "semEstilo")).toEqual([])
        // estilo apontado que não existe conta como sem estilo
        expect(planoDeEscrita(visual({ tel: { musica: "outro" } }), { ...saidas(), tel: { name: "T", style: "fantasma" } }, estilos(), modelos).problemas[0].tipo).toBe("semEstilo")
    })
    it("modelo apagado: problema laranja (e escreve o id assim mesmo: a saída cai no slide como foi feito)", () => {
        const p = planoDeEscrita(visual({ tel: { musica: "sumiu" } }), saidas(), estilos(), modelos, leiautes)
        expect(p.problemas).toContainEqual({ tipo: "modeloSumiu", saida: "tel", coluna: "musica", modelo: "sumiu" })
        expect(p.escritas).toContainEqual({ tipo: "estilo", estilo: "s1", campo: "template", valor: "sumiu", saidas: ["tel"] })
    })
    it("leiaute de retorno apagado: problema e NÃO escreve (não vira saída normal nem aponta pro nada)", () => {
        const p = planoDeEscrita(visual({}, { ret: "sumiu" }), saidas(), estilos(), modelos, leiautes)
        expect(p.problemas).toContainEqual({ tipo: "leiauteSumiu", saida: "ret", leiaute: "sumiu" })
        expect(p.escritas.some((e) => e.tipo === "retorno")).toBe(false)
    })
    it("retorno null = o Visual não mexe; saída normal nunca recebe stageOutput", () => {
        const p = planoDeEscrita(visual({}, { ret: null, tel: "palco2" } as any), saidas(), estilos(), modelos, leiautes)
        expect(p.escritas.some((e) => e.tipo === "retorno")).toBe(false)
    })
})

describe("precisaDeEstiloProprio", () => {
    const o = { ...saidas(), tel: { name: "Telão", style: "s2" } }
    it("dividido: pôr outro modelo numa saída que divide o estilo pede estilo próprio", () => {
        const v = visual({ tel: { musica: "letraLed" }, led: { musica: "letraLed" } })
        expect(precisaDeEstiloProprio(v, o, estilos(), "tel", "musica", "outro")).toBe("dividido")
        expect(precisaDeEstiloProprio(v, o, estilos(), "tel", "musica", "letraLed")).toBeNull()
    })
    it("sem estilo: só pede se a casa for modelo", () => {
        const s = { ...saidas(), tel: { name: "Telão" } }
        expect(precisaDeEstiloProprio(visual({}), s, estilos(), "tel", "musica", "outro")).toBe("semEstilo")
        expect(precisaDeEstiloProprio(visual({}), s, estilos(), "tel", "musica", "slide")).toBeNull()
    })
})

describe("divergencias", () => {
    it("campo do estilo diferente do Visual aparece; pendente não conta", () => {
        const v = visual({ led: { musica: "outro", biblia: "versLed" } })
        expect(divergencias(v, saidas(), estilos()).map((e) => e.campo)).toEqual(["template"])
        expect(divergencias(v, saidas(), estilos(), new Set(["estilo:s2:template"]))).toEqual([])
    })
})

describe("identidadeDoSlide (D15)", () => {
    it("show/leiaute/posição contam; line não conta; vazio = null", () => {
        const a = identidadeDoSlide({ id: "s", layout: "l", index: 1, line: 0 })
        expect(identidadeDoSlide({ id: "s", layout: "l", index: 1, line: 2 })).toBe(a)
        expect(identidadeDoSlide({ id: "s", layout: "l", index: 2 })).not.toBe(a)
        expect(identidadeDoSlide(null)).toBeNull()
        expect(identidadeDoSlide({})).toBeNull()
    })
    it("Bíblia da gaveta (id temp): versículo novo com o mesmo id é outro slide (tempItems/customDynamicValues)", () => {
        const a = identidadeDoSlide({ id: "temp", tempItems: [{ lines: [{ text: [{ value: "v1" }] }] }], customDynamicValues: { scripture_reference: "Jo 3:16" } })
        const b = identidadeDoSlide({ id: "temp", tempItems: [{ lines: [{ text: [{ value: "v2" }] }] }], customDynamicValues: { scripture_reference: "Jo 3:17" } })
        const c = identidadeDoSlide({ id: "temp", tempItems: [{ lines: [{ text: [{ value: "v1" }] }] }], customDynamicValues: { scripture_reference: "Jo 3:17" } })
        expect(a).not.toBe(b)
        expect(a).not.toBe(c)
    })
})

describe("Pendencias (D15, plano A)", () => {
    const comSlide = (slide: any) => ({ ...saidas(), led: { ...saidas().led, out: { slide } } })
    const escLed = { tipo: "estilo" as const, estilo: "s2", campo: "template" as const, valor: "outro", saidas: ["led"] }
    const escTel = { tipo: "estilo" as const, estilo: "s1", campo: "template" as const, valor: "outro", saidas: ["tel"] }

    it("nada no ar: entra já", () => {
        const p = new Pendencias()
        expect(p.registrar([escLed], saidas())).toEqual([escLed])
        expect(p.tamanho).toBe(0)
    })
    it("slide no ar: espera; trocar só a linha não solta; trocar o slide solta", () => {
        const p = new Pendencias()
        expect(p.registrar([escLed, escTel], comSlide({ id: "s", index: 0 }))).toEqual([escTel])
        expect(p.saidasEsperando()).toEqual(new Set(["led"]))
        expect(p.aoMudar(comSlide({ id: "s", index: 0, line: 1 }))).toEqual([])
        expect(p.aoMudar(comSlide({ id: "s", index: 1 }))).toEqual([escLed])
        expect(p.tamanho).toBe(0)
    })
    it("ir para vazio solta; saída apagada solta", () => {
        const p = new Pendencias()
        p.registrar([escLed], comSlide({ id: "s", index: 0 }))
        expect(p.aoMudar(comSlide(null))).toEqual([escLed])
        p.registrar([escLed], comSlide({ id: "s", index: 0 }))
        const { led: _x, ...semLed } = comSlide({ id: "s" })
        expect(p.aoMudar(semLed)).toEqual([escLed])
    })
    it("Bíblia da gaveta: próximo versículo (mesmo id temp) solta", () => {
        const p = new Pendencias()
        p.registrar([escLed], comSlide({ id: "temp", tempItems: [{ a: 1 }] }))
        expect(p.aoMudar(comSlide({ id: "temp", tempItems: [{ a: 1 }] }))).toEqual([])
        expect(p.aoMudar(comSlide({ id: "temp", tempItems: [{ a: 2 }] }))).toEqual([escLed])
    })
    it("registrar de novo substitui (Visual novo antes do próximo slide); cancelar zera", () => {
        const p = new Pendencias()
        p.registrar([escLed], comSlide({ id: "s" }))
        p.registrar([{ ...escLed, valor: "letraLed" }], comSlide({ id: "s" }))
        expect(p.tamanho).toBe(1)
        expect(p.cancelar()).toBe(1)
        expect(p.aoMudar(comSlide({ id: "z" }))).toEqual([])
    })
    it("saída desligada (enabled false) não segura", () => {
        const p = new Pendencias()
        const o = { ...saidas(), led: { ...saidas().led, enabled: false, out: { slide: { id: "s" } } } }
        expect(p.registrar([escLed], o)).toEqual([escLed])
    })
})

describe("linhaDeOrigem (D14)", () => {
    const base = { outputs: saidas(), estilos: estilos(), templates: modelos, leiautes }
    const v = migrar({}, saidas(), estilos(), "x")!.aliancaVisuais[0]
    it("neutra quando bate: modelo da saída, slide como foi feito e o leiaute do retorno", () => {
        const l = linhaDeOrigem(v, "musica", base)
        expect(l.map((e) => [e.nome, e.texto, e.problema])).toEqual([
            ["Telão", "como o slide foi feito", ""],
            ["Telão LED", "Letra LED", ""],
            ["Retorno", "Só texto", ""]
        ])
        expect(linhaDeOrigem(v, "biblia", base)[1].texto).toBe("Versículo LED")
    })
    it("problema só quando algo não bate: modelo apagado, divergência; pendente não é problema", () => {
        const e2 = { ...estilos(), s2: { ...estilos().s2, template: "apagado" } }
        expect(linhaDeOrigem(v, "musica", { ...base, estilos: e2 })[1]).toMatchObject({ texto: "modelo não existe mais" })
        const e3 = { ...estilos(), s2: { ...estilos().s2, template: "outro" } }
        expect(linhaDeOrigem(v, "musica", { ...base, estilos: e3 })[1].problema).toBe("a saída não está como o Visual diz")
        expect(linhaDeOrigem(v, "musica", { ...base, estilos: e3, pendentes: new Set(["estilo:s2:template"]) })[1]).toMatchObject({ problema: "", pendente: true })
    })
})
