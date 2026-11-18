<script lang="ts">
    // Leiaute v2, fatia 7 (D6, P6): a faixa de transporte logo abaixo da tela No ar. So existe quando ha o que controlar: video no fundo da
    // saida, audio tocando, temporizador de contagem ou Spotify. Sem nada, a altura vai a 0 (grade 0fr, com a margem negativa que cancela o
    // `gap` da coluna: nada ao redor se mexe). Nao e camada sobre a tela: ocupa o seu proprio lugar, entao nenhum clique nela alcanca o slide.
    // A logica vem dos controles que o Preview antigo tinha (MediaControls/VideoSlider, Audio, Timers onlyPlaying, SpotifyController,
    // AudioMeter); a marcacao e nova. Nenhuma tecla nova: os atalhos de midia continuam no Preview escondido.
    import { onDestroy, onMount } from "svelte"
    import type { Unsubscriber } from "svelte/store"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activePage, activeTimers, media, outLocked, outputs, playerVideos, playingAudio, timers } from "../../stores"
    import { faixaAberta, MAX_TIMERS_VISIVEIS, timersNaFaixa } from "../../utils/aliancaTransporteLogica"
    import { getAccess } from "../../utils/profile"
    import AudioMeter from "../drawer/audio/AudioMeter.svelte"
    import { getCurrentTimerValue, playPauseGlobal, resetTimer } from "../drawer/timers/timers"
    import { splitPath } from "../helpers/get"
    import { getExtension, getFileName, getMediaType, removeExtension } from "../helpers/media"
    import { getActiveOutputs } from "../helpers/output"
    import { joinTimeBig } from "../helpers/time"
    import { getFirstOutputIdWithBackground } from "../helpers/video"
    import { VideoPlayer } from "../media/video/videoPlayer"
    import { videoSync } from "../media/video/videoSync"
    import { fadePause, skipNext, skipPrev, spotifyIsFading, spotifyState, togglePlay } from "../output/preview/SpotifyManager"
    import AliancaTransporteLinha from "./AliancaTransporteLinha.svelte"

    const COR_VIDEO = "#8cc7a6"
    const COR_AUDIO = "#eba640"

    // ---------------- video: o fundo da primeira saida com fundo (a mesma conta do Preview) ----------------
    $: ativas = getActiveOutputs($outputs, true, true, true)
    $: comFundo = ativas.filter((id) => $outputs[id]?.out?.background)
    $: idSaida = getFirstOutputIdWithBackground(comFundo) || comFundo[0] || ""
    $: fundo = idSaida ? $outputs[idSaida]?.out?.background : null
    $: caminho = (fundo?.path || fundo?.id || "") as string
    $: tipoFundo = (fundo?.type || (caminho ? getMediaType(getExtension(caminho)) : "image")) as string
    $: temVideo = !!fundo && !!caminho && (tipoFundo === "video" || tipoFundo === "player")
    $: nomeVideo = fundo?.type === "player" ? $playerVideos[fundo?.id || ""]?.name || "" : caminho.includes(".") && !caminho.includes("base64") ? removeExtension(splitPath(caminho).name) : fundo?.name || ""

    let dadosVideo = { duracao: 0, pausado: true, repetir: false, mudo: false }
    let tempoVideo = 0
    let arrastandoVideo = false
    let pausadoAntes = true
    let escutaVideo: Unsubscriber | null = null
    let ultimoCaminho = ""
    $: if (caminho !== ultimoCaminho || !temVideo) {
        ultimoCaminho = caminho
        tempoVideo = 0
        dadosVideo = { duracao: 0, pausado: true, repetir: false, mudo: false }
    }
    // a escuta e refeita quando muda o arquivo ou a saida; fora de video, desligada
    $: ligarVideo(temVideo ? caminho : "", idSaida)
    function ligarVideo(c: string, saida: string) {
        if (escutaVideo) escutaVideo()
        escutaVideo = null
        if (!c || !saida) return
        escutaVideo = videoSync(c, saida, (d) => {
            if (!arrastandoVideo) tempoVideo = d.currentTime || 0
            if (d.duration) dadosVideo.duracao = d.duration
            dadosVideo.pausado = d.paused
            dadosVideo.repetir = !!d.loop
            dadosVideo.mudo = !!d.muted
            dadosVideo = dadosVideo
        })
    }
    onDestroy(() => {
        if (escutaVideo) escutaVideo()
        clearInterval(relogio)
        clearInterval(passoAudio)
        clearTimeout(fechando)
    })

    function alternarVideo() {
        if ($outLocked || !caminho) return
        const estavaPausado = dadosVideo.pausado
        dadosVideo.pausado = !estavaPausado
        dadosVideo = dadosVideo
        if (estavaPausado) VideoPlayer.play(caminho, idSaida)
        else VideoPlayer.pause(caminho, idSaida)
    }
    function alternarRepetir() {
        if (!caminho) return
        dadosVideo.repetir = !dadosVideo.repetir
        dadosVideo = dadosVideo
        VideoPlayer.toggleLoop(caminho, idSaida)
    }
    function alternarMudo() {
        if ($outLocked || !caminho) return
        dadosVideo.mudo = !dadosVideo.mudo
        dadosVideo = dadosVideo
        VideoPlayer.toggleMute(caminho, idSaida)
    }
    // arrastar a barra: pausa enquanto arrasta (como o VideoSlider), busca em passos de 150 ms e volta a tocar ao soltar
    let passoBusca: ReturnType<typeof setTimeout> | null = null
    let ultimoArrasto = 0
    function comecarVideo() {
        if (!caminho) return
        arrastandoVideo = true
        pausadoAntes = dadosVideo.pausado
        dadosVideo.pausado = true
        dadosVideo = dadosVideo
        VideoPlayer.pause(caminho, idSaida)
    }
    function moverVideo(e: CustomEvent<number>) {
        ultimoArrasto = e.detail
        tempoVideo = e.detail
        if (passoBusca) return
        passoBusca = setTimeout(() => {
            passoBusca = null
            if (arrastandoVideo && caminho) VideoPlayer.seekTo(caminho, idSaida, ultimoArrasto)
        }, 150)
    }
    function soltarVideo(e: CustomEvent<number>) {
        if (passoBusca) clearTimeout(passoBusca)
        passoBusca = null
        if (!arrastandoVideo) return
        arrastandoVideo = false
        tempoVideo = e.detail
        if (caminho) {
            VideoPlayer.seekTo(caminho, idSaida, e.detail)
            dadosVideo.pausado = pausadoAntes
            dadosVideo = dadosVideo
            if (!pausadoAntes) VideoPlayer.play(caminho, idSaida)
        }
    }
    // o volume e o do arquivo (`media[caminho].volume`, o mesmo que o painel de informacoes da midia escreve)
    $: volumeVideo = $media[caminho]?.volume ?? 1
    function volumeDoVideo(e: CustomEvent<number>) {
        if (!caminho) return
        const v = Math.max(0, Math.min(1, e.detail))
        media.update((a) => ({ ...a, [caminho]: { ...(a[caminho] || {}), volume: v } }))
        VideoPlayer.updateVolume(caminho)
    }

    // ---------------- audio: o primeiro que nao e microfone (o Audio.svelte antigo) ----------------
    $: idsAudio = Object.entries($playingAudio)
        .filter(([, a]) => !a.isMic)
        .map(([id]) => id)
    $: idAudio = idsAudio[0] || ""
    $: tocandoAudio = idAudio ? $playingAudio[idAudio] : null
    $: temAudio = !!tocandoAudio
    $: pausadoAudio = tocandoAudio ? tocandoAudio.paused !== false : true
    $: nomeAudio = tocandoAudio ? (tocandoAudio.name || removeExtension(getFileName(idAudio)) || idAudio) + (idsAudio.length > 1 ? ` (+${idsAudio.length - 1})` : "") : ""
    let duracaoAudio = 0
    let tempoAudio = 0
    let arrastandoAudio = false
    let ultimoAudio = ""
    $: if (idAudio !== ultimoAudio) {
        ultimoAudio = idAudio
        duracaoAudio = 0
        tempoAudio = 0
        if (idAudio) lerDuracao(idAudio)
    }
    async function lerDuracao(id: string) {
        const d = await AudioPlayer.getDuration(id)
        if (id === idAudio) duracaoAudio = d || 0
    }
    // o relogio do audio: 10 vezes por segundo, so enquanto ha audio (como o Audio.svelte)
    let passoAudio: ReturnType<typeof setInterval> | undefined
    $: if (temAudio && !passoAudio) passoAudio = setInterval(() => !arrastandoAudio && (tempoAudio = $playingAudio[idAudio]?.audio?.currentTime || 0), 100)
    $: if (!temAudio && passoAudio) {
        clearInterval(passoAudio)
        passoAudio = undefined
    }
    function alternarAudio() {
        if ($outLocked || !idAudio) return
        AudioPlayer.start(idAudio, { name: tocandoAudio?.name || "" }, { pauseIfPlaying: true, startAt: tempoAudio })
    }
    function comecarAudio() {
        arrastandoAudio = true
    }
    function moverAudio(e: CustomEvent<number>) {
        tempoAudio = e.detail
    }
    function soltarAudio(e: CustomEvent<number>) {
        arrastandoAudio = false
        const id = idAudio
        const pausado = pausadoAudio
        tempoAudio = e.detail
        playingAudio.update((a) => {
            if (a[id]?.audio?.currentTime === undefined) return a
            a[id].audio.currentTime = e.detail
            // o player toca ao mexer no tempo: se estava pausado, pausa de novo (o Audio.svelte antigo faz igual)
            if (pausado) setTimeout(() => a[id].audio.pause(), 20)
            return a
        })
    }
    $: volumeAudio = $media[idAudio]?.volume ?? 1
    function volumeDoAudio(e: CustomEvent<number>) {
        if (!idAudio) return
        const v = Math.max(0.01, Math.min(1, e.detail)) // o audio trata 0 como "sem valor" (= 1); para silenciar, usar o mixer
        media.update((a) => ({ ...a, [idAudio]: { ...(a[idAudio] || {}), volume: v } }))
        AudioPlayer.updateVolume(idAudio)
    }

    // ---------------- temporizadores (a mesma lista que o Timers onlyPlaying) ----------------
    let hoje = new Date()
    const relogio = setInterval(() => (hoje = new Date()), 1000)
    $: lista = timersNaFaixa($timers, $activeTimers)
    $: visiveis = lista.slice(0, MAX_TIMERS_VISIVEIS)
    $: escondidos = lista.length - visiveis.length
    $: somenteLeitura = getAccess("timers").global === "read"
    const lerValor = (t: any, id: string, _a: any, agora: Date) => joinTimeBig(getCurrentTimerValue(t, { id }, agora, $activeTimers), true, true)
    const pausadoDoTimer = (id: string, a: any[]) => !!a.find((x) => x.id === id)?.paused

    // ---------------- Spotify: so em Mostrar, onde o controlador escondido do Preview mantem o estado em dia ----------------
    $: temSpotify = $activePage === "show" && !!$spotifyState

    // ---------------- a faixa ----------------
    $: algo = faixaAberta({ video: temVideo, audio: temAudio, timers: lista.length, spotify: temSpotify })
    $: comMedidor = temVideo || temAudio
    // fechar tem animacao: o conteudo fica ate a grade chegar a 0 (240 ms) e so entao e desmontado (o medidor para)
    let montado = false
    let fechando: ReturnType<typeof setTimeout> | undefined
    $: if (algo) {
        clearTimeout(fechando)
        montado = true
    } else if (montado) {
        clearTimeout(fechando)
        fechando = setTimeout(() => (montado = false), 240)
    }
    // a animacao so abre depois de montar o conteudo (um quadro), para a grade ter de onde crescer
    let aberta = false
    $: if (algo && montado) requestAnimationFrame(() => (aberta = algo))
    $: if (!algo) aberta = false
    onMount(() => (aberta = false))
