import { describe, expect, it, vi } from "vitest"
import { camadasAbertasPorPadrao, editToolsRenderizado, alvoDoRodape, entradaAgrupada, grupoDoInput, idDoInput, linhasFiltradas, mapaDeGrupos, secaoTemAlgoNoGrupo, secoesDoGrupo, itensDoMenuAdicionar, mostrarRecentes, notasLigadas, notasVisiveis, previaEscondida, timelineLigada } from "./aliancaEditorLogica"
import { slideItems } from "../components/edit/values/items"
// boxes.ts importa helpers/array, que puxa o app todo (pdfjs precisa de DOM): so o clone interessa aqui
vi.mock("../components/helpers/array", () => ({ clone: (x: any) => JSON.parse(JSON.stringify(x)) }))
import { itemBoxes } from "../components/edit/values/boxes"
import { itemSections } from "../components/edit/values/item"

const base = { pagina: "edit", tipoEdicao: "show", showExiste: true, focusMode: false, editMode: "default" }

describe("editToolsRenderizado / previaEscondida", () => {
    it("show em modo Slide: renderizado", () => expect(editToolsRenderizado(base)).toBe(true))
    it("modos Texto e Acordes: nao (a coluna ficaria vazia)", () => {
        expect(editToolsRenderizado({ ...base, editMode: "text_edit" })).toBe(false)
        expect(editToolsRenderizado({ ...base, editMode: "chords" })).toBe(false)
    })
    it("editores de midia, audio, efeito e camera: nao", () => {
        for (const t of ["media", "audio", "effect", "camera"]) expect(editToolsRenderizado({ ...base, tipoEdicao: t })).toBe(false)
    })
    it("template e overlay: renderizado mesmo com editMode diferente", () => {
        expect(editToolsRenderizado({ ...base, tipoEdicao: "template", editMode: "text_edit", showExiste: false })).toBe(true)
        expect(editToolsRenderizado({ ...base, tipoEdicao: "overlay", showExiste: false })).toBe(true)
    })
    it("focusMode, outra pagina ou sem show: nao", () => {
        expect(editToolsRenderizado({ ...base, focusMode: true })).toBe(false)
        expect(editToolsRenderizado({ ...base, pagina: "show" })).toBe(false)
        expect(editToolsRenderizado({ ...base, showExiste: false })).toBe(false)
    })
    it("a previa so some no Preparar", () => {
        expect(previaEscondida({ ...base, modo: "preparar" })).toBe(true)
        expect(previaEscondida({ ...base, modo: "culto" })).toBe(false)
        expect(previaEscondida({ ...base, modo: "preparar", editMode: "chords" })).toBe(false)
        expect(previaEscondida({ ...base, modo: "preparar", tipoEdicao: "media" })).toBe(false)
    })
})

describe("timeline e notas", () => {
    it("no Culto seguem a flag", () => {
        expect(timelineLigada(true, "culto")).toBe(true)
        expect(timelineLigada(false, "culto")).toBe(false)
        expect(notasLigadas(true, "culto")).toBe(true)
        expect(notasVisiveis(true, "culto")).toBe(true)
        expect(notasVisiveis(false, "culto")).toBe(false)
    })
    it("no Preparar sao sempre falsas, mesmo com a flag ligada", () => {
        expect(timelineLigada(true, "preparar")).toBe(false)
        expect(notasLigadas(true, "preparar")).toBe(false)
        expect(notasVisiveis(true, "preparar")).toBe(false)
        expect(timelineLigada(undefined, "preparar")).toBe(false)
    })
})

describe("mostrarRecentes", () => {
    const e = { modo: "culto" as const, editId: "", showAberto: true, temHistorico: true, editMode: "default" }
    it("show aberto em modo Slide: slides", () => expect(mostrarRecentes(e)).toBe(false))
    it("modo Texto: Culto mostra recentes, Preparar mostra slides", () => {
        expect(mostrarRecentes({ ...e, editMode: "text_edit" })).toBe(true)
        expect(mostrarRecentes({ ...e, editMode: "text_edit", modo: "preparar" })).toBe(false)
    })
    it("template/overlay: recentes nos dois modos", () => {
        expect(mostrarRecentes({ ...e, editId: "t1" })).toBe(true)
        expect(mostrarRecentes({ ...e, editId: "t1", modo: "preparar", editMode: "text_edit" })).toBe(true)
    })
    it("sem show aberto: historico, e modo Texto continua com recentes", () => {
        expect(mostrarRecentes({ ...e, showAberto: false })).toBe(true)
        expect(mostrarRecentes({ ...e, showAberto: false, temHistorico: false, modo: "preparar", editMode: "text_edit" })).toBe(true)
    })
})

