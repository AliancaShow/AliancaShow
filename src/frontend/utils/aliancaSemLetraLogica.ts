// ----- AliançaShow · Preparar, fatia 4: música "sem letra" (a conta; os stores estão em aliancaSemLetra.ts) -----
//
// "Sem letra" = música (categoria de ícone `song`) que o Show conhece só pelo nome: veio da lista da banda
// visitante e a letra ainda não chegou. Critério único (revisão I4):
//
//   categoria com `icon === "song"`  E  ( carregado ? nenhum texto nos slides : `textCache[id]` vazio )
//
// Show nunca aberto neste computador e sem entrada no `textCache` = não sabemos = não conta.
// Limite conhecido: a vazia criada em OUTRO computador chega sem `textCache` e só passa a contar depois
// de aberta aqui.

type ShowCarregado = { slides?: { [id: string]: { items?: { lines?: { text?: { value?: string }[] }[] }[] } | undefined } } | null | undefined

/** algum slide do show carregado tem texto? */
export function temTexto(show: ShowCarregado): boolean {
    const slides = show?.slides
    if (!slides) return false
    for (const s of Object.values(slides)) {
        for (const item of s?.items || []) for (const linha of item?.lines || []) for (const t of linha?.text || []) if ((t?.value || "").trim()) return true
    }
    return false
}

export function ehSemLetra(entrada: { ehMusica: boolean; carregado: ShowCarregado; textoDoCache: string | undefined }): boolean {
    if (!entrada.ehMusica) return false
    if (entrada.carregado) return !temTexto(entrada.carregado)
    return typeof entrada.textoDoCache === "string" && entrada.textoDoCache.trim() === ""
}

/** categorias que são de música (ícone `song`) */
export function categoriasDeMusica(todas: { [id: string]: { icon?: string } | undefined } | null | undefined): Set<string> {
    return new Set(
        Object.entries(todas || {})
            .filter(([, c]) => c?.icon === "song")
            .map(([id]) => id)
    )
}

/** o show é música sem letra? (reativo: o componente passa os valores dos stores) */
export function showEstaSemLetra(id: string, $shows: any, $categories: any, $showsCache: any, $textCache: any): boolean {
    const s = $shows?.[id]
    if (!s) return false
    return ehSemLetra({ ehMusica: categoriasDeMusica($categories).has(s.category || ""), carregado: $showsCache?.[id], textoDoCache: $textCache?.[id] })
}

export type Pendencias = { conferir: number; semLetra: number }

/** o texto que a faixa do Preparar acrescenta: "N pra conferir · K sem letra" (só o que for maior que zero) */
export function textoDasPendencias(p: Pendencias): string {
    const partes: string[] = []
    if (p.conferir > 0) partes.push(`${p.conferir} pra conferir`)
    if (p.semLetra > 0) partes.push(`${p.semLetra} sem letra`)
    return partes.join(" · ")
}
