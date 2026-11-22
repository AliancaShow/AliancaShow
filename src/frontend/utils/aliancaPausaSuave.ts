// Cabine 6 (D25/D27): os botoes Pausar e Parar do transporte (video e audio). Fora do fecho: so a janela principal importa este arquivo.
//   Pausar: o relogio principal (o <audio> do VideoPlayer, que as saidas seguem pelo `playingVideoState`) desacelera na curva fixa de 0,7 s
//   (aliancaPausaSuaveLogica) e pausa; o multiplicador vai junto no estado (`rampa`), entao TODAS as saidas desaceleram juntas em vez de
//   correrem a 1x e voltarem num salto. O som cai a 0 na mesma curva e, ja pausado, volta ao nivel de antes. Voltar a tocar e manual (D4).
//   Parar: tira do ar (video: limpa o fundo das saidas com aquele arquivo, como o F1; audio: limpa aquele audio, como o F4).
import { get, writable } from "svelte/store"
import { AudioAnalyser } from "../audio/audioAnalyser"
import { clearAudio } from "../audio/audioFading"
import { AudioPlayer } from "../audio/audioPlayer"
import { AudioPlaylist } from "../audio/audioPlaylist"
import { VideoPlayer } from "../components/media/video/videoPlayer"
import { clearBackground } from "../components/output/clear"
import { outLocked, outputs, playingAudio } from "../stores"
import { fatorDaRampa, PASSO_PAUSA_MS, pausaTerminou, saidasComOVideo, velocidadeNaPausa, volumeNaPausa } from "./aliancaPausaSuaveLogica"

/** chaves (`video:<caminho>` / `audio:<id>`) com pausa suave correndo: o botao ja mostra "pausado" desde o clique */
export const pausasSuaves = writable<Set<string>>(new Set())
const cancelar = new Map<string, () => void>()

export const chaveVideo = (caminho: string) => "video:" + caminho
export const chaveAudio = (id: string) => "audio:" + id

function marcar(chave: string, ligado: boolean) {
    pausasSuaves.update((s) => {
        const n = new Set(s)
        if (ligado) n.add(chave)
        else n.delete(chave)
        return n
    })
}

/** cancela a pausa suave em curso (o operador deu play ou parou no meio): volta velocidade e volume, e o player segue como estava */
export function cancelarPausaSuave(chave: string): boolean {
    const f = cancelar.get(chave)
    if (!f) return false
    f()
    return true
}

type Passo = { ms: number }
/** o relogio da curva: por tempo real (nao por contagem de passos), entao termina em 0,7 s mesmo se um passo atrasar */
function correrCurva(chave: string, passo: (p: Passo) => boolean, fim: () => void, desfazer: () => void) {
    const t0 = performance.now()
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const parar = (concluiu: boolean) => {
        if (!vivo) return
        vivo = false
        if (timer) clearTimeout(timer)
        cancelar.delete(chave)
        if (concluiu) fim()
        else desfazer()
        marcar(chave, false)
    }
    cancelar.set(chave, () => parar(false))
    marcar(chave, true)
    const tique = () => {
        timer = null
        if (!vivo) return
        const ms = performance.now() - t0
        // o passo devolve false quando o player sumiu ou mudou por fora: desfaz e sai
        if (!passo({ ms })) return parar(false)
        if (pausaTerminou(ms)) return parar(true)
        timer = setTimeout(tique, PASSO_PAUSA_MS)
    }
    tique()
}

// ---------------- video ----------------

/** volume "de verdade" do video (o mesmo que VideoPlayer.updateVolume calcula; pode passar de 1 no ganho) */
function ganhoDoVideo(caminho: string) {
    return VideoPlayer.getVolume(caminho) * (VideoPlayer.getPlaying(caminho)?.replayGainMultiplier || 1)
}

