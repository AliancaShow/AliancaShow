import { describe, expect, it } from "vitest"
import { acaoDoEnter, alcancaveis, linhasDoMenu, moverFoco } from "./aliancaAdicionarItemLogica"
import { itensDoMenuAdicionar } from "./aliancaEditorLogica"
import { slideItems } from "../components/edit/values/items"

describe("C5: menu Adicionar item (linhas e teclado)", () => {
    const grupos = itensDoMenuAdicionar(slideItems)
    it("raiz: titulo, texto | midia, camera | timer, relogio | Mais (so 'Mais' tem filhos)", () => {
        const l = linhasDoMenu(grupos, "raiz")
        expect(l[0]).toEqual({ tipo: "titulo", texto: "ADICIONAR AO SLIDE" })
        expect(l.filter((x) => x.tipo === "item" || x.tipo === "mais").map((x: any) => x.id)).toEqual(["text", "media", "camera", "timer", "clock", "more"])
        expect(l.filter((x) => x.tipo === "fio").length).toBe(3)
    })
    it("Mais troca o conteudo no lugar: voltar + todos os filhos (nenhum item some)", () => {
        const l = linhasDoMenu(grupos, "mais")
        expect(l[0]).toEqual({ tipo: "voltar" })
        const ids = l.filter((x) => x.tipo === "item").map((x: any) => x.id)
        expect(ids).toEqual(expect.arrayContaining(["table", "chart", "icon", "web", "slide_tracker", "events", "weather", "visualizer", "captions"]))
        expect(ids.indexOf("icon")).toBeLessThan(ids.indexOf("web"))
    })
    it("teclado: o primeiro item nasce marcado; setas andam e param nas pontas; Enter escolhe, abre Mais ou volta", () => {
        const l = linhasDoMenu(grupos, "raiz")
        const primeiro = moverFoco(l, -1, "ArrowDown")
        expect((l[primeiro] as any).id).toBe("text")
        expect(moverFoco(l, primeiro, "ArrowUp")).toBe(primeiro)
        const ult = alcancaveis(l).slice(-1)[0]
        expect(moverFoco(l, ult, "ArrowDown")).toBe(ult)
        expect(acaoDoEnter(l[primeiro])).toEqual({ fazer: "adicionar", id: "text" })
        expect(acaoDoEnter(l[ult])).toEqual({ fazer: "abrir-mais" })
        expect(acaoDoEnter(linhasDoMenu(grupos, "mais")[0])).toEqual({ fazer: "voltar" })
        expect(acaoDoEnter(l[0])).toBeNull()
    })
})
