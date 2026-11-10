// ----- AliançaShow · o catálogo de músicas (lógica pura) -----
//
// A mesma lista serve a dois destinos:
//   - o Firebase do Remote (`catalogo/{id} = {nome}`, aliancaControle.ts), que
//     só o computador DONO do posto publica;
//   - o Sirvo (`show_publicar_catalogo`, migration 0085 do Sirvo), que só a
//     CHAVE marcada "publica as músicas" publica (aliancaSirvoCatalogo.ts).
// Música = show de categoria com ícone `song` (Músicas, Impulso,
// ProPresenter), que não seja privado.

export type MusicaDaBiblioteca = { id: string; nome: string; categoria: string; modificado: number | null }

type ShowsLike = { [id: string]: { name?: string; category?: string | null; private?: boolean; timestamps?: { modified?: number | null } } | undefined }
type CategoriasLike = { [id: string]: { name?: string; icon?: string | null } | undefined }

/** As músicas da biblioteca, em ordem de id (a ordem estável é o que deixa o hash estável). */
export function musicasDaBiblioteca(shows: ShowsLike, categorias: CategoriasLike): MusicaDaBiblioteca[] {
    const lista: MusicaDaBiblioteca[] = []
    for (const [id, show] of Object.entries(shows || {})) {
        if (!show?.name || show.private) continue
        const cat = categorias?.[show.category || ""]
        if (cat?.icon !== "song") continue
        const modificado = Number(show.timestamps?.modified)
        lista.push({
            id,
            nome: String(show.name).slice(0, 120),
            categoria: String(cat.name || "").slice(0, 60),
            modificado: Number.isFinite(modificado) && modificado > 0 ? modificado : null
        })
    }
    return lista.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** O que vai para o Sirvo. Primeira linha, artista, tom, CCLI e slides o processo principal acrescenta (lê dos arquivos). */
export type MusicaParaSirvo = { show_id: string; nome: string; categoria: string; modificado_em: number | null }

export function itensParaSirvo(lista: MusicaDaBiblioteca[]): MusicaParaSirvo[] {
    return lista.map((m) => ({ show_id: m.id, nome: m.nome, categoria: m.categoria, modificado_em: m.modificado }))
}

/**
 * Hash do catálogo (cyrb53, 53 bits em hex). Não é segurança: é só para o
 * Sirvo dizer "o que eu tenho é isso mesmo" no ping de 6 h, sem a lista ir.
 */
export function hashDoCatalogo(itens: MusicaParaSirvo[]): string {
    const texto = JSON.stringify(itens.map((i) => [i.show_id, i.nome, i.categoria, i.modificado_em]))
    let h1 = 0xdeadbeef
    let h2 = 0x41c6ce57
    for (let i = 0; i < texto.length; i++) {
        const c = texto.charCodeAt(i)
        h1 = Math.imul(h1 ^ c, 2654435761)
        h2 = Math.imul(h2 ^ c, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    const n = 4294967296 * (2097151 & h2) + (h1 >>> 0)
    return `c53_${itens.length}_${n.toString(16)}`
}

export type AcaoDoCatalogo =
    /** o Sirvo já tem esta versão */
    | { acao: "em_dia" }
    /** o hash mudou: mandar a lista */
    | { acao: "mandar_lista" }
    | { acao: "publicado"; novas: number; removidas: number; rejeitadas: { show_id: string | null; motivo: string }[] }
    /** limite do Sirvo (2 por minuto): tentar de novo em `ms` */
    | { acao: "reagendar"; ms: number }
    /** tiraria mais da metade do catálogo: o Sirvo recusou, ninguém força sozinho */
    | { acao: "recusado_metade"; vivas: number; removeria: number }
    /** esta chave não publica (o admin não ligou): não pergunta de novo por 1 h */
    | { acao: "nao_publica" }
    /** rede ou erro: tentar de novo mais tarde */
    | { acao: "falhou"; mensagem: string }

type RespostaLike = { ok: boolean; dados?: any; codigo?: string; mensagem?: string }

/** Lê a resposta de `show_publicar_catalogo` (vinda do main) e diz o que fazer. */
export function lerRespostaDoCatalogo(r: RespostaLike | null | undefined): AcaoDoCatalogo {
    if (!r) return { acao: "falhou", mensagem: "sem resposta" }
    if (!r.ok) {
        if (r.codigo === "nao_publica") return { acao: "nao_publica" }
        return { acao: "falhou", mensagem: String(r.mensagem || r.codigo || "erro") }
    }
    const d = r.dados || {}
    if (d.igual === true) return { acao: "em_dia" }
    if (d.desatualizado === true) return { acao: "mandar_lista" }
    const tente = Number(d.tente_em)
    if (Number.isFinite(tente) && tente > 0) return { acao: "reagendar", ms: Math.min(Math.max(tente, 1), 120) * 1000 }
    if (d.motivo === "removeria_mais_da_metade") return { acao: "recusado_metade", vivas: Number(d.vivas) || 0, removeria: Number(d.removeria) || 0 }
    if (d.ok === true) return { acao: "publicado", novas: Number(d.novas) || 0, removidas: Number(d.removidas) || 0, rejeitadas: Array.isArray(d.rejeitadas) ? d.rejeitadas : [] }
    return { acao: "falhou", mensagem: "resposta inesperada do Sirvo" }
}
