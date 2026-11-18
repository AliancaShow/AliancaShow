<script lang="ts">
    // Leiaute v2, cabecalho da biblioteca na pasta Midia: zoom (cartoes maiores/menores) e modo grade/lista. Antes eram botoes flutuantes sobre a
    // grade (Media.svelte); agora moram aqui e escrevem em `mediaOptions`, o mesmo store (a roda do mouse com Ctrl continua no MaterialZoom escondido).
    import { mediaOptions } from "../../stores"

    const MIN = 2
    const MAX = 10
    $: colunas = $mediaOptions.columns
    function zoom(delta: number) {
        const novo = Math.max(MIN, Math.min(MAX, colunas + delta))
        if (novo !== colunas) mediaOptions.set({ ...$mediaOptions, columns: novo })
    }
    function modo() {
        mediaOptions.update((a) => ({ ...a, mode: a.mode === "grid" ? "list" : "grid" }))
    }
</script>

<div class="ctl" role="group" aria-label="Zoom e modo da mídia" data-acao="midia-controles">
    <button type="button" tabindex="-1" aria-label="Cartões menores" title="Cartões menores" disabled={colunas >= MAX} on:mousedown|preventDefault on:click={() => zoom(1)}>−</button>
    <button type="button" tabindex="-1" aria-label="Cartões maiores" title="Cartões maiores" disabled={colunas <= MIN} on:mousedown|preventDefault on:click={() => zoom(-1)}>＋</button>
    <button type="button" tabindex="-1" aria-label="Alternar grade e lista" title={$mediaOptions.mode === "grid" ? "Ver em lista" : "Ver em grade"} on:mousedown|preventDefault on:click={modo}>{$mediaOptions.mode === "grid" ? "☰" : "▦"}</button>
</div>

<style>
    .ctl {
        display: flex;
        gap: 4px;
    }
    button {
        width: 32px;
        height: 28px;
        border: 1px solid var(--luz-borda, rgb(248 248 240 / 0.13));
        border-radius: 6px;
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
        color: var(--luz-texto, #f8f8f0);
        font: inherit;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    button:disabled {
        opacity: 0.35;
        cursor: default;
    }
</style>
