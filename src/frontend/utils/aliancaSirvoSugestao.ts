// Avanço sugerido (F2, SHOW-DESIGN.md §13.4 no repo do Sirvo).
//
// É um ATALHO, não o caminho principal: palavra, avisos e oferta muitas vezes
// não põem nada na saída. Calculado do ESTADO (o que está nas saídas agora),
// nunca de um evento. Sem certeza, nada:
// - o item de cada saída sai do `projectIndex` conferido com o id (como
//   `lerPonteiros`); sem posição, só pelo id se ele aparece UMA vez no projeto;
// - todas as saídas com slide (exceto palco) têm que cair no MESMO bloco;
// - lápide, item antes do 1º cabeçalho, "Fora do roteiro" e saída limpa: nada;
// - o bloco tem que vir DEPOIS do bloco no ar e não ter passado.
// A estabilidade (5 s no mesmo bloco) e a inércia do botão ficam na tela.
import type { ProjectShowRef } from "../../types/Projects"
import { papelDoItem, PREFIXO_SIRVO } from "./aliancaSirvoProjeto"

export type SlideNaSaida = { id?: string; projectIndex?: number } | null | undefined
export type RoteiroParaSugestao = { noAr: boolean; blocoNoAr: string | null; ordem: { id: string; feito: boolean }[] }
export type Sugestao = { destino: string; pulados: number }

/** a posição do item que a saída mostra, ou null se não dá para ter certeza */
export function posicaoNaSaida(itens: ProjectShowRef[], slide: SlideNaSaida): number | null {
    if (!slide || typeof slide.id !== "string") return null
    const pi = slide.projectIndex
    if (typeof pi === "number" && pi >= 0) return itens[pi]?.id === slide.id ? pi : null
    let achou: number | null = null
    for (let i = 0; i < itens.length; i++) {
        if (itens[i]?.id !== slide.id) continue
        if (achou !== null) return null // aparece mais de uma vez
        achou = i
    }
    return achou
}

/** o bloco do Sirvo a que pertence o item na posição `i` (o cabeçalho acima dele) */
export function blocoDaPosicao(itens: ProjectShowRef[], i: number): string | null {
    for (let k = i; k >= 0; k--) {
        const papel = papelDoItem(itens[k])
        if (!papel) continue
        if (papel !== "cabecalho") return null // lápide ou "Fora do roteiro"
        return itens[k].id.slice(PREFIXO_SIRVO.length)
    }
    return null // antes do 1º cabeçalho
}

export function sugerirAvanco(itens: ProjectShowRef[], slides: SlideNaSaida[], roteiro: RoteiroParaSugestao): Sugestao | null {
    if (!roteiro.noAr || !roteiro.blocoNoAr) return null
    const comSlide = slides.filter((s) => s)
    if (!comSlide.length) return null

    let destino: string | null = null
    for (const s of comSlide) {
        const i = posicaoNaSaida(itens, s)
        if (i === null) return null
        const b = blocoDaPosicao(itens, i)
        if (!b) return null
        if (destino !== null && destino !== b) return null
        destino = b
    }
    if (!destino) return null

    const de = roteiro.ordem.findIndex((b) => b.id === roteiro.blocoNoAr)
    const ate = roteiro.ordem.findIndex((b) => b.id === destino)
    if (de < 0 || ate <= de || roteiro.ordem[ate].feito) return null
    return { destino, pulados: ate - de }
}
