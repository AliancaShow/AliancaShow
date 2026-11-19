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
    // C5 (cabine 18/nov, contrato mudou): o menu da barra do Editar e o AliancaAdicionarItem (botao com nome, menu ancorado no wrapper); o ItemAddMenu fica so no Palco
    it("o cabecalho do centro de Editar monta o AliancaAdicionarItem dentro do wrapper .addCab (e nao o ItemAddMenu)", () => {
        expect(ler("main/AliancaEditarCentro.svelte")).toMatch(/<div class="addCab"[^>]*><AliancaAdicionarItem/)
        expect(ler("main/AliancaEditarCentro.svelte")).not.toMatch(/<ItemAddMenu/)
    })
    it("o wrapper e a ancora (relative) e o menu abre do botao para baixo, alinhado pela direita, sem vidro nem pilulas", () => {
        expect(ler("main/AliancaEditarCentro.svelte")).toMatch(/\.addCab \{[^}]*position: relative/)
        const menu = ler("main/AliancaAdicionarItem.svelte")
        expect(menu).toMatch(/\.menu \{[^}]*position: absolute;[^}]*top: calc\(100% \+ 6px\);[^}]*right: 0/)
        expect(menu).not.toMatch(/backdrop-filter|border-radius: 50px|border-radius: 25px/)
    })
    it("o ItemAddMenu nao mudou (a janela de saida o importa; a ancora o vigia)", () => {
        expect(ler("edit/ItemAddMenu.svelte")).not.toMatch(/noCabecalho|aliancaToque/)
    })
})
