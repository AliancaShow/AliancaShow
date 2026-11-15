import { get } from "svelte/store"
import { clone } from "../components/helpers/array"
import { historyCacheCount, redoHistory, showsCache, undoHistory } from "../stores"
import { entradaAgrupada } from "./aliancaEditorLogica"

/**
 * Preparar, fatia 8b: roda `acao` (que escreve em varios slides sem gravar historico) e empurra UMA entrada de desfazer
 * com o estado dos slides antes e depois. O Culto nao passa por aqui.
 */
export async function comDesfazerAgrupado(showId: string, acao: () => Promise<void> | void): Promise<void> {
    const antes = clone(get(showsCache)[showId]?.slides || {})
    await acao()
    const depois = clone(get(showsCache)[showId]?.slides || {})

    const entrada = entradaAgrupada(showId, antes, depois, Date.now())
    if (!entrada) return

    redoHistory.set([])
    undoHistory.update((uh: any[]) => {
        uh.push(entrada)
        return uh.slice(-get(historyCacheCount))
    })
}
