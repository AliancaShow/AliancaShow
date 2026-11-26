// AliancaShow (26/nov, teste na cabine): "apertando a seta comeca a aparecer letra no telao sem nada selecionado". Quando uma tecla de
// avanco (setas, espaco, PageUp/PageDown, Home/End) poe no ar um slide de um show que nao esta aberto, a tela de Mostrar abre esse show
// (o slide no ar ja aparece marcado na grade). So a tecla faz isso: clique, automacao, celular e API nao mudam o que esta aberto.
// Arquivo fora do fecho da janela de saida (so App.svelte o chama, e so na janela principal).
import { get } from "svelte/store"
import { activeProject, activeShow, currentWindow, outputs, projects } from "../stores"
import { telaAtual } from "./aliancaTela"

export const TECLAS_DE_AVANCO = ["ArrowRight", "ArrowLeft", " ", "PageDown", "PageUp", "Home", "End"]
const JANELA_MS = 800

type NoAr = { id: string; layout: string; index: number; projectIndex?: number } | null

/** o slide de show no ar na primeira tela normal ligada (nao retorno/palco/chave) */
export function slideDeShowNoAr(saidas: { [id: string]: any }): NoAr {
    for (const o of Object.values(saidas || {})) {
        if (!o || o.enabled !== true || o.isKeyOutput || o.stageOutput) continue
        const s = o.out?.slide
        if (!s?.id || s.id === "temp" || s.id === "tempText" || (s.type && s.type !== "show")) continue
        return { id: s.id, layout: s.layout || "", index: typeof s.index === "number" ? s.index : -1, projectIndex: s.projectIndex }
    }
    return null
}

/** decide se a tela deve abrir o show que entrou no ar (puro, testado) */
export function deveAbrir(noAr: NoAr, antes: NoAr, aberto: { id?: string } | null, msDesdeTecla: number, tela: string): boolean {
    if (!noAr || tela !== "mostrar") return false
    if (msDesdeTecla < 0 || msDesdeTecla > JANELA_MS) return false
    if (antes && antes.id === noAr.id && antes.index === noAr.index) return false
    return aberto?.id !== noAr.id
}

function ehCampo(alvo: any): boolean {
    if (!alvo || typeof alvo.closest !== "function") return false
    if (alvo.isContentEditable) return true
    return !!alvo.closest('input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"], .edit')
}

let iniciado = false
export function iniciarSegueTeclado() {
    if (iniciado || typeof window === "undefined" || get(currentWindow)) return
    iniciado = true

    let ultimaTecla = 0
    window.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || !TECLAS_DE_AVANCO.includes(e.key) || ehCampo(e.target)) return
            ultimaTecla = Date.now()
        },
        true
    )

    let antes: NoAr = slideDeShowNoAr(get(outputs))
    outputs.subscribe((saidas) => {
        const agora = slideDeShowNoAr(saidas)
        const abrir = deveAbrir(agora, antes, get(activeShow), ultimaTecla ? Date.now() - ultimaTecla : -1, telaAtual())
        antes = agora
        if (!abrir || !agora) return

        // o item do roteiro, quando veio de la (mantem o destaque no roteiro); senao, so o show
        const itens = get(projects)[get(activeProject) || ""]?.shows || []
        let indice = typeof agora.projectIndex === "number" && itens[agora.projectIndex]?.id === agora.id ? agora.projectIndex : itens.findIndex((a) => a?.id === agora.id)
        const item = indice >= 0 ? itens[indice] : null
        activeShow.set(item ? { ...item, index: indice } : { id: agora.id, type: "show" })
    })
}
