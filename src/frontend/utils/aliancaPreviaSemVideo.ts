// Cabine 6, fatia A, opcao (b) do Andre (22/nov): com a saida DESLIGADA, a previa da janela principal volta a DESENHAR o slide (Output mirror),
// mas o video vira a MINIATURA PARADA (a mesma que a biblioteca gera), sem decodificar o arquivo.
// O sinal viaja por CONTEXTO do Svelte, posto SO por AliancaPreviaDesenhada (janela principal). A janela de saida nunca poe o contexto,
// entao `previaSemVideo()` la e sempre false e Media/MediaItem seguem exatamente como antes.
import { getContext, setContext } from "svelte"

const CHAVE = "alianca-previa-sem-video"

/** chame na inicializacao do componente que envolve a previa desenhada */
export function ligarPreviaSemVideo(): void {
    setContext(CHAVE, true)
}

/** chame na inicializacao do componente (Media, MediaItem): true so dentro da previa desenhada da janela principal */
export function previaSemVideo(): boolean {
    return getContext(CHAVE) === true
}
