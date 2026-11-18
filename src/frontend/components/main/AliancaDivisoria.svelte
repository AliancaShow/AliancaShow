<script lang="ts">
    // Leiaute v2: divisoria arrastavel de 8 px. Nao decide nada: avisa `pegar` com o ponto de partida e quem manda e AliancaTela.
    import { createEventDispatcher } from "svelte"

    export let eixo: "v" | "h" = "v"
    export let rotulo = "Arraste para redimensionar"

    const dispatch = createEventDispatcher<{ pegar: { x: number; y: number } }>()
    function pegar(e: MouseEvent) {
        e.preventDefault()
        dispatch("pegar", { x: e.clientX, y: e.clientY })
    }
</script>

<div class="div {eixo}" role="separator" aria-orientation={eixo === "v" ? "vertical" : "horizontal"} aria-label={rotulo} data-acao="divisoria" on:mousedown={pegar}>
    <span class="alca" />
</div>

<style>
    .div {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        position: relative;
        z-index: 2;
    }
    .v {
        width: 8px;
        cursor: col-resize;
    }
    .h {
        height: 8px;
        cursor: row-resize;
    }
    .alca {
        border-radius: 1px;
        background: var(--luz-fraco);
    }
    .v .alca {
        width: 2px;
        height: 32px;
    }
    .h .alca {
        width: 32px;
        height: 2px;
    }
</style>
