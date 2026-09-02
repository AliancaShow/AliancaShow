<script lang="ts">
    // Layout D: as 8 abas da biblioteca vivem na metade de baixo do painel esquerdo,
    // nao na barra do rodape. Clicar numa aba abre o conteudo dela no painel inferior
    // do centro (o Drawer), logo abaixo da grade de slides.
    import type { DrawerTabIds } from "../../../types/Tabs"
    import { activeDrawerTab, drawer, drawerOpenedInEdit, drawerTabsData, focusMode } from "../../stores"
    import { DEFAULT_DRAWER_HEIGHT } from "../../utils/common"
    import { getAccess } from "../../utils/profile"
    import { drawerTabs } from "../../values/tabs"
    import { keysToID } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"

    const MIN_HEIGHT = 40
    const hiddenInFocusMode = ["templates", "calendar"]

    const tabs = keysToID(drawerTabs)

    $: isClosed = $drawer.height <= MIN_HEIGHT

    function openTab(tab: { id: string }) {
        const newId = tab.id as DrawerTabIds

        // clicar na aba ja ativa alterna: fecha se aberta, reabre se fechada
        if ($activeDrawerTab === newId && !isClosed) {
            drawer.set({ height: MIN_HEIGHT, stored: $drawer.height })
            drawerOpenedInEdit.set(false)
            return
        }

        activeDrawerTab.set(newId)

        if (isClosed) {
            const stored = $drawer.stored
            drawer.set({ height: !stored || stored < DEFAULT_DRAWER_HEIGHT ? DEFAULT_DRAWER_HEIGHT : stored, stored: null })
        }
    }
</script>

<div class="library">
    <div class="header">
        <span><T id="tabs.library" /></span>
    </div>

    <div class="tabs">
        {#each tabs as tab, i}
            {#if $drawerTabsData[tab.id]?.enabled !== false && getAccess(tab.id).global !== "none" && (!$focusMode || !hiddenInFocusMode.includes(tab.id))}
                <button class="tab" class:active={$activeDrawerTab === tab.id && !isClosed} title="[Ctrl+{i + 1}]" on:click={() => openTab(tab)}>
                    <Icon id={tab.icon} size={1.2} white={$activeDrawerTab === tab.id && !isClosed} />
                    <span class="label"><T id={tab.name} /></span>
                </button>
            {/if}
        {/each}
    </div>
</div>

<style>
    /* metade de baixo do painel esquerdo; a lista rola se as 8 abas nao couberem */
    .library {
        display: flex;
        flex: 1 1 0;
        flex-direction: column;
        min-height: 0;

        background-color: var(--primary-darkest);
        border-top: 2px solid var(--secondary);
    }

    .header {
        display: flex;
        height: 26px;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;

        font-size: 0.7em;
        color: var(--text);
        letter-spacing: 1px;
        text-transform: uppercase;
        opacity: 0.45;
    }

    .tabs {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
    }

    .tab {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 10px;
        padding: 0.42em 12px;

        border: none;
        border-inline-start: 3px solid transparent;
        background-color: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: inherit;
        text-align: start;
        opacity: 0.72;

        cursor: pointer;
    }

    .tab:hover {
        background-color: var(--hover);
        opacity: 1;
    }

    .tab.active {
        border-inline-start: 3px solid var(--secondary);
        background-color: var(--primary);
        font-weight: 600;
        opacity: 1;
    }

    .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
