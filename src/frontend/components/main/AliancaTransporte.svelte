<script lang="ts">
    // Leiaute v2, fatia 7 (D6, P6): a faixa de transporte logo abaixo da tela No ar. ALTURA FIXA (36 px, uma linha) e SEMPRE presente: sem
    // nada tocando mostra "nada tocando" e nada abaixo se mexe quando a midia comeca ou termina (revisao da fatia 7, achado 3: alvo de clique
    // que muda de lugar sozinho). Mais de uma coisa tocando (video + audio, temporizadores, Spotify): a primeira fica na linha e as outras
    // vao para o "+N", que abre um painel POR CIMA (nao empurra nada). Nao e camada sobre a tela: nenhum clique nela alcanca o slide.
    // A logica vem dos controles que o Preview antigo tinha (MediaControls/VideoSlider, Audio, Timers onlyPlaying, SpotifyController,
    // AudioMeter); a marcacao e nova. Nenhuma tecla nova: os atalhos de midia continuam no Preview escondido.
    import { onDestroy } from "svelte"
    import type { Unsubscriber } from "svelte/store"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activePage, activeTimers, media, outLocked, outputs, playerVideos, playingAudio, timers } from "../../stores"
    import { arrastoVale, criarLimitador, extrasDaFaixa, outrasSaidasComVideo, prenderBusca, prenderVolume, saidasHabilitadas, timersNaFaixa, type ArrastoMidia } from "../../utils/aliancaTransporteLogica"
    import { getAccess } from "../../utils/profile"
    import AudioMeter from "../drawer/audio/AudioMeter.svelte"
    import { getCurrentTimerValue, playPauseGlobal, resetTimer } from "../drawer/timers/timers"
    import { splitPath } from "../helpers/get"
    import { getExtension, getFileName, getMediaType, removeExtension } from "../helpers/media"
    import { joinTimeBig } from "../helpers/time"
    import { VideoPlayer } from "../media/video/videoPlayer"
    import { videoSync } from "../media/video/videoSync"
    import { fadePause, skipNext, skipPrev, spotifyIsFading, spotifyState, togglePlay } from "../output/preview/SpotifyManager"
    import AliancaTransporteLinha from "./AliancaTransporteLinha.svelte"

    const COR_VIDEO = "#8cc7a6"
    const COR_AUDIO = "#eba640"

    // ---------------- video: o fundo da saida PRINCIPAL, a mesma que a tela No ar logo acima mostra (revisao da fatia 7, achado 4) ----------------
    $: habilitadas = saidasHabilitadas($outputs)
    $: idSaida = habilitadas[0] || ""
    $: variasSaidas = habilitadas.length > 1
    $: nomeSaida = variasSaidas ? $outputs[idSaida]?.name || idSaida : ""
    $: fundo = idSaida ? $outputs[idSaida]?.out?.background : null
    $: caminho = (fundo?.path || fundo?.id || "") as string
    $: tipoFundo = (fundo?.type || (caminho ? getMediaType(getExtension(caminho)) : "image")) as string
    $: temVideo = !!fundo && !!caminho && (tipoFundo === "video" || tipoFundo === "player")
    $: nomeVideo = fundo?.type === "player" ? $playerVideos[fundo?.id || ""]?.name || "" : caminho.includes(".") && !caminho.includes("base64") ? removeExtension(splitPath(caminho).name) : fundo?.name || ""

    // outra saida com um video DIFERENTE: so um aviso, sem controles (o operador ve que ha mais, mas a faixa so mexe no da tela)
    const ehVideo = (b: any, c: string) => !!c && (b?.type === "video" || b?.type === "player" || (!b?.type && getMediaType(getExtension(c)) === "video"))
    $: outrasVideo = outrasSaidasComVideo(
        habilitadas.slice(1).map((id) => {
            const b = $outputs[id]?.out?.background
            const c = (b?.path || b?.id || "") as string
            return { caminho: c, video: ehVideo(b, c) }
        }),
        temVideo ? caminho : ""
    )

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
        // desmontou com o botao apertado: o vídeo que tocava antes do arrasto volta a tocar (a barra pausou ao começar)
        if (arrastoVideo && !pausadoAntes) VideoPlayer.play(arrastoVideo.caminho, arrastoVideo.saida)
        arrastoVideo = null
        if (escutaVideo) escutaVideo()
        clearInterval(relogio)
        clearInterval(passoAudio)
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
    // arrastar a barra: pausa enquanto arrasta (como o VideoSlider), busca em passos de 150 ms e volta a tocar ao soltar.
    // O arrasto guarda o arquivo e a saida em que comecou: se o fundo trocar no meio (outro video entra, Esc limpa), ele e abandonado
    // em vez de buscar no video novo; e a flag nunca fica presa (o tempo para de seguir o player enquanto ela esta ligada).
    let passoBusca: ReturnType<typeof setTimeout> | null = null
    let ultimoArrasto = 0
    let arrastoVideo: ArrastoMidia | null = null
    $: if (arrastoVideo && !arrastoVale(arrastoVideo, caminho, idSaida)) abandonarVideo()
    function abandonarVideo() {
        if (passoBusca) clearTimeout(passoBusca)
        passoBusca = null
        arrastoVideo = null
        arrastandoVideo = false
    }
    function comecarVideo() {
        if (!caminho) return
        arrastoVideo = { caminho, saida: idSaida }
        arrastandoVideo = true
        pausadoAntes = dadosVideo.pausado
        dadosVideo.pausado = true
        dadosVideo = dadosVideo
        VideoPlayer.pause(caminho, idSaida)
    }
    function moverVideo(e: CustomEvent<number>) {
        if (!arrastoVideo) return
        ultimoArrasto = e.detail
        tempoVideo = e.detail
        if (passoBusca) return
        passoBusca = setTimeout(() => {
            passoBusca = null
            if (arrastoVideo && arrastoVale(arrastoVideo, caminho, idSaida)) VideoPlayer.seekTo(arrastoVideo.caminho, arrastoVideo.saida, prenderBusca(ultimoArrasto, dadosVideo.duracao, $media[arrastoVideo.caminho]?.toTime))
        }, 150)
    }
    function soltarVideo(e: CustomEvent<number>) {
        if (passoBusca) clearTimeout(passoBusca)
        passoBusca = null
        const a = arrastoVideo
        arrastoVideo = null
        arrastandoVideo = false
        if (!a) return
        // o fundo mudou no meio do arrasto: nada a buscar nem a retomar (o video novo nao e o que o operador estava procurando)
        if (!arrastoVale(a, caminho, idSaida)) return
        const alvo = prenderBusca(e.detail, dadosVideo.duracao, $media[a.caminho]?.toTime)
        tempoVideo = alvo
        VideoPlayer.seekTo(a.caminho, a.saida, alvo)
        dadosVideo.pausado = pausadoAntes
        dadosVideo = dadosVideo
        if (!pausadoAntes) VideoPlayer.play(a.caminho, a.saida)
    }
    // o volume e o do arquivo (`media[caminho].volume`, o mesmo que o painel de informacoes da midia escreve)
    $: volumeVideo = $media[caminho]?.volume ?? 1
    // arrastar o volume escreve o `media` inteiro e o manda por IPC a todas as saidas: no maximo 10 escritas por segundo, e soltar grava o final.
    // O teto e 125 % (o que o ajuste da midia aceita): um volume salvo acima de 100 % aparece como e, e nao e reduzido calado.
    const gravarVolumeVideo = ({ c, v }: { c: string; v: number }) => {
        media.update((a) => ({ ...a, [c]: { ...(a[c] || {}), volume: v } }))
        VideoPlayer.updateVolume(c)
    }
    const limiteVolumeVideo = criarLimitador(gravarVolumeVideo, 100)
    function volumeDoVideo(e: CustomEvent<number>) {
        if (caminho) limiteVolumeVideo.empurrar({ c: caminho, v: prenderVolume(e.detail) })
    }
    function volumeFimDoVideo(e: CustomEvent<number>) {
        if (!caminho) return
        limiteVolumeVideo.fechar({ c: caminho, v: prenderVolume(e.detail) })
        VideoPlayer.reavaliarSilencioDoAudio()
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

    // ---------------- Spotify: so em Mostrar, onde o controlador escondido do Preview mantem o estado em dia ----------------
    $: temSpotify = $activePage === "show" && !!$spotifyState

    // ---------------- a faixa ----------------
    $: comMedidor = temVideo || temAudio
    $: total = (temVideo ? 1 : 0) + (temAudio ? 1 : 0) + lista.length + (temSpotify ? 1 : 0)
    $: extras = extrasDaFaixa(total)
    // o painel do "+N" abre por cima (posicao absoluta) e fecha ao clicar fora; nunca por Esc (Esc e "limpar tudo" no telao)
    let faixaEl: HTMLDivElement
    let painel = false
    $: if (extras === 0) painel = false
    function fora(e: PointerEvent) {
        if (painel && faixaEl && !faixaEl.contains(e.target as Node)) painel = false
    }
</script>

<svelte:window on:pointerdown={fora} />

<div bind:this={faixaEl} class="faixa" class:tem-mais={!!extras} data-acao="transporte" data-estado={total ? "ativo" : "vazio"} data-painel={painel ? "1" : "0"} data-sem-trava>
    <div class="lista" class:painel>
        {#if !total}<div class="item vazio">nada tocando{#if outrasVideo}<span class="outra" data-acao="transporte-outra">· +{outrasVideo} saída com mídia</span>{/if}</div>{/if}
        {#if temVideo}
            <div class="item">
                <AliancaTransporteLinha tipo="video" cor={COR_VIDEO} nome={nomeVideo} saida={nomeSaida} pausado={dadosVideo.pausado} atual={tempoVideo} duracao={dadosVideo.duracao} repetir={dadosVideo.repetir} mudo={dadosVideo.mudo} volume={tipoFundo === "player" ? null : volumeVideo} travada={$outLocked} on:alternar={alternarVideo} on:repetir={alternarRepetir} on:mudo={alternarMudo} on:comecar={comecarVideo} on:mover={moverVideo} on:soltar={soltarVideo} on:volume={volumeDoVideo} on:volumefim={volumeFimDoVideo} />
            </div>
        {/if}
        {#if temAudio}
            <div class="item">
                <AliancaTransporteLinha tipo="audio" cor={COR_AUDIO} nome={nomeAudio} pausado={pausadoAudio} atual={tempoAudio} duracao={duracaoAudio} volume={volumeAudio} travada={$outLocked} on:alternar={alternarAudio} on:comecar={comecarAudio} on:mover={moverAudio} on:soltar={soltarAudio} on:volume={volumeDoAudio} on:volumefim={volumeFimDoAudio} />
            </div>
        {/if}
        {#each lista as t (t.id)}
            {@const timer = $timers[t.id]}
            {@const pausado = pausadoDoTimer(t.id, $activeTimers)}
            <div class="item timer" data-timer={t.id}>
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
        {#if temSpotify && $spotifyState}
            <div class="item spotify" data-acao="spotify">
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
    {#if total && outrasVideo}
        <span class="outra fixa" data-acao="transporte-outra" data-title="+{outrasVideo} saída com mídia diferente: sem controles aqui" aria-label="+{outrasVideo} saída com mídia">+{outrasVideo} saída</span>
    {/if}
    {#if extras > 0}
        <button type="button" class="mais" class:lig={painel} tabindex="-1" aria-expanded={painel} data-acao="transporte-mais" data-title={painel ? "Fechar a lista" : "Ver o que mais está tocando"} on:mousedown|preventDefault on:click={() => (painel = !painel)}>+{extras}</button>
    {/if}
    {#if comMedidor}
        <div class="vu" data-acao="medidor" data-title="Nível de áudio da saída"><AudioMeter channelId="main" /></div>
    {/if}
</div>

<style>
    /* reservada: 36 px sempre, tocando ou nao. A margem de -4 px deixa 6 px entre a tela e a faixa (o `gap` da coluna e 10) */
    .faixa {
        position: relative;
        flex-shrink: 0;
        height: 36px;
        margin-top: -4px;
        display: flex;
        align-items: stretch;
        gap: 4px;
        padding: 0 6px;
        border-radius: 6px;
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
    }
    /* so a primeira linha aparece; as outras esperam no "+N" (visibility tira do clique e do leitor de tela) */
    .lista {
        flex: 1 1 0;
        min-width: 0;
        height: 36px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .faixa.tem-mais .lista:not(.painel) {
        margin-right: 34px;
    }
    .lista:not(.painel) .item:nth-child(n + 2) {
        visibility: hidden;
    }
    /* aberta: por cima do que ha abaixo (posicao absoluta: a faixa continua com 36 px e nada se mexe) */
    .lista.painel {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: auto;
        z-index: 30;
        overflow: visible;
        padding: 0 40px 0 6px;
        border-radius: 6px;
        background: var(--luz-pop-opaco, #1c1c1f);
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            0 6px 18px rgb(0 0 0 / 0.45);
    }
    .item {
        flex: 0 0 36px;
        height: 36px;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        font-size: 11px;
    }
    .vazio {
        color: var(--luz-fraco);
    }
    /* aviso de OUTRA saida com video diferente: texto, sem controle */
    .outra {
        color: var(--luz-ambar);
        white-space: nowrap;
    }
    .outra.fixa {
        flex: 0 0 auto;
        align-self: center;
        font-size: 10px;
    }
    .faixa.tem-mais .outra.fixa {
        margin-right: 34px;
    }
    .vu {
        position: absolute;
        left: 6px;
        right: 6px;
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
    .ic,
    .mais {
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
    /* o "+N" fica de pe no canto, acima do painel aberto */
    .mais {
        position: absolute;
        right: 6px;
        top: 7px;
        z-index: 31;
        width: auto;
        min-width: 28px;
        padding: 0 5px;
        font-size: 11px;
    }
    .mais.lig {
        border-color: var(--luz-texto);
    }
    .ic:hover:not(:disabled),
    .mais:hover {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .ic:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
