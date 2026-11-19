<script lang="ts">
    import { onMount } from "svelte"
    import { activeActionTagFilter, activeDrawerTab, activeEdit, activeVariableTagFilter, activeTimerTagFilter, dictionary, drawerTabsData, labelsDisabled } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { subAbaDeVolta } from "../../../utils/aliancaArvoreLogica"
    import MaterialDrawerTab from "../MaterialDrawerTab.svelte"

    // interface Button extends Category {
    //     label: string
    //     id: string
    //     url?: string
    //     length?: number
    //     readOnly?: boolean
    // }

    export let sections: any[]
    export let active: string
    // C6: sub-abas validas que NAO tem linha propria (a raiz e o "tudo"; Entradas/Online/Audio sao linhas da arvore): nao disparam a escolha da 1a linha
    export let extra: string[] = []
    // "tudo" da raiz (Shows e Midia: "all"): sub-aba vazia ou apagada cai nele, nunca na 1a categoria/pasta (que filtraria a lista sem ninguem pedir)
    export let padrao = ""

    let ready = false
    onMount(() => {
        // give time for any special sub tabs to load (like content providers)
        setTimeout(() => (ready = true), 50)
    })

    $: if (ready && sections.length) {
        const flat = sections.flat().filter((a) => a && a !== "SEPARATOR" && a.id !== "SEPARATOR" && a.id !== "TITLE")
        const volta = subAbaDeVolta(active, flat, extra, padrao)
        if (volta) setSubTab(volta)
    }

    function setSubTab(tabId: string) {
        const drawerId = $activeDrawerTab
        drawerTabsData.update((a) => {
            a[drawerId] = { ...a[drawerId], activeSubTab: tabId, enabled: a[drawerId]?.enabled !== false }
            return a
        })

        // tag submenus will close on keyboard navigation
        activeActionTagFilter.set([])
        activeVariableTagFilter.set([])
        activeTimerTagFilter.set([])
    }

    function notATab(tab: any) {
        if (tab === "SEPARATOR") return true
        if (tab?.id === "SEPARATOR") return true
        if (tab?.id === "TITLE") return true
        return false
    }
    function keydown(e: KeyboardEvent) {
        if ($activeEdit.items.length) return
        if (e.target?.closest?.(".edit") || !(e.ctrlKey || e.metaKey)) return

        const flatSections = sections.flat().filter((a) => !a.hidden)

        // Ctrl + Arrow Up/Down = change active drawer sub tab
        if (e.key === "ArrowDown") {
            let index = flatSections.findIndex((a) => a.id === active)
            let nextIndex = index + 1

            while (nextIndex < flatSections.length && notATab(flatSections[nextIndex])) nextIndex++

            if (nextIndex < flatSections.length) setSubTab(flatSections[nextIndex].id)
        } else if (e.key === "ArrowUp") {
            let index = flatSections.findIndex((a) => a.id === active)
            let nextIndex = index - 1

            while (nextIndex >= 0 && notATab(flatSections[nextIndex])) nextIndex--

            if (nextIndex >= 0) setSubTab(flatSections[nextIndex].id)
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="tabSection">
    {#each sections as buttons, index}
        {#if buttons.length > 1 || !buttons[0]?.hidden}
            <div class="section">
                {#if buttons.length}
                    {#each buttons as category}
                        {#if category?.id === "TITLE"}
                            <div class="title">{translateText(category.label, $dictionary)}</div>

                            {#if $labelsDisabled}
                                <div class="add_button">
                                    {#if index === 0}
                                        <slot name="section_0" />
                                    {:else if index === 1}
                                        <slot name="section_1" />
                                    {:else if index === 2}
                                        <slot name="section_2" />
                                    {:else if index === 3}
                                        <slot name="section_3" />
                                    {:else if index === 4}
                                        <slot name="section_4" />
                                    {/if}
                                </div>
                            {/if}
                        {:else if category === "SEPARATOR" || category?.id === "SEPARATOR"}
                            <div class="separator">
                                {#if category?.label}<div class="sepLabel">{translateText(category.label, $dictionary)}</div>{/if}
                                <hr />
                            </div>
                        {:else if !category.hidden}
                            <MaterialDrawerTab {active} {category} on:rename />
                        {/if}
                    {/each}
                    <!-- {:else}
            <Center style="padding: 10px;" faded>
                <T id="empty.general" />
            </Center> -->
                {/if}

                {#if !$labelsDisabled}
                    {#if index === 0}
                        <slot name="section_0" />
                    {:else if index === 1}
                        <slot name="section_1" />
                    {:else if index === 2}
                        <slot name="section_2" />
                    {:else if index === 3}
                        <slot name="section_3" />
                    {:else if index === 4}
                        <slot name="section_4" />
                    {/if}
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style>
    /* leiaute v2: sem cartao nem borda; so as linhas compactas da arvore (a linha-guia e do pai, em AliancaArvore) */
    .tabSection {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 2px 0;
    }

    .section {
        position: relative;
        display: flex;
        flex-direction: column;
    }

    .title {
        font-weight: 600;
        padding: 6px 8px 2px;
        font-size: 11px;
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
    }

    hr {
        height: 1px;
        border: none;
        background-color: var(--luz-linha, rgb(248 248 240 / 0.075));
        flex: 1;
    }

    .separator {
        display: flex;
        align-items: center;
    }
    .sepLabel {
        font-size: 11px;
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
        padding: 6px 8px 2px;
        line-height: 1;
    }

    .add_button {
        position: absolute;
        top: 0;
        right: 2px;
    }
    .add_button :global(div) {
        padding: 0 !important;
    }
    .add_button :global(button) {
        padding: 4px;
        border: none;
    }
    /* o botao "nova categoria / importar" do pe da secao: contorno tracejado, 26 px */
    .section :global(div[slot]),
    .section > :global(div:last-child:not(.title)) {
        padding: 4px 0 !important;
    }
</style>
