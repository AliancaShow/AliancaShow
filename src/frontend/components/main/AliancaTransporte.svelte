<script lang="ts">
    // Cabine 18/nov, C2: a PILHA de transporte logo abaixo da tela No ar. Um cartao de 60 px por midia (video, audio, Spotify; temporizador numa linha so), compactos e quietos,
    // sem botao creme. Sem nada tocando a pilha reserva UM cartao (60 px) com "nada tocando": nada abaixo se mexe quando a primeira midia comeca. Do 4o cartao em diante a
    // pilha rola por dentro (e uma caixa com altura maxima de 3 cartoes, como as outras do leiaute); nao ha mais "+N" nem painel por cima.
    // A logica vem dos controles que o Preview antigo tinha (MediaControls/VideoSlider, Audio, Timers onlyPlaying, SpotifyController, AudioMeter); a marcacao e nova.
    // Nenhuma tecla nova: os atalhos de midia continuam no Preview escondido.
    import { onDestroy } from "svelte"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activePage, activeTimers, media, outLocked, outputs, playingAudio, timers } from "../../stores"
    import { criarLimitador, etiquetaDeSaidaNecessaria, nomeDaEtiqueta, pilhaAlturaMaxima, prenderBusca, prenderVolume, saidasHabilitadas, timersNaFaixa, videosDaPilha, type FundoDeSaida } from "../../utils/aliancaTransporteLogica"
    import { getAccess } from "../../utils/profile"
    import AudioMeter from "../drawer/audio/AudioMeter.svelte"
    import { getCurrentTimerValue, playPauseGlobal, resetTimer } from "../drawer/timers/timers"
    import { getExtension, getFileName, getMediaType, removeExtension } from "../helpers/media"
    import { joinTimeBig } from "../helpers/time"
    import { fadePause, seekTo as spotifySeek, skipNext, skipPrev, spotifyIsFading, spotifyState, togglePlay } from "../output/preview/SpotifyManager"
    import { chaveAudio, pararAudio, pausarAudioSuave, pausasSuaves, tocarAudio } from "../../utils/aliancaPausaSuave"
    import { alternarMudoDoSpotify, pararSpotify, volumeDoSpotify, volumeFimDoSpotify } from "../../utils/aliancaSpotifyCartao"
    import { spotifyMudo, VOLUME_MAXIMO_SPOTIFY } from "../../utils/aliancaSpotifyCartaoLogica"
    import AliancaBarra from "./AliancaBarra.svelte"
    import AliancaTransporteLinha from "./AliancaTransporteLinha.svelte"
    import AliancaTransporteVideo from "./AliancaTransporteVideo.svelte"

    const COR_AUDIO = "#eba640"

    // ---------------- video: um cartao por ARQUIVO no fundo das saidas (a primeira saida que o toca o comanda) ----------------
    const ehVideo = (b: any, c: string) => !!c && (b?.type === "video" || b?.type === "player" || (!b?.type && getMediaType(getExtension(c)) === "video"))
    $: habilitadas = saidasHabilitadas($outputs)
    $: fundos = habilitadas.map((id) => {
        const b = $outputs[id]?.out?.background
        const c = (b?.path || b?.id || "") as string
        return { id, caminho: c, video: ehVideo(b, c), fundo: b }
    })
    $: videos = videosDaPilha(fundos as FundoDeSaida[]).map((v) => ({ ...v, fundo: fundos.find((f) => f.id === v.id)?.fundo }))
    // a etiqueta da saida so quando ha duvida (mais de uma saida e elas nao mostram a mesma coisa); "Primaria" nunca aparece
    $: etiquetar = etiquetaDeSaidaNecessaria(fundos as FundoDeSaida[])
    $: principal = habilitadas[0] || ""
    $: temVideo = videos.length > 0

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
    // D25: Pausar faz o volume cair a 0 em 0,7 s e pausa (o nivel volta, parado, para o play manual); clicar durante a curva cancela
    $: pausandoAudio = !!idAudio && $pausasSuaves.has(chaveAudio(idAudio))
    function alternarAudio() {
        if ($outLocked || !idAudio) return
        if (pausadoAudio || pausandoAudio) tocarAudio(idAudio, tempoAudio, tocandoAudio?.name || "")
        else pausarAudioSuave(idAudio)
    }
    // D27: Parar = limpa este audio (o F4, so para ele)
    function pararEsteAudio() {
        if ($outLocked || !idAudio) return
        pararAudio(idAudio)
    }
    let arrastoAudio = ""
    $: if (arrastoAudio && arrastoAudio !== idAudio) {
        arrastoAudio = ""
        arrastandoAudio = false
    }
    function comecarAudio() {
        if (!idAudio) return
        arrastoAudio = idAudio
        arrastandoAudio = true
    }
    function moverAudio(e: CustomEvent<number>) {
        if (arrastoAudio) tempoAudio = e.detail
    }
    function soltarAudio(e: CustomEvent<number>) {
        const id = arrastoAudio
        arrastoAudio = ""
        arrastandoAudio = false
        if (!id || id !== idAudio) return
        const pausado = pausadoAudio
        const alvo = prenderBusca(e.detail, duracaoAudio, $media[id]?.toTime)
        tempoAudio = alvo
        playingAudio.update((a) => {
            if (a[id]?.audio?.currentTime === undefined) return a
            a[id].audio.currentTime = alvo
            // o player toca ao mexer no tempo: se estava pausado, pausa de novo (o Audio.svelte antigo faz igual)
            if (pausado) setTimeout(() => a[id].audio.pause(), 20)
            return a
        })
    }
    $: volumeAudio = $media[idAudio]?.volume ?? 1
    const gravarVolumeAudio = ({ id, v }: { id: string; v: number }) => {
        media.update((a) => ({ ...a, [id]: { ...(a[id] || {}), volume: v } }))
        AudioPlayer.updateVolume(id)
    }
    const limiteVolumeAudio = criarLimitador(gravarVolumeAudio, 100)
    // o audio trata 0 como "sem valor" (= 1): o minimo e 1 %; para silenciar de vez, usar o mixer
    function volumeDoAudio(e: CustomEvent<number>) {
        if (idAudio) limiteVolumeAudio.empurrar({ id: idAudio, v: prenderVolume(e.detail, 0.01) })
    }
    function volumeFimDoAudio(e: CustomEvent<number>) {
        if (idAudio) limiteVolumeAudio.fechar({ id: idAudio, v: prenderVolume(e.detail, 0.01) })
    }

    // ---------------- temporizadores (a mesma lista que o Timers onlyPlaying) ----------------
    let hoje = new Date()
    const relogio = setInterval(() => (hoje = new Date()), 1000)
    $: lista = timersNaFaixa($timers, $activeTimers)
    $: somenteLeitura = getAccess("timers").global === "read"
    const lerValor = (t: any, id: string, _a: any, agora: Date) => joinTimeBig(getCurrentTimerValue(t, { id }, agora, $activeTimers), true, true)
    const pausadoDoTimer = (id: string, a: any[]) => !!a.find((x) => x.id === id)?.paused

    onDestroy(() => {
        clearInterval(relogio)
        clearInterval(passoAudio)
    })

    // ---------------- Spotify: so em Mostrar, onde o controlador escondido do Preview mantem o estado em dia ----------------
    $: temSpotify = $activePage === "show" && !!$spotifyState
    $: faltaSpotify = $spotifyState ? Math.max(0, Math.floor($spotifyState.durationSec - $spotifyState.positionSec)) : 0
    // C2 linha 2: mudo + volume (volume do app no mixer do Windows, 0..1); o valor mostrado vem do estado, que o limitador atualiza na hora
    $: volumeSpotify = Math.min(VOLUME_MAXIMO_SPOTIFY, Math.max(0, $spotifyState?.volume ?? 0))
    $: mudoSpotify = spotifyMudo($spotifyState?.volume)
    const mmss = (s: number) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0")

    // ---------------- a pilha ----------------
    $: comMedidor = temVideo || temAudio
    $: total = videos.length + (temAudio ? 1 : 0) + lista.length + (temSpotify ? 1 : 0)
