import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"

// Revisao da fatia 3, achados 4 e 5: um Esc = uma coisa, e o que o Esc fecha/desseleciona em Editar arma os 700 ms.
const janela = vi.hoisted(() => {
    const corpo = {}
    const j = new EventTarget()
    ;(globalThis as any).window = j
    ;(globalThis as any).document = { body: corpo, activeElement: corpo }
    return j
})

import { activeEdit, activePopup, selected } from "../stores"
import { dividirAberto } from "./aliancaDividir"
import { listaAberta } from "./aliancaGavetaEstado"
import { trocarTela } from "./aliancaTela"
import { ligarTravasDeToque } from "./aliancaToque"

let agora = 10_000
let desligar: () => void
let chegouAoPreview = 0

/** um Esc: devolve true se chegou aos ouvintes de bolha (o Preview, que agenda `clearAll`) */
function esc(): boolean {
    chegouAoPreview = 0
    const e = new Event("keydown", { cancelable: true })
    ;(e as any).key = "Escape"
    janela.dispatchEvent(e)
    return chegouAoPreview > 0
}
const passar = (ms: number) => (agora += ms)

beforeEach(() => {
    agora += 100_000
    vi.spyOn(performance, "now").mockImplementation(() => agora)
    // na janela (o proprio alvo) o node dispara na ordem do registro: a trava vem antes do Preview, como o capture do navegador
    desligar = ligarTravasDeToque()
    janela.addEventListener("keydown", aoPreview)
    activePopup.set(null)
    selected.set({ id: null, data: [] })
    activeEdit.set({ items: [] } as any)
    dividirAberto.set(null)
    listaAberta.set(false)
    trocarTela("edit", "botao-direito")
})
afterEach(() => {
    desligar()
    janela.removeEventListener("keydown", aoPreview)
    vi.restoreAllMocks()
})
function aoPreview() {
    chegouAoPreview++
}

describe("Esc em Editar: um Esc = uma coisa (achado 4)", () => {
    it("Dividir aberto: o Esc fecha o Dividir e NAO chega ao Preview (nao limpa o telao)", () => {
        dividirAberto.set("show")
        expect(esc()).toBe(false)
        expect(get(dividirAberto)).toBe(null)
    })
    it("depois de fechar o Dividir, o Esc seguinte espera os 700 ms; passado o tempo, passa", () => {
        dividirAberto.set("show")
        esc()
        passar(100)
        expect(esc()).toBe(false)
        passar(800)
        expect(esc()).toBe(true)
    })
    it("lista das marcacoes aberta: fecha a lista e nao limpa", () => {
        listaAberta.set(true)
        expect(esc()).toBe(false)
        expect(get(listaAberta)).toBe(false)
    })
    it("com popup aberto o Esc e do popup (o Dividir fica; o Preview ja recusa limpar com popup)", () => {
        dividirAberto.set("show")
        activePopup.set("alert" as any)
        esc()
        expect(get(dividirAberto)).toBe("show")
    })
    it("em Mostrar o Dividir nao se aplica: o Esc passa como sempre", () => {
        trocarTela("show", "segmentado")
        dividirAberto.set("show")
        expect(esc()).toBe(true)
        expect(get(dividirAberto)).toBe("show")
    })
})

describe("Esc que desseleciona caixa arma os 700 ms (achado 5)", () => {
    it("caixa selecionada: o 1o Esc passa (desseleciona), o 2o dentro de 700 ms e engolido", () => {
        activeEdit.set({ items: [0] } as any)
        expect(esc()).toBe(true)
        activeEdit.set({ items: [] } as any)
        passar(300)
        expect(esc()).toBe(false)
        passar(800)
        expect(esc()).toBe(true)
    })
    it("nada selecionado: o Esc passa e nao arma nada", () => {
        expect(esc()).toBe(true)
        passar(10)
        expect(esc()).toBe(true)
    })
})
