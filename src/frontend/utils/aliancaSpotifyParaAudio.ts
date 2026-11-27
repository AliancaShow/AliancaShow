// AliancaShow (cabine 27/nov, Andre: "o Spotify funciona como um arquivo de audio, na mesma camada; nao vamos ter Spotify e audio tocando
// ao mesmo tempo"). O outro sentido ja existia (aliancaSpotifyComSom: audio/video com som entra e o Spotify para). Este fecha o que faltava:
// o Spotify COMECAR a tocar (play no cartao ou no proprio app) limpa o audio de arquivo, como o "Limpar audio" da camada (AliancaCamadas).
// So a subida false -> true conta; o estado de quando o programa abre e so a base. Microfone nao e audio de arquivo e fica.
import { get } from "svelte/store"
import { clearAudio } from "../audio/audioFading"
import { spotifyState } from "../components/output/preview/SpotifyManager"
import { playingAudio } from "../stores"

/** a regra pura: tocar o Spotify agora, com audio de arquivo tocando, limpa o audio */
export function deveLimparAudio(antes: boolean | null, agora: boolean, audios: { paused?: boolean; isMic?: boolean }[]): boolean {
    if (antes === null || antes || !agora) return false
    return audios.some((a) => !a.isMic && a.paused === false)
}

let iniciado = false
export function iniciarAudioParaSpotify() {
    if (iniciado) return
    iniciado = true
    let antes: boolean | null = null
    spotifyState.subscribe((s) => {
        const agora = !!s?.isPlaying
        const audios = Object.values(get(playingAudio) || {}) as { paused?: boolean; isMic?: boolean }[]
        if (deveLimparAudio(antes, agora, audios)) clearAudio("", { clearPlaylist: true, commonClear: true })
        antes = agora
    })
}
