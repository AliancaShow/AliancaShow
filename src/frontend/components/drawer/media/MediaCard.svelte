<script lang="ts">
    import { derived, get } from "svelte/store"
    import type { ContentFile, ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import type { MediaStyle } from "../../../../types/Main"
    import type { ShowType } from "../../../../types/Show"
    import { addProjectItem } from "../../../converters/project"
    import { activeShow, customMessageCredits, media, mediaOptions, mediaTags, outLocked, outputs, photoApiCredits, styles } from "../../../stores"
    import { tela } from "../../../utils/aliancaTela"
    import { chavesMarcadas, cliqueDeMarcar, duploCliqueDeMarcar, marcadoDeArquivo } from "../../../utils/aliancaGaveta"
    import { autorizarAr, gavetaNaoToca, podeMarcar } from "../../../utils/aliancaGavetaToque"
    import { chaveDe } from "../../../utils/aliancaGavetaLogica"
    import { camadaNaHora, ehAbaDePasta, pastaDaMidia, resolverFim, tagsSemPasta } from "../../../utils/aliancaPastasMidiaLogica"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaLayerType, getMediaStyle, getMediaType, loadThumbnail } from "../../helpers/media"
    import { findMatchingOut, getAllActiveOutputs, getFirstActiveOutput, setOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import { motivoSemCulto } from "../../../utils/aliancaGaveta"
    import { newToast } from "../../../utils/common"
    import MediaLoader from "./MediaLoader.svelte"

    export let name: string
    export let path: string
    export let credits: any = {}
    export let type: ShowType
    export let active: string | null
    export let shiftRange: any[] = []
    export let thumbnailPath = ""
    export let thumbnail = true
    export let loadFullImage = false
    export let contentProvider: ContentProviderId | false = false
    export let contentFileData: ContentFile | null = null

    let failed = false
    $: if (thumbnail && !thumbnailPath && !loadFullImage) getThumbnail()
    async function getThumbnail() {
        failed = false
        thumbnailPath = await loadThumbnail(path)
        if (!thumbnailPath) failed = true
    }

    // Store ContentFile object and display name for later use (license check, convert to show, etc.)
    $: if (contentFileData && contentProvider && path) {
        media.update((m) => {
            if (!m[path]) m[path] = {}
            m[path].contentFile = { ...contentFileData, providerId: contentProvider }
            m[path].name = name
            return m
        })
    }

    // Memoized name computation
    let displayName = ""
    $: {
        const dotIndex = name.lastIndexOf(".")
        const newName = dotIndex > 0 ? name.slice(0, dotIndex) : name
        if (displayName !== newName) {
            displayName = newName
        }
    }

    let loaded = true
    let videoElem: HTMLVideoElement | undefined
    let hover = false
    let duration = 0

    const steps = 10
    function move(e: any) {
        if (!loaded || !videoElem) {
            // if (hover) clearTimeout(enterTimeout)
            hover = false
            return
        }

        let percentage: number = e.offsetX / e.target.offsetWidth

        let time = Math.floor(duration * ((Math.floor(percentage * steps) * steps + steps) / 100))
        if (time && videoElem.currentTime === time) return
        if (!isFinite(time)) return

        if (Number(time) === time) videoElem.currentTime = time
    }

    function mousedown(e: any) {
        if (e.ctrlKey || e.metaKey) return

        if (credits) {
            photoApiCredits.set(credits)
        }
    }

    // let enterTimeout = null
    function mouseenter(e: any) {
        const mediaGrid = document.querySelector(".grid")?.querySelector(".grid")
        if (!mediaGrid) return

        // don't load if clicked (probably selecting)
        // WIP return if scrolling & don't load if quickly dragging the mouse across..
        if (e.buttons > 0) return
        hover = true

        // don't load all the videos if scrolling, or selecting
        // const scrollTop = mediaGrid.scrollTop
        // if (enterTimeout) clearTimeout(enterTimeout)
        // enterTimeout = setTimeout(() => {
        //     enterTimeout = null
        //     // return if scrolling or selected
        //     if (scrollTop !== mediaGrid.scrollTop || $selected.data.find((a) => a.path === path)) return
        //     hover = true
        // }, 200)
    }

    // AliançaShow (Preparar F6): na gaveta do Preparar o clique MARCA o item para levar ao culto; nunca vai para o ar
    $: marcadoDaGaveta = marcadoDeArquivo({ path, name, type, contentProvider })
    $: marcavel = $tela !== "mostrar" && !!marcadoDaGaveta
    $: estaMarcado = !!marcadoDaGaveta && $chavesMarcadas.has(chaveDe(marcadoDaGaveta))

    let wait = false
    function click(e: any) {
        if (gavetaNaoToca()) {
            if (e.ctrlKey || e.metaKey || e.shiftKey || iconClicked) return
            // fatia 6: em Mostrar o clique so seleciona (a previa); marcar para levar ao culto e coisa de Editar
            if (!podeMarcar()) return
            const m = marcadoDeArquivo({ path, name, type, contentProvider })
            if (m) cliqueDeMarcar(m)
            return
        }
        if (e.ctrlKey || e.metaKey || e.shiftKey || $outLocked || wait || iconClicked) return

        // don't hide again when double clicking
        wait = true
        setTimeout(() => {
            wait = false
        }, 800)

        const activeOutputs = getAllActiveOutputs()

        const isActive = activeOutputs.some((a) => (a.out?.background?.path || a.out?.background?.id) === path)
        if (isActive) {
            clearBackground()
            return
        }

        let videoType = getMediaLayerType(path, mediaStyle)
        let loop = contentProvider || videoType === "foreground" ? false : true
        let muted = videoType === "background" ? true : false
        if (videoType === "foreground") clearSlide()

        // get style per output
        activeOutputs.forEach((output) => {
            const currentOutputStyle = $styles[output.style || ""]
            const currentMediaStyle = getMediaStyle($media[path], currentOutputStyle)
            setOutput("background", { path, type, loop, muted, startAt: 0, ...currentMediaStyle, ignoreLayer: videoType === "foreground" }, false, output.id)
        })

        customMessageCredits.set("")
    }

    // leiaute v2: o "＋" do cartao poe a midia no fim do roteiro (o mesmo `addProjectItem` do duplo clique); 500 ms contra toque duplo
    let ultimoMais = 0
    function maisNoRoteiro(e: MouseEvent) {
        e.stopPropagation()
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        const agora = Date.now()
        if (agora - ultimoMais < 500) return
        ultimoMais = agora
        const motivo = motivoSemCulto()
        if (motivo) return newToast(motivo)
        addProjectItem({ id: path, name, type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)) })
        newToast(`"${displayName || name}" entrou no fim do roteiro`)
    }

    // leiaute v2: o ▶ do cartao poe a midia no fim do roteiro E a manda ao ar, pelo mesmo `click` do cartao (alterna: se ja esta no ar, limpa)
    function tocarMidia(e: MouseEvent) {
        if ($outLocked) {
            e.stopPropagation()
            return newToast("a saída está travada: destrave para mandar ao ar")
        }
        maisNoRoteiro(e)
        // o ▶ e um gesto deliberado: levanta a guarda da biblioteca so para este clique
        autorizarAr(() => click({}))
    }

    function dblclick(e: any) {
        if (e.ctrlKey || e.metaKey || iconClicked) return

        if (gavetaNaoToca()) {
            if (!podeMarcar()) return
            const m = marcadoDeArquivo({ path, name, type, contentProvider })
            if (m) duploCliqueDeMarcar(m)
            return
        }

        // add to project
        const data = { id: path, name, type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)) }
        addProjectItem(data)
    }

    // Memoized output and style computation
    const currentOutput = derived(outputs, ($outputs) => getFirstActiveOutput($outputs))
    const currentStyle = derived([currentOutput, styles], ([$currentOutput, $styles]) => $styles[$currentOutput?.style || ""] || {})

    // Memoized media style computation
    let mediaStyle: MediaStyle = {}
    $: if (path && JSON.stringify($media[path]) !== JSON.stringify(mediaStyle)) {
        mediaStyle = getMediaStyle($media[path], $currentStyle)
    }

    // fixed resolution
    let resolution = { width: 16, height: 9 }
    // $: resolution = getResolution(null, { $outputs, $styles })

    // Memoized computed properties
    let isFavourite = false
    let icon = "image"
    let tags: string[] = []

    $: {
        const mediaData = $media[path]
        isFavourite = mediaData?.favourite === true
        icon = type === "video" ? "movie" : "image"
        // AliancaShow F7: o selo de etiquetas nao mostra a pasta (ela tem o proprio chip)
        tags = tagsSemPasta(mediaData?.tags, $mediaTags)
    }

    // chips da pasta (so nas vistas "pasta:*"): o que o video faz ao terminar e em qual camada; borda = ajuste proprio da midia
    $: pastaId = pastaDaMidia($media[path]?.tags, $mediaTags)
    $: mostraChips = !!pastaId && ehAbaDePasta(active) && type === "video"
    $: fimEf = resolverFim({ midia: $media[path], mediaTags: $mediaTags })
    $: camadaEf = camadaNaHora($media[path], $mediaTags)

    let iconClicked: NodeJS.Timeout | null = null
    function removeStyle(key: string) {
        iconClicked = setTimeout(() => (iconClicked = null), 50)

        media.update((a) => {
            if (!a[path]) return a

            if (key === "filters") {
                delete a[path].fit
                delete a[path].flipped
                delete a[path].flippedY
                delete a[path].blend
                delete a[path].filter
                delete a[path].cropping
            } else if (key === "tags") {
                // a pasta (F7) nao e uma etiqueta comum: "remover etiquetas" a preserva
                const pasta = pastaDaMidia(a[path].tags, get(mediaTags))
                a[path].tags = pasta ? [pasta] : []
            } else {
                delete a[path][key]
            }

            return a
        })
    }
