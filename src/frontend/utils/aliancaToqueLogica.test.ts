import { describe, expect, it } from "vitest"
import { escEngolidoPorRepeticao, CLIQUE_REPETIDO_MS, CLIQUE_REPETIDO_PX, ESC_SEGURA_MS, chaveDoClique, criarEscSeguro, criarRepeticao } from "./aliancaToqueLogica"

describe("Esc que fechou algo segura o seguinte (700 ms)", () => {
    it("sem Esc que fechou: nada e segurado", () => {
        const e = criarEscSeguro()
        expect(e.segura(1000)).toBe(false)
    })
    it("depois de fechar, o Esc dentro de 700 ms e engolido e o de 700 ms em diante passa", () => {
        const e = criarEscSeguro()
        e.fechou(1000)
        expect(e.segura(1000 + ESC_SEGURA_MS - 1)).toBe(true)
        expect(e.segura(1000 + ESC_SEGURA_MS)).toBe(false)
    })
    it("o Esc engolido NAO reinicia a espera (quem segura a tecla nao fica preso)", () => {
        const e = criarEscSeguro()
        e.fechou(0)
        e.segura(300)
        e.segura(600)
        expect(e.segura(700)).toBe(false)
    })
    it("fechar de novo renova a espera", () => {
        const e = criarEscSeguro()
        e.fechou(0)
        e.fechou(500)
        expect(e.segura(1100)).toBe(true)
        expect(e.segura(1200)).toBe(false)
    })
})

describe("clique repetido no mesmo item (700 ms)", () => {
    it("o primeiro passa, o segundo dentro de 700 ms e engolido, o de 700 ms em diante passa", () => {
        const r = criarRepeticao<string>()
        expect(r.engole("a", 0)).toBe(false)
        expect(r.engole("a", CLIQUE_REPETIDO_MS - 1)).toBe(true)
        expect(r.engole("a", CLIQUE_REPETIDO_MS)).toBe(false)
    })
    it("itens diferentes nao se engolem", () => {
        const r = criarRepeticao<string>()
        expect(r.engole("a", 0)).toBe(false)
        expect(r.engole("b", 10)).toBe(false)
    })
    it("clicar a cada 400 ms nao silencia o item para sempre (conta contra o ultimo ACEITO)", () => {
        const r = criarRepeticao<string>()
        const res = [0, 400, 800, 1200, 1600].map((t) => r.engole("a", t))
        expect(res).toEqual([false, true, false, true, false])
    })
    it("o mapa nao cresce sem fim", () => {
        const r = criarRepeticao<number>()
        for (let i = 0; i < 200; i++) r.engole(i, i * 1000)
        expect(r.engole(0, 300000)).toBe(false)
    })
})

describe("clique repetido: distancia do ponteiro (revisao da fatia 2, achado 3)", () => {
    it("mesma chave, dentro de 700 ms e a ate 6 px: engolido", () => {
        const r = criarRepeticao<string>()
        expect(r.engole("a", 0, { x: 100, y: 100 })).toBe(false)
        expect(r.engole("a", 100, { x: 100 + CLIQUE_REPETIDO_PX, y: 100 })).toBe(true)
    })
    it("mesma chave, dentro de 700 ms mas o ponteiro andou mais de 6 px: NAO e o mesmo toque, passa", () => {
        const r = criarRepeticao<string>()
        expect(r.engole("a", 0, { x: 100, y: 100 })).toBe(false)
        expect(r.engole("a", 100, { x: 100 + CLIQUE_REPETIDO_PX + 1, y: 100 })).toBe(false)
    })
    it("vaiEngolir pergunta sem registrar", () => {
        const r = criarRepeticao<string>()
        expect(r.vaiEngolir("a", 0, { x: 1, y: 1 })).toBe(false)
        r.engole("a", 0, { x: 1, y: 1 })
        expect(r.vaiEngolir("a", 100, { x: 1, y: 1 })).toBe(true)
        expect(r.vaiEngolir("a", 100, { x: 1, y: 1 })).toBe(true)
        expect(r.vaiEngolir("b", 100, { x: 1, y: 1 })).toBe(false)
    })
})

