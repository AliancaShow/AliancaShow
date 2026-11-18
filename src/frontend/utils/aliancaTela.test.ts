// Fatia 2: a TELA e a porta. A saida cega, a recusa do que nao e gesto, o anteparo na chegada, o teclado que obedece a tela.
import { get } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { _zerarFalhas, falhas } from "./aliancaFalha"

// stores minimas: `activePage` com a fachada de verdade e `currentWindow` null (= janela principal)
vi.mock("../stores", async () => {
    const { writable: w, get: g } = await import("svelte/store")
    const { guardarPagina: guardar } = await import("./aliancaPaginaGuarda")
    const currentWindow = w<string | null>(null)
    const activePage = guardar(w<string>("show"), () => g(currentWindow) === null)
    return { activePage, currentWindow }
})

import { currentWindow, activePage } from "../stores"
import { GESTOS, anteparoAte, armarAnteparo, emEditar, naoEMostrar, tecladoLivre, tela, trocarTela } from "./aliancaTela"

const ap = activePage as any
const cw = currentWindow as any
beforeEach(() => {
    _zerarFalhas()
    cw.set(null)
    trocarTela("show", "segmentado")
    _zerarFalhas()
})

describe("tela (derivada de activePage)", () => {
    it("show = mostrar, edit = editar, settings/stage/draw = pagina", () => {
        const casos: [string, string][] = [["show", "mostrar"], ["edit", "editar"], ["settings", "pagina"], ["stage", "pagina"], ["draw", "pagina"]]
        for (const [p, t] of casos) {
            expect(trocarTela(p as any, "segmentado")).toBe(true)
            expect(get(tela)).toBe(t)
        }
    })
    it("o teclado e livre em Mostrar e nas paginas, morto so em Editar; gaveta nao toca fora de Mostrar", () => {
        trocarTela("show", "segmentado")
        expect([tecladoLivre(), naoEMostrar(), emEditar()]).toEqual([true, false, false])
        trocarTela("edit", "segmentado")
        expect([tecladoLivre(), naoEMostrar(), emEditar()]).toEqual([false, true, true])
        trocarTela("settings", "menu-app")
        expect([tecladoLivre(), naoEMostrar(), emEditar()]).toEqual([true, true, false])
    })
    it("saida cega: fora da janela principal a tela e sempre mostrar, mesmo com activePage diferente", () => {
        trocarTela("edit", "segmentado")
        cw.set("output")
        expect(get(tela)).toBe("mostrar")
        expect(tecladoLivre()).toBe(true)
        // e a porta nao faz nada na saida
        expect(trocarTela("settings", "menu-app")).toBe(false)
        expect(get(ap)).toBe("edit")
    })
})

describe("a fachada de activePage", () => {
    it("pedido de fora da porta que muda a classe da tela e recusado e a faixa acende (troca-de-tela-recusada)", () => {
        trocarTela("show", "segmentado")
        ap.set("edit")
        expect(get(ap)).toBe("show")
        expect(get(falhas)).toHaveLength(1)
        expect(get(falhas)[0]).toMatchObject({ origem: "troca-de-tela-recusada", mensagem: "show -> edit" })
    })
    it("pedido que NAO muda a classe passa (show->show, settings->stage)", () => {
        ap.set("show")
        trocarTela("settings", "menu-app")
        ap.set("stage")
        expect(get(ap)).toBe("stage")
        expect(get(falhas)).toEqual([])
    })
    it("update tambem passa pela mesma regra", () => {
        ap.update(() => "edit")
        expect(get(ap)).toBe("show")
        expect(get(falhas)[0].origem).toBe("troca-de-tela-recusada")
    })
    it("pagina sem lugar continua recusada pela porta tambem", () => {
        expect(trocarTela("scripture" as any, "popup")).toBe(false)
        expect(get(ap)).toBe("show")
        expect(get(falhas)[0].origem).toBe("pagina-sem-lugar")
    })
    it("a porta nao fica aberta depois da troca (o pedido seguinte de fora e recusado)", () => {
        trocarTela("edit", "segmentado")
        ap.set("show")
        expect(get(ap)).toBe("edit")
    })
})

describe("o espaco nao muda de dono (a regra do teclado segue a tela, nao o que o desfazer, a API ou o celular pedem)", () => {
    // os pedidos remotos e o desfazer nao chamam a porta: tentam a fachada, que recusa
    it.each(["edit", "settings"])("API, celular, processo principal e desfazer tentando ir para %s ficam de fora", (alvo) => {
        trocarTela("show", "segmentado")
        ap.set(alvo)
        expect(tecladoLivre()).toBe(true)
    })
    it("de Editar, um pedido de fora para show nao liga o teclado", () => {
        trocarTela("edit", "segmentado")
        ap.set("show")
        expect(tecladoLivre()).toBe(false)
    })
})

describe("chegada em Mostrar (anteparo)", () => {
    it("chegar em Mostrar vindo de Editar arma o anteparo antes de escrever; ficar em Mostrar nao rearma", () => {
        trocarTela("edit", "segmentado")
        const antes = anteparoAte()
        trocarTela("show", "segmentado")
        expect(anteparoAte()).toBeGreaterThan(antes)
        const depois = anteparoAte()
        trocarTela("show", "chip")
        expect(anteparoAte()).toBe(depois)
    })
    it("chegar em Mostrar vindo de uma pagina do menu tambem arma", () => {
        trocarTela("settings", "menu-app")
        const antes = anteparoAte()
        trocarTela("show", "voltar-de-pagina")
        expect(anteparoAte()).toBeGreaterThan(antes)
    })
    it("armarAnteparo avanca o relogio", () => {
        const a = anteparoAte()
        armarAnteparo()
        expect(anteparoAte()).toBeGreaterThanOrEqual(a)
    })
})

describe("GESTOS", () => {
    it("lista sem repeticao e com os dois gestos de Mostrar <-> Editar", () => {
        expect(new Set(GESTOS).size).toBe(GESTOS.length)
        expect(GESTOS).toContain("segmentado")
        expect(GESTOS).toContain("botao-direito")
    })
})

