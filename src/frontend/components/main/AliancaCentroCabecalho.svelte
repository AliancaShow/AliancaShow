<script lang="ts">
    // Leiaute v2, centro de Mostrar: o cabecalho de 48 px (item aberto, "depois: ...", "AO VIVO · a igreja ve este item" e a dica).
    import { activeProject, activeShow, outputDisplay, outputs, projects, shows } from "../../stores"
    import { noAr } from "../../utils/aliancaModo"
    import { getFileName, removeExtension } from "../helpers/media"
    import AliancaCentroMais from "./AliancaCentroMais.svelte"

    const nomeDe = (item: { id?: string; type?: string; name?: string } | null | undefined, _shows?: unknown): string => {
        if (!item?.id) return ""
        if ((item.type || "show") === "show") return $shows[item.id]?.name || item.name || ""
        return item.name || removeExtension(getFileName(item.id)) || ""
    }

    $: atual = nomeDe($activeShow as any, $shows)
    $: lista = ($activeProject ? $projects[$activeProject]?.shows || [] : []).filter((a) => typeof a === "object")
    $: indice = typeof $activeShow?.index === "number" ? $activeShow.index : lista.findIndex((a) => a.id === $activeShow?.id)
    $: proximo = nomeDe(lista.slice(indice + 1).find((a) => a.type !== "section") as any, $shows)
    const lerNoAr = (_saidas: unknown) => noAr().ids
    $: noArIds = lerNoAr($outputs)
    $: aoVivo = !!$outputDisplay && !!$activeShow?.id && ($activeShow.type || "show") === "show" && noArIds.has($activeShow.id)
</script>

<div class="cab" data-acao="centro-cabecalho">
    <span class="item">{atual || "Nenhum item aberto"}</span>
    {#if atual}<span class="depois">depois: {proximo || "—"}</span>{/if}
    {#if aoVivo}<span class="vivo">AO VIVO · a igreja vê este item</span>{/if}
    <span class="dica">clique num slide = no ar · ← → avançam</span>
    <AliancaCentroMais />
</div>

<style>
    .cab {
        height: 48px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px 0 16px;
        border-bottom: 1px solid var(--luz-linha);
    }
    .item {
        font-size: 17px;
        font-weight: 600;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .depois {
        color: var(--luz-mudo);
        font-size: 13px;
        white-space: nowrap;
    }
    .vivo {
        font-size: 11px;
        font-weight: 700;
        color: var(--luz-vermelho);
        border: 1px solid var(--luz-vermelho);
        border-radius: 4px;
        padding: 2px 6px;
        white-space: nowrap;
    }
    .dica {
        margin-left: auto;
        font-size: 12px;
        color: var(--luz-mudo);
        white-space: nowrap;
    }
</style>
