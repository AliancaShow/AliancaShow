import { describe, expect, it } from "vitest"
import { avisarErros, idDoArquivo, planejarBibliasEmbutidas, siglaDoArquivo } from "./bibliasEmbutidasLogica"

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
        expect(p.corrigir).toEqual([{ id: "nvi", name: NVI, customName: "NVI", copyright: "Nova Versão Internacional © Biblica, Inc." }])
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

    describe("A1 nao duplicar", () => {
        const comArquivos = [{ name: "NVI" }, { name: "ARA" }, ...disco]
        it("perfil com NVI.fsb+ARA.fsb registrados continua com 2", () => {
            const reg = { nvi: { name: "NVI", id: "nvi" }, ara: { name: "ARA", id: "ara" } }
            const p = planejarBibliasEmbutidas(comArquivos, reg)
            expect(p.registrar).toEqual([])
            expect(p.corrigir).toEqual([])
            expect(p.erros).toEqual([])
        })
        it("registro com outro id mas sigla igual e arquivo equivalente tambem conta", () => {
            const p = planejarBibliasEmbutidas(comArquivos, { k1: { name: "NVI", id: "k1", customName: "NVI" }, k2: { name: "ARA.fsb", id: "k2" } })
            expect(p.registrar).toEqual([])
        })
        it("perfil vazio: 2", () => {
            expect(planejarBibliasEmbutidas(disco, {}).registrar).toHaveLength(2)
        })
        it("nvi/NVI antigo sem arquivo: 1 corrigida + ARA", () => {
            const p = planejarBibliasEmbutidas(disco, { nvi: { name: "NVI", id: "nvi", copyright: "x" } })
            expect(p.corrigir).toEqual([{ id: "nvi", name: NVI, customName: "NVI" }])
            expect(p.registrar.map((r) => r.id)).toEqual(["ara"])
        })
        it("importada a mao de outra traducao e preservada", () => {
            const p = planejarBibliasEmbutidas([...comArquivos, { name: "Outra" }], { nvi: { name: "NVI", id: "nvi" }, o: { name: "Outra", id: "o" } })
            expect(p.corrigir).toEqual([])
            expect(p.erros).toEqual([])
        })
    })

    describe("baixas", () => {
        it("NVI nova leva o copyright", () => {
            const p = planejarBibliasEmbutidas(disco, {})
            expect(p.registrar[0].registro.copyright).toBe("Nova Versão Internacional © Biblica, Inc.")
            expect(p.registrar[1].registro.copyright).toBeUndefined()
        })
        it("NVI antiga sem arquivo recebe o copyright", () => {
            expect(planejarBibliasEmbutidas(disco, { nvi: { name: "NVI", id: "nvi" } }).corrigir[0].copyright).toContain("Biblica")
        })
        it("nome registrado com .fsb ou na pasta legada nao e falso positivo", () => {
            const p = planejarBibliasEmbutidas([{ name: "Minha" }, { name: "Velha", legado: true }], { a: { name: "Minha.fsb", id: "a" }, b: { name: "Velha", id: "b" } })
            expect(p.erros).toEqual([])
        })
    })

    describe("A2 alerta visivel", () => {
        const mk = (popup: string | null) => {
            const c = { msg: "", popup: popup as string | null }
            return { c, deps: { definirMensagem: (m: string) => (c.msg = m), abrirPopup: () => (c.popup = "alert"), popupAtual: () => c.popup } }
        }
        it("define a mensagem E abre o popup alert", () => {
            const { c, deps } = mk(null)
            expect(avisarErros(["erro 1", "erro 2"], new Set(), deps)).toBe(true)
            expect(c).toEqual({ msg: "erro 1<br>erro 2", popup: "alert" })
        })
        it("nao atropela popup aberto (initialize): devolve false e nao escreve", () => {
            const { c, deps } = mk("initialize")
            expect(avisarErros(["e"], new Set(), deps)).toBe(false)
            expect(c).toEqual({ msg: "", popup: "initialize" })
        })
        it("avisa so uma vez por sessao", () => {
            const vistos = new Set<string>()
            const a = mk(null)
            avisarErros(["e"], vistos, a.deps)
            const b = mk(null)
            expect(avisarErros(["e"], vistos, b.deps)).toBe(true)
            expect(b.c.popup).toBeNull()
        })
    })
})
