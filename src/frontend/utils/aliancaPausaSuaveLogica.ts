// Cabine 6 (D25/D27): a curva do "Pausar suave" e as contas do "Parar". So funcoes puras: quem mexe no player e `aliancaPausaSuave.ts`.
//   Pausar = desacelera numa curva FIXA de 0,7 s (ease-out) ate a menor velocidade que o Chromium aceita e entao pausa. O som acompanha:
//   o volume cai na mesma curva ate 0 e, ja pausado, volta ao nivel de antes (para quando o operador der play; o play e sempre manual, D4).
//   Parar = tira a midia do ar (video: limpa o fundo das saidas que mostram AQUELE arquivo; audio: limpa aquele audio).

/** duracao fixa da pausa suave (D27: nada de ajuste) */
export const PAUSA_SUAVE_MS = 700
/** a menor `playbackRate` que o Chromium aceita num elemento de midia (abaixo disso ele recusa) */
export const VELOCIDADE_MINIMA = 0.0625
/** passo do relogio da curva: ~20 amostras em 0,7 s, e cada passo empurra o estado para as saidas */
export const PASSO_PAUSA_MS = 35

/** 0..1 do tempo decorrido da pausa */
export function progressoDaPausa(ms: number): number {
    if (!Number.isFinite(ms) || ms <= 0) return 0
    return Math.min(1, ms / PAUSA_SUAVE_MS)
}

/** ease-out cubica: cai rapido no comeco e assenta devagar no fim (o freio de um carro chegando) */
export function easeOut(p: number): number {
    const x = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0))
    return 1 - Math.pow(1 - x, 3)
}

/** a velocidade do relogio principal aos `ms` da pausa, partindo da velocidade de antes (`base`, 1 = normal) */
export function velocidadeNaPausa(ms: number, base = 1): number {
    const b = Number.isFinite(base) && base > VELOCIDADE_MINIMA ? base : 1
    const v = b - (b - VELOCIDADE_MINIMA) * easeOut(progressoDaPausa(ms))
    return Math.max(VELOCIDADE_MINIMA, Math.min(b, v))
}

/** o multiplicador que vai para as saidas (velocidade / base): 1 no comeco, VELOCIDADE_MINIMA/base no fim */
export function fatorDaRampa(ms: number, base = 1): number {
    const b = Number.isFinite(base) && base > VELOCIDADE_MINIMA ? base : 1
    return velocidadeNaPausa(ms, b) / b
}

/** o volume aos `ms` da pausa, partindo de `volume0` (a mesma curva: chega a 0 junto com a velocidade minima) */
export function volumeNaPausa(ms: number, volume0: number): number {
    const v0 = Number.isFinite(volume0) && volume0 > 0 ? volume0 : 0
    return Math.max(0, v0 * (1 - easeOut(progressoDaPausa(ms))))
}

export function pausaTerminou(ms: number): boolean {
    return progressoDaPausa(ms) >= 1
}

/** quanto a midia anda durante a pausa (em segundos de midia, base 1): a integral da velocidade. Serve de medida e de teste */
export function avancoDuranteAPausa(base = 1, passoMs = 1): number {
    let s = 0
    for (let t = 0; t < PAUSA_SUAVE_MS; t += passoMs) s += velocidadeNaPausa(t + passoMs / 2, base) * (passoMs / 1000)
    return s
}

/** a curva amostrada (para o relatorio e para a fumaca conferir) */
export function amostrasDaCurva(passoMs = 100): { ms: number; velocidade: number; volume: number }[] {
    const r: { ms: number; velocidade: number; volume: number }[] = []
    for (let t = 0; t <= PAUSA_SUAVE_MS; t += passoMs) r.push({ ms: t, velocidade: velocidadeNaPausa(t), volume: volumeNaPausa(t, 1) })
    return r
}

type SaidaComFundo = { out?: { background?: { path?: string; id?: string } | null } | null; enabled?: boolean } | undefined
/** Parar (D27): as saidas que mostram ESTE arquivo no fundo. So elas sao limpas (como o F1, mas so para aquele video) */
export function saidasComOVideo(outputs: Record<string, SaidaComFundo> | null | undefined, caminho: string): string[] {
    if (!caminho) return []
    return Object.entries(outputs || {})
        .filter(([, o]) => !!o?.enabled && ((o?.out?.background?.path || o?.out?.background?.id) ?? "") === caminho)
        .map(([id]) => id)
}
