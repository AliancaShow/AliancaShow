import { get } from "svelte/store"
import { playingAudio, playingVideos, outputs } from "../stores"
import { fadePause, spotifyIsFading, spotifyState } from "../components/output/preview/SpotifyManager"
import { chavesComSom, deveParaOSpotify, entraramComSom } from "./aliancaSpotifyComSomLogica"

let iniciado = false
/** o que fazia som na ultima olhada (exposto para a fumaca) */
let anterior = new Set<string>()

function olhar() {
    const retornos = new Set(
        Object.entries(get(outputs) || {})
            .filter(([, o]) => !!o?.stageOutput)
            .map(([id]) => id)
    )
    const videos = get(playingVideos).map((v) => ({ path: v.path, muted: !!v.audio?.muted, ended: !!(v.audio as any)?.ended, saidas: v.linkedOutputIds }))
    const agora = chavesComSom(videos, get(playingAudio), retornos)
    const entraram = entraramComSom(anterior, agora)
    anterior = agora
    if (deveParaOSpotify(entraram, !!get(spotifyState)?.isPlaying, get(spotifyIsFading))) fadePause()
}

/**
 * So a janela principal chama (App.svelte). O `muted` do video e escrito logo DEPOIS de ele entrar no store, entao a olhada espera um instante.
 * Idempotente.
 */
export function iniciarSpotifyParaComSom() {
    if (iniciado) return
    iniciado = true
    let espera: ReturnType<typeof setTimeout> | null = null
    const agendar = () => {
        if (espera) clearTimeout(espera)
        espera = setTimeout(() => {
            espera = null
            olhar()
        }, 80)
    }
    playingVideos.subscribe(agendar)
    playingAudio.subscribe(agendar)
}
