// Leiaute v2, fatia 7: a faixa de transporte da coluna No ar (video, audio, temporizadores, Spotify). Pura: quem le os stores e o componente.
// Reaproveita o que o Preview antigo ja tinha (MediaControls, Audio, TimerControls, SpotifyController); aqui so mora a conta.

/** "m:ss" (ou "h:mm:ss" a partir de 1 hora). Negativo, NaN e infinito viram 0:00. */
export function tempoCurto(seg: number): string {
    const s = Number.isFinite(seg) && seg > 0 ? Math.floor(seg) : 0
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const r = s % 60
    const dois = (n: number) => (n < 10 ? "0" + n : String(n))
    return h ? `${h}:${dois(m)}:${dois(r)}` : `${m}:${dois(r)}`
}

/** O que falta, nunca negativo (a duracao pode ainda ser 0 enquanto o arquivo carrega). */
export function restante(duracao: number, atual: number): number {
    if (!(duracao > 0)) return 0
    return Math.max(0, duracao - Math.floor(Math.max(0, atual)))
}

/** 0..1, preso nas pontas; sem duracao = 0. */
export function fracao(atual: number, duracao: number): number {
    if (!(duracao > 0)) return 0
    return Math.min(1, Math.max(0, atual / duracao))
}

/** Onde, de 0 a `max`, caiu o ponteiro numa barra de `largura` px que comeca em `esquerda`. Largura 0 = 0. */
export function valorNaBarra(clienteX: number, esquerda: number, largura: number, max: number): number {
    if (!(largura > 0) || !(max > 0)) return 0
    return Math.min(1, Math.max(0, (clienteX - esquerda) / largura)) * max
}

// Temporizadores que entram na linha: os que o FreeShow ja listava como "tocando" (Timers onlyPlaying). `sirvo_live` fica de fora: e o contador
// do BLOCO no ar, que ja mora no Roteiro (bloco ao vivo); numa linha daqui ele manteria a faixa aberta o culto inteiro.
export const TIPOS_NA_FAIXA = ["counter", "pco_live"]

export type TimerBruto = { type?: string; name?: string }

export function timersNaFaixa(timers: Record<string, TimerBruto>, ativos: { id: string }[]): { id: string; nome: string; tipo: string }[] {
    const ids = new Set(ativos.map((a) => a.id))
    return Object.entries(timers || {})
        .filter(([id, t]) => ids.has(id) && TIPOS_NA_FAIXA.includes(t?.type || ""))
        .map(([id, t]) => ({ id, nome: t.name || "", tipo: t.type as string }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

/** A faixa abre quando ha o que controlar. */
export function faixaAberta(e: { video: boolean; audio: boolean; timers: number; spotify: boolean }): boolean {
    return e.video || e.audio || e.timers > 0 || e.spotify
}

export const MAX_TIMERS_VISIVEIS = 2
