<script lang="ts">
    import { chavesMarcadas, cliqueDeMarcar, duploCliqueDeMarcar, marcadoDeArquivo } from "../../../utils/aliancaGaveta"
    import { chaveDe } from "../../../utils/aliancaGavetaLogica"
    import { gavetaNaoToca } from "../../../utils/aliancaModo"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { AudioPlaylist } from "../../../audio/audioPlaylist"
    import { addProjectItem } from "../../../converters/project"
    import { activePlaylist, activeShow, media, outLocked, playingAudio } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"

    import SelectElem from "../../system/SelectElem.svelte"

    export let path: string
    export let name: string
    export let active: string | null = null
    export let playlist = false
    export let index = -1
    export let fileOver = false

    $: outline = !!$playingAudio[path] && (!$activePlaylist || $activePlaylist?.index === index)

    // AliançaShow (Preparar F6): no Preparar o clique MARCA o áudio para o culto; nunca toca
    $: marcadoDaGaveta = marcadoDeArquivo({ path, name })
    $: estaMarcado = !!marcadoDaGaveta && $chavesMarcadas.has(chaveDe(marcadoDaGaveta))
</script>

<SelectElem id="audio" data={{ path, name, index }} {fileOver} borders={playlist ? "edges" : "all"} trigger={playlist ? "column" : null} draggable>
    <Button
        class="context #audio_button{playlist ? '_playlist' : ''}"
        {outline}
        active={$activeShow?.id === path}
        border
        style="width: 100%;"
        title={path}
        bold={false}
        on:click={(e) => {
            if (gavetaNaoToca()) {
                if (e.ctrlKey || e.metaKey || e.shiftKey) return
                const m = marcadoDeArquivo({ path, name })
                if (m) cliqueDeMarcar(m)
                return
            }
            if ($outLocked || e.ctrlKey || e.metaKey || e.shiftKey) return

            if (playlist) AudioPlaylist.start(active || "", path, index, { pauseIfPlaying: true })
            else AudioPlayer.start(path, { name }, { playMultiple: e.altKey })
        }}
        on:dblclick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) return
            if (gavetaNaoToca()) {
                const m = marcadoDeArquivo({ path, name })
                if (m) duploCliqueDeMarcar(m)
                return
            }
            addProjectItem({ id: path, name, type: "audio" })
        }}
    >
        <span style="max-width: 90%;">
            {#await AudioPlayer.getDuration(path)}
                <Icon id="music" white right />
            {:then duration}
                <Icon id={$playingAudio[path]?.paused === true ? "play" : $playingAudio[path]?.paused === false ? "pause" : $media[path]?.favourite === true && active !== "favourites" ? "star" : AudioPlayer.getAudioType(path, duration)} white={$playingAudio[path]?.paused === true || (!$playingAudio[path] && ($media[path]?.favourite !== true || active === "favourites"))} right />
            {/await}
            {#if estaMarcado}<span class="marcadoGaveta" data-title="Marcado para o culto"><Icon id="check" size={0.9} white /></span>{/if}
            <p>{name.slice(0, name.lastIndexOf("."))}</p>
        </span>
        <span style="opacity: 0.8;">
            {#await AudioPlayer.getDuration(path)}
                <p>00:00</p>
            {:then duration}
                <p>{joinTime(secondsToTime(duration))}</p>
            {/await}
        </span>
    </Button>
</SelectElem>

<style>
    span {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .marcadoGaveta {
        padding: 2px;
        border-radius: 50%;
        background: var(--secondary);
    }
</style>
