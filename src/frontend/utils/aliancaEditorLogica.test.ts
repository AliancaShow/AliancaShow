import { describe, expect, it } from "vitest"
import { camadasAbertasPorPadrao, editToolsRenderizado, itensDoMenuAdicionar, mostrarRecentes, notasLigadas, notasVisiveis, previaEscondida, timelineLigada } from "./aliancaEditorLogica"
import { slideItems } from "../components/edit/values/items"

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
