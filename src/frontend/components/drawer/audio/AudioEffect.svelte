<script lang="ts">
    import { gavetaNaoToca } from "../../../utils/aliancaGavetaToque"
    import { onDestroy } from "svelte"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { activeShow, outLocked, playingAudio } from "../../../stores"
    import { getFileName } from "../../helpers/media"
    import Button from "../../inputs/Button.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import TocarAgora from "../TocarAgora.svelte"

    export let path: string
    export let name: string

    let currentTime = 0
    let duration = 0

    $: if ($playingAudio[path]) startUpdater()
    else stop()
    onDestroy(() => {
        if (updaterInterval) clearInterval(updaterInterval)
    })

    let updaterInterval: NodeJS.Timeout | null = null
    function startUpdater() {
        if (updaterInterval) return

        updaterInterval = setInterval(() => {
            let audio = AudioPlayer.getAudio(path)
            if (!audio) return

            currentTime = audio.currentTime
            duration = audio.duration
        }, 80)
    }

    function stop() {
        currentTime = 0
        duration = 0
        if (updaterInterval) clearInterval(updaterInterval)
        updaterInterval = null
    }

    $: outline = !!$playingAudio[path]

    // o clique so seleciona; o ▶ (e o "Mostrar agora" do botao direito) toca (revisao da fatia 6, achado 4)
    function tocar() {
        if (gavetaNaoToca() || $outLocked) return
        AudioPlayer.start(path, { name }, { playMultiple: true, stopIfPlaying: true, clearTime: 0.3 })
    }
</script>

<div data-tocavel style="position: relative;width: calc(20% - 5px);">
<SelectElem id="audio_effect" data={{ path, name }} style="width: 100%;" draggable>
    <Button
        class="context #audio_effect_button"
        {outline}
        active={$activeShow?.id === path}
        border
        style="width: 100%;height: 100px;border: 2px solid var(--primary-lighter);border-radius: 8px;"
        title={getFileName(path)}
        bold={false}
    >
        <div class="flex">
            <p style="font-size: 1.15em;white-space: normal;">{name}</p>
            <!-- <span style="opacity: 0.8;">
                {#await AudioPlayer.getDuration(path)}
                    <p>00:00</p>
                {:then duration}
                    <p>{joinTime(secondsToTime(duration))}</p>
                {/await}
            </span> -->
        </div>
        {#if duration}
            <div class="progress" style="width: {(currentTime / duration) * 100}%;"></div>
        {/if}
    </Button>
</SelectElem>
<TocarAgora flutuante titulo={outline ? "Parar o efeito" : "Tocar o efeito"} on:tocar={tocar} />
</div>

<style>
    .flex {
        display: flex;
        flex-direction: column;
        justify-content: center;

        width: 100%;
        height: 100%;

        padding: 0;
    }

    .progress {
        position: absolute;
        bottom: 0;
        left: 0;

        width: 100%;
        height: 2px;

        background-color: var(--secondary);

        padding: 0;
    }
</style>
