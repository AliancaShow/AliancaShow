// Leiaute v2, roteiro: o clique num item da lista. Faz EXATAMENTE o que o `click` de ShowButton.svelte (usado pela lista de antes) fazia para um
// item de projeto: lembra o ultimo item do culto (o "＋" entra depois dele), marca como conferido, e, se o item nao era o aberto, abre
// (show: carrega e poe em `settings.activeLayout` o leiaute gravado NAQUELE item; audio: leva o nome; imagem/video: o editor vai para a midia; editor
// de modelo aberto volta para o show). Ctrl e Shift nao abrem (so selecionam, por SelectElem). Nunca escreve em `outputs`.
import { get } from "svelte/store"
import { loadShows } from "../components/helpers/setShow"
import { swichProjectItem } from "../components/helpers/showActions"
import { activeEdit, activePage, activeProject, activeShow, refreshEditSlide, showsCache } from "../stores"
import { marcarConferidoPorIndice } from "./aliancaConferir"
import { ultimoDoCulto } from "./aliancaGavetaEstado"

export type ItemDoRoteiro = { id: string; type?: string; name?: string; [k: string]: unknown }

export function abrirItemDoRoteiro(item: ItemDoRoteiro, index: number, mods: { ctrl?: boolean; shift?: boolean } = {}): void {
    if (mods.ctrl || mods.shift) return
    const type = (item.type || "show") as string
    const projetoId = get(activeProject)
    // blocos (section) so abrem; o resto da regra e dos itens
    if (type !== "section") {
        if (projetoId) ultimoDoCulto.set({ projetoId, index, id: item.id })
        marcarConferidoPorIndice(index)
    }
    // reabrir o mesmo item so conta como "visto" (acima), nao mexe em nada
    if (get(activeShow)?.index === index) return

    const novo: any = { ...item, type, index }
    if (type === "show") {
        setTimeout(async () => {
            await loadShows([item.id])
            if (get(showsCache)[item.id]) swichProjectItem(index, item.id)
        })
    }
    activeShow.set(novo)

    if (type === "image" || type === "video") activeEdit.set({ id: item.id, type: "media", items: [] } as any)
    else if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [], showId: get(activeShow)?.id } as any)

    if (get(activePage) === "edit") refreshEditSlide.set(true)
}
