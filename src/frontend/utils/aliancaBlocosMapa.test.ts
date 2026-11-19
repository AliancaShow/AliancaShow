import { describe, expect, it, vi } from "vitest"
import { grupoDoInput, idDoInput, linhasFiltradas, secoesDoGrupo } from "./aliancaEditorLogica"
import { mapaDeBlocos } from "./aliancaBlocosMapa"
// boxes.ts importa helpers/array, que puxa o app todo (pdfjs precisa de DOM): so o clone interessa aqui
vi.mock("../components/helpers/array", () => ({ clone: (x: any) => JSON.parse(JSON.stringify(x)) }))
import { itemBoxes } from "../components/edit/values/boxes"
import { itemSections } from "../components/edit/values/item"

describe("mapaDeBlocos (prancha C4)", () => {
    it("texto: a vista tem os 4 blocos abertos (fonte, alinhamento, texto, linhas); Mais tem contorno/sombra/lista/acordes; Avancado tem rolagem/especiais/CSS", () => {
        const m = mapaDeBlocos("box", "text", itemBoxes.text!.sections)!
        expect(Object.keys(m.vista)).toEqual(["default", "align", "text", "lines"])
        expect(Object.keys(m.mais).sort()).toEqual(["chords", "list", "outline", "shadow"])
        expect(Object.keys(m.avancado).sort()).toEqual(["CSS", "scrolling", "special"])
    })
    it("texto: todo bloco tem rotulo proprio", () => {
        const m = mapaDeBlocos("box", "text", itemBoxes.text!.sections)!
        expect(m.rotulos).toMatchObject({ "vista:default": "Fonte", "vista:align": "Alinhamento", "vista:text": "Texto", "vista:lines": "Linhas", "mais:outline": "Contorno", "mais:shadow": "Sombra do texto", "mais:list": "Lista", "mais:chords": "Acordes", "avancado:scrolling": "Rolagem", "avancado:special": "Especiais" })
    })
    it("item e midia ganham o rotulo da vista; o resto do mapa aprovado fica como estava", () => {
        const i = mapaDeBlocos("item", "item", itemSections)!
        expect(i.rotulos["vista:position"]).toBe("Posição")
        expect(i.rotulos["mais:default"]).toBe("Fundo da caixa")
        const md = mapaDeBlocos("box", "media", itemBoxes.media!.sections)!
        expect(md.rotulos["vista:default"]).toBe("Mídia")
        expect(md.rotulos["avancado:default"]).toBe("Mistura e espelho")
    })
    it("tipo sem mapa fino continua sem mapa", () => {
        expect(mapaDeBlocos("box", "timer", (itemBoxes as any).timer?.sections || {})).toBeNull()
    })
    const casos: [string, "box" | "item", string, any][] = [
        ["texto", "box", "text", itemBoxes.text!.sections],
        ["midia", "box", "media", itemBoxes.media!.sections],
        ["item", "item", "item", itemSections]
    ]
    for (const [nome, origem, tipo, secoes] of casos) {
        it(nome + ": cada input cai em exatamente um grupo (nada some)", () => {
            const mapa = mapaDeBlocos(origem, tipo, secoes)!
            for (const [secaoId, secao] of Object.entries<any>(secoes)) {
                const ids: string[] = secao.inputs.flat().map(idDoInput)
                const vistos: string[] = []
                for (const g of ["vista", "mais", "avancado"] as const) {
                    const parte = secoesDoGrupo(mapa, g, secoes).find((s) => s.id === secaoId)
                    if (!parte) continue
                    const linhas = linhasFiltradas(secao.inputs, parte.ids).flat().map(idDoInput)
                    vistos.push(...linhas)
                    for (const i of linhas) expect(grupoDoInput(mapa, secaoId, i)).toBe(g)
                }
                expect(vistos.slice().sort(), nome + " / " + secaoId).toEqual(ids.slice().sort())
            }
        })
    }
})
