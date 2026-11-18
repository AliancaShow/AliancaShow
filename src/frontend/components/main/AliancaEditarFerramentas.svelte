<script lang="ts">
    // Leiaute v2, fatia 1, commit 9 (provisorio, diferenca declarada D1): a coluna da direita de Editar com as pecas de hoje, sem acabamento.
    // A escolha e a de MainLayout (MediaTools, AudioTools, EffectTools ou EditTools conforme `$activeEdit.type`) e, quando o item aberto e um
    // show, um <details> fechado "Ferramentas do show" com ShowTools (P4: grupos, notas, metadados e midia do show moram so aqui).
    // Editar na forma final (propriedades na ordem do prototipo, selos, faixa de pendencia) e da fatia 3.
    import { activeEdit, activeShow, editMode, showsCache } from "../../stores"
    import LazyLoad from "../helpers/LazyLoad.svelte"
    import ShowTools from "../show/ShowTools.svelte"

    $: ehShow = !!$activeShow && ($activeShow.type === "show" || $activeShow.type === undefined)
    $: tipo = $activeEdit.type
    $: temShow = !!$showsCache[$activeShow?.id || ""]
</script>

<div class="ferr" data-acao="editar-ferramentas">
    {#if tipo === "media" || tipo === "camera"}
        <LazyLoad component={() => import("../edit/MediaTools.svelte")} show={true} />
    {:else if tipo === "audio"}
        <LazyLoad component={() => import("../edit/AudioTools.svelte")} show={true} />
    {:else if tipo === "effect"}
        <LazyLoad component={() => import("../edit/EffectTools.svelte")} show={true} />
    {:else if tipo === "overlay" || tipo === "template" || temShow}
        {#if (tipo || "show") === "show" && $editMode !== "default"}
            <!-- nada -->
        {:else}
            <LazyLoad component={() => import("../edit/EditTools.svelte")} show={true} />
        {/if}
    {/if}

    {#if ehShow}
        <details class="show">
            <summary>Ferramentas do show</summary>
            <ShowTools />
        </details>
    {/if}
</div>

<style>
    .ferr {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: auto;
        margin: -12px;
    }
    .show {
        border-top: 1px solid var(--luz-linha);
        padding: 8px 12px;
    }
    summary {
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
</style>
