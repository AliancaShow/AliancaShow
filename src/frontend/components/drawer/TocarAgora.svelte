<script lang="ts">
    // Leiaute v2, fatia 6 (correcoes da revisao): o ▶ de uma porta da biblioteca. Na biblioteca o clique simples so seleciona; ir ao ar e este botao, o
    // Ctrl+Enter ou o botao direito -> "Mostrar agora". O gesto levanta a guarda da biblioteca (`autorizarAr`) so durante o evento `tocar`, de forma sincrona:
    // quem escuta `on:tocar` roda o mesmo caminho do antigo clique, com a guarda de sempre na primeira linha.
    import { createEventDispatcher } from "svelte"
    import { autorizarAr } from "../../utils/aliancaGavetaToque"

    export let titulo = "Mandar ao ar"
    export let desligado = false
    // dentro de um cartao: canto do cartao, por cima da miniatura; fora (linha): ao lado, como o ▶ do audio
    export let flutuante = false

    const dispatch = createEventDispatcher()
    function tocar() {
        if (desligado) return
        autorizarAr(() => dispatch("tocar"))
    }
</script>

<button type="button" class="tocarAgora" class:flutuante data-acao="tocar-ao-ar" aria-label={titulo} data-title={titulo} tabindex="-1" disabled={desligado} on:mousedown|preventDefault|stopPropagation on:dblclick|stopPropagation on:keydown|stopPropagation on:click|stopPropagation={tocar}>▶</button>

<style>
    .tocarAgora {
        flex: none;
        width: 28px;
        height: 28px;
        border: 1px solid var(--luz-borda, rgb(248 248 240 / 0.13));
        border-radius: 6px;
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
        color: var(--luz-texto, #f8f8f0);
        cursor: pointer;
    }
    .tocarAgora:hover:not(:disabled) {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .tocarAgora:disabled {
        opacity: 0.4;
        cursor: default;
    }
    /* o cartao de um componente que a saida tambem usa (tocavel.ts) ainda desenha o ▶ grande de hover ("clique toca"): escondido */
    :global(.card.soSeleciona .overlayIcon) {
        display: none;
    }
    .flutuante {
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 2;
        background: rgb(0 0 0 / 0.55);
    }
</style>
