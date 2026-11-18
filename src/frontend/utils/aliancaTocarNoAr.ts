// Leiaute v2, biblioteca: o botao ▶ da linha. Poe o item no fim do roteiro do culto aberto E manda o PRIMEIRO slide ao ar, pelo mesmo
// caminho do clique num slide de Mostrar (`slideClick` de show/Slides.svelte: `setOutput("slide")` + `updateOut`). Respeita a saida travada.
// A trava de clique repetido (< 700 ms no mesmo botao) e a global de aliancaToque (o ▶ e um botao dentro de `.context`, na regiao da biblioteca).
// So e importado por componentes da janela principal.
import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { getLayoutRef } from "../components/helpers/show"
import { loadShows } from "../components/helpers/setShow"
import { setOutput } from "../components/helpers/output"
import { checkActionTrigger, updateOut } from "../components/helpers/showActions"
import { outLocked, projects, activeProject, showsCache } from "../stores"
import { porShowNoFim } from "./aliancaBiblioteca"
import { newToast } from "./common"

export const MOTIVO_TRAVADA = "a saída está travada: destrave para mandar ao ar"

/**
 * Retorna o motivo de nao ter ido ao ar ("" = foi). A falha em por no roteiro (sem culto aberto) vai em aviso e NAO impede o envio.
 * `entrarNoRoteiro: false` e o "Mostrar agora (sem pôr no roteiro)" do botao direito (fatia 6): o telao recebe o primeiro slide e o roteiro nao muda.
 */
export async function tocarShowNoAr(id: string, opcoes: { entrarNoRoteiro?: boolean } = {}): Promise<string> {
    if (get(outLocked)) {
        newToast(MOTIVO_TRAVADA)
        return MOTIVO_TRAVADA
    }
    const projetoId = get(activeProject)
    const jaNoCulto = !!projetoId && (get(projects)[projetoId]?.shows || []).some((s: { id: string }) => s.id === id)
    if (!jaNoCulto && opcoes.entrarNoRoteiro !== false) {
        const r = porShowNoFim(id)
        if (!r.entrou && r.motivo) newToast(`Não entrou no roteiro: ${r.motivo}`)
    }
    await loadShows([id])
    if (!get(showsCache)[id]) {
        newToast("não consegui abrir esse show")
        return "não consegui abrir esse show"
    }
    const layoutRef = getLayoutRef(id)
    const primeiro = layoutRef.findIndex((a: { data: { disabled?: boolean } }) => !a.data.disabled)
    if (primeiro === -1) {
        newToast("esse show não tem slides para mandar ao ar")
        return "sem slides"
    }
    if (get(outLocked)) return MOTIVO_TRAVADA
    customActionActivation("slide_click")
    checkActionTrigger(layoutRef[primeiro]?.data, primeiro)
    setOutput("slide", { id, layout: get(showsCache)[id].settings.activeLayout, index: primeiro, line: 0, revealCount: 0, itemClickReveal: false })
    updateOut(id, primeiro, layoutRef, true)
    return ""
}
