<script lang="ts">
    // Cabine 27/nov: exibicao da pasta Shows, no mesmo icone da Midia. "Colunas" = os nomes em colunas de 300 px (com o cantor discreto ao
    // lado); "Lista" = uma linha por musica com Cantor, Categoria, Ultima vez no ar e Criada, ordenavel pelo cabecalho. Fica em drawerTabsData.
    import { drawerTabsData } from "../../stores"

    $: lista = ($drawerTabsData.shows as any)?.aliancaExibicao === "lista"
    function modo(m: "colunas" | "lista") {
        drawerTabsData.update((a) => {
            a.shows = { ...(a.shows || { enabled: true, activeSubTab: "all" }), aliancaExibicao: m } as any
            return a
        })
        aberto = false
    }

    let aberto = false
    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement).closest?.(".exibicaoShows")) aberto = false
    }
</script>

<svelte:window on:mousedown={fora} />

<div class="menuRaiz exibicaoShows" data-acao="shows-controles">
    <button class="ico" data-acao="shows-exibicao" data-title="Exibição" aria-label="Exibição" aria-haspopup="menu" aria-expanded={aberto} tabindex="-1" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>
        {#if lista}
            <svg class="funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z" /></svg>
        {:else}
            <svg class="funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h8v2H3zm10 0h8v2h-8zM3 11h8v2H3zm10 0h8v2h-8zM3 17h8v2H3zm10 0h8v2h-8z" /></svg>
        {/if}
    </button>
    {#if aberto}
        <div class="pop direita" role="menu">
            <div class="sec">Ver como</div>
            <button class="item" role="menuitemradio" aria-checked={!lista} data-acao="shows-colunas" tabindex="-1" on:mousedown|preventDefault on:click={() => modo("colunas")}><span class="ck">{!lista ? "✓" : ""}</span>Colunas</button>
            <button class="item" role="menuitemradio" aria-checked={lista} data-acao="shows-lista" tabindex="-1" on:mousedown|preventDefault on:click={() => modo("lista")}><span class="ck">{lista ? "✓" : ""}</span>Lista com detalhes</button>
        </div>
    {/if}
</div>
