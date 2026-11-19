import { describe, expect, it } from "vitest"
import { estadoDaTarja, JANELA_TENTATIVA_MS, nomeDaRecusa, nomeDoClique, oQueNaoFoiAoAr, PISCA_MS, RECUSA_MS, recusaNova, TARJA_ALTURA, vezesJaVistas } from "./aliancaTarjaLogica"
import { falhaAlta, falhas, _zerarFalhas } from "./aliancaFalha"
import { get } from "svelte/store"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { motivoDaRecusa } from "./aliancaSoRetornoLogica"

describe("C3: a tarja do so retorno", () => {
    it("tres estados; recusa so existe com o modo ligado", () => {
        expect(estadoDaTarja(false, false)).toBe("desligado")
        expect(estadoDaTarja(false, true)).toBe("desligado")
        expect(estadoDaTarja(true, false)).toBe("ligado")
        expect(estadoDaTarja(true, true)).toBe("recusa")
    })
    it("32 px sempre: a altura vem do que o componente desenha, nao de uma constante conferida contra ela mesma", () => {
        const fonte = readFileSync(join(__dirname, "../components/main/AliancaNoAr.svelte"), "utf8")
        expect(fonte).toMatch(new RegExp("height: " + TARJA_ALTURA + "px"))
        expect(fonte).toMatch(/animation: pisca 0.9s/)
        expect(fonte).toContain("RECUSA_MS")
    })
    it("o que nao foi ao ar sai da mensagem da recusa", () => {
        for (const o of ["mídia", "PDF", "áudio", "sobreposição", "efeito"]) expect(oQueNaoFoiAoAr(motivoDaRecusa(o))).toBe(o)
        expect(oQueNaoFoiAoAr("outra coisa")).toBe("item")
        expect(oQueNaoFoiAoAr(undefined)).toBe("item")
    })
    it("recusa nova = o contador cresceu", () => {
        expect(recusaNova(1, 0)).toBe(true)
        expect(recusaNova(3, 3)).toBe(false)
    })
})

describe("revisao do PR #40, achado 1: a tarja mostra a recusa ATUAL, nunca a antiga", () => {
    const duas = () => {
        _zerarFalhas()
        falhaAlta("so-retorno-recusa", motivoDaRecusa("mídia"))
        falhaAlta("so-retorno-recusa", motivoDaRecusa("áudio"))
        return get(falhas).find((f) => f.origem === "so-retorno-recusa")!
    }
    it("a 2a recusa mantem a MENSAGEM da 1a no store (por isso o tipo da mensagem nao serve)", () => {
        const a = duas()
        expect(a.vezes).toBe(2)
        expect(oQueNaoFoiAoAr(a.mensagem)).toBe("mídia")
    })
    it("duas recusas, a segunda mostra o nome da SEGUNDA tentativa", () => {
        const a = duas()
        expect(nomeDaRecusa({ nome: "Louvor.mp4", em: 1000 }, 1010, 1, motivoDaRecusa("mídia"))).toBe("Louvor.mp4")
        expect(nomeDaRecusa({ nome: "Fundo.mp3", em: 90000 }, 90020, a.vezes, a.mensagem)).toBe("Fundo.mp3")
    })
    it("sem tentativa, a 2a recusa nunca repete o tipo da 1a: diz so \"item\"", () => {
        const a = duas()
        expect(nomeDaRecusa(null, 5, a.vezes, a.mensagem)).toBe("item")
    })
    it("sem tentativa, a 1a recusa da sessao ainda tem o tipo certo", () => {
        expect(nomeDaRecusa(null, 5, 1, motivoDaRecusa("PDF"))).toBe("PDF")
    })
    it("tentativa velha demais (outro clique, ha mais que a janela) nao vale", () => {
        expect(nomeDaRecusa({ nome: "Velho", em: 0 }, JANELA_TENTATIVA_MS + 1, 3, "x")).toBe("item")
    })
})

describe("revisao do PR #40, achado 2: recusa antiga nao repisca ao remontar", () => {
    it("a tarja nasce contando as recusas que ja existiam", () => {
        _zerarFalhas()
        falhaAlta("so-retorno-recusa", motivoDaRecusa("mídia"))
        falhaAlta("outra", "x")
        const inicial = vezesJaVistas(get(falhas))
        expect(inicial).toBe(1)
        expect(recusaNova(1, inicial)).toBe(false)
        falhaAlta("so-retorno-recusa", motivoDaRecusa("mídia"))
        expect(recusaNova(get(falhas).find((f) => f.origem === "so-retorno-recusa")!.vezes, inicial)).toBe(true)
        expect(vezesJaVistas([])).toBe(0)
    })
})

describe("nome do clique", () => {
    const el = (nome: string | null, texto: string, ctx = true): any => {
        const alvo: any = { closest: (sel: string) => (sel === "[data-nome]" ? (nome ? { getAttribute: () => nome } : null) : ctx ? { innerText: texto } : null) }
        return alvo
    }
    it("data-nome vence; senao a 1a linha do .context; fora das regioes, vazio", () => {
        expect(nomeDoClique(el("Abertura", "x"))).toBe("Abertura")
        expect(nomeDoClique(el(null, "\n  Vídeo do avivamento \n 3:12"))).toBe("Vídeo do avivamento")
        expect(nomeDoClique(el(null, "", false))).toBe("")
    })
})
