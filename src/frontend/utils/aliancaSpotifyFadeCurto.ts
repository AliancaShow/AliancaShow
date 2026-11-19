// Cabine 4: fade CURTO do Spotify para o caminho "entrou midia com som" (~1 s; o do botao manual, em SpotifyManager, dura 3 s ou mais e nao muda).
// Consulta o estado FRESCO no processo principal e desiste se o Spotify nao estiver tocando.
import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { spotifyIsFading } from "../components/output/preview/SpotifyManager"
import { wait } from "./common"

export const PASSOS_DO_FADE_CURTO = 10
export const DURACAO_DO_FADE_CURTO_MS = 1000

/** A porta do Spotify (processo principal). Objeto mutavel de proposito: a fumaca troca estas duas funcoes por um Spotify de mentira (o aparelho de teste nao tem Spotify). */
export const portaDoSpotify = {
    estado: () => requestMain(Main.SPOTIFY_GET_STATE) as Promise<{ isPlaying?: boolean; volume: number } | null | undefined>,
    comando: (command: string, value?: number) => requestMain(Main.SPOTIFY_COMMAND, { command, value } as any)
}

export async function fadeCurtoDoSpotify(duracaoMs = DURACAO_DO_FADE_CURTO_MS): Promise<boolean> {
    if (get(spotifyIsFading)) return false
    spotifyIsFading.set(true)
    try {
        const fresco = await portaDoSpotify.estado()
        if (!fresco?.isPlaying) return false
        const inicial = fresco.volume
        const passoMs = duracaoMs / PASSOS_DO_FADE_CURTO
        for (let i = 1; i <= PASSOS_DO_FADE_CURTO; i++) {
            await portaDoSpotify.comando("setVolume", Math.max(0, inicial - (inicial / PASSOS_DO_FADE_CURTO) * i))
            await wait(passoMs)
        }
        await portaDoSpotify.comando("pause")
        await wait(300)
        await portaDoSpotify.comando("setVolume", inicial)
        return true
    } finally {
        spotifyIsFading.set(false)
    }
}
