<script lang="ts">
    // Leiaute v2, coluna No ar: a faixa de icones colada na tela (sobreposicao F3, texto F2, fundo F1, audio F4) e "limpar tudo".
    // NAO le nem escreve o estado do Preview (autoChange/activeClear): deriva dos mesmos stores (aliancaCamadasLogica) e chama os mesmos
    // limpadores que as teclas F1-F4 de `previewShortcuts`. Respeita `outLocked`. "Limpar tudo" e de SEGURAR (nasce inerte 1 s); Esc
    // continua limpando na hora (e do Preview escondido).
    import { onDestroy } from "svelte"
    import { clearAudio } from "../../audio/audioFading"
    import { outLocked, outputs, playingAudio, playingMetronome, timelineRecordingAction } from "../../stores"
    import { camadasDoNoAr, COR_DA_CAMADA, SEGURAR_MS, tudoDesabilitado, type IdCamada } from "../../utils/aliancaCamadasLogica"
    import { clearAll, clearBackground, clearSlide } from "../output/clear"
    import { isOutCleared, setOutput } from "../helpers/output"

    $: audioLimpo = !Object.keys($playingAudio).length && !$playingMetronome
    $: audioSemMicrofone = !Object.values($playingAudio).filter((a) => !a.isMic).length && !$playingMetronome
    $: entrada = {
        fundoLimpo: isOutCleared("background", $outputs),
        textoLimpo: isOutCleared("slide", $outputs),
        sobreposicaoLimpa: isOutCleared("overlays", $outputs, true),
        efeitosLimpos: isOutCleared("effects", $outputs, true),
        audioLimpo,
        tudoLimpo: isOutCleared(null, $outputs) && audioSemMicrofone,
        travada: $outLocked
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
            setOutput("overlays", [])
            setOutput("effects", [])
            timelineRecordingAction.set({ id: "clear_overlays" })
        } else {
            clearAudio("", { clearPlaylist: true, clearMicrophones: true, commonClear: true })
            timelineRecordingAction.set({ id: "clear_audio" })
        }
    }

    // ----- limpar tudo: segurar -----
    let progresso = 0
    let inicio = 0
    let quadro = 0
    const nasceuEm = Date.now()
    let agora = Date.now()
    const relogio = setInterval(() => (agora = Date.now()), 250)
    onDestroy(() => {
        clearInterval(relogio)
        cancelAnimationFrame(quadro)
    })
    $: inerte = agora - nasceuEm < 1000
    function comecar(e: PointerEvent) {
        if (e.button !== 0 || tudoOff || Date.now() - nasceuEm < 1000) return
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        inicio = performance.now()
        const passo = () => {
            progresso = Math.min(1, (performance.now() - inicio) / SEGURAR_MS)
            if (progresso >= 1) {
                inicio = 0
                progresso = 0
                clearAll(true)
                return
            }
            quadro = requestAnimationFrame(passo)
        }
        quadro = requestAnimationFrame(passo)
    }
    function soltar() {
        cancelAnimationFrame(quadro)
        inicio = 0
        progresso = 0
    }
</script>

<div class="faixa" data-acao="camadas">
    {#each camadas as c (c.id)}
        <button class="ic" class:limpo={!c.noAr} style="--cor: {COR_DA_CAMADA[c.id]}" disabled={c.desabilitada} aria-label={c.rotulo} data-title={c.rotulo} data-camada={c.id} tabindex="-1" on:mousedown|preventDefault on:click={() => limpar(c.id)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONES[c.id]} /></svg>
        </button>
    {/each}
    <button class="ic tudo" class:inerte disabled={tudoOff} aria-label="Segure pra limpar tudo · Esc" data-title="Segure pra limpar tudo · Esc" data-camada="tudo" tabindex="-1" on:mousedown|preventDefault on:pointerdown={comecar} on:pointerup={soltar} on:pointercancel={soltar} on:pointerleave={soltar}>
        <span class="enche" style="height: {progresso * 100}%" />
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
    .tudo.inerte {
        opacity: 0.6;
    }
    .enche {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(242, 26, 39, 0.35);
        pointer-events: none;
    }
    svg {
        position: relative;
    }
</style>
