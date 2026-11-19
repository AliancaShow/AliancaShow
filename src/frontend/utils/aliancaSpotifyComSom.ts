import { get } from "svelte/store"
import { playingAudio, playingVideos, outputs } from "../stores"
import { spotifyIsFading } from "../components/output/preview/SpotifyManager"
import { VideoPlayer } from "../components/media/video/videoPlayer"
import { fadeCurtoDoSpotify } from "./aliancaSpotifyFadeCurto"
import { deveParaOSpotify, entraramComSom, instanciasComSom } from "./aliancaSpotifyComSomLogica"

let iniciado = false
/** o que fazia som na ultima olhada (instancias dos elementos de audio) */
let anterior = new Set<unknown>()
const comOuvinte = new WeakSet<object>()
let agendado = false

function olhar() {
    agendado = false
    const retornos = new Set(
        Object.entries(get(outputs) || {})
            .filter(([, o]) => !!o?.stageOutput)
            .map(([id]) => id)
    )
    const videos = get(playingVideos).map((v) => {
        ouvir(v.audio)
        const a = v.audio as any
        return { inst: v.audio, path: v.path, muted: !!a?.muted, paused: !!a?.paused, ended: !!a?.ended, congelado: !!v.congelado, volume: VideoPlayer.getVolume(v.path), saidas: v.linkedOutputIds }
    })
    const audios = Object.values(get(playingAudio)).map((a) => ({ inst: a.audio ?? a, paused: a.paused, isMic: a.isMic }))
    const agora = instanciasComSom(videos, audios, retornos)
    const entraram = entraramComSom(anterior, agora)
    anterior = agora
    if (deveParaOSpotify(entraram, get(spotifyIsFading))) fadeCurtoDoSpotify()
}

/** os eventos do proprio elemento (tocar, pausar, mudo, fim) acordam a olhada: o VideoPlayer nao reescreve o store ao pausar/desmutar */
function ouvir(el: unknown) {
    if (!(el instanceof HTMLAudioElement) || comOuvinte.has(el)) return
    comOuvinte.add(el)
    for (const ev of ["playing", "pause", "volumechange", "ended"]) el.addEventListener(ev, agendar)
}

function agendar() {
    if (agendado) return
    agendado = true
    queueMicrotask(olhar)
}

/** So a janela principal chama (startupMain). Idempotente. */
export function iniciarSpotifyParaComSom() {
    if (iniciado) return
    iniciado = true
    playingVideos.subscribe(agendar)
    playingAudio.subscribe(agendar)
    // video online nao tem elemento de audio (objeto virtual, sem eventos): uma olhada leve cobre pausa/mudo dele
    setInterval(olhar, 300)
}
