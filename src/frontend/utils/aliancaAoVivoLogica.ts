// Leiaute v2, roteiro: a faixa AO VIVO. Pura. Resposta do dono (17/nov, noite): acende quando o telao esta SOLTANDO alguma coisa (saida ligada
// COM conteudo no ar: slide, fundo ou sobreposicao). "Sirvo iniciado" NAO acende e o horario da agenda tambem nao. Telao ligado e vazio: apagado.
//
// Revisao da fatia 2 (achados 5.1 e 5.3): o "ligado" vem de `outputState` (por SAIDA), nao de `outputDisplay`, que o FreeShow so escreve quando TODAS as
// saidas visiveis concordam e por isso congela em estado misto. Efeitos, desenho (preencher, zoom, pintura) e audio tambem contam como "soltando algo":
// assim o AO VIVO nao apaga a cada Esc parcial, so quando realmente nada esta no ar.
export type EntradaAoVivo = { telaoLigado: boolean; algoNoAr: boolean }
export type FaixaAoVivo = { aceso: boolean; motivo: string }
export type EstadoDaSaida = { id: string; active: boolean | "invisible" }
/** o que sai pelo telao sem morar numa saida: desenho (global) e audio tocando */
export type ExtrasNoAr = { desenho: boolean; audio: boolean }

export function faixaAoVivo(e: EntradaAoVivo): FaixaAoVivo {
    return e.telaoLigado && e.algoNoAr ? { aceso: true, motivo: "telão no ar" } : { aceso: false, motivo: "" }
}

/** saida de tela de verdade (nao chave, nao palco) habilitada */
function ehTela(o: any): boolean {
    return !!o && o.enabled === true && !o.isKeyOutput && !o.stageOutput
}

/** a saida esta ligada agora (estado por saida; `invisible` = so NDI, nao e tela) */
function ligada(id: string, estados: EstadoDaSaida[] | null | undefined): boolean {
    return (estados || []).find((s) => s.id === id)?.active === true
}

/** existe saida de tela ligada, saida por saida */
export function telaoLigadoEm(outputs: Record<string, any> | null | undefined, estados: EstadoDaSaida[] | null | undefined): boolean {
    return Object.entries(outputs || {}).some(([id, o]) => ehTela(o) && ligada(id, estados))
}

/**
 * Alguma saida de tela LIGADA solta algo: slide, fundo, sobreposicao ou efeito na propria saida; ou desenho/audio (extras), que so contam com o telao ligado.
 * Saida com conteudo mas desligada nao conta.
 */
export function algoNoArEm(outputs: Record<string, any> | null | undefined, estados: EstadoDaSaida[] | null | undefined, extras: ExtrasNoAr = { desenho: false, audio: false }): boolean {
    const ligadas = Object.entries(outputs || {}).filter(([id, o]) => ehTela(o) && ligada(id, estados))
    if (!ligadas.length) return false
    if (extras.desenho || extras.audio) return true
    return ligadas.some(([, o]: [string, any]) => {
        const out = o.out || {}
        return !!(out.slide?.id || out.background?.path || out.background?.id || out.overlays?.length || out.effects?.length)
    })
}
