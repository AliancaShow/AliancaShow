// Revisao da fatia 2, achado 1: a pagina `draw` (Ferramentas da saida) tem que FUNCIONAR quando aberta pelo menu a partir de Mostrar.
// Antes, cada porta de components/draw perguntava `gavetaNaoToca()` (= tela diferente de Mostrar), e a propria pagina `draw` e tela "pagina".
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { get } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { _zerarFalhas, falhas } from "./aliancaFalha"

vi.mock("../stores", async () => {
    const { writable: w, get: g } = await import("svelte/store")
    const { guardarPagina: guardar } = await import("./aliancaPaginaGuarda")
    const currentWindow = w<string | null>(null)
    const activePage = guardar(w<string>("show"), () => g(currentWindow) === null)
    return { activePage, currentWindow }
})

import { trocarTela } from "./aliancaTela"
import { desenhoBloqueado } from "./aliancaDesenho"

beforeEach(() => {
    _zerarFalhas()
    trocarTela("show", "segmentado")
})

describe("desenhoBloqueado", () => {
    it("com a pagina draw aberta pelo menu (a partir de Mostrar) NAO bloqueia nem acende a faixa", () => {
        trocarTela("draw", "menu-app")
        expect(desenhoBloqueado()).toBe(false)
        expect(get(falhas)).toHaveLength(0)
    })
    it("em Mostrar nao bloqueia", () => {
        expect(desenhoBloqueado()).toBe(false)
    })
    it("em Editar bloqueia em voz alta", () => {
        trocarTela("edit", "segmentado")
        expect(desenhoBloqueado()).toBe(true)
        expect(get(falhas)[0]).toMatchObject({ origem: "desenho-no-preparar" })
    })
})

describe("as portas de components/draw", () => {
    const dir = join(__dirname, "..", "components", "draw")
    const arquivos = readdirSync(dir).filter((f) => f.endsWith(".svelte"))
    it("nenhuma usa gavetaNaoToca (que e `tela != mostrar` e mata a propria pagina draw)", () => {
        for (const f of arquivos) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/gavetaNaoToca/)
    })
    it("DrawSettings, DrawTabs e Slide usam desenhoBloqueado", () => {
        for (const f of ["DrawSettings.svelte", "DrawTabs.svelte", "Slide.svelte"]) expect(readFileSync(join(dir, f), "utf8"), f).toMatch(/desenhoBloqueado\(\)/)
    })
})
