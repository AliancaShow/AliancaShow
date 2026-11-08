<script lang="ts">
    import { actions, activeProject, activeShow, editingProjectTemplate, projects, projectTemplates, special } from "../../stores"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { cabecalhoTrancado, linkSeguro } from "../../utils/aliancaSirvoProjeto"
    import { translateText } from "../../utils/language"
    import { getActionIcon, runAction } from "../actions/actions"
    import { keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import InputRow from "../input/InputRow.svelte"
    import Title from "../input/Title.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialTimePicker from "../inputs/MaterialTimePicker.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import Tip from "../main/Tip.svelte"
    import Notes from "./tools/Notes.svelte"

    export let section: any

    $: isTemplate = !!$editingProjectTemplate
    $: projectId = isTemplate ? $editingProjectTemplate : $activeProject
    $: currentProject = isTemplate ? $projectTemplates[projectId || ""] : $projects[projectId || ""]

    let note = ""
    $: if ($activeShow !== null || section) updateNote()

    function updateNote() {
        note = currentProject?.shows?.[section.index]?.notes || section?.notes || ""
    }

    function edit(e: any) {
        if (section.notes === e.detail || !projectId) return
        ;(isTemplate ? projectTemplates : projects).update((a) => {
            if (!a[projectId!]?.shows) return a
            let index = a[projectId!].shows.findIndex((a) => a.id === section.id)
            if (index >= 0) a[projectId!].shows[index].notes = e.detail
            a[projectId!].modified = Date.now()
            return a
        })
    }

    function updateName(e: any) {
        updateSection("name", e.target.value || "")
    }

    function updateSection(key: string, value: any) {
        if (!projectId) return
        ;(isTemplate ? projectTemplates : projects).update((a) => {
            if (!a[projectId!]?.shows) return a
            let index = a[projectId!].shows.findIndex((a) => a.id === section.id)
            if (index >= 0) a[projectId!].shows[index][key] = value
            a[projectId!].modified = Date.now()
            return a
        })
    }

    function keydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return
        ;(document.activeElement as any)?.blur()
    }

    $: actionOptions = sortByName(keysToID($actions)).map((a) => ({ value: a.id, label: a.name }))

    function updateTrigger(e: any) {
        special.update((a) => {
            a.sectionTriggerAction = e.detail
            return a
        })
    }

    function updateTriggerLocal(e: any) {
        let actionId = e.detail
        updateSectionData("settings", { triggerAction: actionId })
    }

    function updateSectionData(key: string, value: any) {
        ;(isTemplate ? projectTemplates : projects).update((a) => {
            if (!a[projectId!]?.shows?.[section.index]) return a
            const currentData = a[projectId!].shows[section.index].data || {}
            a[projectId!].shows[section.index].data = { ...currentData, [key]: value }
            a[projectId!].modified = Date.now()
            return a
        })
    }

    let settingsOpened = false

    $: sectionUpdated = currentProject?.shows?.[section.index] || section || {}
    $: localAction = currentProject?.shows?.[section.index]?.data?.settings?.triggerAction || ""

    $: currentActionId = localAction || $special.sectionTriggerAction
    $: currentAction = currentActionId ? { ...$actions[currentActionId], id: currentActionId } : null

    // AliançaShow: cabeçalho de um bloco do Sirvo. Nome, hora e nota vêm do
    // Sirvo e ficam só para leitura; a nota NÃO vai para `notes` (lá ela vira
    // uma parada a mais no "próximo"). Texto do Sirvo só por interpolação {…}.
    $: doSirvo = !isTemplate && cabecalhoTrancado(currentProject, sectionUpdated)
    $: sirvoDados = doSirvo ? sectionUpdated?.data?.sirvo || {} : null
    $: sirvoLink = sirvoDados ? linkSeguro(sirvoDados.link) : ""
    $: sirvoHost = sirvoLink ? new URL(sirvoLink).hostname : ""

    // abre no navegador do PC, pelo processo principal (shell.openExternal); só https://
    function abrirLink() {
        const url = linkSeguro(sirvoDados?.link)
        if (url) sendMain(Main.URL, url)
    }

    $: isLocked = !!currentProject?.sectionsLocked || doSirvo
</script>

