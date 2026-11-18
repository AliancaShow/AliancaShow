// Leiaute v2, roteiro: a faixa AO VIVO. Pura. Resposta do dono (17/nov, noite): acende quando o telao esta SOLTANDO alguma coisa (saida ligada
// COM conteudo no ar: slide, fundo ou sobreposicao). "Sirvo iniciado" NAO acende e o horario da agenda tambem nao. Telao ligado e vazio: apagado.
export type EntradaAoVivo = { telaoLigado: boolean; algoNoAr: boolean }
export type FaixaAoVivo = { aceso: boolean; motivo: string }

export function faixaAoVivo(e: EntradaAoVivo): FaixaAoVivo {
    return e.telaoLigado && e.algoNoAr ? { aceso: true, motivo: "telão no ar" } : { aceso: false, motivo: "" }
}

/** o mesmo criterio de `algoNoAr()` (aliancaModo.ts), sobre o objeto de `outputs`: so saidas de tela de verdade (nao chave, nao palco) com algo no ar */
export function algoNoArEm(outputs: Record<string, any> | null | undefined): boolean {
    return Object.values(outputs || {}).some((o: any) => {
        if (!o || o.enabled !== true || o.isKeyOutput || o.stageOutput) return false
        const out = o.out || {}
        return !!(out.slide?.id || out.background?.path || out.background?.id || out.overlays?.length)
    })
}
