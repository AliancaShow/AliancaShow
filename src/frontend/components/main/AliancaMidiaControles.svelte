<script lang="ts">
    // Leiaute v2, cabecalho da biblioteca na pasta Midia: modo grade/lista e tamanho dos cartoes, em `mediaOptions` (a roda do mouse com Ctrl
    // continua no MaterialZoom escondido do Media.svelte). Barra uniforme (26/nov): os tres botoes − ＋ ☰ viraram UM icone de exibicao com menu.
    import { mediaOptions } from "../../stores"

    // colunas: 10 = cartoes pequenos, 2 = grandes. O controle mostra "tamanho" (maior para a direita), entao inverte
    const MIN = 2
    const MAX = 10
    $: colunas = $mediaOptions.columns
    $: tamanho = MAX + MIN - colunas
    function mudarTamanho(e: Event) {
        const novo = MAX + MIN - Number((e.target as HTMLInputElement).value)
        if (novo !== colunas) mediaOptions.set({ ...$mediaOptions, columns: novo })
    }
    function modo(m: "grid" | "list") {
        mediaOptions.update((a) => ({ ...a, mode: m }))
    }

    let aberto = false
    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement).closest?.(".exibicaoRaiz")) aberto = false
    }
</script>

<svelte:window on:mousedown={fora} />

<div class="menuRaiz exibicaoRaiz" data-acao="midia-controles">
    <button class="ico" data-acao="midia-exibicao" data-title="Exibição" aria-label="Exibição" aria-haspopup="menu" aria-expanded={aberto} tabindex="-1" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>
        {#if $mediaOptions.mode === "list"}
            <svg class="funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z" /></svg>
        {:else}
            <svg class="funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z" /></svg>
        {/if}
    </button>
    {#if aberto}
        <div class="pop direita" role="menu">
            <div class="sec">Ver como</div>
            <button class="item" role="menuitemradio" aria-checked={$mediaOptions.mode !== "list"} data-acao="midia-grade" tabindex="-1" on:mousedown|preventDefault on:click={() => modo("grid")}><span class="ck">{$mediaOptions.mode !== "list" ? "✓" : ""}</span>Grade</button>
            <button class="item" role="menuitemradio" aria-checked={$mediaOptions.mode === "list"} data-acao="midia-lista" tabindex="-1" on:mousedown|preventDefault on:click={() => modo("list")}><span class="ck">{$mediaOptions.mode === "list" ? "✓" : ""}</span>Lista</button>
            {#if $mediaOptions.mode !== "list"}
                <div class="sec">Tamanho</div>
                <label class="tamanho">
                    <span aria-hidden="true">▫</span>
                    <input type="range" class="edit" min={MIN} max={MAX} step="1" value={tamanho} aria-label="Tamanho dos cartões" data-acao="midia-tamanho" on:input={mudarTamanho} />
                    <span aria-hidden="true">◻</span>
                </label>
            {/if}
        </div>
    {/if}
</div>

<style>
    .tamanho {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px 8px;
        color: var(--luz-mudo);
        font-size: 14px;
    }
    .tamanho input {
        flex: 1;
        accent-color: var(--luz-texto);
    }
</style>
