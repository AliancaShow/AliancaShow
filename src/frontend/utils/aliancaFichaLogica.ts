// AliancaShow (26/nov, cabine): a ficha da musica no Editar (titulo, categoria, modelo, "Revisada"). So conta, sem store.
import { CATEGORIA_NOVAS, idDoRascunho, itemDe } from "./aliancaSirvoMusicas"

type Cats = { [id: string]: { name?: string; icon?: string } | undefined }

/** para onde vai o rascunho ao marcar "Revisada": a categoria de musica sugerida, nunca "Novas do Sirvo"; senao "song"; senao a 1a de musica */
export function destinoDaRevisao(sugerida: string | null | undefined, cats: Cats): string | null {
    const musica = Object.entries(cats || {})
        .filter(([id, c]) => c?.icon === "song" && id !== CATEGORIA_NOVAS)
        .map(([id]) => id)
    if (sugerida && sugerida !== CATEGORIA_NOVAS && cats?.[sugerida]) return sugerida
    if (cats?.song) return "song"
    return musica[0] || null
}

/** as categorias do seletor, por nome; "Novas do Sirvo" so aparece quando a musica ainda esta nela */
export function opcoesDeCategoria(cats: Cats, atual: string | null | undefined, traduzir: (k: string) => string): { id: string; nome: string }[] {
    return Object.entries(cats || {})
        .filter(([id, c]) => !!c && (id !== CATEGORIA_NOVAS || atual === CATEGORIA_NOVAS))
        .map(([id, c]) => {
            const n = c?.name || ""
            return { id, nome: n.startsWith("category.") ? traduzir(n) : n || "Sem nome" }
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

export const ehRascunhoDoSirvo = (categoria: string | null | undefined) => categoria === CATEGORIA_NOVAS

/**
 * "Revisada" sem esperar a montagem do Sirvo (que so roda com o Sirvo conectado): no roteiro, o aviso "✎ Rascunho" desta musica vira a
 * propria musica, com a mesma marca da linha do Sirvo (o mesmo item que a montagem poria: itemDe tipo "show"). null = nada a trocar.
 */
export function trocarAvisoPelaMusica<T extends { id?: string; type?: string; data?: any }>(itens: T[], showId: string): T[] | null {
    let trocou = false
    const nova = (itens || []).map((it) => {
        const rm = it?.data?.sirvoMusica
        if (!it?.data?.sirvoFalta || typeof rm !== "string" || idDoRascunho(rm) !== showId) return it
        trocou = true
        return itemDe({ rmId: rm, tipo: "show", showId }) as any as T
    })
    return trocou ? nova : null
}