export function pausarVideoSuave(caminho: string, saida: string) {
    if (get(outLocked) || !caminho) return
    const chave = chaveVideo(caminho)
    if (cancelar.has(chave)) return
    const audio = VideoPlayer.getAudio(caminho, saida)
    if (!audio || audio.paused) return
    // video online (YouTube/Vimeo) tem relogio virtual sem velocidade: pausa seca, como antes
    if (!(audio instanceof HTMLAudioElement)) return VideoPlayer.pause(caminho, saida)

    const base = audio.playbackRate || 1
    const ganho0 = ganhoDoVideo(caminho)
    const soa = !audio.muted
    const devolver = () => {
        VideoPlayer.rampa.delete(caminho)
        try {
            audio.playbackRate = base
        } catch {}
        VideoPlayer.updateVolume(caminho)
        VideoPlayer.sincronizarAgora()
    }
    correrCurva(
        chave,
        ({ ms }) => {
            if (VideoPlayer.getAudio(caminho, saida) !== audio || audio.paused) return false
            try {
                audio.playbackRate = velocidadeNaPausa(ms, base)
            } catch {}
            if (soa) {
                const g = volumeNaPausa(ms, ganho0)
                audio.volume = Math.min(1, Math.max(0, g))
                AudioAnalyser.setSourceVolume(caminho, g)
            }
            VideoPlayer.rampa.set(caminho, fatorDaRampa(ms, base))
            VideoPlayer.sincronizarAgora()
            return true
        },
        () => {
            // chegou na velocidade minima: pausa de verdade e devolve velocidade/volume (para o play manual sair normal)
            VideoPlayer.pause(caminho, saida)
            devolver()
        },
        devolver
    )
}

/** Tocar no cartao: com pausa suave correndo, so a cancela (o video segue tocando); senao, toca */
export function tocarVideo(caminho: string, saida: string) {
    if (get(outLocked) || !caminho) return
    if (cancelarPausaSuave(chaveVideo(caminho))) return
    VideoPlayer.play(caminho, saida)
}

/** Parar (D27): tira o video do ar nas saidas que mostram ESTE arquivo (o F1, so para ele). Nada volta sozinho (D4) */
export function pararVideo(caminho: string) {
    if (get(outLocked) || !caminho) return
    cancelarPausaSuave(chaveVideo(caminho))
    saidasComOVideo(get(outputs) as any, caminho).forEach((id) => clearBackground(id))
}

// ---------------- audio (arquivo da gaveta) ----------------

function ganhoDoAudio(id: string) {
    let v = AudioPlayer.getVolume(id)
    if (AudioPlaylist.getPlayingKey() === id) v *= AudioPlaylist.getActivePlaylist()?.volume || 1
    return v * (get(playingAudio)[id]?.replayGainMultiplier || 1)
}

export function pausarAudioSuave(id: string) {
    if (get(outLocked) || !id) return
    const chave = chaveAudio(id)
    if (cancelar.has(chave)) return
    const audio = AudioPlayer.getAudio(id)
    if (!audio || audio.paused) return
    const ganho0 = ganhoDoAudio(id)
    const devolver = () => AudioPlayer.updateVolume(id)
    correrCurva(
        chave,
        ({ ms }) => {
            if (AudioPlayer.getAudio(id) !== audio || audio.paused) return false
            const g = volumeNaPausa(ms, ganho0)
            audio.volume = Math.min(1, Math.max(0, g))
            AudioAnalyser.setSourceVolume(id, g)
            return true
        },
        () => {
            AudioPlayer.pause(id)
            devolver()
        },
        devolver
    )
}

export function tocarAudio(id: string, startAt: number, nome: string) {
    if (get(outLocked) || !id) return
    if (cancelarPausaSuave(chaveAudio(id))) return
    AudioPlayer.start(id, { name: nome }, { pauseIfPlaying: true, startAt })
}

/** Parar (D27): limpa ESTE audio (o F4, so para ele), com o mesmo fade do F4 */
export function pararAudio(id: string) {
    if (get(outLocked) || !id) return
    cancelarPausaSuave(chaveAudio(id))
    clearAudio(id, { clearPlaylist: true, commonClear: true })
}
