<script lang="ts">
    import { onDestroy } from "svelte"
    import { soRetornoLigado } from "../../utils/aliancaSoRetorno"
    import type { Unsubscriber } from "svelte/store"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import type { MediaStyle } from "../../../types/Main"
    import { requestMain, sendMain } from "../../IPC/main"
    import { activeProject, activeRename, focusMode, media, mediaTags, outLocked, outputs, playingVideos, projects, videoMarkers } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { resolverFim } from "../../utils/aliancaPastasMidiaLogica"
    import { getExtension, getFileName, getMediaLayerType, removeExtension } from "../helpers/media"
    import { getFirstActiveOutput, setOutput } from "../helpers/output"
    import { joinTime, secondsToTime } from "../helpers/time"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import HoverButton from "../inputs/HoverButton.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MediaPicker from "../inputs/MediaPicker.svelte"
    import { videoSync } from "../media/video/videoSync"
    import VideoSlider from "../output/VideoSlider.svelte"
    import { clearSlide } from "../output/clear"
    import MediaControls from "../output/tools/MediaControls.svelte"
    import Player from "../system/Player.svelte"
    import AliancaCentroVideo from "../main/AliancaCentroVideo.svelte"
    import { formatVTT, SRTtoVTT } from "./media/subtitles"

    export let mediaPath: string
    export let show

    $: showId = show?.id
    $: type = show?.type

    // NOTE: subtitles uses local mediaPath - time markers uses synced showId path

    // show updates when videoTime updates for some reason?
    // $: console.trace(show)
    // $: console.trace(videoTime)

    $: subtitleData = $media[mediaPath] || {}
    $: tracks = subtitleData.tracks || []
    $: subtitle = subtitleData.subtitle || ""
    $: if (type !== "player" && mediaPath && subtitleData.tracks === undefined) sendMain(Main.MEDIA_TRACKS, { path: mediaPath })

    export let mediaStyle: MediaStyle = {}

    let unsubscriber: Unsubscriber | null = null
    $: setTimeout(() => pathChanged(mediaPath, outputId))
    function pathChanged(path: string | undefined, outputId: string) {
        if (unsubscriber) {
            unsubscriber()
            unsubscriber = null
        }

        if (!path || type !== "video") return

        videoData = { paused: true, muted: true, duration: 0, loop: false, softLoop: 0 }

        // cabine 18/nov (A7): o centro NUNCA toca video: e um quadro parado. Quem toca e a saida. A previa nao segue o relogio dela (antes seguia e,
        // com o video parado no ar, o do centro continuava rodando): so duracao, repeticao e soft loop vem do estado da saida, para os controles.
        unsubscriber = videoSync(path, outputId, (data) => {
            if (data.duration) videoData.duration = data.duration
            videoData.loop = playingInOutput ? data.loop : false
            if (data.softLoop !== undefined) videoData.softLoop = data.softLoop
            // videoData.muted = data.muted
        })
    }
    onDestroy(() => {
        if (unsubscriber) unsubscriber()
    })

    let videoTime = 0
    let duracaoDoCartao = 0
    let videoData = { paused: true, muted: true, duration: 0, loop: false, softLoop: 0 }
    // (A7) o video do centro nasce parado e nunca sai do pause: nem pelo elemento, nem pela saida, nem por um estado velho
    $: if (!videoData) videoData = { paused: true, muted: true, duration: 0, loop: false, softLoop: 0 }
    $: if (type !== "player" && videoData && !videoData.paused) videoData.paused = true

    $: if (type !== "player" && duracaoDoCartao && !videoData.duration) videoData.duration = duracaoDoCartao

    let prevId: string | undefined = undefined
    $: if (mediaPath !== prevId) {
        videoTime = 0
        prevId = mediaPath

        timeMarkersEnabled = !!$videoMarkers[mediaPath]?.length || false
        if (timeMarkersEnabled && manageSubtitles) manageSubtitles = false
    }

    // background output
    $: outputId = $playingVideos.find((a) => a.path === mediaPath)?.linkedOutputIds?.[0] || getFirstActiveOutput()?.id || ""
    $: currentOutput = outputId ? $outputs[outputId] || null : null

    // outBackground.subscribe(backgroundChanged)
    $: background = currentOutput?.out?.background || {}
    $: if (background || mediaPath) backgroundChanged()
    let playingInOutput = false
    function backgroundChanged() {
        // background = currentOutput?.out?.background || {}
        // || videoData.paused
        if (background === null || (background.path || background.id) !== mediaPath) {
            playingInOutput = false
            return
        }
        // if (background.type !== "media" && background.type !== "video") return

        // videoData.paused = true
        playingInOutput = true
    }

    // WIP player video output time

    let manageSubtitles = false
    let timeMarkersEnabled = false

    // player
    $: if (type === "player") playerLoad()
    function playerLoad() {
        if (!$focusMode) return

        // timeout for loading, because if the video is not loaded in time it will start playing, but that's fine
        setTimeout(() => {
            videoData.paused = true
            videoTime = videoData.duration ? videoData.duration / 2 : 0
        }, 2000)
    }

    let shouldLoop = false
    let shouldBeMuted = false
    $: videoType = getMediaLayerType(mediaPath, mediaStyle)
    $: projectItem = $projects[$activeProject || ""]?.shows?.[show?.index]
    $: if (mediaPath) {
        // AliancaShow F7: sem escolha do item, o botao de repetir mostra o que a pasta (ou o ajuste proprio) vai fazer
        const daPasta = resolverFim({ midia: $media[mediaPath], mediaTags: $mediaTags })
        shouldLoop = typeof projectItem?.loop === "boolean" ? projectItem.loop : daPasta.origem === "pasta" || daPasta.origem === "proprio" ? !!daPasta.loop : videoType === "background" ? true : false
        shouldBeMuted = typeof projectItem?.muted === "boolean" ? projectItem.muted : videoType === "background" ? true : false
    }
    function playVideo(startAt = 0) {
        if ($outLocked) return

        let loop = shouldLoop
        let muted = shouldBeMuted
        if (!soRetornoLigado() && (videoType === "foreground" || (videoType !== "background" && !shouldLoop))) clearSlide()
        let bg: any = { type, startAt, muted, loop, ...mediaStyle, ignoreLayer: videoType === "foreground" }
        // AliancaShow F7: so o "repetir" que o item do culto ESCOLHEU vence a pasta
        if (typeof projectItem?.loop === "boolean") bg.loopDoItem = projectItem.loop

        if (type === "player") bg.id = mediaPath
        else {
            bg.path = mediaPath
            // if (filter) data.filter = filter
        }

        // autoPause = true
        // videoData.paused = true

        // TODO: playing in multiple outputs will create unclearable "ghost" video

        setOutput("background", bg)
    }

    function toggleLoop() {
        shouldLoop = !shouldLoop
        saveToProject("loop", shouldLoop)
    }
    function toggleMute() {
        shouldBeMuted = !shouldBeMuted
        saveToProject("muted", shouldBeMuted)
    }

    // save in project item if any active
    function saveToProject(key: string, value: any) {
        if (!projectItem || projectItem.id !== showId) return

        projects.update((a) => {
            a[$activeProject || ""].shows[show.index][key] = value
            return a
        })
    }

    let edit = false

    // SUBTITLE

    function changeSubtitleName(e: any) {
        let subtitleIndex = e.detail?.id?.slice("subtitle_".length)
        let value = e.detail.value
        if (subtitleIndex === undefined || !value) return

        media.update((a) => {
            if (!a[mediaPath]?.tracks?.[subtitleIndex]) return a
            a[mediaPath].tracks![subtitleIndex].name = value
            if (a[mediaPath].tracks![subtitleIndex].lang.length !== 2) a[mediaPath].tracks![subtitleIndex].lang = value.replaceAll(" ", "_").toLowerCase()

            return a
        })
    }

    async function subtitlePicked(e: any) {
        let path = e.detail || ""
        let content = (await requestMain(Main.READ_FILE, { path }))?.content
        if (!content) return

        let extension = getExtension(path)
        if (extension === "srt") {
            content = SRTtoVTT(content)
        }

        content = formatVTT(content)

        media.update((a) => {
            if (!a[mediaPath]) a[mediaPath] = {}
            if (!a[mediaPath].tracks) a[mediaPath].tracks = []

            let name = removeExtension(getFileName(path)).replaceAll(" ", "_")
            let id = name || uid(5)
            a[mediaPath].tracks!.push({ lang: id, name, vtt: content })

            activeRename.set("subtitle_" + (a[mediaPath].tracks!.length - 1))

            return a
        })
    }

    function setActiveSubtitle(e: any, lang: string) {
        if (e.target?.closest?.(".edit")) return

        media.update((a) => {
            if (!a[mediaPath]) a[mediaPath] = {}
            if (a[mediaPath].subtitle === lang) {
                a[mediaPath].subtitle = ""
                lang = ""
            } else a[mediaPath].subtitle = lang

            return a
        })
    }

    // MARKER

    // TODO: history
    function addMarker() {
        videoMarkers.update((a) => {
            const newMarker = { name: "", time: Math.floor(videoTime || 0) }

            if (a[showId]?.find((a) => a.time === newMarker.time)) return a

            if (!a[showId]) a[showId] = []
            a[showId].push(newMarker)

            // sort by time
            a[showId] = a[showId].sort((a, b) => a.time - b.time)

            let markerIndex = a[showId].findIndex((a) => a.time === newMarker.time)
            activeRename.set("marker_" + markerIndex)

            return a
        })
    }

    function changeName(e: any) {
        let currentMarker = e.detail?.id?.slice("marker_".length)
        if (currentMarker === undefined) return

        videoMarkers.update((a) => {
            a[showId][currentMarker].name = e.detail.value

            return a
        })
        // history({ id: "UPDATE", newData: { key: "layouts", keys: [currentLayout], subkey: "name", data: e.detail.value }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    }

    let pausedByEdit = false
    $: if (edit) {
        if (!videoData.paused) {
            videoData.paused = true
            pausedByEdit = true
        }
    } else if (pausedByEdit) {
        videoData.paused = false
        pausedByEdit = false
    }
</script>

{#key mediaPath || showId}
    <div id={mediaPath || showId} class="media context #media_preview" style="flex: 1;overflow: hidden;">
        {#if type === "player"}
            <!-- TODO: info about: CTRL click to play at current pos -->
            <HoverButton hide={playingInOutput} icon="play" size={10} on:click={(e) => playVideo(e.ctrlKey || e.metaKey ? videoTime : 0)}>
                <Player id={showId} {outputId} preview />
            </HoverButton>
        {:else if mediaPath}
            <!-- cabine 6 (D26): o centro mostra um CARTAO (miniatura, nome, duracao, tocar/pausar/parar), nunca abre o arquivo de video -->
            <div class="cartao-centro">
                <AliancaCentroVideo {mediaPath} nome={show?.name || removeExtension(getFileName(mediaPath))} bind:duracao={duracaoDoCartao} on:tocar={(e) => playVideo(e.detail.noPonto ? videoTime : 0)} />
            </div>
        {/if}
    </div>
{/key}

{#if !$focusMode}
    {#if !playingInOutput && !manageSubtitles && !timeMarkersEnabled}
        <FloatingInputs side="left">
            <MaterialButton title={"media._loop" + (shouldLoop ? ": settings.enabled" : "")} on:click={toggleLoop}>
                <Icon id="loop" size={1.2} white={!shouldLoop} />
            </MaterialButton>

            <!-- <div class="divider" /> -->

            <MaterialButton title={!shouldBeMuted ? "actions.mute" : "actions.unmute"} disabled={$outLocked} on:click={toggleMute}>
                <Icon id={!shouldBeMuted ? "volume" : "muted"} size={1.2} white={shouldBeMuted} />
            </MaterialButton>
        </FloatingInputs>
    {/if}

    {#if playingInOutput ? tracks.length : manageSubtitles}
        <FloatingInputs side="left" style={playingInOutput ? `margin-bottom: ${$videoMarkers[showId]?.length ? 100 : 50}px;` : "max-width: 50%;"}>
            {#if tracks.length}
                <div class="scroll">
                    {#each tracks as track, i}
                        <MaterialButton id={i.toString()} style="font-weight: normal;" isActive={subtitle === track.lang} class="context #video_subtitle{track.embedded ? '_embedded' : ''}" on:click={(e) => setActiveSubtitle(e, track.lang)}>
                            {#if playingInOutput}
                                <p style="padding: 5px;">{track.name}</p>
                            {:else}
                                <HiddenInput value={track.name} id={"subtitle_" + i} on:edit={changeSubtitleName} bind:edit />
                            {/if}
                        </MaterialButton>
                    {/each}
                </div>
            {/if}

            {#if !playingInOutput}
                <div class="divider" />

                <MediaPicker id="subtitles" title={translateText("scripture.local")} filter={{ name: "Video Text Track", extensions: ["vtt", "srt"] }} on:picked={subtitlePicked} dark={false}>
                    <Icon id="add" right={!tracks.length} />
                    {#if !tracks.length}<T id="scripture.local" />{/if}
                    <!-- <Icon id="captions" right={!tracks.length} />
                    {#if !tracks.length}<T id="actions.manage_subtitles" />{/if} -->
                </MediaPicker>
                <!-- <MaterialFilePicker label="scripture.local" style="flex: 1;" icon="add" value="" filter={{ name: "Video Text Track", extensions: ["vtt", "srt"] }} on:change={subtitlePicked} /> -->
            {/if}
        </FloatingInputs>
    {/if}

    {#if playingInOutput ? $videoMarkers[showId]?.length : timeMarkersEnabled}
        <FloatingInputs side="left" style={playingInOutput || manageSubtitles ? "margin-bottom: 50px;" : "max-width: 50%;"}>
            {#if $videoMarkers[showId]?.length}
                <div class="scroll">
                    {#each $videoMarkers[showId] as marker, i}
                        <MaterialButton
                            id={i}
                            style="font-weight: normal;"
                            class="context #video_marker"
                            on:click={() => {
                                if (!edit) {
                                    playVideo(marker.time || 0)
                                }
                            }}
                        >
                            <p style="display: flex;align-items: center;">
                                <HiddenInput value={marker.name} id={"marker_" + i} on:edit={changeName} bind:edit />
                                <span style="opacity: 0.7;">{joinTime(secondsToTime(marker.time))}</span>
                            </p>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}

            {#if !playingInOutput}
                <div class="diviver" />

                <MaterialButton icon="add" title="actions.add_time_marker" on:click={addMarker}>
                    {#if !$videoMarkers[showId]?.length}<T id="actions.add_time_marker" />{/if}
                </MaterialButton>
            {/if}
        </FloatingInputs>
    {/if}

    {#if type === "player" && playingInOutput}
        <!-- controles de transporte do player online: o operador aperta varias vezes de proposito (fora da trava de clique repetido) -->
        <div data-sem-trava style="display: contents;">
            <MediaControls {currentOutput} {outputId} big />
        </div>
    {:else if !playingInOutput}
        <FloatingInputs arrow={type === "video"} let:open>
            <div slot="menu" data-sem-trava style="display: flex;min-width: 500px;">
                <!-- (A7) sem tocar/pausar/mudo da previa: o centro e um quadro parado; a barra so escolhe o quadro (e o ponto de partida do Ctrl+clique) -->
                <VideoSlider {outputId} path={mediaPath} bind:videoData bind:videoTime />

                <div class="divider"></div>
            </div>

            <MaterialButton
                isActive={manageSubtitles}
                title="actions.manage_subtitles"
                on:click={() => {
                    manageSubtitles = !manageSubtitles
                    if (timeMarkersEnabled) timeMarkersEnabled = false
                }}
            >
                <Icon id="captions" white={!tracks.length} size={1.2} />
            </MaterialButton>

            {#if open}
                <div class="divider"></div>
            {/if}

            <MaterialButton
                isActive={timeMarkersEnabled}
                title="actions.toggle_time_marker"
                on:click={() => {
                    timeMarkersEnabled = !timeMarkersEnabled
                    if (manageSubtitles) manageSubtitles = false
                }}
            >
                <Icon id="timeMarker" white={!$videoMarkers[showId]?.length} size={1.2} />
            </MaterialButton>
        </FloatingInputs>
    {/if}
{/if}

<style>
    .cartao-centro {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 16px;
        display: flex;
        overflow: auto;
    }
    .scroll {
        display: flex;
        overflow-x: auto;
    }
    .scroll :global(button) {
        overflow: initial;
    }
</style>