describe("camadasAbertasPorPadrao", () => {
    it("recolhida com 0 ou 1 item, aberta com 2+", () => {
        expect(camadasAbertasPorPadrao(0)).toBe(false)
        expect(camadasAbertasPorPadrao(1)).toBe(false)
        expect(camadasAbertasPorPadrao(2)).toBe(true)
    })
})

describe("itensDoMenuAdicionar", () => {
    const ids = (gs: any[]) => gs.flatMap((g) => g.items.flatMap((i: any) => [i.id, ...(i.children || []).map((c: any) => c.id)]))
    const visiveis = (gs: any[]) => gs.flatMap((g) => g.items.map((i: any) => i.id)).filter((i: string) => i !== "more")
    it("a vista: Texto, Midia, Camera, Timer, Relogio", () => {
        expect(visiveis(itensDoMenuAdicionar(slideItems)).sort()).toEqual(["camera", "clock", "media", "text", "timer"])
    })
    it("tabela, grafico e icone vao para Mais; nenhum item se perde nem duplica", () => {
        const novo = itensDoMenuAdicionar(slideItems)
        const mais = novo.flatMap((g) => g.items).find((i: any) => i.id === "more")!
        const filhos = (mais.children || []).map((c) => c.id)
        for (const id of ["table", "chart", "icon", "web", "weather"]) expect(filhos).toContain(id)
        expect(ids(novo).sort()).toEqual(ids(slideItems).sort())
        expect(new Set(ids(novo)).size).toBe(ids(novo).length)
    })
    it("nao muda o original", () => {
        const antes = JSON.stringify(slideItems)
        itensDoMenuAdicionar(slideItems)
        expect(JSON.stringify(slideItems)).toBe(antes)
    })
})

describe("entradaAgrupada (desfazer agrupado, 8b passo 0)", () => {
    const antes = { a: { items: [{ lines: [{ align: "" }] }] }, b: { items: [] } }
    const depois = { a: { items: [{ lines: [{ align: "text-align:right;" }] }] }, b: { items: [] } }

    it("monta UMA entrada UPDATE no formato do handleUpdate, com antes e depois", () => {
        const e = entradaAgrupada("show1", antes, depois, 123)
        expect(e).toEqual({ id: "UPDATE", location: { page: "edit", id: "show_key" }, oldData: { id: "show1" }, newData: { key: "slides", data: depois, previousData: antes }, time: 123 })
    })
    it("nada mudou: sem entrada", () => expect(entradaAgrupada("show1", antes, JSON.parse(JSON.stringify(antes)), 1)).toBeNull())
    it("sem show: sem entrada", () => expect(entradaAgrupada("", antes, depois, 1)).toBeNull())
})