{#if settingsOpened}
    <div class="settings">
        <Title label="popup.action" icon="actions" />
        <Tip type="info" value="settings.section_trigger_action" style="justify-content: left;" bottom={10} />

        <InputRow>
            <MaterialDropdown label="groups.global" disabled={localAction && $actions[localAction]} options={actionOptions} value={$special.sectionTriggerAction} on:change={updateTrigger} allowEmpty />
            <MaterialDropdown label="groups.current" options={actionOptions} value={localAction} on:change={updateTriggerLocal} allowEmpty />
        </InputRow>
    </div>
{:else}
    {#key section}
        <InputRow>
            <h4 id="sectionTitle" class:empty={!sectionUpdated?.name} style="flex: 6;border-bottom: 1.2px solid {sectionUpdated.color || 'var(--primary-lighter)'};">
                <TextInput value={sectionUpdated?.name || ""} placeholder={translateText("main.unnamed")} disabled={isLocked} on:input={updateName} on:keydown={keydown} />
            </h4>
            <!-- WIP suggest titles based on previous titles? (maybe not needed as we have project templates) -->

            <MaterialTimePicker label="calendar.time" value={sectionUpdated?.data?.time} disabled={isLocked} style="flex: 1;height: 100%;" on:change={(e) => updateSectionData("time", e.detail)} />
        </InputRow>

        {#if sirvoDados}
            <div class="sirvo">
                <p class="origem">Vem do roteiro do Sirvo. Para mudar, mude no Sirvo.</p>

                {#if sirvoDados.responsavel}
                    <div class="campo">
                        <span class="rotulo">Responsável</span>
                        <span class="valor">{sirvoDados.responsavel}</span>
                    </div>
                {/if}
                {#if sirvoDados.duracaoMin}
                    <div class="campo">
                        <span class="rotulo">Duração</span>
                        <span class="valor">{sirvoDados.duracaoMin} min</span>
                    </div>
                {/if}
                {#if sirvoDados.nota}
                    <div class="campo nota">
                        <span class="rotulo">Nota</span>
                        <p class="valor">{sirvoDados.nota}</p>
                    </div>
                {/if}
                {#if sirvoLink}
                    <div class="campo">
                        <span class="rotulo">Link</span>
                        <MaterialButton variant="outlined" on:click={abrirLink}>
                            <Icon id="launch" white />
                            <span>Abrir link</span>
                        </MaterialButton>
                        <span class="host" data-title={sirvoLink}>{sirvoHost}</span>
                    </div>
                {:else if sirvoDados.link}
                    <div class="campo">
                        <span class="rotulo">Link</span>
                        <span class="valor fraco">O link do Sirvo não começa com https:// e não abre por aqui.</span>
                    </div>
                {/if}
                {#if !sirvoDados.responsavel && !sirvoDados.nota && !sirvoDados.link}
                    <p class="fraco">Sem responsável, nota ou link neste bloco.</p>
                {/if}
            </div>
        {:else}
            <Notes value={note} disabled={isLocked} on:edit={edit} />
        {/if}
    {/key}
{/if}

{#if currentAction && !settingsOpened}
    <FloatingInputs side="left" onlyOne>
        <MaterialButton title="actions.run_action" on:click={() => runAction(currentAction, { source: "section" })}>
            <Icon id={getActionIcon(currentActionId)} />
            {currentAction.name}
        </MaterialButton>
    </FloatingInputs>
{/if}

<FloatingInputs round>
    <MaterialButton isActive={settingsOpened} title="menu.settings" on:click={() => (settingsOpened = !settingsOpened)}>
        <Icon size={1.1} id="options" white={!settingsOpened} />
    </MaterialButton>
</FloatingInputs>

<style>
    h4 {
        font-size: 2em;
    }

    h4 :global(input) {
        background-color: var(--primary-darkest);
    }
    /* ::placeholder opacity does not work for some reason */
    h4.empty :global(input::placeholder) {
        color: rgb(255 255 255 / 0.4);
    }

    .sirvo {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 10px;
        padding: 12px 14px;
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        background-color: var(--primary-darker);
        user-select: text;
    }
    .sirvo .origem,
    .sirvo .fraco {
        opacity: 0.6;
        font-size: 0.85em;
    }
    .sirvo .campo {
        display: flex;
        align-items: baseline;
        gap: 12px;
        min-width: 0;
    }
    .sirvo .campo.nota {
        flex-direction: column;
        gap: 4px;
    }
    .sirvo .rotulo {
        flex: none;
        min-width: 90px;
        opacity: 0.6;
        font-size: 0.85em;
    }
    .sirvo .valor {
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .sirvo .nota .valor {
        white-space: pre-wrap;
        max-height: 40vh;
        overflow-y: auto;
    }
    .sirvo .host {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.6;
        font-size: 0.85em;
    }

    .settings {
        margin: 10px;
        padding: 10px;

        /* flex: 1; */
        margin-block-end: auto;
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }
</style>
