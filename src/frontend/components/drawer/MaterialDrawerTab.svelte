<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { SelectIds } from "../../../types/Main"
    import { actions, activeActionTagFilter, activeDrawerTab, activePlaylist, activeVariableTagFilter, activeTimerTagFilter, audioPlaylists, drawerTabsData, outputs, templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getActionIcon } from "../actions/actions"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getFirstActiveOutput } from "../helpers/output"
    import { metadataDisplayValues } from "../helpers/show"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import SelectElem from "../system/SelectElem.svelte"

    export let category: any

    $: id = category.id
    $: label = category.label
    $: icon = category.icon
    $: option = category.option
    $: action = category.action || ""
    $: template = category.template || ""
    $: metadata = category.metadata || ""
    $: count = category.count || 0
    $: readOnly = category.readOnly || false

    export let parentId = ""
    export let isSubmenu = false
    $: submenu = category.submenu || {}

    export let active: string

    $: submenuActive = isSubmenu ? (active === "actions" ? $activeActionTagFilter.includes(id) : active === "variables" ? $activeVariableTagFilter.includes(id) : active === "timer" ? $activeTimerTagFilter.includes(id) : false) : false
    $: isActive = submenuActive || active === id

    $: output = getFirstActiveOutput($outputs)
    $: showOutline = drawerId === "scripture" ? (output?.out?.slide as any)?.categoryId === id : drawerId === "audio" ? $activePlaylist?.id === id : false

    $: drawerId = $activeDrawerTab
    $: selectId = `category_${drawerId}${drawerId === "scripture" ? "___" + icon : ""}` as SelectIds

    const dispatch = createEventDispatcher()
    function click(e: any) {
        const { ctrl, shift } = e.detail
        if (ctrl) return

        if (category.openTrigger) category.openTrigger(id, shift)
        if (shift) return

        drawerTabsData.update((a) => {
            a[drawerId].activeSubTab = parentId || id
            if (isSubmenu) a[drawerId].activeSubmenu = id
            else delete a[drawerId].activeSubmenu
            return a
        })
    }

    function dblclick() {
        if (category.onDoubleClick) category.onDoubleClick()
    }

    function rename(e: any) {
        dispatch("rename", { id, value: e.detail.value })
    }

    const defaultFolders = ["all", "unlabeled", "number", "favourites", "effects_library", "effects", "online", "inputs", "metronome"]
    const tabsWithCategories = ["shows", "media", "audio", "overlays", "templates", "scripture"]

    $: noEdit = !tabsWithCategories.includes(drawerId) || defaultFolders.includes(id) || String(id).startsWith("pasta:")
    $: className = noEdit ? "" : $audioPlaylists[id] ? "context #playlist" : `context #category_${drawerId}_button${readOnly ? "_readonly" : ""}`

    // drag and drop audio playlists
    $: draggable = !!(drawerId === "audio" && $audioPlaylists[id])

    // SUB MENU

    $: openedSubmenus = $drawerTabsData[drawerId]?.openedSubmenus || []
    $: submenuOpened = openedSubmenus.includes(id)

    function openSubMenu() {
        drawerTabsData.update((a) => {
            if (!a[drawerId]) return a
            let opened = clone(openedSubmenus)

            let existingIndex = opened.findIndex((menuId) => menuId === id) ?? -1
            if (existingIndex < 0) opened.push(id)
            else {
                opened.splice(existingIndex, 1)
                delete a[drawerId].activeSubmenu
                if (category.openTrigger) category.openTrigger(id)
            }

            a[drawerId].openedSubmenus = opened
            return a
        })
    }
</script>

<!-- leiaute v2: linha compacta da arvore (26 px; 28 nas pastas), sem icone de pasta e sem marcador vermelho. Contador a direita. -->
<SelectElem style="width: 100%;" id={selectId} selectable={!noEdit} {draggable} borders="center" trigger="column" data={id}>
    <div class="envolve">
    <button type="button" class="linha {className}" class:ativo={isActive} class:contorno={showOutline} class:sub={isSubmenu} tabindex="-1" on:click={(e) => (click({ detail: { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey } }), (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null))} on:dblclick={dblclick} data-title={translateText(label)}>
        <span class="rotulo">
            {#if noEdit || isSubmenu}
                {#if label}
                    {translateText(label)}
                {:else}
                    <span style="opacity: 0.5;font-style: italic;pointer-events: none;">{translateText("main.unnamed")}</span>
                {/if}
            {:else}
                <HiddenInput value={translateText(label)} id="category_{drawerId}_{id}" on:edit={rename} />
            {/if}
        </span>

        <span class="icons">
            {#if option}
                <span class="marca" style={option.style} data-title={translateText(option.title)}>
                    <Icon id={option.icon} size={0.7} white />
                </span>
            {/if}
            {#if metadata}
                <span class="marca" data-title={translateText(`tools.metadata: <b>${metadataDisplayValues.find((a) => a.id === metadata)?.name}</b>`)}>
                    <Icon id="info" size={0.7} white />
                </span>
            {/if}
            {#if template && $templates[template]}
                <span class="marca" data-title={translateText(`info.template: <b>${$templates[template].name}</b>`)}>
                    <Icon id="templates" size={0.7} white />
                </span>
            {/if}
            {#if action && $actions[action]}
                <span class="marca" data-title={translateText(`popup.action: <b>${$actions[action].name}</b>`)}>
                    <Icon id={getActionIcon(action)} size={0.7} white />
                </span>
            {/if}

            {#if count}
                <span class="count">{count}</span>
            {/if}
        </span>
    </button>
    <!-- SUB MENU -->
    {#if !isSubmenu && submenu?.options?.length}
        <button type="button" class="abreSub" tabindex="-1" aria-label={submenuOpened ? "Fechar" : "Abrir"} on:click={openSubMenu}>{submenuOpened ? "▾" : "▸"}</button>
    {/if}
    </div>
</SelectElem>

{#if !isSubmenu && submenuOpened && submenu?.options?.length}
    <div class="submenus">
        {#each submenu.options as option}
            <svelte:self parentId={id} category={option} {active} isSubmenu />
        {/each}
    </div>
{/if}

<style>
    .linha {
        width: 100%;
        height: 26px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 6px 0 8px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto, #f8f8f0);
        font: inherit;
        font-size: 12px;
        font-weight: 400;
        text-align: left;
        cursor: pointer;
    }
    .linha:focus,
    .linha:focus-visible {
        outline: none;
    }
    .linha:hover {
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
    }
    .linha.ativo {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
        box-shadow: inset 2px 0 0 var(--luz-texto, #f8f8f0);
        font-weight: 600;
    }
    .linha.contorno {
        box-shadow: inset 0 0 0 1px var(--luz-borda-forte, rgb(248 248 240 / 0.3));
    }
    .rotulo {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .rotulo :global(input) {
        padding: 2px 4px;
    }
    .icons {
        display: flex;
        align-items: center;
        gap: 2px;
        flex: none;
    }
    .marca {
        opacity: 0.6;
        display: inline-flex;
    }
    .count {
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
        font-size: 11px;
        font-weight: 400;
    }
    .envolve {
        position: relative;
        width: 100%;
    }
    .abreSub {
        position: absolute;
        right: 0;
        top: 0;
        height: 26px;
        width: 22px;
        border: 0;
        background: transparent;
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
        font-size: 11px;
        cursor: pointer;
    }
    .submenus {
        margin: 0 0 2px 10px;
        padding-left: 6px;
        border-left: 1px solid var(--luz-linha, rgb(248 248 240 / 0.075));
        display: flex;
        flex-direction: column;
    }
</style>
