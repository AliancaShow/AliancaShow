<script lang="ts">
    // Leiaute v2, fatia 3: as NOTAS do slide e do show, nas propriedades de Editar (decisao 7: notas moram so aqui). Gravam em `slide.notes` e na nota do
    // layout ativo, as mesmas que o Culto mostra. Nada aqui escreve em `outputs`.
    import { activeEdit, activeShow, showsCache } from "../../stores"
    import { gravarNotaDoShow, gravarNotaDoSlide } from "../../utils/aliancaNotas"
    import { getAccess } from "../../utils/profile"
    import { getLayoutRef } from "../helpers/show"
    import Notes from "../show/tools/Notes.svelte"

    $: showId = (($activeShow?.type === undefined || $activeShow?.type === "show" ? $activeShow?.id : "") || ($activeEdit as any).showId || "") as string
    $: show = showId ? $showsCache[showId] : undefined
    $: ref = showId && show ? getLayoutRef(showId, show) : []
    $: indice = typeof $activeEdit.slide === "number" ? $activeEdit.slide : null
    $: slideId = indice !== null ? ref[indice]?.id || "" : ""
    $: notaSlide = slideId ? show?.slides?.[slideId]?.notes || "" : ""
    $: notaShow = (show?.layouts?.[show?.settings?.activeLayout || ""] as any)?.notes || ""

    const profile = getAccess("shows")
    $: travado = !!(show?.locked || profile.global === "read" || profile[show?.category || ""] === "read")
</script>

{#if show}
    <div class="notas" data-acao="editar-notas">
        <div class="rot">Nota do slide</div>
        {#if slideId}
            {#key slideId}
                <div class="caixa" data-acao="editar-nota-slide"><Notes value={notaSlide} lines={3} placeholder="Recado para quem toca neste slide" disabled={travado} on:edit={(e) => gravarNotaDoSlide(showId, slideId, notaSlide, e.detail)} /></div>
            {/key}
        {:else}
            <div class="vazio">Selecione um slide.</div>
        {/if}
        <div class="rot">Nota do show</div>
        {#key showId}
            <div class="caixa" data-acao="editar-nota-show"><Notes value={notaShow} lines={3} placeholder="Recado para o show inteiro" disabled={travado} on:edit={(e) => gravarNotaDoShow(showId, notaShow, e.detail)} /></div>
        {/key}
    </div>
{/if}

<style>
    .notas {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 8px;
    }
    .rot {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .caixa {
        height: 76px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        font-size: 13px;
        overflow: hidden;
        display: flex;
    }
    .caixa :global(.paper) {
        background: transparent;
    }
    .vazio {
        font-size: 12px;
        color: var(--luz-mudo);
    }
</style>
