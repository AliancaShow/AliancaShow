import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { checkActionTrigger, updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { loadShows } from "../components/helpers/setShow"
import { activeEdit, activeShow, outLocked, outputs, refreshEditSlide, showsCache } from "../stores"
import { falhaAlta } from "./aliancaFalha"
import { saidasQueMostram } from "./aliancaEditarLogica"
import { destinosDoEnvio, jaMostramOSlide, saidasParaMandar } from "./aliancaEditarSaidas"
import { refotografarSaidas } from "./aliancaRefotografar"

// Leiaute v2, fatia 3: "Mandar pro ar" de um slide que se esta EDITANDO (faixa de pendencia do centro e botao direito na miniatura).
// E o clique do slide de Mostrar (components/show/Slides.svelte `slideClick`) sem o `e`: um gesto deliberado do operador. Quem chama e um clique do
// mouse (nunca tecla: em Editar so o Esc mexe no telao), entao nao passa pela guarda de tecla em curso.

/** O `index` e a posicao no layout ativo. `saidas` vazio = as telas do slide (o que o clique no slide faz); com ids, so essas. */
export function mandarSlideAoAr(showId: string, index: number, saidas: string | string[] = []): boolean {
    const alvo = Array.isArray(saidas) ? saidas : saidas ? [saidas] : []
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
        const destinos = destinosDoEnvio({ saidas: alvo, bindings: ref[index].data?.bindings, ativas: getActiveOutputs(get(outputs) || {}, true, false, true) })
        setTimeout(() => {
            // quem ja estava neste slide, ANTES do envio (depois o `setOutput` ja escreveu o indice novo)
            const jaNoAr = jaMostramOSlide(
                destinos.map((id) => ({ id, slide: (get(outputs)[id] as any)?.out?.slide })),
                showId,
                layout,
                index
            )
            for (const id of alvo.length ? alvo : [""]) {
                setOutput("slide", { id: showId, layout, index, line: 0, revealCount: 0, itemClickReveal: false }, false, id)
                updateOut(showId, index, ref, true, id)
            }
            // o mesmo slide ja no ar: "mandar de novo" tira uma foto nova (e o que a faixa de pendencia pede) so nas saidas DESTE envio
            refotografarSaidas(jaNoAr)
        })
        return true
    } catch (erro) {
        falhaAlta("mandar-slide", erro)
        return false
    }
}

/**
 * Faixa de pendencia: manda o slide EDITADO de novo, mas so para as telas que ja o mostravam. Nunca faz outra tela pular de slide. Devolve false (e acende a
 * falha) se nenhuma tela mostra o slide: a faixa so aparece quando alguma mostra, entao isso e um erro, nao um "nada a fazer".
 */
export function atualizarSlideNoAr(showId: string, index: number): boolean {
    try {
        const layout: string = get(showsCache)[showId]?.settings?.activeLayout || ""
        const ref = layout ? _show(showId).layouts([layout]).ref()[0] || [] : []
        const todas = get(outputs) || {}
        const ids = saidasQueMostram({ showId, layout, ref, slides: get(showsCache)[showId]?.slides, posicao: index, saidas: getActiveOutputs(todas, true, true, true).map((saida) => ({ saida, slide: (todas[saida] as any)?.out?.slide })) }).map((s) => s.saida)
        if (!ids.length) {
            falhaAlta("atualizar-slide", `nenhuma saida mostra o slide ${index} do show ${showId}`)
            return false
        }
        return mandarSlideAoAr(showId, index, ids)
    } catch (erro) {
        falhaAlta("atualizar-slide", erro)
        return false
    }
}

/** as saidas que o "Mandar so para" lista (telao e transmissao; o retorno e o modo da fatia 8, nao entra aqui) */
export function saidasDoMenu(): { id: string; nome: string }[] {
    const todas = get(outputs) || {}
    return saidasParaMandar(getActiveOutputs(todas, false, true, true).map((id) => ({ id, ...(todas[id] as any) })))
}

/**
 * Botao direito numa linha de show da biblioteca -> "Editar": abre o show no editor SEM pôr no roteiro (entra como "Aberto da biblioteca"). Quem chama troca a
 * tela pela porta (`trocarTela("edit", "botao-direito")`). Nada aqui escreve em `outputs`.
 */
export function prepararEdicaoDoShow(showId: string): void {
    activeShow.set({ type: "show", id: showId } as any)
    activeEdit.set({ type: "show", slide: 0, items: [], showId } as any)
    refreshEditSlide.set(true)
    // o show pode nao estar carregado ainda (a lista da biblioteca e do indice): carrega, e o editor reage ao cache
    void loadShows([showId])
}
