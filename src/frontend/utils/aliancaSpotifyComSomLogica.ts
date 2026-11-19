// Cabine 4, pedido 1: o Spotify para sozinho quando uma midia COM SOM entra no ar. Aqui mora so a conta (pura); o observador esta em
// aliancaSpotifyComSom.ts. Regra do dono: "se um video comeca a tocar, tem que parar na hora (com fade e uma boa)".

export type VideoNoAr = { path?: string; muted?: boolean; ended?: boolean; saidas?: string[] }
export type AudioNoAr = { paused?: boolean; isMic?: boolean }

/**
 * O que esta fazendo SOM agora, como um conjunto de chaves estaveis. Video: nao mudo, nao terminado e ligado a pelo menos uma saida que nao seja
 * so de retorno (`retornos` = ids das saidas com `stageOutput`; video sem saida ligada conta). Audio: nao microfone e nao pausado.
 * Video de fundo mudo em repeticao nunca entra aqui.
 */
export function chavesComSom(videos: VideoNoAr[], audios: Record<string, AudioNoAr>, retornos: Set<string>): Set<string> {
    const chaves = new Set<string>()
    for (const v of videos || []) {
        if (!v || v.muted || v.ended) continue
        const saidas = v.saidas || []
        if (saidas.length && saidas.every((s) => retornos.has(s))) continue
        chaves.add("v:" + (v.path || ""))
    }
    for (const [id, a] of Object.entries(audios || {})) {
        if (!a || a.isMic || a.paused !== false) continue
        chaves.add("a:" + id)
    }
    return chaves
}

/** So o que ENTROU conta (borda de subida): se o operador religa o Spotify com o video ja no ar, ele nao e derrubado de novo. */
export function entraramComSom(antes: Set<string>, agora: Set<string>): string[] {
    return [...agora].filter((k) => !antes.has(k))
}

/** Para o Spotify quando algo com som entrou, ele esta tocando e nao esta no meio de um fade. */
export function deveParaOSpotify(entraram: string[], spotifyTocando: boolean, emFade: boolean): boolean {
    return entraram.length > 0 && spotifyTocando && !emFade
}
