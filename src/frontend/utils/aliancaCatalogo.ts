// ----- AliançaShow · o catálogo de músicas (lógica pura) -----
//
// A mesma lista serve a dois destinos:
//   - o Firebase do Remote (`catalogo/{id} = {nome}`, aliancaControle.ts), que
//     só o computador DONO do posto publica;
//   - o Sirvo (`show_publicar_catalogo`, migration 0085 do Sirvo), que só a
//     CHAVE marcada "publica as músicas" publica (aliancaSirvoCatalogo.ts).
// Música = show de categoria com ícone `song` (Músicas, Impulso,
// ProPresenter), que não seja privado nem rascunho ("Novas do Sirvo", F3).

import { detalhesDoShow, type DetalhesDaMusica } from "../../electron/sirvo/catalogoDetalhes"
import { CATEGORIA_NOVAS, PREFIXO_RASCUNHO } from "./aliancaSirvoMusicas"

export type MusicaDaBiblioteca = { id: string; nome: string; categoria: string; modificado: number | null }

type ShowsLike = { [id: string]: { name?: string; category?: string | null; private?: boolean; timestamps?: { modified?: number | null } } | undefined }
type CategoriasLike = { [id: string]: { name?: string; icon?: string | null } | undefined }

/** As músicas da biblioteca, em ordem de id (a ordem estável é o que deixa o hash estável). */
export function musicasDaBiblioteca(shows: ShowsLike, categorias: CategoriasLike): MusicaDaBiblioteca[] {
    const lista: MusicaDaBiblioteca[] = []
    for (const [id, show] of Object.entries(shows || {})) {
        if (!show?.name || show.private || show.category === CATEGORIA_NOVAS) continue
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

/**
 * O que vai para o Sirvo. Primeira linha, artista, CCLI e o trecho o processo
 * principal acrescenta (lê dos arquivos). `sirvo_musicas` (F3, migration 0086):
 * as linhas de "música nova" do Sirvo que ESTA música é — o Sirvo troca a nova
 * pelo show_id real.
 */
export type MusicaParaSirvo = { show_id: string; nome: string; categoria: string; modificado_em: number | null; sirvo_musicas?: string[] } & Partial<DetalhesDaMusica>

const UUID_SEM_HIFEN = /^[0-9a-f]{32}$/i

/** o rascunho `sn_<uuid sem hífen>` diz de qual linha do Sirvo ele nasceu */
export function linhaDoRascunho(showId: string): string | null {
    if (!showId.startsWith(PREFIXO_RASCUNHO)) return null
    const h = showId.slice(PREFIXO_RASCUNHO.length)
    if (!UUID_SEM_HIFEN.test(h)) return null
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toLowerCase()
}

/**
 * @param ligacoes "é esta?": linha do Sirvo → show que o operador ligou. O
 *   rascunho aprovado (saiu de "Novas do Sirvo") se liga sozinho pelo id.
 */
export function itensParaSirvo(lista: MusicaDaBiblioteca[], ligacoes: { [rmId: string]: string } = {}): MusicaParaSirvo[] {
    const porShow = new Map<string, string[]>()
    const ligar = (showId: string, rmId: string) => {
        const l = porShow.get(showId) || []
        if (!l.includes(rmId) && l.length < 20) l.push(rmId)
        porShow.set(showId, l)
    }
    for (const [rmId, showId] of Object.entries(ligacoes || {})) if (rmId && typeof showId === "string" && showId) ligar(showId, rmId)
    for (const m of lista) {
        const rm = linhaDoRascunho(m.id)
        if (rm) ligar(m.id, rm)
    }
    return lista.map((m) => {
        const item: MusicaParaSirvo = { show_id: m.id, nome: m.nome, categoria: m.categoria, modificado_em: m.modificado }
        const ligadas = porShow.get(m.id)
        if (ligadas?.length) item.sirvo_musicas = [...ligadas].sort()
        return item
    })
}

/**
 * Hash do catálogo (cyrb53, 53 bits em hex). Não é segurança: é só para o
 * Sirvo dizer "o que eu tenho é isso mesmo" no ping de 6 h, sem a lista ir.
 */
export function hashDoCatalogo(itens: MusicaParaSirvo[]): string {
    const texto = JSON.stringify(itens.map((i) => (i.sirvo_musicas?.length ? [i.show_id, i.nome, i.categoria, i.modificado_em, i.sirvo_musicas] : [i.show_id, i.nome, i.categoria, i.modificado_em])))
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
    // o prefixo é a VERSÃO DO FORMATO: mudou o que vai em cada item (c54 = com a letra),
    // a assinatura muda e a próxima conversa manda a lista inteira de novo
    return `c54_${itens.length}_${n.toString(16)}`
}

/**
 * Show editado e ainda não gravado: o arquivo no disco está velho, então o
 * main não pode ler o conteúdo dele. O renderer calcula os detalhes (trecho,
 * primeira linha, letra…) do show em memória, com a MESMA função pura do main.
 * O hash não muda: ele só olha id/nome/categoria/modificado/ligações.
 */
export function comDetalhesDosNaoSalvos(itens: MusicaParaSirvo[], naoSalvo: (id: string) => boolean, cache: { [id: string]: any }): MusicaParaSirvo[] {
    return itens.map((item) => (naoSalvo(item.show_id) && cache?.[item.show_id] ? { ...item, ...detalhesDoShow(cache[item.show_id]) } : item))
}

/** Teto do corpo da publicação (o limite do Sirvo/PostgREST é maior; aqui sobra folga). */
export const CORPO_MAX_BYTES = 7_500_000

export function tamanhoDoCorpo(itens: unknown): number {
    const texto = JSON.stringify(itens)
    // UTF-8 sem depender de TextEncoder/Buffer (renderer e testes)
    let bytes = 0
    for (let i = 0; i < texto.length; i++) {
        const c = texto.charCodeAt(i)
        bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdbff ? (i++, 4) : 3
    }
    return bytes
}

export function semLetra(itens: MusicaParaSirvo[]): MusicaParaSirvo[] {
    return itens.map((item) => {
        if (!("letra" in item)) return item
        const copia = { ...item }
        delete copia.letra
        return copia
    })
}

/**
 * Mandar de novo SEM `letra`? Sim quando o Sirvo recusou por tamanho
 * (Postgres 54000 "program_limit_exceeded", ou HTTP 413) ou quando o corpo
 * já estimado passa do teto. O catálogo básico nunca depende da letra.
 * @param tamanho bytes do corpo com as letras (os itens que vão ao Sirvo)
 */
export function deveTirarALetra(r: { ok: boolean; pg?: string } | null | undefined, tamanho: number): boolean {
    if (tamanho > CORPO_MAX_BYTES) return true
    return !!r && !r.ok && (r.pg === "54000" || r.pg === "413")
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
