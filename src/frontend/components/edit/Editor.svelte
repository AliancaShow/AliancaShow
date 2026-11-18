<script lang="ts">
    import { onMount } from "svelte"
    import { activeEdit, activePopup, activeShow, cloudUsers, editMode, focusMode, refreshEditSlide, showsCache } from "../../stores"
    import { isActiveShowInUseByCloudUser } from "../../utils/cloudSync"
    import { edicaoDoItemMostrado } from "../../utils/aliancaEditarLogica"
    import { getAccess } from "../../utils/profile"
    import Icon from "../helpers/Icon.svelte"
    import { getLayoutRef } from "../helpers/show"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Splash from "../main/Splash.svelte"
    import TextEditor from "../show/TextEditor.svelte"
    import AudioEditor from "./editors/AudioEditor.svelte"
    import CameraEditor from "./editors/CameraEditor.svelte"
    import EffectEditor from "./editors/EffectEditor.svelte"
    import MediaEditor from "./editors/MediaEditor.svelte"
    import OverlayEditor from "./editors/OverlayEditor.svelte"
    import SlideEditor from "./editors/SlideEditor.svelte"
    import TemplateEditor from "./editors/TemplateEditor.svelte"
    import { getSlideText } from "./scripts/textStyle"

    $: currentShowId = $activeShow?.id || $activeEdit.showId || ""
    $: currentShow = $showsCache[currentShowId]
    $: ref = getLayoutRef(currentShowId, currentShow)
    $: Slide = currentShow?.slides && $activeEdit.slide != null ? currentShow.slides[ref[$activeEdit.slide]?.id] : null

    $: profile = getAccess("shows")
    $: isLocked = currentShow?.locked || Slide?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    // no need to add chords on scripture/events
    $: chordsHidden = !!currentShow?.reference?.type
    $: chordsDisabled = !Slide || isLocked || !getSlideText(Slide)

    $: if ($editMode === "chords" && (chordsHidden || chordsDisabled)) editMode.set("default")

    $: if ($refreshEditSlide) {
        setTimeout(() => refreshEditSlide.set(false), 100)
    }

    // leiaute v2 (fatia 3): o botao "+ Caixa" (ItemAddMenu) mora no cabecalho do centro (nada flutua sobre o slide); as vistas (Slide, Acordes, Texto) e o zoom moram no cabecalho do centro (AliancaEditarCentro); a biblioteca nao fecha mais ao entrar aqui

    onMount(() => {
        // mainly for overlay preview
        // so tipo editavel (aliancaEditarLogica): bloco, pdf, ppt... nunca viram `activeEdit.type` (faixa de falha "editar-tipo-desconhecido", cabine 18/nov A9)
        const edicao = edicaoDoItemMostrado($activeShow as any, $activeEdit as any)
        if (edicao) activeEdit.set(edicao as any)
    })

    let hideCloudConflict = false
</script>

<div class="editor">
    {#key $refreshEditSlide}
        {#if $activeEdit.type === "overlay"}
            <OverlayEditor />
        {:else if $activeEdit.type === "template"}
            <TemplateEditor />
        {:else if $activeEdit.type === "effect"}
            <EffectEditor />

            <FloatingInputs gradient style="width: 50px;height: 50px;border: none;">
                <MaterialButton
                    class="addButton"
                    title="edit.add_items"
                    style="width: 50px;height: 50px;"
                    on:click={() => {
                        activePopup.set("effect_items")
                        // const currentEffect = $effects[$activeEdit.id || ""] || {}
                        // const nextIndex = currentEffect?.items?.length || 0
                        // if (!openedMenus[nextIndex]) openedMenus[nextIndex] = true
                    }}
                >
                    <Icon id="add" size={1.5} white />
                </MaterialButton>
            </FloatingInputs>
        {:else if $activeEdit.type === "media"}
            <MediaEditor />
        {:else if $activeEdit.type === "camera"}
            {#key $activeEdit.id}
                <CameraEditor />
            {/key}
        {:else if $activeEdit.type === "audio"}
            <AudioEditor />
        {:else if $activeEdit.slide !== undefined}
            {#if !hideCloudConflict && isActiveShowInUseByCloudUser({ $activeShow, $cloudUsers })}
                <div class="darken">
                    <p style="text-align: center;font-size: 1.5em;display: block;background-color: black;padding: 10px;border-radius: 4px;">
                        Currently in use on another computer!<br />
                        <MaterialButton variant="outlined" icon="check" on:click={() => (hideCloudConflict = true)} />
                    </p>
                </div>
            {/if}

            <div class="content">
                {#if $editMode === "text_edit" && !$focusMode}
                    <TextEditor currentShow={$showsCache[$activeShow?.id || ""]} />
                {:else}
                    <SlideEditor />
                {/if}
            </div>
        {:else}
            <Splash />
        {/if}
    {/key}
</div>

<style>
    .editor {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .content {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    .darken {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        background-color: rgba(0, 0, 0, 0.5);

        display: flex;
        align-items: center;
        justify-content: center;

        z-index: 200;
    }
</style>
