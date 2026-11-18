import { beforeEach, describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"

const chamadas = vi.hoisted(() => ({ carregados: [] as string[][], layouts: [] as [number, string][], conferidos: [] as number[] }))
vi.mock("../components/helpers/setShow", () => ({
    loadShows: async (ids: string[]) => {
        chamadas.carregados.push(ids)
    }
}))
vi.mock("../components/helpers/showActions", () => ({
    swichProjectItem: (pos: number, id: string) => {
        chamadas.layouts.push([pos, id])
    }
}))
vi.mock("./aliancaConferir", () => ({
    marcarConferidoPorIndice: (i: number) => {
        chamadas.conferidos.push(i)
    }
}))

import { activeEdit, activeProject, activeShow, refreshEditSlide, showsCache } from "../stores"
import { trocarTela } from "./aliancaTela"
import { ultimoDoCulto } from "./aliancaGavetaEstado"
import { abrirItemDoRoteiro } from "./aliancaRoteiroClique"

const esperar = () => new Promise((r) => setTimeout(r, 5))

beforeEach(() => {
    chamadas.carregados.length = 0
    chamadas.layouts.length = 0
    chamadas.conferidos.length = 0
    activeProject.set("p1")
    activeShow.set(null)
    activeEdit.set({ items: [] } as any)
    trocarTela("show", "segmentado")
    refreshEditSlide.set(false)
    showsCache.set({ musica: { layouts: {}, settings: {} } } as any)
    ultimoDoCulto.set(null as any)
})

describe("abrirItemDoRoteiro (o clique do ShowButton de antes)", () => {
    it("show: abre, lembra o ultimo do culto, confere, carrega e aplica o leiaute do item", async () => {
        abrirItemDoRoteiro({ id: "musica", type: "show" }, 2)
        expect(get(activeShow)).toMatchObject({ id: "musica", type: "show", index: 2 })
        expect(get(ultimoDoCulto)).toEqual({ projetoId: "p1", index: 2, id: "musica" })
        expect(chamadas.conferidos).toEqual([2])
        await esperar()
        expect(chamadas.carregados).toEqual([["musica"]])
        expect(chamadas.layouts).toEqual([[2, "musica"]])
    })
    it("a mesma musica duas vezes: o segundo item aplica o leiaute DO SEGUNDO (posicao 3)", async () => {
        abrirItemDoRoteiro({ id: "musica", type: "show" }, 1)
        abrirItemDoRoteiro({ id: "musica", type: "show" }, 3)
        await esperar()
        expect(chamadas.layouts).toEqual([
            [1, "musica"],
            [3, "musica"]
        ])
    })
    it("reabrir o item ja aberto so marca visto e lembra: nao recarrega nem troca o leiaute", async () => {
        activeShow.set({ id: "musica", type: "show", index: 2 } as any)
        abrirItemDoRoteiro({ id: "musica", type: "show" }, 2)
        await esperar()
        expect(chamadas.conferidos).toEqual([2])
        expect(chamadas.layouts).toEqual([])
    })
    it("Ctrl e Shift so selecionam: nada abre, nada e lembrado", () => {
        abrirItemDoRoteiro({ id: "musica" }, 2, { ctrl: true })
        abrirItemDoRoteiro({ id: "musica" }, 2, { shift: true })
        expect(get(activeShow)).toBeNull()
        expect(chamadas.conferidos).toEqual([])
    })
    it("imagem/video: o editor vai para a midia", () => {
        abrirItemDoRoteiro({ id: "c:/a.mp4", type: "video", name: "a" }, 0)
        expect(get(activeEdit)).toMatchObject({ id: "c:/a.mp4", type: "media" })
        expect(chamadas.layouts).toEqual([])
    })
    it("editor de modelo aberto volta para o show aberto", () => {
        activeEdit.set({ id: "modelo1", type: "template", items: [] } as any)
        abrirItemDoRoteiro({ id: "musica", type: "show" }, 1)
        expect(get(activeEdit)).toMatchObject({ type: "show", slide: 0, showId: "musica" })
    })
    it("em Editar manda atualizar o slide do editor", () => {
        trocarTela("edit", "segmentado")
        abrirItemDoRoteiro({ id: "musica", type: "show" }, 1)
        expect(get(refreshEditSlide)).toBe(true)
    })
    it("bloco (section) so abre: nao mexe em ultimo do culto nem em conferido", () => {
        abrirItemDoRoteiro({ id: "s1", type: "section", name: "Louvor" }, 0)
        expect(get(activeShow)).toMatchObject({ id: "s1", type: "section", index: 0 })
        expect(get(ultimoDoCulto)).toBeNull()
        expect(chamadas.conferidos).toEqual([])
    })
})
