// "Fundo quebrado": um slide cujo `background` aponta para uma midia que o show nao tem mais. O Slides.svelte limpa esse apontador, mas
// so deve ESCREVER em `showsCache` quando ha algo a limpar: todo `set` do cache e reenviado inteiro a janela de saida (utils/listeners.ts).
type ShowParcial = { layouts?: { [id: string]: { slides?: any } }; media?: { [id: string]: unknown } } | null | undefined

export function temFundoQuebrado(show: ShowParcial): boolean {
    if (!show) return false
    for (const layout of Object.values(show.layouts || {})) {
        if (!Array.isArray(layout?.slides)) continue
        for (const slide of layout.slides) {
            const id = slide?.background
            if (id && !show.media?.[id]) return true
        }
    }
    return false
}
