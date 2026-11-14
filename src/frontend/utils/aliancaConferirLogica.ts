import { hashDaLetra } from "./aliancaSirvoMusicas"

// ----- AliançaShow · Preparar, fatia 3: o selo "conferir" (só a conta; os stores estão em aliancaConferir.ts) -----
//
// Música que o Sirvo pôs no projeto nasce "conferir" e continua assim até alguém ABRIR o item
// (clique, ou ↑/↓ que deixa o item aberto por um instante). Se a letra mudar no Sirvo, pede de novo.
// Memória: `special.aliancaConferidos = { [eventId]: { em, marcas: { [rmId]: hash } } }`.

export type ConferidosDoCulto = { em: number; marcas: { [rmId: string]: string } }
export type Conferidos = { [eventId: string]: ConferidosDoCulto }

export const MAX_CULTOS_CONFERIDOS = 10

/** o que identifica "esta é a letra que eu vi": a letra, ou o show da biblioteca quando o Sirvo não manda letra */
export function hashDaMusica(m: { letra?: string | null; show_id?: string | null } | null | undefined): string {
    if (!m) return ""
    return m.letra ? hashDaLetra(m.letra) : `show:${m.show_id || ""}`
}

/** a linha existe no roteiro e ninguém abriu desta versão: precisa conferir */
export function precisaConferir(conferidos: Conferidos | null | undefined, eventId: string, rmId: string, musica: { letra?: string | null; show_id?: string | null } | null | undefined): boolean {
    if (!musica) return false
    return conferidos?.[eventId]?.marcas?.[rmId] !== hashDaMusica(musica)
}

/** marca como conferido; guarda só os cultos mais recentes e poda marcas cuja linha saiu do roteiro (`linhasVivas` null = não sei) */
export function comConferido(conferidos: Conferidos | null | undefined, eventId: string, rmId: string, hash: string, agora: number, linhasVivas: Set<string> | null = null): Conferidos {
    const antigo = conferidos?.[eventId]?.marcas || {}
    const marcas: { [rmId: string]: string } = {}
    for (const [k, v] of Object.entries(antigo)) if (!linhasVivas || linhasVivas.has(k)) marcas[k] = v
    marcas[rmId] = hash
    const todos: Conferidos = { ...(conferidos || {}), [eventId]: { em: agora, marcas } }
    const ids = Object.keys(todos).sort((a, b) => (todos[b].em || 0) - (todos[a].em || 0))
    const fica = new Set(ids.slice(0, MAX_CULTOS_CONFERIDOS))
    const saida: Conferidos = {}
    for (const id of Object.keys(todos)) if (fica.has(id)) saida[id] = todos[id]
    return saida
}
