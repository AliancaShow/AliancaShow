<script lang="ts">
    import { onMount } from "svelte"
    import { activeEdit, activeShow, cachedShowsData, editColumns, outputs, showsCache } from "../../stores"
    import { selosDoShow } from "../../utils/aliancaEditarLogica"
    import T from "../helpers/T.svelte"
    import { saidasDoEnvio } from "../../utils/aliancaEditarSaidas"
    import { getShowCacheId } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import SkeletonSlide from "../slide/SkeletonSlide.svelte"
    import Slide from "../slide/Slide.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"

    $: showId = $activeShow?.id || $activeEdit.showId || ""
    $: currentShow = $showsCache[showId]
    $: layoutSlides = $cachedShowsData[getShowCacheId(showId, currentShow)]?.layout || []

    // Leiaute v2 (fatia 3): selos NO AR / EDITADO por posicao do layout (a conta esta em aliancaEditarLogica.ts; a foto e o que o telao mostra)
    $: activeLayout = currentShow?.settings?.activeLayout || ""
    let selos: ReturnType<typeof selosDoShow> = {}
    $: selos = calcularSelos(currentShow, $outputs, activeLayout, showId)
    function calcularSelos(..._deps: any[]) {
        if (!showId || !currentShow || !activeLayout) return {}
        const saidas = saidasDoEnvio(Object.entries($outputs || {}).map(([id, o]) => ({ ...(o as any), id }))).map((id) => $outputs[id]?.out?.slide)
        const ref = _show(showId).layouts([activeLayout]).ref()[0] || []
        return selosDoShow({ showId, layout: activeLayout, ref, slides: currentShow.slides, noAr: saidas as any })
    }

    let hasMounted = false
    onMount(() => {
        // don't double render all slides on first load because of cachedShowsData update
        setTimeout(() => (hasMounted = true), 80)
    })

    function keydown(e: KeyboardEvent) {
        if (e.altKey) {
            e.preventDefault()
            altKeyPressed = true
        }

        if (e.target instanceof HTMLTextAreaElement || e.target?.closest?.(".edit")) return
        if ($activeEdit.items.length) return

        if (e.key === "ArrowDown") {
            // Arrow Down
            e.preventDefault()
            ;(document.activeElement as any)?.blur()

            if ($activeEdit.slide === null || $activeEdit.slide === undefined) {
                activeEdit.set({ slide: 0, items: [], showId })
            } else if ($activeEdit.slide < layoutSlides.length - 1) {
                activeEdit.set({ slide: $activeEdit.slide + 1, items: [], showId })
            }
        } else if (e.key === "ArrowUp") {
            // Arrow Up
            e.preventDefault()
            ;(document.activeElement as any)?.blur()

            if ($activeEdit.slide === null || $activeEdit.slide === undefined) {
                activeEdit.set({ slide: layoutSlides.length - 1, items: [], showId })
            } else if ($activeEdit.slide > 0) {
                activeEdit.set({ slide: $activeEdit.slide - 1, items: [], showId })
            }
        }
    }

    let skipScrolling = false
    let scrollElem: HTMLElement | undefined
    let offset = -1
    $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined) updateScroll()
    function updateScroll() {
        if (skipScrolling) return

        let index = $activeEdit.slide! - 1
        setTimeout(() => {
            if (index >= 0 && scrollElem) offset = ((scrollElem.querySelector(".grid")?.children?.[index] as HTMLElement)?.offsetTop || 5) - 5
        }, 10)
    }

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        e.preventDefault()
        editColumns.set(Math.max(1, Math.min(4, $editColumns + (e.deltaY < 0 ? -1 : 1))))

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    let altKeyPressed = false
    function keyup() {
        altKeyPressed = false
    }

    function slideClick(e: any, index: number) {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            activeEdit.set({ slide: index, items: [], showId })
            skipScrolling = true
            setTimeout(() => (skipScrolling = false), 10)
        }
    }

    // lazy loader

    let lazyLoader = 1
    let timeout: NodeJS.Timeout | null = null
    let loaded = false

    // reset loading when changing view modes
    $: if (showId) loaded = false

    $: if (!loaded && !lazyLoading && layoutSlides?.length) {
        lazyLoading = true
        lazyLoader = 1
        startLazyLoader()
    }

    let lazyLoading = false
    function startLazyLoader() {
        if (!layoutSlides) return
        if (lazyLoader >= layoutSlides.length) {
            loaded = true
            lazyLoading = false
            return
        }
        if (timeout) clearTimeout(timeout)

        timeout = setTimeout(() => {
            lazyLoader++
            startLazyLoader()
        }, 10)
    }
</script>

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={keyup} />

<Autoscroll {offset} bind:scrollElem style="display: flex;background-color: var(--primary-darker);">
    <DropArea id="all_slides" selectChildren>
        <DropArea id="slides" hoverTimeout={0} selectChildren>
            {#if layoutSlides.length}
                <div class="grid" on:wheel={wheel}>
                    {#each layoutSlides as slide, i}
                        {@const currentSlide = currentShow?.slides?.[slide.id]}
                        {#if hasMounted && (loaded || i < lazyLoader)}
                            {#if currentSlide}
                                <Slide {showId} slide={currentSlide} show={currentShow} layoutSlide={slide} {layoutSlides} index={i} color={slide.color} active={!!selos[i]} noAr={!!selos[i]} editado={!!selos[i]?.editado} focused={$activeEdit.slide === i} noQuickEdit {altKeyPressed} columns={$editColumns} on:click={(e) => slideClick(e, i)} />
                            {/if}
                        {:else}
                            <SkeletonSlide slide={currentSlide} index={i} color={slide.color} columns={$editColumns} active={$activeEdit.slide === i} on:click={(e) => slideClick(e, i)} />
                        {/if}
                    {/each}

                    <div class="padding" style="height: 60px;width: 1px;"></div>
                </div>
            {:else}
                <Center faded>
                    <T id="empty.slides" />
                </Center>
            {/if}
        </DropArea>
    </DropArea>
</Autoscroll>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        padding: 5px;
        width: 100%;
        height: 100%;
        align-content: flex-start;
    }
</style>
