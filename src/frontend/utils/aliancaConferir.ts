import { derived, get } from "svelte/store"
import type { ProjectShowRef } from "../../types/Projects"
import { activeProject, editingProjectTemplate, projects, special } from "../stores"
import { sirvoRoteiro } from "./aliancaSirvo"
import { comConferido, hashDaMusica, precisaConferir, type Conferidos } from "./aliancaConferirLogica"
import { linhasDoRoteiro, marcaDe, type MusicaDoSirvo } from "./aliancaSirvoMusicas"

// ----- AliançaShow · Preparar, fatia 3: o selo "conferir" (os stores; a conta é aliancaConferirLogica.ts) -----
//
// A memória fica no `special` (salva com as configurações do FreeShow, e portanto sobe na nuvem do
// FreeShow junto com elas; não vai ao Sirvo). "Conferido" = o operador ABRIU o item: clique no item do
// projeto, ou ↑/↓ que o deixa aberto por um instante. Nunca a passada do Sirvo, o Remote ou a API.

const CHAVE = "aliancaConferidos"
/** ↑/↓ que passa direto não conta como ter olhado */
export const ESPERA_CONFERIR_MS = 1000

const lerConferidos = (): Conferidos => {
    const c = get(special)?.[CHAVE]
    return c && typeof c === "object" && !Array.isArray(c) ? c : {}
}

type Roteiro = { event_id: string; blocos: { id: string; musicas?: MusicaDoSirvo[] | null }[] } | null | undefined

/** a música do roteiro que este item do projeto representa (só show de verdade, não o aviso cinza) */
function musicaDoItem(item: ProjectShowRef | null | undefined, eventId: string | undefined, roteiro: Roteiro): { rmId: string; musica: MusicaDoSirvo } | null {
    if (!item || !eventId || !roteiro || roteiro.event_id !== eventId) return null
    if ((item.type || "show") !== "show" || item.data?.sirvoFalta) return null
    const rmId = marcaDe(item)
    if (!rmId) return null
    const linha = linhasDoRoteiro(roteiro.blocos as any).get(rmId)
    return linha ? { rmId, musica: linha.musica } : null
}

/** o item precisa de conferência? (projeto ligado ao culto, linha viva no roteiro, ninguém abriu desta versão) */
export function itemPrecisaConferir(item: ProjectShowRef | null | undefined, eventId: string | undefined, roteiro: Roteiro, conferidos: Conferidos | null | undefined): boolean {
    const m = musicaDoItem(item, eventId, roteiro)
    return !!m && precisaConferir(conferidos, eventId!, m.rmId, m.musica)
}

/** quantas músicas do Sirvo no projeto aberto ainda precisam de conferência (0 sem projeto ligado ou em template) */
export const paraConferir = derived([projects, activeProject, editingProjectTemplate, special, sirvoRoteiro], ([$projects, $ativo, $template, $special, $roteiro]) => {
    if ($template || !$ativo) return 0
    const projeto = $projects[$ativo]
    const eventId = projeto?.sirvo?.eventId
    if (!eventId) return 0
    const conf = ($special as any)?.[CHAVE] as Conferidos | undefined
    return (projeto.shows || []).filter((i) => itemPrecisaConferir(i, eventId, $roteiro as Roteiro, conf)).length
})

/** o operador abriu o item da posição `index` do projeto aberto */
export function marcarConferidoPorIndice(index: number | null | undefined) {
    try {
        if (typeof index !== "number" || index < 0 || get(editingProjectTemplate)) return
        const projeto = get(projects)[get(activeProject) || ""]
        const eventId = projeto?.sirvo?.eventId
        const roteiro = get(sirvoRoteiro) as Roteiro
        const m = musicaDoItem(projeto?.shows?.[index], eventId, roteiro)
        if (!m || !eventId) return
        const conf = lerConferidos()
        if (!precisaConferir(conf, eventId, m.rmId, m.musica)) return
        const vivas = new Set(linhasDoRoteiro(roteiro!.blocos as any).keys())
        const nova = comConferido(conf, eventId, m.rmId, hashDaMusica(m.musica), Date.now(), vivas)
        special.update((a) => {
            a[CHAVE] = nova
            return a
        })
    } catch (erro) {
        console.error("Preparar: falha ao marcar a música como conferida", erro)
    }
}

let timerSeta: ReturnType<typeof setTimeout> | undefined
/** ↑/↓: só conta se o MESMO item continuar aberto depois de ESPERA_CONFERIR_MS */
export function marcarConferidoSeFicar(abertoAgora: () => number | null | undefined) {
    clearTimeout(timerSeta)
    const index = abertoAgora()
    if (typeof index !== "number") return
    timerSeta = setTimeout(() => {
        if (abertoAgora() === index) marcarConferidoPorIndice(index)
    }, ESPERA_CONFERIR_MS)
}
