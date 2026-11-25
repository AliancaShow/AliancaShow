<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { activeEdit, activePage, activePopup, activeShow, activeStage, dynamicValuesRevealUsed, overlays, popupData, refreshEditSlide, showsCache, special, stageShows, templates, timers, variables } from "../../../stores"
    import { gruposLigados, type GrupoLigado } from "../../../utils/aliancaTextoLigadoLogica"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { formatSearch } from "../../../utils/search"
    import { clone } from "../../helpers/array"
    import { getLayoutRef } from "../../helpers/show"
    import { dynamicValueText, getDynamicIds, getVariableNameId, replaceDynamicValues } from "../../helpers/showActions"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    const obj = $popupData.obj || {}
    const caret = $popupData.caret || {}
    onMount(() => popupData.set({}))

    let mode: null | "scripture" = null
    if ($activePage === "edit" && $activeEdit.type === "template" && ($templates[$activeEdit.id || ""]?.settings?.mode === "scripture" || $templates[$activeEdit.id || ""]?.category === "scripture")) mode = "scripture"

    // AliancaShow (fila de 24/nov: "uma tela melhor para os valores dinamicos"): abre em PORTUGUES, com os mesmos grupos do "Texto ligado"
    // (utils/aliancaTextoLigadoLogica.ts) + as Variaveis criadas, nome claro e previa ao vivo. Os codigos do FreeShow ficam em "Todos os codigos".
    let avancado = false
    let buscaBruta = ""
    const semAcento = (s: string) =>
        String(s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
    function gruposEmPortugues(busca: string, _t: any, _v: any): GrupoLigado[] {
        const grupos = gruposLigados({ emModelo: mode === "scripture", cronometros: Object.values($timers || {}).map((x: any) => x?.name) })
        const vars = Object.values($variables || {}).filter((x: any) => x?.name && x.type !== "text_set")
        if (vars.length) grupos.push({ id: "variaveis", rotulo: "Variáveis", opcoes: vars.map((x: any) => ({ id: "var:" + x.name, rotulo: x.name, partes: [`{$${getVariableNameId(x.name)}}`] })) })
        const q = semAcento(busca).trim()
        if (q.length < 2) return grupos
        return grupos.map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => semAcento(o.rotulo + " " + g.rotulo).includes(q)) })).filter((g) => g.opcoes.length)
    }
    $: gruposPt = gruposEmPortugues(buscaBruta, $timers, $variables)
    const textoDaOpcao = (o: { partes: string[]; emLinhas?: boolean }) => o.partes.join(o.emLinhas ? " " : "")

    let showAll = $dynamicValuesRevealUsed
    function toggleShowAll() {
        showAll = !showAll
        values = getValues()
        defaultValues = clone(values)
        dynamicValuesRevealUsed.set(showAll)
    }

    const hidden: string[] = $special.disabledDynamicValues || []

    let values = getValues()

    function getValues() {
        let list = getDynamicIds(false, mode, showAll).map((id) => ({ id }))

        // WIP organize better - and don't hide any values
        // _color is only for CSS "var(--slide-group-color)", but we should show them in a seperate way

        const isStage = $activePage === "stage"
        const hidden = ["slide_text", "slide_group_color", "slide_group_upcoming_color"]
        let nonStageHidden = ["show_text_full", "slide_group_text"]
        if ($showsCache[$activeShow?.id || ""]?.reference?.type !== "interaction") nonStageHidden.push("interaction_")
        const stageHidden = ["interaction_"]
        if (isStage) list = list.filter((a) => !hidden.includes(a.id) && !stageHidden.some((h) => a.id.startsWith(h)))
        else list = list.filter((a) => !hidden.includes(a.id) && !nonStageHidden.some((h) => a.id.startsWith(h)))

        let separatorId = ""
        // the ones that can have a custom name should be first (to prevent it from overwriting a category)
        const separators = ["$", "timer_", "meta_", "rss_", "project_", "time_", "show_", "slide_text", "exif_", "video_", "audio_", "scripture_", "interaction_"]

        let newList: { [key: string]: typeof list } = {}
        list.forEach((value) => {
            const separator = separators.find((a) => value.id.startsWith(a)) || ""
            if (separator && separatorId !== separator && separatorId !== "$" && !newList[separator]?.length) {
                separatorId = separator
                newList[separatorId] = []
            }

            if (hidden.includes(separatorId.slice(0, -1))) return

            newList[separatorId].push(value)
        })

        return newList
    }

    function getTitle(id: string) {
        if (id === "interaction_") return "tabs.interactions"
        if (id === "scripture_") return "tabs.scripture"
        if (id === "time_") return "timer.time"
        if (id === "project_") return "guide_title.project"
        if (id === "show_") return "guide_title.show"
        if (id === "slide_text") return "edit.text"
        if (id === "exif_") return "items.image (EXIF)"
        if (id === "video_") return "edit.video"
        if (id === "audio_") return "tools.audio"
        if (id === "meta_") return "tools.metadata"
        if (id === "timer_") return "items.timer"
        if (id === "rss_") return "settings.rss"
        if (id === "$") return "items.variable"
        return ""
    }

    let defaultValues = clone(values)
    $: if (defaultValues) search()

    let searchedValues = clone(defaultValues)
    let searchValue = ""
    // let previousSearchValue = ""
    let resetInput = false
    function search(value = "") {
        if (value.length && !showAll) toggleShowAll()

        searchValue = formatSearch(value.replaceAll(" ", "_"))

        if (searchValue.length < 2) {
            searchedValues = clone(defaultValues)
            return
        }

        let currentValuesList = clone(defaultValues) // searchedValues
        // reset if search value changed
        // if (!searchValue.includes(previousSearchValue)) currentValuesList = clone(defaultValues)

        searchedValues = {
            search: Object.values(currentValuesList)
                .flat()
                .filter((a) => formatSearch(a.id).includes(searchValue))
        }

        // previousSearchValue = searchValue
    }

    function applyValue(e: any, id = "", texto = "") {
        if (!id && !texto) {
            if (e.key !== "Enter" || searchValue.length < 2) return
            if (avancado) id = Object.values(searchedValues)[0]?.[0]?.id
            else {
                const primeira = gruposPt[0]?.opcoes[0]
                if (primeira) texto = textoDaOpcao(primeira)
            }
        }
        if (!id && !texto) return

        const contextElem = (obj.contextElem as HTMLElement | null) || null
        const contextEditItem = contextElem?.closest(".editItem") as HTMLElement | null
        let isStage = !!contextElem?.closest(".stage_item")
        if (!contextEditItem && !isStage) return

        let edit = $activeEdit
        const selectedItemIndex = edit.items?.[0] ?? Number(contextEditItem?.getAttribute("data-index") || 0)

        if (isStage) {
            let activeItemId = $activeStage?.items[0]
            if (!$stageShows[$activeStage.id!] || !activeItemId) return

            stageShows.update((a) => {
                a[$activeStage.id!].items[activeItemId] = updateItemText(a[$activeStage.id!]?.items[activeItemId])
                a[$activeStage.id!].modified = Date.now()
                return a
            })

            refreshEditSlide.set(true)
            finish()
            return
        }

        if (edit.id) {
            if (edit.type === "overlay") {
                overlays.update((a) => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    a[edit.id!].modified = Date.now()
                    return a
                })
            } else if (edit.type === "template") {
                templates.update((a) => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    a[edit.id!].modified = Date.now()
                    return a
                })
            }

            refreshEditSlide.set(true)
            finish()
            return
        }

        let showId = $activeShow?.id || ""
        let ref = getLayoutRef(showId)
        let slideId = ref[edit.slide || 0]?.id || ""

        showsCache.update((a) => {
            if (!a[showId]?.slides?.[slideId]) return a

            a[showId].slides[slideId].items = updateItemText(a[showId].slides[slideId].items)
            return a
        })

        refreshEditSlide.set(true)
        finish()

        function updateItemText(items) {
            let replaced = false
            const caretLine = Number.isFinite(caret.line) ? caret.line : 0
            let caretPos = Number.isFinite(caret.pos) ? caret.pos : 0

            let lines = items[selectedItemIndex]?.lines || []
            if (isStage) lines = items?.lines || []
            const lineIndex = lines[caretLine]?.text ? caretLine : 0

            lines[lineIndex]?.text?.forEach((text) => {
                if (replaced) return

                let value = text.value
                if (value.length < caretPos) {
                    caretPos -= value.length
                    return
                }

                let valueIdString = texto || dynamicValueText(id)
                let newValue = value.slice(0, caretPos) + valueIdString + value.slice(caretPos)
                text.value = newValue
                replaced = true

                // if applying multiple
                caret.pos = caretPos + valueIdString.length
            })

            return items
        }

        function finish() {
            if (e.ctrlKey) {
                resetInput = true
                setTimeout(() => (resetInput = false))
                searchValue = ""
                buscaBruta = ""
                search()
            } else {
                activePopup.set(null)
            }
        }
    }

    // custom ref
    const ref = { showId: $activeShow?.id, layoutId: _show().get("settings.activeLayout"), slideIndex: $activeEdit.slide, type: $activePage === "stage" ? "stage" : $activeEdit.type || "show", id: $activeEdit.id, mode }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    const dynamicInterval = setInterval(() => {
        updateDynamic++
    }, 1000)
    onDestroy(() => clearInterval(dynamicInterval))
