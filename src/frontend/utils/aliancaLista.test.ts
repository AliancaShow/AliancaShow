import { describe, expect, it } from "vitest"
import { casarComBiblioteca, chaveDeMusica, duplicadasDe, lerLista, posicaoDeEntrada, type MusicaDoCatalogo } from "./aliancaLista"

describe("lerLista", () => {
    it("lista numerada com cabeçalho: só as numeradas contam", () => {
        const r = lerLista("Banda Visitante · domingo\n1. Ousado Amor - Isaias Saad\n2) Bondade de Deus\n3 - Oceanos (Tom: D)\n\nobrigado!")
        expect(r.map((l) => l.nome)).toEqual(["Ousado Amor", "Bondade de Deus", "Oceanos"])
        expect(r[0].cantor).toBe("Isaias Saad")
        expect(r[2].tom).toBe("D")
    })
    it("sem numeração: tira marcador e emoji, ignora vazio e pontuação", () => {
        const r = lerLista("• Santo Espírito\n- Grande é o Senhor — Fulano\n🎵 Aleluia | Cicrano\n\n---\n*   Nada Além do Sangue")
        expect(r.map((l) => l.nome)).toEqual(["Santo Espírito", "Grande é o Senhor", "Aleluia", "Nada Além do Sangue"])
        expect(r.map((l) => l.cantor)).toEqual(["", "Fulano", "Cicrano", ""])
    })
    it("tom no fim em várias formas", () => {
        expect(lerLista("Quão Grande é o Meu Deus (G)")[0]).toMatchObject({ nome: "Quão Grande é o Meu Deus", tom: "G" })
        expect(lerLista("Quão Grande - Tom A")[0]).toMatchObject({ nome: "Quão Grande", tom: "A", cantor: "" })
        expect(lerLista("Bondade (Ao Vivo)")[0].nome).toBe("Bondade (Ao Vivo)")
    })
    it("'cantor' que é só palavra de versão vira sufixo do nome", () => {
        expect(lerLista("Deus de Promessas - Ao Vivo")[0]).toMatchObject({ nome: "Deus de Promessas (Ao Vivo)", cantor: "" })
    })
    it("cabeçalho sem numeração é marcado (nasce desmarcado se não casar)", () => {
        const r = lerLista("Banda X · domingo\nLouvor de hoje:\nDomingo 16/11\nOusado Amor")
        expect(r.map((l) => l.pareceCabecalho)).toEqual([true, true, true, false])
    })
})

describe("chaveDeMusica", () => {
    it("título, caixa, pontuação e versão dão a mesma chave", () => {
        const k = chaveDeMusica("Ousado Amor")
        expect(chaveDeMusica("OUSADO AMOR!")).toBe(k)
        expect(chaveDeMusica("ousado amor (ao vivo)")).toBe(k)
        expect(chaveDeMusica("Ousado Amor [Live]")).toBe(k)
        expect(chaveDeMusica("Ousado Amor - Ao Vivo")).toBe(k)
        expect(chaveDeMusica("Ousado Amor (Acústico)")).toBe(k)
        expect(chaveDeMusica("Ousado Amor (feat. Fulano)")).toBe(k)
        expect(chaveDeMusica("Ousado Amor (Gravado ao vivo)")).toBe(k)
    })
    it("não come o que não é versão", () => {
        expect(chaveDeMusica("Santo (Parte 2)")).toBe("santo parte 2")
        expect(chaveDeMusica("Deus de Promessas")).toBe("deus de promessas")
    })
})

const cat = (...nomes: string[]): MusicaDoCatalogo[] => nomes.map((n, i) => ({ id: `s${i}`, nome: n, categoria: "song" }))

describe("casarComBiblioteca", () => {
    it("chave idêntica única: 'uma'", () => {
        expect(casarComBiblioteca("Ousado Amor", cat("Oceanos", "Ousado Amor (Ao Vivo)"))).toEqual({ tipo: "uma", showId: "s1" })
    })
    it("duas idênticas: pergunta, pré-seleciona a mais usada", () => {
        const c: MusicaDoCatalogo[] = [
            { id: "a", nome: "Oceanos", usadoEm: 10 },
            { id: "b", nome: "oceanos (ao vivo)", usadoEm: 99 }
        ]
        expect(casarComBiblioteca("Oceanos", c)).toEqual({ tipo: "varias", candidatos: ["b", "a"], identicas: true, preSelecionado: "b" })
    })
    it("'Santo' × 'Santo Espírito' pergunta, mesmo com um só candidato", () => {
        expect(casarComBiblioteca("Santo", cat("Santo Espírito", "Oceanos"))).toEqual({ tipo: "varias", candidatos: ["s0"], identicas: false, preSelecionado: null })
        expect(casarComBiblioteca("Santo Espírito Vem", cat("Santo Espírito"))).toMatchObject({ tipo: "varias" })
    })
    it("parecida (≥ 0,85) também pergunta; diferente não", () => {
        expect(casarComBiblioteca("Quão grande é o meu Deus", cat("Quao grande e o meu Deus!"))).toEqual({ tipo: "uma", showId: "s0" })
        expect(casarComBiblioteca("Aleluia Aleluia Amem", cat("Aleluia Aleluia Amen"))).toMatchObject({ tipo: "varias", identicas: false })
        expect(casarComBiblioteca("Ousado Amor", cat("Oceanos", "Grande é o Senhor"))).toEqual({ tipo: "nenhuma" })
    })
    it("palavra curta (< 4 letras) não 'contém'", () => {
        expect(casarComBiblioteca("Rei", cat("Rei dos Reis"))).toEqual({ tipo: "nenhuma" })
    })
    it("no máximo 5 candidatos", () => {
        const muitas = cat("Santo 1", "Santo 2", "Santo 3", "Santo 4", "Santo 5", "Santo 6", "Santo 7")
        const r = casarComBiblioteca("Santo", muitas)
        expect(r.tipo === "varias" && r.candidatos.length).toBe(5)
    })
})

describe("posicaoDeEntrada", () => {
    it("fim = tamanho da lista; depois = selecionado + 1; sem seleção vale o fim", () => {
        expect(posicaoDeEntrada(7, "fim", 2)).toBe(7)
        expect(posicaoDeEntrada(7, "depois", 2)).toBe(3)
        expect(posicaoDeEntrada(7, "depois", null)).toBe(7)
        expect(posicaoDeEntrada(7, "depois", 40)).toBe(7)
    })
})

describe("duplicadasDe", () => {
    const c = cat("Ousado Amor", "Oceanos")
    it("por nome", () => {
        expect(duplicadasDe("ousado amor (ao vivo)", null, c).porNome.map((d) => d.nome)).toEqual(["Ousado Amor"])
        expect(duplicadasDe("Outra", null, c).porNome).toEqual([])
    })
    it("por letra: as 3 primeiras linhas dentro do texto de outro show", () => {
        const textos = { s1: "sobre as águas eu vou caminhar senhor tu és o meu refúgio e a minha força" }
        const r = duplicadasDe("Nome Diferente", "Sobre as águas eu vou\ncaminhar Senhor\nTu és o meu refúgio", c, textos)
        expect(r.porLetra.map((d) => d.nome)).toEqual(["Oceanos"])
        expect(duplicadasDe("Nome", "oi\ntchau", c, textos).porLetra).toEqual([])
    })
})
