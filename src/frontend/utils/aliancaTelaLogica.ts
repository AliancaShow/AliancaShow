// Leiaute v2: as contas da tela (puras, testadas em aliancaTelaLogica.test.ts). Tudo em px de CONTEUDO (o `main` de App.svelte).
import type { AliancaTelaValores } from "./aliancaTelaEstado"

export const LIMITES = { esq: [200, 460], dir: [260, 460], bib: [140, 560] } as const
export const CENTRO_MIN_LARGURA = 480
export const FAIXA_MIN_ALTURA = 240
export const ALTURA_TOPO = 56
/** padding horizontal total do esqueleto (10 + 10) mais as duas divisorias de 8 px que ficam entre esquerda/centro e entre area/direita */
export const FOLGA_LARGURA = 20 + 8 + 8
/** topo + padding de baixo (10) + divisoria horizontal (8) */
export const FOLGA_ALTURA = ALTURA_TOPO + 10 + 8

const lim = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const larguraDoCentro = (conteudoW: number, v: AliancaTelaValores) => conteudoW - FOLGA_LARGURA - v.esq - v.dir
export const alturaDaFaixa = (conteudoH: number, v: AliancaTelaValores) => conteudoH - FOLGA_ALTURA - v.bib

/** Presos aos limites e ao minimo do centro e da faixa de cima. Quando a janela encolhe, cede primeiro a esquerda, depois a direita
 *  (largura) e a biblioteca (altura), cada uma ate o seu minimo. Nunca devolve valor fora dos limites individuais. */
export function prender(v: AliancaTelaValores, conteudo: { w: number; h: number }): AliancaTelaValores {
    let esq = lim(Number.isFinite(v.esq) ? v.esq : 280, ...LIMITES.esq)
    let dir = lim(Number.isFinite(v.dir) ? v.dir : 330, ...LIMITES.dir)
    let bib = lim(Number.isFinite(v.bib) ? v.bib : 260, ...LIMITES.bib)
    let falta = CENTRO_MIN_LARGURA - (conteudo.w - FOLGA_LARGURA - esq - dir)
    if (falta > 0) {
        const daEsq = Math.min(falta, esq - LIMITES.esq[0])
        esq -= daEsq
        falta -= daEsq
    }
    if (falta > 0) dir -= Math.min(falta, dir - LIMITES.dir[0])
    const faltaH = FAIXA_MIN_ALTURA - (conteudo.h - FOLGA_ALTURA - bib)
    if (faltaH > 0) bib -= Math.min(faltaH, bib - LIMITES.bib[0])
    return { esq: Math.round(esq), dir: Math.round(dir), bib: Math.round(bib) }
}

/** Arrasto: quem para e a divisoria arrastada. `qual` e a que o mouse segura; `inicio` o valor quando pegou; `delta` o movimento em px
 *  no eixo dela (para a direita e para baixo positivos). A esquerda cresce com o mouse; a direita e a biblioteca encolhem com ele. */
export function arrastar(qual: keyof AliancaTelaValores, atual: AliancaTelaValores, inicio: number, delta: number, conteudo: { w: number; h: number }): AliancaTelaValores {
    const alvo = qual === "esq" ? inicio + delta : inicio - delta
    const [lo, hi] = LIMITES[qual]
    let valor = lim(alvo, lo, hi)
    const saida = { ...atual }
    if (qual === "esq") valor = Math.min(valor, conteudo.w - FOLGA_LARGURA - atual.dir - CENTRO_MIN_LARGURA)
    if (qual === "dir") valor = Math.min(valor, conteudo.w - FOLGA_LARGURA - atual.esq - CENTRO_MIN_LARGURA)
    if (qual === "bib") valor = Math.min(valor, conteudo.h - FOLGA_ALTURA - FAIXA_MIN_ALTURA)
    saida[qual] = Math.max(lo, Math.round(valor))
    return saida
}

/** `repeat(auto-fill, minmax(180px, 1fr))` com gap de 12 px e 16 px de padding de cada lado, mais 10+10 da grade do app. */
export function colunasDaGrade(largura: number): number {
    return Math.max(1, Math.floor((largura - 20) / 192))
}
