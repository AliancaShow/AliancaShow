// Cabine 4, pedido 1: o Spotify para sozinho quando uma midia COM SOM passa a TOCAR. Aqui mora so a conta (pura); o observador esta em
// aliancaSpotifyComSom.ts. Regra do dono: "se um video comeca a tocar, tem que parar na hora (com fade e uma boa)".
// Revisao do PR #42 (achados 1, 2, 4, 6): a identidade e a INSTANCIA (o elemento de audio), nao o caminho; o gatilho e a borda
// "nao soava -> soa", e "soar" exige estar de fato tocando (nao pausado, nao mudo, volume > 0, nao congelado).

export type VideoNoAr = { inst: unknown; path?: string; muted?: boolean; paused?: boolean; ended?: boolean; congelado?: boolean; volume?: number; saidas?: string[] }
export type AudioNoAr = { inst: unknown; paused?: boolean; isMic?: boolean }

/** o video esta soando AGORA? (tocando de verdade, com som, e ligado a pelo menos uma saida que nao seja so de retorno) */
export function videoSoando(v: VideoNoAr, retornos: Set<string>): boolean {
    if (!v || v.muted || v.paused || v.ended || v.congelado) return false
    if (v.volume !== undefined && v.volume <= 0) return false
    const saidas = v.saidas || []
    if (saidas.length && saidas.every((s) => retornos.has(s))) return false
    return true
}

/** O conjunto das INSTANCIAS que fazem som agora. Audio: nao microfone e nao pausado. Video de fundo mudo nunca entra. */
export function instanciasComSom(videos: VideoNoAr[], audios: AudioNoAr[], retornos: Set<string>): Set<unknown> {
    const soando = new Set<unknown>()
    for (const v of videos || []) if (videoSoando(v, retornos)) soando.add(v.inst)
    for (const a of audios || []) if (a && !a.isMic && a.paused === false) soando.add(a.inst)
    return soando
}

/** So o que ENTROU conta (borda de subida): se o operador religa o Spotify com o video ja no ar, ele nao e derrubado de novo. */
export function entraramComSom(antes: Set<unknown>, agora: Set<unknown>): unknown[] {
    return [...agora].filter((k) => !antes.has(k))
}

/**
 * Para o Spotify quando algo com som entrou e ele nao esta no meio de um fade. O estado do Spotify NAO entra na conta (estaria velho
 * fora da pagina Mostrar): quem faz o fade consulta o estado fresco e desiste sozinho se ele nao estiver tocando.
 */
export function deveParaOSpotify(entraram: unknown[], emFade: boolean): boolean {
    return entraram.length > 0 && !emFade
}
