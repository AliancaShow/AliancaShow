import { describe, expect, it } from "vitest"
import { juntarAvisos, mereceAviso, type BlocoParaAviso, type Mudanca } from "./aliancaSirvoAvisos"

const INICIO = "2026-11-08T13:00:00Z"
const blocos: BlocoParaAviso[] = [
    { id: "b1", titulo: "Louvor", concluido_em: null },
    { id: "b2", titulo: "Palavra", concluido_em: null }
]
const mudanca = (extra: Partial<Mudanca>): Mudanca => ({ rev: 10, tipo: "musica_tirada", bloco_id: "b1", bloco_titulo: "Louvor", antes: null, depois: { nome: "Oceanos" }, autor: "Sala de vídeo", em: "2026-11-08T13:10:00Z", ...extra })

describe("'musica_tirada' (F3): um Show tirou do projeto uma música que o Sirvo pôs", () => {
    it("merece aviso como as músicas do bloco: só com o culto no ar e o bloco por vir; o eco do próprio Show é mudo", () => {
        expect(mereceAviso(mudanca({}), blocos, INICIO, null)).toBe(true)
        expect(mereceAviso(mudanca({ minha: true }), blocos, INICIO, null)).toBe(false)
        expect(mereceAviso(mudanca({}), blocos, null, null)).toBe(false) // antes de iniciar
        expect(mereceAviso(mudanca({}), blocos, INICIO, "2026-11-08T15:00:00Z")).toBe(false) // encerrado
        expect(mereceAviso(mudanca({ em: "2026-11-08T12:00:00Z" }), blocos, INICIO, null)).toBe(false) // antes do início
        expect(mereceAviso(mudanca({}), [{ id: "b1", titulo: "Louvor", concluido_em: "2026-11-08T13:05:00Z" }], INICIO, null)).toBe(false) // bloco já passou
    })

    it("o texto: quem tirou o quê de qual bloco; o nome vem de `depois` ou de `antes`, objeto ou texto", () => {
        expect(juntarAvisos([mudanca({})], blocos)).toEqual([{ chave: "Sala de vídeo|musica_tirada|10", texto: "Sala de vídeo tirou “Oceanos” de “Louvor”" }])
        expect(juntarAvisos([mudanca({ depois: null, antes: "Terra" })], blocos)[0].texto).toBe("Sala de vídeo tirou “Terra” de “Louvor”")
        expect(juntarAvisos([mudanca({ depois: { name: "Sangue" } })], blocos)[0].texto).toBe("Sala de vídeo tirou “Sangue” de “Louvor”")
        expect(juntarAvisos([mudanca({ depois: 7, antes: null, autor: "", bloco_titulo: null })], blocos)[0].texto).toBe("Alguém tirou “um bloco” de “um bloco”")
    })

    it("duas músicas tiradas do mesmo bloco são duas linhas, não uma 'antes → depois'", () => {
        const linhas = juntarAvisos([mudanca({ rev: 10 }), mudanca({ rev: 11, depois: { nome: "Terra" } })], blocos)
        expect(linhas.map((l) => l.texto)).toEqual(["Sala de vídeo tirou “Oceanos” de “Louvor”", "Sala de vídeo tirou “Terra” de “Louvor”"])
    })

    it("tipo desconhecido não derruba nada: não merece aviso, e o texto é genérico", () => {
        const m = mudanca({ tipo: "coisa_nova", depois: { x: 1 } })
        expect(mereceAviso(m, blocos, INICIO, null)).toBe(false)
        expect(juntarAvisos([m], blocos)[0].texto).toBe("Sala de vídeo mudou o roteiro")
    })
})