describe("mapaDeGrupos: cobertura dos dados REAIS (todo input em exatamente um grupo)", () => {
    const grupos = ["vista", "mais", "avancado"] as const
    const casos: [string, "box" | "item", string, any][] = [
        ["box/text", "box", "text", itemBoxes.text!.sections],
        ["box/media", "box", "media", itemBoxes.media!.sections],
        ["item", "item", "item", itemSections]
    ]
    for (const [nome, origem, tipo, secoes] of casos) {
        it(nome + ": cada input cai em exatamente um grupo", () => {
            const mapa = mapaDeGrupos(origem, tipo, secoes)!
            expect(mapa).not.toBeNull()
            for (const [secaoId, secao] of Object.entries<any>(secoes)) {
                const ids: string[] = secao.inputs.flat().map(idDoInput)
                const vistos: string[] = []
                for (const g of grupos) {
                    const parte = secoesDoGrupo(mapa, g, secoes).find((s) => s.id === secaoId)
                    if (!parte) continue
                    // linhas filtradas devolvem exatamente os inputs do grupo
                    const linhas = linhasFiltradas(secao.inputs, parte.ids).flat().map(idDoInput)
                    vistos.push(...linhas)
                    for (const i of linhas) expect(grupoDoInput(mapa, secaoId, i)).toBe(g)
                }
                expect(vistos.slice().sort(), nome + " / " + secaoId).toEqual(ids.slice().sort())
            }
        })
    }

    it("box/text: a vista tem fonte e alinhamento; Mais tem as 6 secoes; Avancado tem scrolling/special/CSS", () => {
        const m = mapaDeGrupos("box", "text", itemBoxes.text!.sections)!
        expect(Object.keys(m.vista)).toEqual(["default", "align"])
        expect(Object.keys(m.mais).sort()).toEqual(["chords", "lines", "list", "outline", "shadow", "text"])
        expect(Object.keys(m.avancado).sort()).toEqual(["CSS", "scrolling", "special"])
        expect(m.rotulos["mais:shadow"]).toBe("Sombra do texto")
    })
    it("item: a vista so tem a posicao; o fundo da caixa vai em Mais com rotulo", () => {
        const m = mapaDeGrupos("item", "item", itemSections)!
        expect(Object.keys(m.vista)).toEqual(["position"])
        expect(m.mais.default).toBe(true)
        expect(m.rotulos["mais:default"]).toBe("Fundo da caixa")
        expect(m.rotulos["avancado:shadow"]).toBe("Sombra da caixa")
    })
    it("midia: o default e partido; a parte do avancado ganha 'Mistura e espelho'", () => {
        const m = mapaDeGrupos("box", "media", itemBoxes.media!.sections)!
        expect(m.vista.default).toEqual(["src", "fit", "muted", "loop", "speed"])
        expect(m.avancado.default).toEqual(["blend", "flipped", "flippedY"])
        expect(m.rotulos["avancado:default"]).toBe("Mistura e espelho")
    })
    it("tipo sem mapa fino (timer, relogio, camera...): null, painel como no Culto", () => {
        for (const t of ["timer", "clock", "camera", "web", "slide_tracker", "icon", "chart", "table"]) expect(mapaDeGrupos("box", t, (itemBoxes as any)[t]?.sections || {})).toBeNull()
    })
    it("secao inventada cai em avancado e nunca some", () => {
        const secoes = { ...itemBoxes.text!.sections, novo: { inputs: [[{ id: "x", type: "number", value: 0, values: {} }]] } } as any
        const m = mapaDeGrupos("box", "text", secoes)!
        expect(m.avancado.novo).toBe(true)
        expect(secoesDoGrupo(m, "avancado", secoes).map((s) => s.id)).toContain("novo")
    })
    it("input novo dentro da secao partida cai em avancado", () => {
        const base = JSON.parse(JSON.stringify(itemBoxes.media!.sections))
        base.default.inputs.push([{ id: "inventado", type: "checkbox", value: false, values: {} }])
        const m = mapaDeGrupos("box", "media", base)!
        expect(m.avancado.default).toContain("inventado")
        expect(grupoDoInput(m, "default", "inventado")).toBe("avancado")
    })
    it("grupo vazio nao desenha: mais da midia", () => {
        const s = itemBoxes.media!.sections
        const m = mapaDeGrupos("box", "media", s)!
        expect(secaoTemAlgoNoGrupo(m, "mais", s)).toBe(false)
        expect(secaoTemAlgoNoGrupo(m, "avancado", s)).toBe(true)
    })
    it("overlay sem a secao chords: o mapa ignora o que nao existe", () => {
        const s = { ...itemBoxes.text!.sections } as any
        delete s.chords
        const m = mapaDeGrupos("box", "text", s)!
        expect(secoesDoGrupo(m, "mais", s).map((x) => x.id)).not.toContain("chords")
    })
    it("linhasFiltradas: linha vazia some; sem ids devolve tudo", () => {
        const linhas = [[{ id: "a" }], [{ id: "b" }, { id: "c" }]]
        expect(linhasFiltradas(linhas, ["c"])).toEqual([[{ id: "c" }]])
        expect(linhasFiltradas(linhas, null)).toBe(linhas)
    })
})

describe("alvoDoRodape", () => {
    const base = { escolhidos: 0, templateTextMode: false, templateItemMode: false, slideRemovido: false, tipo: "show" as const }
    it("show com camada escolhida: texto", () => expect(alvoDoRodape({ ...base, escolhidos: 1 })).toBe("text"))
    it("show sem escolha: slide", () => expect(alvoDoRodape(base)).toBe("slide"))
    it("template modo item com escolha: caixa", () => expect(alvoDoRodape({ ...base, tipo: "template", templateItemMode: true, escolhidos: 1 })).toBe("item"))
    it("template modo texto sem escolha (slide removido): texto", () => expect(alvoDoRodape({ ...base, tipo: "template", templateTextMode: true, slideRemovido: true })).toBe("text"))
    it("overlay sem escolha: texto (o slide ativo nao e do overlay)", () => expect(alvoDoRodape({ ...base, tipo: "overlay" })).toBe("text"))
    it("template comum sem escolha: texto (copiar o slide leria o show aberto)", () => expect(alvoDoRodape({ ...base, tipo: "template" })).toBe("text"))
    it("template modo item sem escolha: caixa", () => expect(alvoDoRodape({ ...base, tipo: "template", templateItemMode: true })).toBe("item"))
    it("show com slide removido sem escolha: texto", () => expect(alvoDoRodape({ ...base, slideRemovido: true })).toBe("text"))
})
