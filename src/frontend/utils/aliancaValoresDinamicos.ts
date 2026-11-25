// Valores dinamicos em portugues (fila de 24/nov: "uma tela melhor para os valores dinamicos"). O popup do FreeShow (DynamicValues.svelte)
// e do FECHO e nao muda: a janela principal (AliancaTela) intercepta a abertura dele e mostra AliancaValoresDinamicos.svelte no lugar.
// "Todos os codigos (avancado)" abre o popup original, sem mudanca. Insercao = a mesma do FreeShow (no cursor da caixa clicada com o botao
// direito), so que com o texto ja montado (um ou mais codigos). Arquivo livre (fora do fecho).
import { get, writable } from "svelte/store"
import { activeEdit, activePopup, activeShow, activeStage, overlays, popupData, refreshEditSlide, showsCache, stageShows, templates } from "../stores"
import { getLayoutRef } from "../components/helpers/show"
import { falhaAlta } from "./aliancaFalha"

export type PedidoDeValor = { obj: any; caret: { line?: number; pos?: number } }

/** aberto = a janela em portugues esta na frente, com o que o botao direito entregou */
export const valoresAbertos = writable<PedidoDeValor | null>(null)

let deixarOFreeShow = false

/** AliancaTela: troca a abertura do popup do FreeShow pela janela em portugues. Devolve o desligar. */
export function interceptarValoresDinamicos(): () => void {
    return activePopup.subscribe((p) => {
        if (p !== "dynamic_values") {
            deixarOFreeShow = false
            return
        }
        if (deixarOFreeShow) return
        const d: any = get(popupData) || {}
        valoresAbertos.set({ obj: d.obj || {}, caret: { ...(d.caret || {}) } })
        activePopup.set(null)
    })
}

/** "Todos os codigos (avancado)": o popup original do FreeShow, com o mesmo cursor */
export function abrirCodigosDoFreeShow(): void {
    const p = get(valoresAbertos)
    valoresAbertos.set(null)
    if (!p) return
    deixarOFreeShow = true
    popupData.set({ obj: p.obj, caret: p.caret })
    activePopup.set("dynamic_values")
}

/** poe `texto` no cursor da caixa (como o applyValue do FreeShow). Devolve true se entrou. `manter` = continua aberta (Ctrl + clique) */
export function inserirValor(texto: string, manter = false): boolean {
    const p = get(valoresAbertos)
    if (!p || !texto) return false
    try {
        const contextElem = (p.obj?.contextElem as HTMLElement | null) || null
        const contextEditItem = contextElem?.closest?.(".editItem") as HTMLElement | null
        const isStage = !!contextElem?.closest?.(".stage_item")
        if (!contextEditItem && !isStage) return false

        const edit: any = get(activeEdit)
        const selectedItemIndex = edit.items?.[0] ?? Number(contextEditItem?.getAttribute("data-index") || 0)
        let entrou = false

        const atualizar = (items: any, ehStage = false) => {
            const caretLine = Number.isFinite(p.caret.line) ? (p.caret.line as number) : 0
            let caretPos = Number.isFinite(p.caret.pos) ? (p.caret.pos as number) : 0
            const lines = (ehStage ? items?.lines : items?.[selectedItemIndex]?.lines) || []
            const lineIndex = lines[caretLine]?.text ? caretLine : 0
            let feito = false
            lines[lineIndex]?.text?.forEach((t: any) => {
                if (feito) return
                const value = String(t.value ?? "")
                if (value.length < caretPos) {
                    caretPos -= value.length
                    return
                }
                t.value = value.slice(0, caretPos) + texto + value.slice(caretPos)
                feito = true
                // varios seguidos (Ctrl + clique): o cursor anda
                p.caret.pos = (Number.isFinite(p.caret.pos) ? (p.caret.pos as number) : 0) + texto.length
            })
            if (feito) entrou = true
            return items
        }

        if (isStage) {
            const stage: any = get(activeStage)
            const itemId = stage?.items?.[0]
            if (!(get(stageShows) as any)[stage?.id] || !itemId) return false
            stageShows.update((a: any) => {
                a[stage.id].items[itemId] = atualizar(a[stage.id]?.items[itemId], true)
                a[stage.id].modified = Date.now()
                return a
            })
        } else if (edit.id && edit.type === "overlay") {
            overlays.update((a: any) => {
                a[edit.id].items = atualizar(a[edit.id].items)
                a[edit.id].modified = Date.now()
                return a
            })
        } else if (edit.id && edit.type === "template") {
            templates.update((a: any) => {
                a[edit.id].items = atualizar(a[edit.id].items)
                a[edit.id].modified = Date.now()
                return a
            })
        } else {
            const showId = (get(activeShow) as any)?.id || ""
            const slideId = getLayoutRef(showId)[edit.slide || 0]?.id || ""
            showsCache.update((a: any) => {
                if (!a[showId]?.slides?.[slideId]) return a
                a[showId].slides[slideId].items = atualizar(a[showId].slides[slideId].items)
                return a
            })
        }
        refreshEditSlide.set(true)
        if (!manter) valoresAbertos.set(null)
        else valoresAbertos.set({ ...p })
        return entrou
    } catch (erro) {
        falhaAlta("valores-dinamicos", erro)
        return false
    }
}
