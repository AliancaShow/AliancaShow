// Cabine 18/nov, C5: o menu "＋ Adicionar item ▾" ancorado na barra do Editar. Pura. Mora aqui (e nao em aliancaEditorLogica.ts) porque aquele arquivo
// esta no fecho da janela de saida (o ItemAddMenu o importa) e nao pode mudar.
// ----- cabine 18/nov, C5: o menu "＋ Adicionar item ▾" ancorado na barra do Editar -----

export type LinhaDoMenu = { tipo: "item"; id: string; item: any } | { tipo: "mais"; id: string; item: any } | { tipo: "voltar" } | { tipo: "fio" } | { tipo: "titulo"; texto: string }

/** os ids que o FreeShow ja tinha no menu e que vao para dentro de "Mais" na vista do Editar (a 1a metade de "Mais": antes do fio) */
const ANTES_DO_FIO = ["table", "chart", "icon"]

/**
 * As linhas do menu: `raiz` = os grupos (texto | midia, camera | timer, relogio | Mais); `mais` = a MESMA caixa trocada por "‹ Mais itens" + os filhos
 * (nenhum item some: tabela, grafico, icone e os do FreeShow, com um fio entre os dois blocos).
 */
export function linhasDoMenu(grupos: { label?: string; items: any[] }[], vista: "raiz" | "mais"): LinhaDoMenu[] {
    if (vista === "mais") {
        const mais = grupos.flatMap((g) => g.items).find((i) => i.id === "more")
        const filhos: any[] = mais?.children || []
        const linhas: LinhaDoMenu[] = [{ tipo: "voltar" }, { tipo: "fio" }]
        const a = filhos.filter((f) => ANTES_DO_FIO.includes(f.id))
        const b = filhos.filter((f) => !ANTES_DO_FIO.includes(f.id))
        a.forEach((f) => linhas.push({ tipo: "item", id: f.id, item: f }))
        if (a.length && b.length) linhas.push({ tipo: "fio" })
        b.forEach((f) => linhas.push({ tipo: "item", id: f.id, item: f }))
        return linhas
    }
    const linhas: LinhaDoMenu[] = [{ tipo: "titulo", texto: "ADICIONAR AO SLIDE" }]
    grupos.forEach((g, i) => {
        if (i > 0) linhas.push({ tipo: "fio" })
        for (const it of g.items) linhas.push(it.children ? { tipo: "mais", id: it.id, item: it } : { tipo: "item", id: it.id, item: it })
    })
    return linhas
}

/** so as linhas que o teclado alcanca (itens, "Mais" e "voltar") */
export const alcancaveis = (linhas: LinhaDoMenu[]): number[] => linhas.flatMap((l, i) => (l.tipo === "item" || l.tipo === "mais" || l.tipo === "voltar" ? [i] : []))

/** a seta/tecla: de qual linha para qual (o primeiro item nasce marcado; as pontas nao dao a volta) */
export function moverFoco(linhas: LinhaDoMenu[], atual: number, tecla: "ArrowDown" | "ArrowUp"): number {
    const ok = alcancaveis(linhas)
    if (!ok.length) return -1
    const pos = ok.indexOf(atual)
    if (pos < 0) return ok[0]
    return ok[Math.max(0, Math.min(ok.length - 1, pos + (tecla === "ArrowDown" ? 1 : -1)))]
}

/** o que o Enter faz na linha: escolher o item, entrar em "Mais" ou voltar dele */
export function acaoDoEnter(linha: LinhaDoMenu | undefined): { fazer: "adicionar"; id: string } | { fazer: "abrir-mais" } | { fazer: "voltar" } | null {
    if (!linha) return null
    if (linha.tipo === "item") return { fazer: "adicionar", id: linha.id }
    if (linha.tipo === "mais") return { fazer: "abrir-mais" }
    if (linha.tipo === "voltar") return { fazer: "voltar" }
    return null
}
