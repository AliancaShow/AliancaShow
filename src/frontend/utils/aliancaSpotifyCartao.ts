// Cabine 6, Frente 4 (4a/4b) e D9: os comandos do cartao do Spotify (volume, mudo, parar) e o Spotify como camada Audio (F4, Esc,
// "Limpar tudo"). Tudo pelas portas que ja existem: `portaDoSpotify` (aliancaSpotifyFadeCurto) e as funcoes exportadas do SpotifyManager.
// Nada aqui mexe no fecho da janela de saida. A conta pura mora em aliancaSpotifyCartaoLogica.ts.
import { get } from "svelte/store"
import { activeEdit, activePage, activePopup, activeStage, contextActive, outLocked, selected, topContextActive } from "../stores"
import { seekTo, spotifyIsFading, spotifyState } from "../components/output/preview/SpotifyManager"
import { tecladoPodeMexerNaSaida } from "./aliancaModo"
import { fadeCurtoDoSpotify, portaDoSpotify } from "./aliancaSpotifyFadeCurto"
import { alternarMudoSpotify, escParaOSpotify, passosDoParar, prenderVolumeSpotify } from "./aliancaSpotifyCartaoLogica"
import { criarLimitador } from "./aliancaTransporteLogica"

/** o volume de antes do mudo; vive fora do componente para sobreviver ao cartao sumir e voltar (trocar de pagina, Spotify fechado) */
let volumeAntesDoMudo: number | null = null

function aplicarVolume(v: number) {
    const alvo = prenderVolumeSpotify(v)
    // otimista: o cartao mostra o novo valor na hora; a proxima leitura do processo principal confirma
    spotifyState.update((s) => (s ? { ...s, volume: alvo } : s))
    portaDoSpotify.comando("setVolume", alvo)
}

// arrastar manda IPC a cada movimento: a primeira passa, as seguintes esperam 100 ms e so a ultima vale; soltar aplica na hora
const limitador = criarLimitador(aplicarVolume, 100)

export function volumeDoSpotify(v: number) {
    if (get(spotifyIsFading)) return
    limitador.empurrar(prenderVolumeSpotify(v))
}
export function volumeFimDoSpotify(v: number) {
    if (get(spotifyIsFading)) return
    limitador.fechar(prenderVolumeSpotify(v))
}

export function alternarMudoDoSpotify() {
    if (get(spotifyIsFading)) return
    const atual = get(spotifyState)?.volume ?? 0
    const r = alternarMudoSpotify(atual, volumeAntesDoMudo)
    volumeAntesDoMudo = r.guardado
    limitador.fechar(r.volume)
}

/** 4b: Parar = pausar + voltar ao inicio. "pause" de verdade (nao o "playpause", que alterna e poderia LIGAR com estado velho). */
export async function pararSpotify() {
    if (get(spotifyIsFading)) return
    for (const passo of passosDoParar(!!get(spotifyState)?.isPlaying)) {
        if (passo === "pause") {
            spotifyState.update((s) => (s ? { ...s, isPlaying: false } : s))
            await portaDoSpotify.comando("pause")
        } else await seekTo(0)
    }
}

// ---------------- D9: Spotify = midia so de audio, na camada Audio ----------------

/** F4 / clique na camada Audio / "Limpar tudo": para o Spotify com o fade curto (ele mesmo consulta o estado fresco e desiste se nao toca). */
export function pararSpotifyComoAudio() {
    if (get(outLocked)) return
    fadeCurtoDoSpotify()
}

/** Esc pelo teclado (o `clearAll` mora no fecho): para o Spotify se o mesmo Esc nao seria barrado. */
export function pararSpotifyNoEsc() {
    const ok = escParaOSpotify({
        travada: !!get(outLocked),
        // a mesma guarda de destino do clearAll, mas SEM o aviso (o Esc ja passou por `teclaIgnorada` no Preview; o aviso nao pode piscar duas vezes)
        recusaDestino: !tecladoPodeMexerNaSaida(),
        popup: !!get(activePopup),
        selecionadoNaoBiblia: !!(get(selected).id && get(selected).id !== "scripture"),
        editandoItens: get(activePage) === "edit" && !!get(activeEdit).items.length,
        palcoComItens: !!get(activeStage).items.length,
        menuAberto: !!(get(contextActive) || get(topContextActive))
    })
    if (ok) fadeCurtoDoSpotify()
}
