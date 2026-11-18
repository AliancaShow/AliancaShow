<script lang="ts">
    // Leiaute v2, fatia 3: as propriedades de Editar (a coluna da direita). A escolha e a de sempre (MediaTools, AudioTools, EffectTools ou EditTools
    // conforme `$activeEdit.type`); `EditTools` e o painel organizado (TEXTO, CAIXA, SLIDE e o rodape de copiar/aplicar em todos), o unico. Quando o item
    // aberto e um show: a secao NOTAS (slide e show, `AliancaNotas`) e o bloco FERRAMENTAS DO SHOW com ShowTools (grupos, metadados e midia): decisao 7.
    import { activeEdit, activeShow, editMode, showsCache } from "../../stores"
    import LazyLoad from "../helpers/LazyLoad.svelte"
    import ShowTools from "../show/ShowTools.svelte"
    import AliancaNotas from "./AliancaNotas.svelte"

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
        <details class="show" data-acao="editar-notas-secao" open>
            <summary>Notas</summary>
            <AliancaNotas />
        </details>
        <details class="show" data-acao="editar-ferramentas-do-show">
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
