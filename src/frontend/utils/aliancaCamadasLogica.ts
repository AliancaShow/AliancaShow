// Leiaute v2, coluna No ar: as quatro camadas (sobreposicao F3, texto F2, fundo F1, audio F4) e o "limpar tudo", derivadas dos MESMOS stores
// que o ClearButtons le (expressoes de ClearButtons.svelte). Pura: quem le os stores e o componente. Nao toca no estado do Preview.
export type EntradaCamadas = {
    fundoLimpo: boolean
    textoLimpo: boolean
    sobreposicaoLimpa: boolean
    efeitosLimpos: boolean
    audioLimpo: boolean
    tudoLimpo: boolean
    travada: boolean
}

export type IdCamada = "sobre" | "texto" | "fundo" | "audio"

export type Camada = { id: IdCamada; tecla: "F3" | "F2" | "F1" | "F4"; rotulo: string; noAr: boolean; desabilitada: boolean }

export const COR_DA_CAMADA: Record<IdCamada, string> = { sobre: "#d98ab4", texto: "#f8f8f0", fundo: "#8cc7a6", audio: "#eba640" }

/** Ordem de cima para baixo, como o protótipo: sobreposição, texto, fundo, áudio. */
export function camadasDoNoAr(e: EntradaCamadas): Camada[] {
    return [
        { id: "sobre", tecla: "F3", rotulo: "Limpar sobreposição · F3", noAr: !(e.sobreposicaoLimpa && e.efeitosLimpos), desabilitada: e.travada || (e.sobreposicaoLimpa && e.efeitosLimpos) },
        { id: "texto", tecla: "F2", rotulo: "Limpar texto · F2", noAr: !e.textoLimpo, desabilitada: e.travada || e.textoLimpo },
        { id: "fundo", tecla: "F1", rotulo: "Limpar fundo · F1", noAr: !e.fundoLimpo, desabilitada: e.travada || e.fundoLimpo },
        { id: "audio", tecla: "F4", rotulo: "Parar áudio · F4", noAr: !e.audioLimpo, desabilitada: e.travada || e.audioLimpo }
    ]
}

export const tudoDesabilitado = (e: EntradaCamadas) => e.travada || e.tudoLimpo

/** Segurar para limpar tudo: tempo do gesto e inercia depois de aparecer (lição de 09/ago: destrutivo nao herda o pixel do seguro). */
export const SEGURAR_MS = 900

/** "16:9", "3:1"... a partir da resolucao da saida (reduz por MDC; resolucao estranha vira "w×h"). */
export function proporcaoDaSaida(w: number, h: number): string {
    if (!w || !h) return "16:9"
    const mdc = (a: number, b: number): number => (b ? mdc(b, a % b) : a)
    const g = mdc(Math.round(w), Math.round(h))
    const a = Math.round(w) / g
    const b = Math.round(h) / g
    return a <= 32 && b <= 32 ? `${a}:${b}` : `${(w / h).toFixed(2).replace(".", ",")}:1`
}
