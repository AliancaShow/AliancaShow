import type { ProjectShowRef } from "../../types/Projects"

// ----- AliançaShow · os ponteiros do projeto seguem o MESMO item (F0b, passo 6) -----
//
// O FreeShow aponta para o projeto por POSIÇÃO: o item aberto (activeShow.index),
// o do modo foco (activeFocus.index) e o que está no telão
// (outputs[*].out.slide.projectIndex). O "próximo" soma 1 a essa posição. Quando
// o Sirvo muda a ordem dos blocos, cada ponteiro tem que ir para onde o MESMO
// item foi parar. Pelo objeto, nunca pelo id: a mesma música pode estar duas
// vezes no projeto, e ir pelo id leva o telão para a cópia errada.
//
// Só a conta, sem store: quem chama lê os ponteiros, escreve a lista nova e
// aplica o que esta função devolve, tudo na mesma passada (aliancaSirvoMontar.ts).

export type PonteiroDeItem = { index?: number | null; id?: string | null }
export type PonteirosDoProjeto = {
    /** o item aberto (activeShow) */
    ativo?: PonteiroDeItem | null
    /** o item do modo foco (activeFocus) */
    foco?: PonteiroDeItem | null
    /** posição guardada em cada saída (out.slide.projectIndex) */
    saidas?: { [saidaId: string]: number | null | undefined }
    /** posição do slide guardado ao limpar a tela (outputSlideCache), por saída */
    limpos?: { [saidaId: string]: number | null | undefined }
}
export type Remapeamento = {
    /** null: o ponteiro fica como está */
    ativo: { index: number; id: string } | null
    foco: { index: number; id: string } | null
    /** só as saídas cuja posição muda: tocar numa saída à toa reenvia o slide */
    saidas: { [saidaId: string]: number }
    /** algum ponteiro apontava para um item que sumiu da lista (não deveria: a conta nunca tira item ativo) */
    perdidos: number
}

/** onde foi parar o item que estava na posição `i` de `antes`; -1 se a posição não vale ou o item sumiu */
export function ondeFoiParar(antes: ProjectShowRef[], depois: ProjectShowRef[], i: number | null | undefined): number {
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= antes.length) return -1
    const item = antes[i]
    if (!item || typeof item !== "object") return -1
    return depois.indexOf(item)
}

/**
 * Para onde vai cada ponteiro quando a lista do projeto passa de `antes` para
 * `depois` (os mesmos objetos, em outra ordem). Devolve só o que muda. Um item
 * que trocou de id no lugar (virou lápide, era duplicata) leva o id novo junto,
 * para o destaque e o painel da seção continuarem achando o item.
 */
export function remapearPonteiros(antes: ProjectShowRef[], depois: ProjectShowRef[], p: PonteirosDoProjeto): Remapeamento {
    let perdidos = 0

    const item = (ptr: PonteiroDeItem | null | undefined) => {
        if (!ptr || typeof ptr.index !== "number" || ptr.index < 0) return null
        const j = ondeFoiParar(antes, depois, ptr.index)
        if (j < 0) {
            if (ptr.index < antes.length) perdidos++
            return null
        }
        const id = depois[j].id
        return j !== ptr.index || id !== ptr.id ? { index: j, id } : null
    }

    const saidas: { [saidaId: string]: number } = {}
    for (const [saidaId, i] of Object.entries(p.saidas || {})) {
        if (typeof i !== "number" || i < 0) continue
        const j = ondeFoiParar(antes, depois, i)
        if (j < 0) {
            if (i < antes.length) perdidos++
            continue
        }
        if (j !== i) saidas[saidaId] = j
    }

    return { ativo: item(p.ativo), foco: item(p.foco), saidas, perdidos }
}

/**
 * O Ctrl+Z do FreeShow, numa mudança da lista do projeto, guarda a lista
 * INTEIRA de antes (clonada). Desfeito depois que o Sirvo mudou a ordem com o
 * culto no ar, ele devolveria a ordem velha, com objetos novos: os ponteiros
 * por posição (item aberto e o telão) passariam a apontar para outro item, e o
 * "próximo" iria para o lugar errado. Esta é a entrada que faria isso.
 */
export function desfazListaDoProjeto(h: any, projetoId: string): boolean {
    if (!h || typeof h !== "object" || h.id !== "UPDATE") return false
    if (h.newData?.key !== "shows" && h.oldData?.key !== "shows") return false
    const ids = [h.oldData?.id, h.newData?.id].filter((id) => typeof id === "string" && id)
    // sem id, o FreeShow desfaz no projeto que estiver aberto: conta como deste
    return !ids.length || ids.includes(projetoId)
}
