import { derived, writable } from "svelte/store"
import { media, mediaTags } from "../stores"
import { aplicarEstado, etiquetasComuns, listarPastas, membrosPorPasta, type EstadoDePastas } from "./aliancaPastasMidiaLogica"

/** a pasta recem-criada: a gaveta abre o painel dela (nome e comportamento) */
export const pastaParaConfigurar = writable<string | null>(null)

export const pastas = derived(mediaTags, ($t) => listarPastas($t))
/** as etiquetas comuns, sem as pastas (menu de etiquetas, ManageTags) */
export const mediaTagsComuns = derived(mediaTags, ($t) => etiquetasComuns($t))
/** os caminhos de cada pasta (segundo o store `media`, que é deste computador) */
export const membros = derived([media, mediaTags], ([$m, $t]) => membrosPorPasta($m, $t))

// Aplica nos stores o estado de pastas do histórico (MEDIA_PASTA). Módulo pequeno e sem `history`, para o historyActions importar sem ciclo.
// Só mexe nas chaves que o estado cita: o resto do objeto `media[caminho]` (info, creationTime, tracks…) não é tocado.
export function aplicarNosStores(estado: EstadoDePastas | null | undefined) {
    if (!estado) return
    if (estado.mediaTags && Object.keys(estado.mediaTags).length) {
        mediaTags.update((t) => {
            aplicarEstado({ mediaTags: estado.mediaTags }, { mediaTags: t, media: {} })
            return t
        })
    }
    if (estado.midia && Object.keys(estado.midia).length) {
        media.update((m) => {
            aplicarEstado({ midia: estado.midia }, { mediaTags: {}, media: m })
            return m
        })
    }
}
