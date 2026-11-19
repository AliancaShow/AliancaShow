<script lang="ts">
    // Cabine 18/nov, C6: a linha QUIETA de "＋ categoria" / "＋ pasta" no fim dos filhos da arvore (no lugar do botao largo contornado).
    export let rotulo = ""
    export let titulo = ""
    export let desligada = false
</script>

<button type="button" class="add" tabindex="-1" disabled={desligada} data-title={titulo || rotulo} data-acao="arvore-add" on:mousedown|preventDefault on:click>＋ {rotulo}</button>

<style>
    .add {
        width: 100%;
        height: 26px;
        display: flex;
        align-items: center;
        padding: 0 8px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        text-align: left;
        color: var(--luz-mudo);
        cursor: pointer;
    }
    .add:hover:not(:disabled) {
        background: var(--luz-hover);
        color: var(--luz-texto);
    }
    .add:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
