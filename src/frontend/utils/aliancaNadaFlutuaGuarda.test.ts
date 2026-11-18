// Regra do dono (fatia 3, achado 9): nada flutua sobre o conteudo do slide em edicao. O "+" de itens mora no cabecalho do centro de Editar
// (AliancaEditarCentro), nao dentro do Editor (onde era um botao redondo por cima do slide).
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const ler = (rel: string) => readFileSync(join(__dirname, "..", "components", rel), "utf8").replace(/\r\n/g, "\n")

describe("o botao + de itens nao flutua sobre o slide", () => {
    it("o Editor nao monta mais o ItemAddMenu", () => {
        expect(ler("edit/Editor.svelte")).not.toMatch(/<ItemAddMenu/)
    })
    it("o cabecalho do centro de Editar monta o ItemAddMenu no modo de cabecalho", () => {
        expect(ler("main/AliancaEditarCentro.svelte")).toMatch(/<ItemAddMenu[^>]*\bnoCabecalho\b/)
    })
    it("no modo de cabecalho o botao nao e FloatingInputs (que posiciona por cima do conteudo)", () => {
        const fonte = ler("edit/ItemAddMenu.svelte")
        const cab = fonte.slice(fonte.indexOf("{#if noCabecalho}"))
        expect(cab.slice(0, cab.indexOf("{:else}"))).not.toMatch(/FloatingInputs/)
    })
})