</script>

<div class="faixa" class:aberta data-acao="transporte" data-aberta={aberta ? "1" : "0"} aria-hidden={!aberta} data-sem-trava>
    <div class="miolo">
        {#if montado}
            <div class="bloco">
                {#if temVideo}
                    <AliancaTransporteLinha tipo="video" cor={COR_VIDEO} nome={nomeVideo} pausado={dadosVideo.pausado} atual={tempoVideo} duracao={dadosVideo.duracao} repetir={dadosVideo.repetir} mudo={dadosVideo.mudo} volume={tipoFundo === "player" ? null : volumeVideo} travada={$outLocked} on:alternar={alternarVideo} on:repetir={alternarRepetir} on:mudo={alternarMudo} on:comecar={comecarVideo} on:mover={moverVideo} on:soltar={soltarVideo} on:volume={volumeDoVideo} />
                {/if}
                {#if temAudio}
                    <AliancaTransporteLinha tipo="audio" cor={COR_AUDIO} nome={nomeAudio} pausado={pausadoAudio} atual={tempoAudio} duracao={duracaoAudio} volume={volumeAudio} travada={$outLocked} on:alternar={alternarAudio} on:comecar={comecarAudio} on:mover={moverAudio} on:soltar={soltarAudio} on:volume={volumeDoAudio} />
                {/if}
                {#if comMedidor}
                    <div class="vu" data-acao="medidor" data-title="Nível de áudio da saída"><AudioMeter channelId="main" /></div>
                {/if}
                {#each visiveis as t (t.id)}
                    {@const timer = $timers[t.id]}
                    {@const pausado = pausadoDoTimer(t.id, $activeTimers)}
                    <div class="timer" data-timer={t.id}>
                        {#if t.tipo === "counter"}
                            <button type="button" class="ic" tabindex="-1" disabled={somenteLeitura} aria-label={pausado ? "Continuar" : "Pausar"} data-title={pausado ? "Continuar" : "Pausar"} on:mousedown|preventDefault on:click={() => playPauseGlobal(t.id, timer)}>
                                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                                    {#if pausado}<path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />{:else}<path d="M5 3v10 M11 3v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" />{/if}
                                </svg>
                            </button>
                        {/if}
                        <span class="tn" data-title={t.nome}>{t.nome || "Temporizador"}</span>
                        <span class="tv">{lerValor(timer, t.id, $activeTimers, hoje)}</span>
                        {#if t.tipo === "counter"}
                            <button type="button" class="ic" tabindex="-1" disabled={somenteLeitura} aria-label="Parar temporizador" data-title="Parar e zerar" on:mousedown|preventDefault on:click={() => resetTimer(t.id)}>
                                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4h8v8H4z" fill="currentColor" /></svg>
                            </button>
                        {/if}
                    </div>
                {/each}
                {#if escondidos > 0}<div class="mais">+{escondidos} temporizador{escondidos > 1 ? "es" : ""} ativo{escondidos > 1 ? "s" : ""}</div>{/if}
                {#if temSpotify && $spotifyState}
                    <div class="spotify" data-acao="spotify">
                        <span class="sn" data-title={$spotifyState.title + " · " + $spotifyState.artist}>♫ {$spotifyState.title || "—"}<span class="sa"> · {$spotifyState.artist || ""}</span></span>
                        <button type="button" class="ic" tabindex="-1" disabled={$spotifyIsFading} aria-label="Anterior" data-title="Anterior" on:mousedown|preventDefault on:click={skipPrev}>
                            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M13 3.2v9.6L6 8z" fill="currentColor" /></svg>
                        </button>
                        <button type="button" class="ic" tabindex="-1" disabled={$spotifyIsFading} aria-label={$spotifyState.isPlaying ? "Pausar Spotify" : "Tocar Spotify"} data-title={$spotifyState.isPlaying ? "Pausar" : "Tocar"} on:mousedown|preventDefault on:click={togglePlay}>
                            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                                {#if $spotifyState.isPlaying}<path d="M5 3v10 M11 3v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" />{:else}<path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />{/if}
                            </svg>
                        </button>
                        <button type="button" class="ic" tabindex="-1" disabled={$spotifyIsFading} aria-label="Próxima" data-title="Próxima" on:mousedown|preventDefault on:click={skipNext}>
                            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M3 3.2v9.6L10 8z" fill="currentColor" /></svg>
                        </button>
                        {#if $spotifyState.isPlaying}
                            <button type="button" class="ic fade" tabindex="-1" disabled={$spotifyIsFading} aria-label="Sumir aos poucos" data-title="Sumir aos poucos (fade)" on:mousedown|preventDefault on:click={fadePause}>↓</button>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    /* fechada: altura 0 e a margem de -10 px cancela o `gap` da coluna (o resto do No ar nao se mexe); aberta: 6 px abaixo da tela */
    .faixa {
        flex-shrink: 0;
        display: grid;
        grid-template-rows: 0fr;
        margin-top: -10px;
        visibility: hidden;
        transition:
            grid-template-rows 160ms ease,
            margin-top 160ms ease,
            visibility 0s linear 160ms;
    }
    .faixa.aberta {
        grid-template-rows: 1fr;
        margin-top: -4px;
        visibility: visible;
        transition:
            grid-template-rows 160ms ease,
            margin-top 160ms ease,
            visibility 0s;
    }
    .miolo {
        min-height: 0;
        overflow: hidden;
    }
    .bloco {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 6px;
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        transition: opacity 140ms;
    }
    /* fechando: o conteudo ja saiu, entao a caixa some enquanto a altura vai a 0 (sem piscar uma caixa vazia) */
    .faixa:not(.aberta) .bloco {
        opacity: 0;
    }
    .vu {
        height: 8px;
        display: flex;
        align-items: center;
    }
    .vu :global(.background) {
        width: 100%;
        background: transparent;
        padding: 0;
    }
    .vu :global(span.meter) {
        height: 3px !important;
    }
    .timer,
    .spotify {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        font-size: 11px;
    }
    .tn,
    .sn {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--luz-mudo);
    }
    .sa {
        opacity: 0.7;
    }
    .tv {
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
        color: var(--luz-texto);
    }
    .mais {
        font-size: 11px;
        color: var(--luz-fraco);
    }
    .ic {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 1px solid var(--luz-borda);
        border-radius: 5px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        cursor: pointer;
        font-size: 12px;
    }
    .ic:hover:not(:disabled) {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .ic:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
