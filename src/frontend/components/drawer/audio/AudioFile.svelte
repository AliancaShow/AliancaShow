<script lang="ts">
    import { chavesMarcadas, cliqueDeMarcar, duploCliqueDeMarcar, marcadoDeArquivo } from "../../../utils/aliancaGaveta"
    import { chaveDe } from "../../../utils/aliancaGavetaLogica"
    import { gavetaNaoToca, podeMarcar } from "../../../utils/aliancaGavetaToque"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { AudioPlaylist } from "../../../audio/audioPlaylist"
    import { addProjectItem } from "../../../converters/project"
    import { activePlaylist, activeShow, media, outLocked, playingAudio } from "../../../stores"
    import { tela } from "../../../utils/aliancaTela"
    import { motivoSemCulto } from "../../../utils/aliancaGaveta"
    import { newToast } from "../../../utils/common"
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

    // leiaute v2 (so em Mostrar, fora de playlist): "＋" poe o audio no fim do roteiro; "▶" poe E toca (o mesmo `AudioPlayer.start` do clique)
    let ultimoMais = 0
    function noRoteiro(): boolean {
        const agora = Date.now()
        if (agora - ultimoMais < 500) return false
        ultimoMais = agora
        const motivo = motivoSemCulto()
        if (motivo) {
            newToast(`Não entrou no roteiro: ${motivo}`)
            return false
        }
        addProjectItem({ id: path, name, type: "audio" })
        newToast(`"${name.slice(0, name.lastIndexOf("."))}" entrou no fim do roteiro`)
        return true
    }
    function tocarAgora() {
        if ($outLocked) return newToast("a saída está travada: destrave para tocar")
        noRoteiro()
        AudioPlayer.start(path, { name }, { playMultiple: false })
    }
</script>

<div class="linhaAudio">
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
                if (!podeMarcar()) return
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
                if (!podeMarcar()) return
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
{#if !playlist && $tela === "mostrar"}
    <button type="button" class="aux" data-acao="audio-mais" aria-label="Adicionar ao roteiro" title="Adicionar ao fim do roteiro" tabindex="-1" on:mousedown|preventDefault on:click|stopPropagation={noRoteiro}>＋</button>
    <button type="button" class="aux" data-acao="audio-tocar" aria-label="Adicionar ao roteiro e tocar" title="Adicionar ao roteiro e tocar" tabindex="-1" on:mousedown|preventDefault on:click|stopPropagation={tocarAgora}>▶</button>
{/if}
</div>

<style>
    .linhaAudio {
        display: flex;
        align-items: stretch;
        gap: 4px;
    }
    .linhaAudio > :global(:first-child) {
        flex: 1 1 auto;
        min-width: 0;
    }
    .aux {
        flex: none;
        width: 32px;
        border: 1px solid var(--luz-borda, rgb(248 248 240 / 0.13));
        border-radius: 6px;
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
        color: var(--luz-texto, #f8f8f0);
        cursor: pointer;
    }
    .aux:hover {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
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
