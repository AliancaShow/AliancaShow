<script lang="ts">
    import { drawerTabsData } from "../../../stores"

    // AliançaShow (Preparar F7): os filtros Vídeo · Áudio · Foto no rodapé da gaveta de mídia. Nenhum ligado = aparece tudo. Valem nos dois modos.
    type Tipo = "video" | "audio" | "image"
    const opcoes: { id: Tipo; rotulo: string; icone: string }[] = [
        { id: "video", rotulo: "Vídeo", icone: "movie" },
        { id: "audio", rotulo: "Áudio", icone: "music" },
        { id: "image", rotulo: "Foto", icone: "image" }
    ]

    $: ligados = ($drawerTabsData.media?.aliancaFiltro || []) as Tipo[]

    function alternar(id: Tipo) {
        drawerTabsData.update((a) => {
            if (!a.media) a.media = { enabled: true, activeSubTab: null }
            const atual = a.media.aliancaFiltro || []
            a.media.aliancaFiltro = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
            return a
        })
    }
</script>

<div class="filtros" role="group" aria-label="Filtrar por tipo">
    {#each opcoes as o}
        <button type="button" class:ligado={ligados.includes(o.id)} aria-pressed={ligados.includes(o.id)} data-filtro={o.id} tabindex="-1" on:mousedown|preventDefault on:click={() => alternar(o.id)}>
            {o.rotulo}
        </button>
    {/each}
</div>

<style>
    /* leiaute v2: chips no cabecalho da biblioteca (mesma forma dos chips de Shows) */
    .filtros {
        display: flex;
        gap: 8px;
    }
    button {
        height: 28px;
        padding: 0 10px;
        border-radius: 14px;
        border: 1px solid var(--luz-borda, rgb(248 248 240 / 0.13));
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
        color: var(--luz-texto, #f8f8f0);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    button.ligado {
        border-color: var(--luz-texto, #f8f8f0);
        background: var(--luz-texto, #f8f8f0);
        color: var(--luz-tinta, #161616);
    }
</style>