</script>

<svelte:window on:keydown={applyValue} />

<MaterialButton class="popup-reset" icon="edit" iconSize={1.1} title="create_show.more_options" on:click={() => activePopup.set("manage_dynamic_values")} white />

{#if avancado}
    <MaterialButton class="popup-options {showAll ? 'active' : ''}" icon={showAll ? "eye" : "hide"} iconSize={1.3} title={showAll ? "actions.close" : "create_show.more_options"} on:click={toggleShowAll} white />
{/if}

{#key resetInput}
    <MaterialTextInput
        label="main.search"
        value=""
        on:input={(e) => {
            buscaBruta = e.detail
            search(e.detail)
        }}
        autofocus
    />
{/key}

<div class="modo" role="group" aria-label="Como mostrar">
    <button type="button" class:sel={!avancado} data-acao="valores-pt" on:click={() => (avancado = false)}>Em português</button>
    <button type="button" class:sel={avancado} data-acao="valores-codigos" on:click={() => (avancado = true)}>Todos os códigos (avançado)</button>
</div>

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if !avancado}
        {#if gruposPt.length}
            <div class="list">
                {#each gruposPt as g (g.id)}
                    <p class="grupo">{g.rotulo}</p>
                    <div class="grid pt">
                        {#each g.opcoes as o (o.id)}
                            {@const previa = replaceDynamicValues(o.partes.join(o.emLinhas ? " · " : ""), ref, updateDynamic, true)}
                            <div class="value pt" role="button" tabindex="0" data-acao="valor-pt" data-valor={o.id} title="Clique para pôr na caixa, no lugar do cursor" on:click={(e) => applyValue(e, "", textoDaOpcao(o))} on:keydown={triggerClickOnEnterSpace}>
                                <p class="rotulo">{o.rotulo}</p>
                                <p class="previa">
                                    {#if previa && previa.trim()}{@html previa}{:else if o.exemplo}<span class="ex">ex.: {o.exemplo}</span>{:else}<span class="ex">— (sem valor agora)</span>{/if}
                                </p>
                            </div>
                        {/each}
                    </div>
                {/each}
                <p class="dica">Ctrl + clique põe mais de um sem fechar. Para ligar a caixa inteira a um valor, use “Texto ligado” no painel da direita.</p>
            </div>
        {:else}
            <Center size={1.2} faded style="height: 100px;padding-top: 20px;">Nada com esse nome.</Center>
        {/if}
    {:else if Object.values(searchedValues)[0]?.length}
        <div class="list" style={searchValue.length > 1 ? "margin-top: 10px;" : ""}>
            {#each Object.entries(searchedValues) as [key, values]}
                {#if key !== "search" && !hidden.includes(key.slice(0, -1))}
                    <HRule title={getTitle(key)} />
                {/if}

                <div class="grid">
                    {#each values as value, i}
                        {@const preview = replaceDynamicValues(`{${value.id}}`, ref, updateDynamic, true)}
                        <div class="value" class:active={searchValue.length > 1 && i === 0 ? "border: 2px solid var(--secondary-opacity);" : ""} role="button" tabindex="0" on:click={(e) => applyValue(e, value.id)} on:keydown={triggerClickOnEnterSpace}>
                            <p class="preview">
                                {#if preview}{@html preview}{:else}—{/if}
                            </p>

                            <p style="display: inline-flex;" data-title={value.id}>
                                <span style="color: var(--secondary);">{"{"}</span>
                                {#if value.id.startsWith("$")}
                                    <span style="color: var(--secondary);">{"$"}</span>
                                    {value.id.slice(1)}
                                {:else}
                                    {value.id}
                                {/if}
                                <span style="color: var(--secondary);">{"}"}</span>
                            </p>
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    {:else}
        <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
            {#if values.length}
                <T id="empty.search" />
            {:else}
                <T id="empty.general" />
            {/if}
        </Center>
    {/if}
</div>

<style>
    .modo {
        display: flex;
        gap: 4px;
        margin: 8px 0 4px;
    }
    .modo button {
        height: 28px;
        padding: 0 12px;
        border: 1px solid var(--luz-borda, var(--primary-lighter));
        border-radius: 14px;
        background: transparent;
        color: var(--luz-mudo, var(--text));
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .modo button.sel {
        background: var(--luz-texto, var(--secondary));
        color: var(--luz-tinta, var(--primary));
        font-weight: 600;
    }
    .grupo {
        margin: 10px 0 4px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.7;
    }
    .grid.pt {
        justify-content: flex-start;
    }
    .value.pt {
        align-items: flex-start;
        gap: 4px;
        width: 220px;
        cursor: pointer;
    }
    .value.pt .rotulo {
        font-weight: 600;
        white-space: normal;
    }
    .value.pt .previa {
        font-size: 0.9em;
        opacity: 0.85;
        white-space: normal;
        max-height: 60px;
        overflow: hidden;
    }
    .ex {
        font-style: italic;
        opacity: 0.6;
    }
    .dica {
        margin-top: 12px;
        font-size: 12px;
        opacity: 0.6;
    }
    .list {
        display: flex;
        flex-direction: column;
        padding: 5px;
    }

    .grid {
        display: flex;
        justify-content: center;
        /* place-content: flex-start; */
        flex-wrap: wrap;
        gap: 5px;
    }

    .value {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        gap: 10px;

        border-radius: 4px;

        background-color: var(--primary-darkest);
        padding: 10px;

        max-width: 500px;
    }

    .value.active {
        outline: 2px solid var(--secondary-opacity);
        outline-offset: 0;
    }
    .value:active {
        outline: 2px solid var(--secondary);
        outline-offset: 0;
    }
    .value:focus {
        outline: 2px solid var(--secondary);
        outline-offset: 0;
    }

    .preview {
        font-weight: bold;
        font-size: 1.2em;
        text-align: center;
        white-space: initial;
        max-height: 200px;
    }
</style>
