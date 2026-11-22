// Cabine 6, Frente 4 (4a/4b) e D9: a conta pura do cartao do Spotify na pilha de transporte (AliancaTransporte.svelte).
// Volume do Spotify = volume do APP no mixer do Windows (0..1, `setVolume` do processo principal); diferente da midia, o teto e 1,0.
// Mudo = volume 0, lembrando o de antes para devolver. Quem le stores e manda comandos e aliancaSpotifyCartao.ts.

/** O teto do Spotify: o mixer do Windows nao passa de 100 %. */
export const VOLUME_MAXIMO_SPOTIFY = 1
/** Volume devolvido ao tirar o mudo quando nao ha um "de antes" que preste (ex.: o app abriu com o Spotify ja em 0). */
export const VOLUME_PADRAO_SPOTIFY = 1

export function prenderVolumeSpotify(v: number): number {
    return Math.min(VOLUME_MAXIMO_SPOTIFY, Math.max(0, Number.isFinite(v) ? v : 0))
}

export const spotifyMudo = (volume: number | undefined | null): boolean => !(Number(volume) > 0)

/**
 * O clique no mudo. Com som: vai a 0 e guarda o volume atual. Mudo: volta ao guardado (ou ao padrao, se o guardado nao presta).
 * Arrastar o volume para cima tira o mudo por conta propria (o volume e a unica verdade); o guardado so serve ao botao.
 */
export function alternarMudoSpotify(volumeAtual: number, guardado: number | null): { volume: number; guardado: number | null } {
    const atual = prenderVolumeSpotify(volumeAtual)
    if (atual > 0) return { volume: 0, guardado: atual }
    const volta = guardado !== null && guardado > 0 ? prenderVolumeSpotify(guardado) : VOLUME_PADRAO_SPOTIFY
    return { volume: volta, guardado: null }
}

/** Parar = pausar + voltar ao inicio. A pausa so e mandada se estiver tocando (o comando "pause" e idempotente, mas evita IPC a toa). */
export function passosDoParar(tocando: boolean): ("pause" | "inicio")[] {
    return tocando ? ["pause", "inicio"] : ["inicio"]
}

// ---------------- D9: o Spotify na camada Audio ----------------

/** O Spotify so tem estado confiavel na pagina Mostrar (onde o controlador escondido do Preview o mantem em dia), como o cartao. */
export function spotifyNaCamadaAudio(paginaAtiva: string, estado: { isPlaying?: boolean } | null | undefined): boolean {
    return paginaAtiva === "show" && !!estado?.isPlaying
}

/** Os mesmos impedimentos que `clearAll()` (clear.ts, fecho) aplica a uma tecla (nao botao) antes de limpar. */
export type ImpedimentosDoEsc = {
    travada: boolean
    recusaDestino: boolean
    popup: boolean
    selecionadoNaoBiblia: boolean
    editandoItens: boolean
    palcoComItens: boolean
    menuAberto: boolean
}

/**
 * Esc ("limpar tudo") tambem para o Spotify quando o `clearAll` nao seria barrado pelas MESMAS guardas. Diferente do `clearAll`, nao
 * desiste quando o resto ja esta limpo: o Spotify sozinho tocando tambem e "algo no ar".
 */
export function escParaOSpotify(i: ImpedimentosDoEsc): boolean {
    return !(i.travada || i.recusaDestino || i.popup || i.selecionadoNaoBiblia || i.editandoItens || i.palcoComItens || i.menuAberto)
}

// ---------------- largura interna do cartao (board C2) ----------------

/** As medidas do cartao em px, as mesmas do CSS de AliancaTransporte.svelte (.tk/.tk-a/.tk-b/.q/.vol). */
export const MEDIDAS_CARTAO_SPOTIFY = {
    padEsq: 6,
    padDir: 8,
    botao: 24,
    gapGrupo: 2,
    gapLinha1: 6,
    gapLinha2: 2,
    tempo: 44,
    volume: 40,
    margemVolume: 4,
    margemBarra: 10 // AliancaBarra .alto: margin 0 6px 0 4px
}

/** Quanto sobra para o nome (linha 1: anterior/tocar/proxima + parar, nome, tempo) e para a barra (linha 2: barra, crossfade, mudo, volume). */
export function largurasDoCartaoSpotify(larguraCartao: number) {
    const m = MEDIDAS_CARTAO_SPOTIFY
    const util = larguraCartao - m.padEsq - m.padDir
    const grupo = 3 * m.botao + 2 * m.gapGrupo
    // linha 1: [grupo] gap [parar] gap [nome] gap [tempo]
    const nome = util - grupo - m.botao - m.tempo - 3 * m.gapLinha1
    // linha 2: [barra] gap [crossfade] gap [mudo] gap [volume]
    const barra = util - m.botao - m.botao - (m.volume + m.margemVolume) - 3 * m.gapLinha2 - m.margemBarra
    return { util, nome, barra }
}
