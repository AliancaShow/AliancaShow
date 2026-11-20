// cabine-5 (Andre, 19/nov): escolher entre corte seco e fade quando o fundo (video/imagem) troca.
// So dados, sem stores, para o teste ler sem carregar o app. Mexe na transicao GLOBAL de midia (`transitionData.media`):
// e a unica que o audio do video tambem segue (videoPlayer.ts le a global), entao corte seco precisa de tipo "none" E duracao 0.
import type { Transition } from "../../types/Show"

export type ModoTrocaFundo = "corte" | "fade"

const FADE_PADRAO: Transition = { type: "fade", duration: 800, easing: "sine" }

export function modoTrocaFundo(media: Transition | undefined): ModoTrocaFundo {
    if (!media) return "fade"
    return media.type === "none" || !media.duration ? "corte" : "fade"
}

export function trocaFundo(media: Transition | undefined, modo: ModoTrocaFundo): Transition {
    if (modo === "corte") return { ...(media || FADE_PADRAO), type: "none", duration: 0 }
    // volta ao fade: mantem duracao/easing que o operador ja tinha ajustado, se havia
    const atual = media && media.type === "fade" && media.duration ? media : null
    return atual ? { ...atual } : { ...FADE_PADRAO }
}
