<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import ItemsList from "./ItemsList.svelte"

    export let allSlideItems: Item[]
    // Preparar (8b): as Camadas ja estao no topo do painel
    export let semCamadas = false
</script>

<div class="tools">
    {#if !semCamadas}
        <ItemsList bind:allSlideItems />
    {/if}
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }
</style>
