<script lang="ts">
    import type { Item, ItemType, Line, Slide } from "../../../types/Show"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activeShow, copyPasteEdit, overlays, selected, showsCache, storedEditMenuState, templates } from "../../stores"
    import { alvoDoRodape } from "../../utils/aliancaEditorLogica"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getLayoutRef, isSlideLocked } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Center from "../system/Center.svelte"
    import { comDesfazerAgrupado } from "../../utils/aliancaDesfazerAgrupado"
    import { getBoxStyle, getItemStyle, getSlideStyle, setBoxStyle, setItemStyle, setSlideStyle } from "./scripts/itemClipboard"
    import { DEFAULT_ITEM_STYLE } from "./scripts/itemHelpers"
    import { addStyleString } from "./scripts/textStyle"
    import AliancaTextoLigado from "./tools/AliancaTextoLigado.svelte"
    import BoxStyle from "./tools/BoxStyle.svelte"
    import ItemsList from "./tools/ItemsList.svelte"
    import ItemStyle from "./tools/ItemStyle.svelte"
    import SlideFilters from "./tools/SlideFilters.svelte"
    import SlideStyle from "./tools/SlideStyle.svelte"
    import TemplateStyle from "./tools/TemplateStyle.svelte"
    import { itemBoxes } from "./values/boxes"

    let tabs: TabsObj = {
        text: { name: "items.text", icon: "text" },
        item: { name: "tools.item", icon: "item" },
        slide: { name: "tools.slide", icon: "options", overflow: true },
        filters: { name: "edit.filters", icon: "filter", overflow: true } // as abas sairam: o objeto so guarda `remove` (alvoDoRodape olha se ha slide e caixa)
    }
    let active: string = Object.keys(tabs)[0]
    $: tabs.text.icon = item?.type && itemBoxes[item.type] ? itemBoxes[item.type]!.icon : "text"
    $: tabs.text.name = "items." + (item?.type || "text")

    $: activeId = $activeEdit.id || ""
    $: activeSlide = $activeEdit.slide ?? -1

    // is not template or overlay
    $: isShow = !activeId
    $: tabs.filters.remove = !isShow // TODO: set filters in template / overlay ? ( && $activeEdit.type !== "template")
    $: tabs.slide.remove = (!isShow && $activeEdit.type !== "template" && $activeEdit.type !== "overlay") || templateTextMode
    $: if ((tabs.slide.remove && active === "slide") || (tabs.filters.remove && active === "filters")) active = "text"

    $: templateTextMode = $activeEdit.type === "template" && $templates[activeId]?.settings?.mode === "text"
    $: if (templateTextMode) {
        tabs.item.remove = true
        // tabs.slide.remove = true
    } else {
        tabs.item.remove = false
        // tabs.slide.remove = false
    }
    $: templateItemMode = $activeEdit.type === "template" && $templates[activeId]?.settings?.mode === "item"
    $: if (templateItemMode) {
        if (active === "text") active = "item"
        tabs.text.remove = true
    } else {
        tabs.text.remove = false
    }

    $: showIsActive = $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")
    $: editSlideSelected = $activeEdit.slide !== null && $activeEdit.slide !== undefined
    $: activeIsShow = $activeShow && ($activeShow.type || "show") === "show"

    let slides: Slide[] = []
    $: if (allSlideItems && (($activeEdit?.id && editSlideSelected) || showIsActive))
        slides = _show($activeEdit?.id || $activeShow?.id)
            .slides()
            .get()

    $: isEmpty = !allSlideItems?.length
    $: tabs.item.disabled = isEmpty
    let previousCount = 0
    $: if (isEmpty || activeId || activeSlide) {
        previousCount = 0
    }
    $: if (item !== undefined) itemChanged()
    function itemChanged() {
        if (item === null) {
            if (active === "text" || active === "item") active = "text"
            tabs.text.disabled = true
            return
        }

        let currentCount = allSlideItems.length
        if (previousCount === currentCount) return
        previousCount = currentCount

        tabs.text.disabled = false
    }

    $: ref = getLayoutRef("active", $showsCache)

    $: if (editSlideSelected && activeIsShow && ref.length <= activeSlide && ref.length > 0) activeEdit.set({ slide: 0, items: [], showId: $activeShow?.id })

    let allSlideItems: Item[] = []
    $: {
        if ($activeEdit.type === "overlay") allSlideItems = clone($overlays[activeId]?.items || [])
        else if ($activeEdit.type === "template") allSlideItems = clone($templates[activeId]?.items || [])
        else allSlideItems = editSlideSelected && activeIsShow && ref.length > activeSlide ? clone(_show().slides([ref[activeSlide]?.id]).get("items")[0] || []) : []
    }
    const getItemsByIndex = (array: number[]): Item[] => array.map((i) => allSlideItems[i])

    // select active items or all items
    $: items = $activeEdit.items.length ? getItemsByIndex([...$activeEdit.items].sort((a, b) => a - b)) : allSlideItems
    // select last item
    $: item = items?.length ? items[items.length - 1] : null

    // COPY

    // o rodape age sobre o ALVO (texto, caixa ou slide), nao sobre uma aba (leiaute v2, fatia 3: o painel organizado e o unico)
    let tipoEdicao: "show" | "template" | "overlay" = "show"
    $: tipoEdicao = $activeEdit.type === "overlay" ? "overlay" : $activeEdit.type === "template" ? "template" : "show"
    $: escolhidos = $activeEdit.items.length
    $: alvo = alvoDoRodape({ escolhidos, templateTextMode, templateItemMode, slideRemovido: !!tabs.slide.remove, tipo: tipoEdicao })
    $: aba = alvo

    $: itemType = aba === "text" ? item?.type || "text" : ""
    $: type = `${aba}${itemType}`
    function copyStyle() {
        const styles = getItemsStyle()

        copyPasteEdit.update((a) => {
            a[type] = styles
            // Preparar: com camada escolhida copia tambem a caixa (posicao, fundo...), para o botao "Colar caixa"
            if (temCaixa && aba !== "item") a["item"] = items.map((it) => getCurrentStyle(it, "item"))
            return a
        })

        console.log("COPIED STYLE", $copyPasteEdit)
    }

    function clearClipboard() {
        copyPasteEdit.update((a) => {
            delete a[type]
            delete a["item"]
            return a
        })
    }

    function getItemsStyle(_updater: any = null) {
        if (!items?.length) return [getCurrentStyle()]
        return items.map((item) => getCurrentStyle(item))
    }

    function getCurrentStyle(item: Item | null = null, alvoDe: string = aba) {
        if (alvoDe === "text" && item) return getBoxStyle(item)
        if (alvoDe === "item" && item) return getItemStyle(item)
        if (alvoDe === "slide") return getSlideStyle()
        return null
    }

    // PASTE

    // o botao do prototipo "Aplicar este estilo em todos os slides": copia o estilo do alvo e cola em todos de uma vez (so show; texto e slide)
    $: podeAplicarEmTodos = isShow && (aba === "text" || aba === "slide")
    async function aplicarEmTodos() {
        if (colando || !podeAplicarEmTodos) return
        copyStyle()
        await pasteStyle(true)
    }

    // Preparar (8b): trava de clique duplo enquanto cola, e o desfazer da colagem em grupo e UMA entrada so
    let colando = false

    async function pasteStyle(applyToAll = false) {
        let styles = $copyPasteEdit[type]
        if (!Array.isArray(styles)) return
        if (colando) return

        // get selected slide(s)
        let slides: any[] = []
        if ($activeEdit.type === "overlay") slides = [$overlays[activeId]]
        else if ($activeEdit.type === "template") slides = [$templates[activeId]]
        else {
            let activeSlides: string[] = []
            // all slides
            if (applyToAll) activeSlides = []
            // selected slides
            else if ($selected.id === "slide" && $selected.data.length) activeSlides = $selected.data.map(({ index }) => ref[index]?.id)
            // active slide
            else activeSlides = [ref[activeSlide]?.id]

            slides = _show().slides(activeSlides).get()
        }

        slides = clone(slides)

        const agrupar = isShow && (aba === "text" || aba === "slide") && !!$activeShow?.id
        if (agrupar) {
            colando = true
            try {
                await comDesfazerAgrupado($activeShow!.id, () => setNewStyle(true))
            } finally {
                colando = false
            }
        } else setNewStyle()

        function setNewStyle(semHistorico = false) {
            if (aba === "text") return setBoxStyle(styles, slides, itemType as ItemType, semHistorico)
            if (aba === "item") return setItemStyle(styles, slides)
            return setSlideStyle(styles[0], slides, semHistorico)
        }
    }

    // RESET

    async function reset() {
        // Preparar: reset de varios dados num slide = UMA entrada de desfazer
        if (isShow && (aba === "text" || aba === "slide") && $activeShow?.id) {
            if (colando) return
            colando = true
            try {
                await comDesfazerAgrupado($activeShow.id, () => resetar(true))
            } finally {
                colando = false
            }
            return
        }
        resetar(false)
    }

    function resetar(semHistorico: boolean) {
        const semEntrada = semHistorico ? { save: false } : {}
        if (!isShow) {
            if (aba === "item") {
                history({
                    id: "UPDATE",
                    oldData: { id: $activeEdit.id },
                    newData: { key: "items", subkey: "style", data: DEFAULT_ITEM_STYLE, indexes: $activeEdit.items },
                    location: { page: "edit", id: $activeEdit.type + "_items", override: true }
                })
                return
            }

            if (aba === "slide") {
                if ($activeEdit.type !== "template") return

                let id = $activeEdit?.id || ""
                history({ id: "UPDATE", newData: { key: "settings", data: {} }, oldData: { id }, location: { page: "edit", id: "template_settings", override: id } })
                return
            }

            if (aba !== "text") return

            if ($activeEdit.type === "overlay") overlays.update(updateItemValues)
            else if ($activeEdit.type === "template") templates.update(updateItemValues)

            function updateItemValues(a: any) {
                if (!a[$activeEdit.id!]?.items) return

                $activeEdit.items.forEach((i: number) => {
                    if (!a[$activeEdit.id!].items[i]?.lines) return

                    a[$activeEdit.id!].items[i].lines.forEach((line: Line) => {
                        line.text?.forEach((text) => {
                            text.style = ""
                        })
                    })
                })

                a[$activeEdit.id!].modified = Date.now()
                return a
            }

            return
        }

        let ref = getLayoutRef()
        let slideId = ref[activeSlide]?.id
        if (!slideId) return

        storedEditMenuState.set({})

        if (aba === "item") {
            history({
                id: "setStyle",
                newData: { style: { key: "style", values: [DEFAULT_ITEM_STYLE] } },
                location: { page: "edit", show: $activeShow!, slide: slideId, items: $activeEdit.items }
            })
            return
        }

        if (aba === "slide") {
            history({
                id: "slideStyle",
                ...semEntrada,
                oldData: { style: _show().slides([slideId]).get("settings")[0] },
                newData: { style: {} },
                location: { page: "edit", show: $activeShow!, slide: slideId }
            })
            return
        }

        if (aba !== "text") return

        let values: any = []
        items.forEach((item) => {
            if (item.lines) {
                let text = item.lines.map((a) => {
                    return (a.text || []).map((a) => {
                        a.style = ""
                        return a
                    })
                })
                values.push(text)
            }
        })

        // let selectedItems = $activeEdit.items.length ? $activeEdit.items : Object.keys(allSlideItems)
        if (values.length) {
            history({
                id: "textStyle",
                ...semEntrada,
                newData: { style: { key: "text", values } },
                location: {
                    page: "edit",
                    show: $activeShow!,
                    slide: slideId,
                    items: $activeEdit.items
                }
            })
        }

        let deleteKeys = ["auto", "textFit", "specialStyle", "scrolling"]
        // reset timer/icon/media/mirror etc. style
        if (item && item[item.type || ""]) deleteKeys = [item.type!]

        deleteKeys.forEach((key) => {
            history({
                id: "setItems",
                ...semEntrada,
                newData: { style: { key, values: [undefined] } },
                location: { page: "edit", show: $activeShow!, slide: slideId, items: $activeEdit.items, id: key }
            })
        })

        // WIP refresh edit tools after resetting
    }

    function keydown(e: KeyboardEvent) {
        if (document.activeElement?.closest(".edit")) return

        // move items with arrow keys
        if (e.key.includes("Arrow") && $activeEdit.items.length) {
            e.preventDefault()

            const key = ["ArrowLeft", "ArrowRight"].includes(e.key) ? "left" : "top"
            let value = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1
            if (e.ctrlKey || e.metaKey) value *= 10

            let selectedItems: number[] = $activeEdit.items || allSlideItems.map((_, i) => i)
            if (!selectedItems.length) return

            let values: string[] = []

            selectedItems.forEach((index) => {
                let item = allSlideItems[index]
                if (!item) return

                let previousItemValue = Number(getStyles(item.style, true)?.[key] || "0")
                let newValue = previousItemValue + value + "px"

                values.push(addStyleString(item.style, [key, newValue]))
            })

            if (activeId) {
                history({
                    id: "UPDATE",
                    oldData: { id: activeId },
                    newData: { key: "items", subkey: "style", data: values, indexes: selectedItems },
                    location: { page: "edit", id: $activeEdit.type + "_items", override: true }
                })
                return
            }

            let ref = getLayoutRef()
            let slideId = ref[activeSlide ?? ""]?.id

            history({
                id: "setItems",
                newData: { style: { key: "style", values } },
                location: { page: "edit", show: $activeShow!, slide: slideId, items: selectedItems, override: "slideitem_" + slideId + "_items_" + selectedItems.join(",") }
            })
        }
    }

    $: slideActive = !!((slides?.length && showIsActive && activeSlide !== null) || activeId)
    let profile = getAccess("shows")

    $: currentShow = $showsCache[$activeShow?.id || ""]
    $: isLocked = activeId ? false : currentShow?.locked || isSlideLocked($activeShow?.id || "", ref[activeSlide]?.id || "", currentShow) || profile.global === "read" || profile[currentShow?.category || ""] === "read"
    // $: isDefault = $activeEdit.type === "overlay" ? $overlays[activeId || ""]?.isDefault : $activeEdit.type === "template" ? $templates[activeId || ""]?.isDefault : false

    $: currentCopied = $copyPasteEdit[type]
    $: currentItemStyle = getItemsStyle($showsCache[$activeEdit?.id || $activeShow?.id || ""])
    $: copiedStyleDifferent = currentCopied && JSON.stringify(currentCopied) !== JSON.stringify(currentItemStyle)

    // ----- Preparar (8b): painel organizado -----
    // blocos: conteudo (texto/midia...), Caixa (posicao e aparencia) e a secao Slide (fechada, no fim)
    $: temCaixa = escolhidos > 0 && !templateTextMode
    $: mostrarConteudo = !!item && !templateItemMode
    $: mostrarCaixa = !templateTextMode && allSlideItems.length > 0 && (escolhidos > 0 || templateItemMode)
    $: secaoSlide = !tabs.slide.remove && tipoEdicao !== "overlay"
    $: tipoConteudo = item?.type || "text"
    $: tituloConteudo = escolhidos === 0 ? (tipoConteudo === "text" ? "Texto de todas as caixas" : `${translateText("items." + tipoConteudo)}: todos os itens`) : translateText("items." + tipoConteudo)
    $: rotuloRodape = aba === "slide" ? "Estilo do slide" : aba === "item" ? "Estilo da caixa" : "Estilo do texto"

    // a secao Slide abre sozinha quando nada esta escolhido; fora disso so se a pessoa abrir (volta a fechar ao trocar de slide/show)
    let slideAbertoPeloUsuario = false
    let filtrosAbertos = false
    $: voltarASecaoFechada(activeSlide, $activeShow?.id, activeId)
    function voltarASecaoFechada(..._: any[]) {
        slideAbertoPeloUsuario = false
        filtrosAbertos = false
    }
    $: slideAberto = escolhidos === 0 || slideAbertoPeloUsuario

    // "Colar caixa": a caixa copiada (posicao, fundo...) so nas camadas escolhidas deste slide. Nao ha "caixa em todos": empilharia as caixas.
    $: caixaCopiada = $copyPasteEdit["item"]
    $: caixaAtual = temCaixa && aba !== "item" ? items.map((it) => getItemStyle(it)) : []
    $: difereCaixa = isShow && temCaixa && aba !== "item" && !!caixaCopiada && JSON.stringify(caixaCopiada) !== JSON.stringify(caixaAtual)
    async function colarCaixa() {
        if (colando || !Array.isArray(caixaCopiada) || !ref[activeSlide]?.id) return
        colando = true
        try {
            await setItemStyle(caixaCopiada, clone(_show().slides([ref[activeSlide].id]).get()))
        } finally {
            colando = false
        }
    }

    // function copyToCreateData() {
    //     const slide = $activeEdit?.type === "overlay" ? $overlays[activeId || ""] : $activeEdit?.type === "template" ? $templates[activeId || ""] : null
    //     if (!slide) return

    //     const newSlide = {
    //         isDefault: true,
    //         name: slide.name,
    //         color: slide.color || null,
    //         category: slide.category,
    //         items: trimItems(clone(slide.items))
    //         // settings
    //     } as typeof slide

    //     navigator.clipboard.writeText(JSON.stringify(newSlide))
    //     newToast("Copied!")

    //     function trimItems(items: Item[]) {
    //         items.forEach((item) => {
    //             if (item.type === "text") delete item.type
    //             if (item.auto === false) delete item.auto

    //             item.lines?.forEach((line, lineIndex) => {
    //                 line.align = (line.align || "").replaceAll(";;", ";")
    //                 if (line.align === ";") line.align = ""

    //                 line.text.forEach((text) => {
    //                     text.value = text.value ? (lineIndex + 1).toString() : ""
    //                     text.style = text.style.replace("color:#FFFFFF;", "")
    //                 })
    //             })
    //         })
    //         return items
    //     }
    // }
