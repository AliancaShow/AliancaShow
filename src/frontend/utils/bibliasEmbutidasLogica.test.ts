import { describe, expect, it } from "vitest"
import { idDoArquivo, planejarBibliasEmbutidas, siglaDoArquivo } from "./bibliasEmbutidasLogica"

const NVI = "Nova Versao Internacional (NVI)"
const ARA = "Almeida Revista e Atualizada 1993 (ARA)"
const disco = [
    { name: ARA, embutida: true },
    { name: NVI, embutida: true }
]

describe("Biblias embutidas", () => {
    it("deriva sigla e id do nome do arquivo", () => {
        expect(siglaDoArquivo(NVI)).toBe("NVI")
        expect(idDoArquivo(ARA)).toBe("ara")
    })

    it("perfil vazio: registra as 2, NVI primeiro, com o nome do arquivo", () => {
        const p = planejarBibliasEmbutidas(disco, {})
        expect(p.registrar.map((r) => r.id)).toEqual(["nvi", "ara"])
        expect(p.registrar.map((r) => r.registro.name)).toEqual([NVI, ARA])
        expect(p.erros).toEqual([])
    })

    it("perfil antigo nvi/'NVI': corrige o nome para o arquivo e registra so a ARA", () => {
        const p = planejarBibliasEmbutidas(disco, { nvi: { name: "NVI", id: "nvi" } })
        expect(p.corrigir).toEqual([{ id: "nvi", name: NVI, customName: "NVI" }])
        expect(p.registrar.map((r) => r.id)).toEqual(["ara"])
        expect(p.erros).toEqual([])
    })

    it("Biblia importada pelo usuario e preservada (e sem duplicar a que ja casa)", () => {
        const proprias = { x1: { name: "Minha Biblia", id: "x1" }, nvi: { name: NVI, id: "nvi" } }
        const p = planejarBibliasEmbutidas([...disco, { name: "Minha Biblia" }], proprias)
        expect(p.corrigir).toEqual([])
        expect(p.registrar.map((r) => r.id)).toEqual(["ara"])
        expect(p.erros).toEqual([])
    })

    it("id ocupado por Biblia do usuario nao e sobrescrito", () => {
        const p = planejarBibliasEmbutidas([...disco, { name: "Outra" }], { ara: { name: "Outra", id: "ara" }, nvi: { name: NVI, id: "nvi" } })
        expect(p.registrar[0].id).toBe("ara-embutida")
    })

    it("registro sem arquivo e sem equivalente embutido: erro alto", () => {
        const p = planejarBibliasEmbutidas(disco, { zzz: { name: "Fantasma", id: "zzz" }, nvi: { name: NVI, id: "nvi" } })
        expect(p.erros).toHaveLength(1)
        expect(p.erros[0]).toContain("Fantasma")
    })
})
