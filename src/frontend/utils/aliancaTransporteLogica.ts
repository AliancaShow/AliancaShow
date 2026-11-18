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

/** Folga antes do fim: buscar EXATAMENTE o fim dispara `ended` (o fundo some, a playlist pula). O antigo `input range` tambem nunca chegava la. */
export const FOLGA_FIM = 0.25

/** Ate onde a barra pode buscar: o fim do trecho (`toTime`, se houver) ou a duracao, menos a folga. Sem duracao, 0. */
export function limiteBusca(duracao: number, toTime = 0): number {
    const fim = toTime > 0 && (!(duracao > 0) || toTime < duracao) ? toTime : duracao
    if (!(fim > 0)) return 0
    return Math.max(0, fim - FOLGA_FIM)
}

/** O valor pedido pela barra, preso em [0, limiteBusca]. */
export function prenderBusca(valor: number, duracao: number, toTime = 0): number {
    return Math.min(Math.max(0, valor || 0), limiteBusca(duracao, toTime))
}

/** O ajuste de volume da midia vai ate 125 % (`edit/values/media.ts`): a barra tem o mesmo teto, para nunca mostrar cheio e gravar menos do que esta salvo. */
export const VOLUME_MAXIMO = 1.25

export function prenderVolume(v: number, minimo = 0): number {
    return Math.min(VOLUME_MAXIMO, Math.max(minimo, Number.isFinite(v) ? v : 0))
}

/**
 * Limita a frequencia de uma escrita (arrastar o volume manda o `media` inteiro por IPC a todas as saidas): a primeira passa na hora, as
 * seguintes esperam o intervalo e so a ULTIMA vale; `fechar` (soltar) aplica o valor final na hora e cancela o que estava esperando.
 */
export function criarLimitador<T>(aplicar: (v: T) => void, intervaloMs = 100) {
    let ultimo = -Infinity
    let pendente: { v: T } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const rodar = (v: T) => {
        ultimo = Date.now()
        aplicar(v)
    }
    return {
        empurrar(v: T) {
            const espera = ultimo + intervaloMs - Date.now()
            if (espera <= 0 && !timer) return rodar(v)
            pendente = { v }
            if (!timer)
                timer = setTimeout(
                    () => {
                        timer = null
                        const p = pendente
                        pendente = null
                        if (p) rodar(p.v)
                    },
                    Math.max(0, espera)
                )
        },
        fechar(v: T) {
            if (timer) clearTimeout(timer)
            timer = null
            pendente = null
            rodar(v)
        }
    }
}

/** As saidas que a coluna No ar considera: habilitadas e visiveis, na ordem do objeto. A primeira e a principal (a que a tela mostra E a que a faixa controla). */
export function saidasHabilitadas(outputs: Record<string, { enabled?: boolean; invisible?: boolean } | undefined> | null | undefined): string[] {
    return Object.entries(outputs || {})
        .filter(([, o]) => o?.enabled && !o?.invisible)
        .map(([id]) => id)
}

/** Quantas OUTRAS saidas tem um video diferente do que a faixa controla (o mesmo arquivo nas duas e controlado junto, nao conta). */
export function outrasSaidasComVideo(outras: { caminho: string; video: boolean }[], caminhoPrincipal: string): number {
    return outras.filter((o) => o.video && !!o.caminho && o.caminho !== caminhoPrincipal).length
}

/** O arrasto guarda em que arquivo/saida comecou; se o fundo trocou no meio, ele morre (a busca cairia no video novo). */
export type ArrastoMidia = { caminho: string; saida: string }
export function arrastoVale(a: ArrastoMidia | null, caminho: string, saida: string): boolean {
    return !!a && !!caminho && a.caminho === caminho && a.saida === saida
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

/** Quantas coisas ficam atras do "+N": a faixa mostra uma linha so, as demais abrem num painel por cima. */
export function extrasDaFaixa(total: number): number {
    return Math.max(0, Math.floor(total) - 1)
}
