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
    it("o cabecalho do centro de Editar monta o ItemAddMenu dentro do wrapper .addCab", () => {
        expect(ler("main/AliancaEditarCentro.svelte")).toMatch(/<div class="addCab"[^>]*><ItemAddMenu/)
    })
    it("o wrapper e a ancora (relative) e o botao redondo deixa de ser posicionado pelo conteudo", () => {
        const fonte = ler("main/AliancaEditarCentro.svelte")
        expect(fonte).toMatch(/\.addCab \{[^}]*position: relative/)
        expect(fonte).toMatch(/\.addCab :global\(\.row\) \{[^}]*position: absolute !important[^}]*bottom: auto !important/)
    })
    it("o ItemAddMenu nao mudou (a janela de saida o importa; a ancora o vigia)", () => {
        expect(ler("edit/ItemAddMenu.svelte")).not.toMatch(/noCabecalho|aliancaToque/)
    })
})