</script>

<div class="faixa" data-acao="transporte" data-estado={total ? "ativo" : "vazio"} data-sem-trava>
    <div class="pilha" data-acao="transporte-pilha" style="max-height: {pilhaAlturaMaxima()}px">
        {#if !total}<div class="vazio">nada tocando</div>{/if}
        {#each videos as v (v.caminho)}
            <AliancaTransporteVideo fundo={v.fundo} idSaida={v.id} etiqueta={etiquetar ? nomeDaEtiqueta($outputs[v.id]?.name) : ""} noTelao={v.id === principal} />
        {/each}
        {#if temAudio}
            <AliancaTransporteLinha tipo="audio" cor={COR_AUDIO} nome={nomeAudio} pausado={pausadoAudio || pausandoAudio} pausando={pausandoAudio} atual={tempoAudio} duracao={duracaoAudio} volume={volumeAudio} travada={$outLocked} on:alternar={alternarAudio} on:parar={pararEsteAudio} on:comecar={comecarAudio} on:mover={moverAudio} on:soltar={soltarAudio} on:volume={volumeDoAudio} on:volumefim={volumeFimDoAudio} />
        {/if}
        {#each lista as t (t.id)}
            {@const timer = $timers[t.id]}
            {@const pausado = pausadoDoTimer(t.id, $activeTimers)}
            <div class="tm" data-timer={t.id}>
                {#if t.tipo === "counter"}
                    <button type="button" class="q p" tabindex="-1" disabled={somenteLeitura} aria-label={pausado ? "Continuar" : "Pausar"} data-title={pausado ? "Continuar" : "Pausar"} on:mousedown|preventDefault on:click={() => playPauseGlobal(t.id, timer)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                            {#if pausado}<path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />{:else}<path d="M5 3v10 M11 3v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" />{/if}
                        </svg>
                    </button>
                {/if}
                <span class="nome" data-title={t.nome}>{t.nome || "Temporizador"}</span>
                <span class="t1">{lerValor(timer, t.id, $activeTimers, hoje)}</span>
                {#if t.tipo === "counter"}
                    <button type="button" class="q" tabindex="-1" disabled={somenteLeitura} aria-label="Parar temporizador" data-title="Parar e zerar" on:mousedown|preventDefault on:click={() => resetTimer(t.id)}>
                        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4h8v8H4z" fill="currentColor" /></svg>
                    </button>
                {/if}
            </div>
        {/each}
        {#if temSpotify && $spotifyState}
            <div class="tk" data-acao="spotify" data-sem-trava>
                <div class="tk-a">
                    <div class="grp3">
                        <button type="button" class="q" tabindex="-1" disabled={$spotifyIsFading} aria-label="Anterior" data-title="Anterior" on:mousedown|preventDefault on:click={skipPrev}>
                            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M13 3.2v9.6L6 8z" fill="currentColor" /></svg>
                        </button>
                        <button type="button" class="q p" tabindex="-1" disabled={$spotifyIsFading} aria-label={$spotifyState.isPlaying ? "Pausar Spotify" : "Tocar Spotify"} data-title={$spotifyState.isPlaying ? "Pausar" : "Tocar"} on:mousedown|preventDefault on:click={togglePlay}>
                            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                                {#if $spotifyState.isPlaying}<path d="M5 3v10 M11 3v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" />{:else}<path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />{/if}
                            </svg>
                        </button>
                        <button type="button" class="q" tabindex="-1" disabled={$spotifyIsFading} aria-label="Próxima" data-title="Próxima" on:mousedown|preventDefault on:click={skipNext}>
                            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M3 3.2v9.6L10 8z" fill="currentColor" /></svg>
                        </button>
                    </div>
                    <!-- 4b: Parar = pausar + voltar ao inicio; sempre no mesmo lugar (nada entra nem sai quando da play) -->
                    <button type="button" class="q" tabindex="-1" disabled={$spotifyIsFading} aria-label="Parar Spotify" data-acao="spotify-parar" data-title="Parar (volta ao início)" on:mousedown|preventDefault on:click={pararSpotify}>
                        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4h8v8H4z" fill="currentColor" /></svg>
                    </button>
                    <span class="nome" data-title={$spotifyState.title + " · " + $spotifyState.artist}>♫ {$spotifyState.title || "—"}<span class="sub"> · {$spotifyState.artist || ""}</span></span>
                    <span class="t1">−{mmss(faltaSpotify)}</span>
                </div>
                <div class="tk-b">
                    <AliancaBarra valor={$spotifyState.positionSec} max={$spotifyState.durationSec} desligada={$spotifyIsFading || !($spotifyState.durationSec > 0)} rotulo="Posição" alto on:soltar={(e) => spotifySeek(e.detail)} />
                    <!-- a casa FIXA do crossfade (duas rampas que se cruzam, sem seta): sempre no mesmo pixel, parado ou tocando; acesa enquanto o fade corre -->
                    <button type="button" class="q" class:lig={$spotifyIsFading} tabindex="-1" disabled={$spotifyIsFading || !$spotifyState.isPlaying} aria-label="Sumir aos poucos" data-acao="spotify-crossfade" data-title="Crossfade: sumir aos poucos (fade)" on:mousedown|preventDefault on:click={fadePause}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 4h3l7 8h3M1.5 12h3l7-8h3" /></svg>
                    </button>
                    <!-- C2: mudo 24 px + volume 40 px, como o cartao de midia (AliancaTransporteLinha) -->
                    <button type="button" class="q" class:lig={mudoSpotify} tabindex="-1" disabled={$spotifyIsFading} aria-pressed={mudoSpotify} aria-label="Mudo do Spotify" data-acao="spotify-mudo" data-title={mudoSpotify ? "Som desligado: ligar" : "Desligar o som"} on:mousedown|preventDefault on:click={alternarMudoDoSpotify}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M2.5 6h2.5l3-2.5v9L5 10H2.5z" />
                            {#if mudoSpotify}<path d="M11 6l3 4 M14 6l-3 4" />{:else}<path d="M11 5.5a3.5 3.5 0 0 1 0 5" />{/if}
                        </svg>
                    </button>
                    <div class="vol" data-acao="spotify-volume"><AliancaBarra valor={volumeSpotify} max={VOLUME_MAXIMO_SPOTIFY} desligada={$spotifyIsFading} rotulo="Volume do Spotify {Math.round(volumeSpotify * 100)}%" alto on:mover={(e) => volumeDoSpotify(e.detail)} on:soltar={(e) => volumeFimDoSpotify(e.detail)} /></div>
                </div>
            </div>
        {/if}
    </div>
    {#if comMedidor}
        <div class="vu" data-acao="medidor" data-title="Nível de áudio da saída"><AudioMeter channelId="main" /></div>
    {/if}
</div>

<style>
    /* reservada: a pilha tem no minimo UM cartao de 60 px (tocando ou nao) e rola por dentro a partir do 4o; a margem de -4 px deixa 6 px entre a tela e a pilha (o gap da coluna e 10) */
    .faixa {
        position: relative;
        flex-shrink: 0;
        margin-top: -4px;
    }
    .pilha {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-height: 60px;
        overflow-y: auto;
        overflow-x: hidden;
    }
    .vazio {
        height: 60px;
        flex-shrink: 0;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        padding: 0 12px;
        border-radius: 8px;
        background: var(--luz-trilho);
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .vu {
        position: absolute;
        left: 8px;
        right: 8px;
        bottom: 1px;
        height: 3px;
        pointer-events: none;
    }
    .vu :global(.background) {
        width: 100%;
        background: transparent;
        padding: 0;
    }
    .vu :global(span.meter) {
        height: 3px !important;
    }
    /* cartao do Spotify e do temporizador: o mesmo desenho dos cartoes de midia (AliancaTransporteLinha) */
    .tk,
    .tm {
        flex-shrink: 0;
        box-sizing: border-box;
        border-radius: 8px;
        background: var(--luz-trilho);
        min-width: 0;
    }
    .tk {
        height: 60px;
        padding: 6px 8px 4px 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .tm {
        height: 36px;
        padding: 0 8px 0 6px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .tk-a,
    .tk-b {
        display: flex;
        align-items: center;
        height: 24px;
        min-width: 0;
    }
    .tk-a {
        gap: 6px;
    }
    .tk-b {
        gap: 2px;
    }
    .grp3 {
        display: flex;
        gap: 2px;
    }
    .q {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto-60);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
    .q:hover:not(:disabled) {
        background: var(--luz-hover);
        color: var(--luz-texto);
    }
    .q:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .q.p {
        box-shadow: inset 0 0 0 1px var(--luz-borda);
        color: var(--luz-texto-85);
    }
    .q.lig {
        color: var(--luz-texto);
        background: var(--luz-hover);
    }
    .nome {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--luz-texto-80);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .sub {
        color: var(--luz-mudo);
    }
    .vol {
        flex: 0 0 40px;
        display: flex;
        margin: 0 2px;
    }
    .vol :global(.barra) {
        margin: 0 2px;
    }
    .t1 {
        flex-shrink: 0;
        min-width: 44px;
        text-align: right;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--luz-texto-85);
    }
</style>
