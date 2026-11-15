<script lang="ts">
    import { drawerTabsData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"

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
        <button type="button" class:ligado={ligados.includes(o.id)} aria-pressed={ligados.includes(o.id)} data-filtro={o.id} on:click={() => alternar(o.id)}>
            <Icon id={o.icone} size={0.9} white />
            {o.rotulo}
        </button>
    {/each}
</div>

<style>
    /* sobre o rodape da grade, acima da barra de zoom (que fica em bottom: 12px, 40px de altura) */
    .filtros {
        display: flex;
        gap: 6px;
        padding: 4px 6px;
        position: absolute;
        left: 12px;
        bottom: 60px;
        z-index: 199;
        border-radius: 999px;
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);
    }
    button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        border: 1px solid var(--primary-lighter);
        background: transparent;
        color: var(--text);
        font-size: 0.8em;
        opacity: 0.7;
    }
    button:hover {
        opacity: 1;
    }
    button.ligado {
        opacity: 1;
        background: var(--secondary-opacity);
        border-color: var(--secondary);
    }
</style>
