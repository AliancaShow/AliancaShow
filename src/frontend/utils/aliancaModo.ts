import { get, writable } from "svelte/store"
import { activeEdit, activeStage, modoAlianca, outputs } from "../stores"

// Modo Culto | Preparar (AliancaShow).
// No Preparar nenhuma TECLA mexe no telao: limpar/avancar so no Culto.
// Clique na tela, celular, MIDI e API nao passam por aqui (sao gestos deliberados de quem/onde manda).

/** Uma unica regra: o teclado so mexe na saida fora do Preparar. */
export function tecladoPodeMexerNaSaida(): boolean {
    return get(modoAlianca) !== "preparar"
}

/** Cada tecla ignorada incrementa; a faixa/seletor piscam quando muda. */
export const avisoTecla = writable(0)

/**
 * Guarda de ORIGEM: devolve true quando a tecla deve ser ignorada (so `return`, nunca preventDefault).
 * Avisa (faixa/seletor piscam) so quando a tecla MEXERIA no telao: digitar, mover item no editor,
 * Ctrl+C etc. passam em silencio. Sem `e` (origem sem evento): avisa sempre.
 */
export function teclaIgnorada(e?: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: any }): boolean {
    if (tecladoPodeMexerNaSaida()) return false
    if (!e || teclaMexeriaNaSaida(e)) avisoTecla.update((n) => n + 1)
    return true
}

function teclaMexeriaNaSaida(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: any }): boolean {
    const key = e.key || ""
    if (e.ctrlKey || e.metaKey) return ["r", "l", "m", "o"].includes(key.toLowerCase())
    if (e.altKey) return false
    // Esc tem funcao propria no Preparar (fecha/volta): bloqueado no Preview, mas sem aviso
    if (key === "Escape") return false
    if (/^F[1-5]$/.test(key) || key === ".") return algoNoAr()
    if (ehCampoDeTexto(e.target)) return false
    if ([" ", "PageUp", "PageDown", "Home", "End"].includes(key)) return true
    if (key === "ArrowRight" || key === "ArrowLeft") return !(get(activeEdit)?.items?.length || get(activeStage)?.items?.length)
    return false
}

// ---------------------------------------------------------------- tecla em curso (guarda no DESTINO)

let teclaEmCurso = false
let liberarTimer: ReturnType<typeof setTimeout> | undefined
let iniciado = false

function ehCampoDeTexto(alvo: any): boolean {
    if (!alvo || typeof alvo.closest !== "function") return false
    if (alvo.isContentEditable) return true
    return !!alvo.closest('input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"], .edit')
}

/**
 * Listener de captura (App.svelte): marca "tecla em curso" de keydown ate um instante depois do keyup.
 * Cobre Enter/Espaco em botao focado, Espaco da timeline, etc., que chegam na saida sem passar pelo Preview.
 * - Modificadores sozinhos nao marcam (Ctrl+clique continua sendo clique).
 * - Digitar em campo de texto nao marca (um timer/avanco automatico nao pode travar enquanto se digita);
 *   quem toca a partir de campo de texto (busca da gaveta) tem guarda de origem.
 * - Clique/toque limpa a marca (gesto deliberado); perder o foco da janela tambem.
 */
export function iniciarMarcaDeTecla() {
    if (iniciado || typeof window === "undefined") return
    iniciado = true

    const soltar = () => {
        clearTimeout(liberarTimer)
        liberarTimer = undefined
        teclaEmCurso = false
    }

    window.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
            if (["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock"].includes(e.key)) return
            if (ehCampoDeTexto(e.target)) return
            clearTimeout(liberarTimer)
            liberarTimer = undefined
            teclaEmCurso = true
        },
        true
    )
    window.addEventListener(
        "keyup",
        () => {
            if (!teclaEmCurso) return
            // folga pros setTimeout dos atalhos (shortcuts.ts, Preview.svelte)
            clearTimeout(liberarTimer)
            liberarTimer = setTimeout(soltar, 350)
        },
        true
    )
    window.addEventListener("mousedown", soltar, true)
    window.addEventListener("pointerdown", soltar, true)
    window.addEventListener("blur", soltar)
}

/** Guarda de DESTINO: no Preparar, com uma tecla em curso, a saida recusa (e avisa). */
export function destinoRecusaTecla(): boolean {
    if (tecladoPodeMexerNaSaida() || !teclaEmCurso) return false
    avisoTecla.update((n) => n + 1)
    return true
}

// ---------------------------------------------------------------- o que esta no ar

/** Saidas que sao tela de verdade (nao retorno/palco). */
function saidasNormais() {
    return Object.entries(get(outputs) || {}).filter(([, o]: [string, any]) => o && o.enabled === true && !o.isKeyOutput && !o.stageOutput)
}

/** ids dos shows com slide no ar; indices por saida. */
export function noAr(): { ids: Set<string>; porSaida: { id: string; layout: string; index: number }[] } {
    const ids = new Set<string>()
    const porSaida: { id: string; layout: string; index: number }[] = []
    for (const [, o] of saidasNormais()) {
        const s = (o as any).out?.slide
        if (!s?.id || s.id === "temp" || s.id === "tempText") continue
        ids.add(s.id)
        porSaida.push({ id: s.id, layout: s.layout || "", index: typeof s.index === "number" ? s.index : -1 })
    }
    return { ids, porSaida }
}

export function algoNoAr(): boolean {
    return saidasNormais().some(([, o]: [string, any]) => {
        const out = o.out || {}
        return !!(out.slide?.id || out.background?.path || out.background?.id || out.overlays?.length)
    })
}
