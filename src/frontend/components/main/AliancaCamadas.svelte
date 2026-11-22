<script lang="ts">
    // Leiaute v2, coluna No ar: a faixa de icones colada na tela (sobreposicao F3, texto F2, fundo F1, audio F4) e "limpar tudo".
    // NAO le nem escreve o estado do Preview (autoChange/activeClear): deriva dos mesmos stores (aliancaCamadasLogica) e chama os mesmos
    // limpadores que as teclas F1-F4 de `previewShortcuts`. Respeita `outLocked`. "Limpar tudo" limpa com UM clique, como o Esc.
    import { clearAudio } from "../../audio/audioFading"
    import { activePage, outLocked, outputs, playingAudio, playingMetronome, timelineRecordingAction } from "../../stores"
    import { camadasDoNoAr, COR_DA_CAMADA, tudoDesabilitado, type IdCamada } from "../../utils/aliancaCamadasLogica"
    import { clearAll, clearBackground, clearOverlays, clearSlide } from "../output/clear"
    import { isOutCleared } from "../helpers/output"
    import { spotifyState } from "../output/preview/SpotifyManager"
    import { pararSpotifyComoAudio } from "../../utils/aliancaSpotifyCartao"
    import { spotifyNaCamadaAudio } from "../../utils/aliancaSpotifyCartaoLogica"

    // D9: o Spotify e midia so de audio: tocando, acende a camada Audio; F4/Audio/"Limpar tudo" tambem o param (fade curto)
    $: spotifyTocando = spotifyNaCamadaAudio($activePage, $spotifyState)

    $: audioLimpo = !Object.keys($playingAudio).length && !$playingMetronome
    $: audioSemMicrofone = !Object.values($playingAudio).filter((a) => !a.isMic).length && !$playingMetronome
    $: entrada = {
        fundoLimpo: isOutCleared("background", $outputs),
        textoLimpo: isOutCleared("slide", $outputs),
        // sem contar as sobreposicoes TRAVADAS (checkLocked=false): com so uma travada no ar o icone fica apagado, como o botao antigo (`lockedOverlay`)
        sobreposicaoLimpa: isOutCleared("overlays", $outputs, false),
        efeitosLimpos: isOutCleared("effects", $outputs, true),
        audioLimpo,
        tudoLimpo: isOutCleared(null, $outputs) && audioSemMicrofone,
        travada: $outLocked,
        spotifyTocando
    }
    $: camadas = camadasDoNoAr(entrada)
    $: tudoOff = tudoDesabilitado(entrada)

    const ICONES: Record<IdCamada | "tudo", string> = {
        sobre: "M5.5 2.5h8v6h-8z M2.5 6.5v7h8",
        texto: "M3.5 3.5h9 M8 3.5v9.5",
        fundo: "M2.5 3.5h11v9h-11z M2.5 10.5l3.5-3 2.5 2 2-1.5 3 2.5",
        audio: "M6 11.5v-8l7-1.5v8 M6 11.5a1.8 1.8 0 1 1-3.6 0a1.8 1.8 0 1 1 3.6 0 M13 10a1.8 1.8 0 1 1-3.6 0a1.8 1.8 0 1 1 3.6 0",
        tudo: "M4 4l8 8 M12 4l-8 8"
    }

    function limpar(id: IdCamada) {
        if ($outLocked) return
        if (id === "fundo") {
            clearBackground()
            timelineRecordingAction.set({ id: "clear_background" })
        } else if (id === "texto") {
            clearSlide()
            timelineRecordingAction.set({ id: "clear_slide" })
        } else if (id === "sobre") {
            // `clearOverlays` MANTEM as sobreposicoes travadas e passa por `destinoRecusaTecla()`, como o botao de antes
            clearOverlays()
            timelineRecordingAction.set({ id: "clear_overlays" })
        } else {
            clearAudio("", { clearPlaylist: true, clearMicrophones: true, commonClear: true })
            timelineRecordingAction.set({ id: "clear_audio" })
            pararSpotifyComoAudio()
        }
    }

    // ----- limpar tudo: UM clique, igual ao Esc (limpar o telao e recuperavel por "Voltar o que foi limpo") -----
    function limparTudo() {
        if (tudoOff) return
        clearAll(true)
        pararSpotifyComoAudio()
    }
</script>

<div class="faixa" data-acao="camadas">
    {#each camadas as c (c.id)}
        <button class="ic" class:limpo={!c.noAr} style="--cor: {COR_DA_CAMADA[c.id]}" disabled={c.desabilitada} aria-label={c.rotulo} data-title={c.rotulo} data-camada={c.id} tabindex="-1" on:mousedown|preventDefault on:click={() => limpar(c.id)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONES[c.id]} /></svg>
        </button>
    {/each}
    <button class="ic tudo" disabled={tudoOff} aria-label="Limpar tudo (Esc)" data-title="Limpar tudo (Esc)" data-camada="tudo" tabindex="-1" on:mousedown|preventDefault on:click={limparTudo}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONES.tudo} /></svg>
    </button>
</div>

<style>
    .faixa {
        width: 30px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        user-select: none;
        -webkit-touch-callout: none;
    }
    .ic {
        position: relative;
        flex: 1 1 0;
        min-height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border-radius: 5px;
        cursor: pointer;
        overflow: hidden;
        border: 1px solid var(--luz-borda);
        background: var(--luz-campo);
        color: var(--cor);
    }
    .ic.limpo {
        border-color: var(--luz-linha);
        color: rgba(248, 248, 240, 0.2);
    }
    .ic:disabled {
        cursor: default;
    }
    .tudo {
        margin-top: 4px;
        border-color: var(--luz-vermelho);
        color: var(--luz-vermelho);
    }
    .tudo:disabled {
        border-color: var(--luz-linha);
        color: rgba(248, 248, 240, 0.2);
    }
    svg {
        position: relative;
    }
</style>
