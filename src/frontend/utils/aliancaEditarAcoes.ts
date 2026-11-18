import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { getActiveOutputs, refreshOut, setOutput } from "../components/helpers/output"
import { checkActionTrigger, updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { outLocked, outputs, showsCache } from "../stores"
import { falhaAlta } from "./aliancaFalha"
import { saidasParaMandar } from "./aliancaEditarSaidas"

// Leiaute v2, fatia 3: "Mandar pro ar" de um slide que se esta EDITANDO (faixa de pendencia do centro e botao direito na miniatura).
// E o clique do slide de Mostrar (components/show/Slides.svelte `slideClick`) sem o `e`: um gesto deliberado do operador. Quem chama e um clique do
// mouse (nunca tecla: em Editar so o Esc mexe no telao), entao nao passa pela guarda de tecla em curso.

/** O `index` e a posicao no layout ativo. `outputId` vazio = todas as telas (o que o clique no slide faz). */
export function mandarSlideAoAr(showId: string, index: number, outputId = ""): boolean {
    try {
        if (get(outLocked)) return false
        const layout: string = get(showsCache)[showId]?.settings?.activeLayout || ""
        const ref = layout ? _show(showId).layouts([layout]).ref()[0] || [] : []
        if (!layout || !ref[index]) {
            falhaAlta("mandar-slide", `slide ${index} do show ${showId} nao existe no layout ${layout}`)
            return false
        }
        customActionActivation("slide_click")
        checkActionTrigger(ref[index].data, index)
        // dar tempo para as acoes configuradas rodarem primeiro (igual ao clique em Mostrar)
        setTimeout(() => {
            const jaNoAr = Object.values(get(outputs) || {}).some((o: any) => o?.out?.slide?.id === showId && o.out.slide.layout === layout && o.out.slide.index === index)
            setOutput("slide", { id: showId, layout, index, line: 0, revealCount: 0, itemClickReveal: false }, false, outputId)
            updateOut(showId, index, ref, true, outputId)
            // o mesmo slide ja no ar: "mandar de novo" tira uma foto nova (e o que a faixa de pendencia pede)
            if (jaNoAr) refreshOut(true, true)
        })
        return true
    } catch (erro) {
        falhaAlta("mandar-slide", erro)
        return false
    }
}

/** as saidas que o "Mandar so para" lista (telao e transmissao; o retorno e o modo da fatia 8, nao entra aqui) */
export function saidasDoMenu(): { id: string; nome: string }[] {
    const todas = get(outputs) || {}
    return saidasParaMandar(getActiveOutputs(todas, false, true, true).map((id) => ({ id, ...(todas[id] as any) })))
}