</script>

<svelte:window on:keydown={keydown} />

<div class="main border editTools">
    {#if slideActive && !isLocked}
        <div class="content">
            <ItemsList {allSlideItems} recolhivel />

            {#if mostrarConteudo}
                <div class="bloco">
                    <div class="blocoTitulo"><p>{tituloConteudo}</p></div>
                    {#if tipoConteudo === "text" && escolhidos === 1}<AliancaTextoLigado {allSlideItems} />{/if}
                    <BoxStyle id={tipoConteudo} agrupar bind:allSlideItems bind:item />
                </div>
            {:else if !templateItemMode}
                <Center faded>
                    <T id="empty.items" />
                </Center>
            {/if}

            {#if mostrarCaixa}
                <div class="bloco">
                    <div class="blocoTitulo">
                        <p>Caixa</p>
                        {#if difereCaixa}
                            <MaterialButton style="padding: 2px 8px;font-size: 0.8em;" title="Colar a caixa copiada (posição, fundo...) só nas camadas escolhidas" disabled={colando} on:click={colarCaixa}>Colar caixa</MaterialButton>
                        {/if}
                    </div>
                    <ItemStyle agrupar bind:allSlideItems bind:item />
                </div>
            {/if}

            {#if secaoSlide}
                <div class="bloco">
                    <div class="blocoTitulo">
                        <MaterialButton style="width: 100%;padding: 8px 12px;justify-content: space-between;" disabled={escolhidos === 0} on:click={() => (slideAbertoPeloUsuario = !slideAbertoPeloUsuario)}>
                            <p>{translateText("tools.slide")}</p>
                            {#if escolhidos > 0}<Icon id="arrow_back_modern" class="seta {slideAberto ? 'aberta' : ''}" size={0.6} style="opacity: 0.5;" white />{/if}
                        </MaterialButton>
                    </div>
                    {#if slideAberto}
                        {#if $activeEdit.type === "template"}
                            <TemplateStyle semCamadas bind:allSlideItems />
                        {:else}
                            <SlideStyle semCamadas bind:allSlideItems />
                        {/if}

                        {#if isShow}
                            <div class="blocoTitulo sub">
                                <MaterialButton style="width: 100%;padding: 6px 12px;justify-content: space-between;" on:click={() => (filtrosAbertos = !filtrosAbertos)}>
                                    <p>Filtros do slide</p>
                                    <Icon id="arrow_back_modern" class="seta {filtrosAbertos ? 'aberta' : ''}" size={0.6} style="opacity: 0.5;" white />
                                </MaterialButton>
                            </div>
                            {#if filtrosAbertos}
                                <SlideFilters />
                            {/if}
                        {/if}
                    {/if}
                </div>
            {/if}
        </div>

        {#if item || aba === "slide"}
            <!-- rodape fixo (nao flutua sobre o conteudo): o estilo copiado vale para o alvo de cima -->
            <div class="rodape" data-acao="editar-rodape">
                <span class="rotuloRodape">{rotuloRodape}</span>
                <div class="botoes">
                    {#if copiedStyleDifferent}
                        <button type="button" class="b" disabled={colando} on:click={() => pasteStyle()}>Colar estilo</button>
                    {/if}
                    {#if currentCopied && !copiedStyleDifferent}
                        {#if isShow}
                            <button type="button" class="b" disabled={colando} on:click={() => pasteStyle(true)}>Colar em todos os slides</button>
                        {/if}
                    {:else}
                        <button type="button" class="b" disabled={!currentItemStyle?.length} on:click={copyStyle}>Copiar estilo</button>
                    {/if}
                    {#if currentCopied}
                        <button type="button" class="b" title="Esquecer o estilo copiado" on:click={clearClipboard}>Esquecer cópia</button>
                    {:else if aba !== "item"}
                        <button type="button" class="b" disabled={colando} title="Voltar ao estilo padrão" on:click={reset}>Restaurar</button>
                    {/if}
                </div>
                {#if podeAplicarEmTodos && !currentCopied}
                    <button type="button" class="b grande" disabled={colando || !currentItemStyle?.length} title="Copia o estilo deste slide e aplica em todos os slides do show" on:click={aplicarEmTodos}>Aplicar este estilo em todos os slides</button>
                {/if}
            </div>
        {/if}
    {:else if isLocked}
        <Center faded>
            <Icon id="lock" size={2} white />
            <p style="margin-top: 8px;"><T id="output.state_locked" /></p>
        </Center>
    {:else}
        <Center faded>
            <T id="empty.slides" />
        </Center>
    {/if}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;

        padding-bottom: 12px;
    }
    .content :global(section) {
        padding: 10px;
        /* flex: 1; */
        /* height: 100%; */
    }
    .content :global(section div) {
        display: flex;
        justify-content: space-between;
    }

    /* Preparar (8b): painel organizado */
    .bloco {
        margin-top: 10px;
        padding: 0 5px;
    }
    /* titulos de bloco como os do prototipo: TEXTO, CAIXA, SLIDE (rotulo pequeno em caixa alta, sem fundo) */
    .blocoTitulo {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--luz-linha);
        overflow: hidden;
        padding: 0 12px;
    }
    .blocoTitulo.sub {
        margin-top: 6px;
        padding: 0;
    }
    .blocoTitulo :global(button) {
        padding-inline: 0;
    }
    .blocoTitulo p {
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--luz-mudo);
        opacity: 1;
        padding: 8px 0;
    }
    .bloco :global(svg.seta) {
        transition: 0.1s transform ease;
        transform: rotate(180deg);
    }
    .bloco :global(svg.seta.aberta) {
        transform: rotate(-90deg);
    }
    .rodape {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--luz-linha);
    }
    .rodape .botoes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }
    .rodape .b {
        height: 36px;
        padding: 0 8px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .rodape .b.grande {
        height: 40px;
        font-size: 13px;
    }
    .rodape .b:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .rotuloRodape {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--luz-mudo);
        white-space: nowrap;
    }
</style>