</script>

<SelectElem id="media" class="context #media_card" data={{ name, path, type, contentProvider }} {shiftRange} draggable fill>
    <Card
        resolution={{ width: 16, height: 9 }}
        loaded={(loaded && ($mediaOptions.mode === "grid" ? thumbnailPath !== "" || loadFullImage : true)) || failed}
        style={thumbnail ? `width: ${$mediaOptions.mode === "grid" ? 100 : 100 / $mediaOptions.columns}%;` : ""}
        mode={$mediaOptions.mode}
        width={100}
        preview={$activeShow?.id === path}
        outlineColor={findMatchingOut(path, $outputs)}
        active={findMatchingOut(path, $outputs) !== null}
        label={displayName}
        semRotulo={$mediaOptions.mode === "grid" && thumbnail}
        title={contentProvider ? "" : path}
        icon={thumbnail ? icon : null}
        white={type === "image"}
        showPlayOnHover={false}
        {marcavel}
        marcado={estaMarcado}
        checkered={$mediaOptions.mode === "grid" && mediaStyle.fit !== "blur" && !failed}
        on:mousedown={mousedown}
        on:click={click}
        on:dblclick={dblclick}
        on:mouseenter={mouseenter}
        on:mouseleave={() => (hover = false)}
        on:mousemove={move}
    >
        <!-- icons -->
        <div class="icons">
            {#if isFavourite && active !== "favourites"}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("favourite")}>
                            <Icon id="star" size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if mediaStyle.videoType}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("videoType")}>
                            <Icon id={`type_${mediaStyle.videoType}`} size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if !!mediaStyle.filter?.length || $media[path]?.fit || mediaStyle.flipped || mediaStyle.flippedY || (mediaStyle.blend && mediaStyle.blend !== "normal") || Object.keys(mediaStyle.cropping || {}).length}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("filters")}>
                            <Icon id="filter" size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if tags.length}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("tags")}>
                            <Icon id="tag" size={0.9} white />
                        </Button>
                    </div>
                    <span style="max-width: 100%;">
                        <p>{tags.length === 1 ? $mediaTags[tags[0]]?.name || "—" : tags.length}</p>
                    </span>
                </div>
            {/if}
        </div>

        {#if mostraChips}
            <div class="chips">
                <span class:proprio={fimEf.origem === "proprio"} data-title={fimEf.origem === "proprio" ? "Ajuste próprio desta mídia" : "Segue a pasta"}>{fimEf.loop === false ? "para" : "repete"}</span>
                <span class:proprio={!!$media[path]?.videoType} data-title={$media[path]?.videoType ? "Ajuste próprio desta mídia" : "Segue a pasta"}>{camadaEf === "foreground" ? "frente" : "fundo"}</span>
            </div>
        {/if}

        {#if failed}
            <div class="icon">
                <Icon size={2.5} id="close" style="color: var(--disconnected);" white />
            </div>
        {:else if thumbnail}
            {#if thumbnailPath || loadFullImage}
                <MediaLoader bind:loaded bind:hover bind:duration bind:videoElem {resolution} {type} {path} {thumbnailPath} {name} {mediaStyle} {loadFullImage} />
            {/if}
        {:else}
            <div class="icon">
                <Icon size={2.5} id={icon} white={type === "image"} />
            </div>
        {/if}
    </Card>
</SelectElem>
{#if $mediaOptions.mode === "grid" && thumbnail}
    <div class="rodape" data-acao="midia-rodape">
        <span class="rn" data-title={path}>{displayName}</span>
        <button type="button" class="rmais" aria-label="Adicionar ao roteiro" title="Adicionar ao fim do roteiro" tabindex="-1" on:mousedown|preventDefault on:click={maisNoRoteiro}>＋</button>
        {#if $tela === "mostrar"}
            <button type="button" class="rmais" data-acao="midia-tocar" aria-label="Adicionar ao roteiro e mandar ao ar" title="Adicionar ao roteiro e mandar ao ar" tabindex="-1" on:mousedown|preventDefault on:click={tocarMidia}>▶</button>
        {/if}
    </div>
{/if}

<style>
    .rodape {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 2px 4px;
    }
    .rn {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
    }
    .rmais {
        flex: none;
        width: 28px;
        height: 28px;
        border: 1px solid var(--luz-borda, rgb(248 248 240 / 0.13));
        border-radius: 6px;
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
        color: var(--luz-texto, #f8f8f0);
        cursor: pointer;
    }
    .rmais:hover {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .icon {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        /* overflow: hidden; */
        height: 100%;
    }
    .icon :global(svg) {
        height: 100%;
    }

    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        left: 0;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;

        max-width: calc(100% - 21px);
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }
    .chips {
        pointer-events: none;
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 1;
        display: flex;
        gap: 2px;
        padding: 2px;
    }
    .chips span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        color: var(--text);
        padding: 1px 5px;
        font-size: 0.7em;
        font-weight: bold;
        border-radius: 3px;
        outline: 1px solid transparent;
    }
    .chips span.proprio {
        outline-color: var(--secondary);
    }

    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
