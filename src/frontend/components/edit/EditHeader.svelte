<script lang="ts">
    import { activeEdit, activePopup, editMode, groups, showsCache, templates } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { _show } from "../helpers/shows"
    import { getLayoutRef } from "../helpers/show"

    export let showId: string
    // leiaute v2 (fatia 2, regra B): o menu "mais opcoes" (notas e linha do tempo do slide) so existia fora do Preparar e saiu: ha um so editor
    export let hideOptions = false

    $: currentShow = $showsCache[showId]

    let listScrollY = 0

    // TEMPLATE

    $: ref = showId && currentShow ? getLayoutRef(showId) : []
    $: Slide = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? _show(showId).slides([ref[$activeEdit.slide!]?.id]).get()?.[0] : null

    $: parentId = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? ref[$activeEdit.slide!]?.parent?.id || ref[$activeEdit.slide!]?.id : ""
    $: slideGroup = _show(showId).slides([parentId]).get()?.[0]?.globalGroup || ""
    $: templateId = Slide?.settings?.template || $groups[slideGroup]?.template || currentShow?.settings?.template || ""
</script>

<div class="header" class:shadow={listScrollY > 0}>
    <div class="name" data-title={currentShow?.name}>
        {#if currentShow?.name}
            {currentShow.name}
        {:else}
            <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
        {/if}
    </div>

    {#if $editMode === "default"}
        <div class="right">
            {#if templateId}
                <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;" title="formats.template: <b>{$templates[templateId]?.name || 'info.template'}</b>" on:click={() => activePopup.set("template_info")}>
                    <Icon size={0.8} id="templates" white />
                </MaterialButton>
            {/if}
        </div>
    {/if}
</div>

<style>
    /* header */

    .header {
        position: relative;
        width: 100%;
        height: 30px;

        padding: 0.2em;
        padding-left: 0.8em;
        font-weight: 600;

        display: flex;
        align-items: center;

        backdrop-filter: blur(10px);

        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;

        background-color: rgb(0 0 10 / 0.3);

        z-index: 200;
        transition: box-shadow 0.2s ease;
    }
    .header.shadow {
        background-color: rgb(0 0 10 / 0.12);
        box-shadow: 0 2px 4px rgb(0 0 10 / 0.3);
    }

    .header .right {
        height: 100%;
        display: flex;
        flex-shrink: 0;
        margin-left: auto;
    }

    .name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.9em;
    }
</style>