// um DOM de mentira: cada no tem "tags" (os seletores simples que ele casa) e um pai; closest sobe do proprio no
type No = { tags: string[]; pai?: No; closest(s: string): No | null }
function no(tags: string[], pai?: No): No {
    const n: No = {
        tags,
        pai,
        closest(sel: string) {
            const lista = sel.split(",").map((x) => x.trim())
            for (let c: No | undefined = n; c; c = c.pai) if (c.tags.some((t) => lista.includes(t))) return c
            return null
        }
    }
    return n
}

describe("chaveDoClique: o clicavel mais interno, nunca o conteiner", () => {
    const centro = no(['[data-regiao="centro"]'])
    const caixa = no([".context", ".main"], centro)
    it("dois botoes irmaos dentro do mesmo .context tem chaves diferentes", () => {
        const tocar = no(["button"], caixa)
        const parar = no(["button"], caixa)
        expect(chaveDoClique(tocar)).toBe(tocar)
        expect(chaveDoClique(parar)).toBe(parar)
        expect(chaveDoClique(tocar)).not.toBe(chaveDoClique(parar))
    })
    it("o icone dentro do botao cai na chave do botao", () => {
        const b = no(["button"], caixa)
        expect(chaveDoClique(no(["svg"], b))).toBe(b)
    })
    it("versiculos e capitulos diferentes do mesmo contêiner sao chaves diferentes", () => {
        const lista = no([".context"], no(['[data-regiao="biblioteca"]']))
        const v5 = no([".verse"], lista)
        const v6 = no([".verse"], lista)
        const cap = no(["[data-item]"], lista)
        expect(chaveDoClique(v5)).toBe(v5)
        expect(chaveDoClique(v6)).not.toBe(chaveDoClique(v5))
        expect(chaveDoClique(cap)).toBe(cap)
    })
    it("sem clicavel proprio, a chave e o proprio .context (comportamento de antes)", () => {
        const l = no(["span"], caixa)
        expect(chaveDoClique(l)).toBe(caixa)
    })
    it("controles de transporte (data-sem-trava) ficam fora da trava", () => {
        const play = no(["button"], no(["[data-sem-trava]"], caixa))
        expect(chaveDoClique(play)).toBeNull()
    })
    it("fora das regioes ou sem .context: fora da trava", () => {
        expect(chaveDoClique(no(["button"], no([".context"])))).toBeNull()
        expect(chaveDoClique(no(["button"], centro))).toBeNull()
    })
})

describe("Esc: tecla segurada e esperas encadeadas (revisao da fatia 2, achado 6)", () => {
    it("auto-repeticao e engolida sempre; o toque normal nao", () => {
        expect(escEngolidoPorRepeticao({ repeat: true })).toBe(true)
        expect(escEngolidoPorRepeticao({ repeat: false })).toBe(false)
        expect(escEngolidoPorRepeticao({})).toBe(false)
    })
    it("menu fechado -> selecao desfeita -> limpar: so UMA espera (o terceiro Esc passa logo depois do segundo)", () => {
        const e = criarEscSeguro()
        e.fechou(0) // Esc 1 fecha o menu de contexto
        expect(e.segura(710)).toBe(false) // Esc 2 passa (700 ms depois)
        e.fechou(710) // ... e desseleciona: NAO arma outra espera
        expect(e.segura(720)).toBe(false) // Esc 3 limpa o telao
    })
    it("um fechamento bem depois da rajada arma a espera de novo", () => {
        const e = criarEscSeguro()
        e.fechou(0)
        e.fechou(5000)
        expect(e.segura(5100)).toBe(true)
    })
})
