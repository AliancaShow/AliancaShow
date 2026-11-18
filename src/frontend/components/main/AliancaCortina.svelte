<script lang="ts">
    // Leiaute v2, fatia 4: o "clique fora" dos popovers do topo. A regiao de arrastar do topo e a barra de botoes nativos nao entregam
    // `mousedown` ao DOM, entao o ouvinte na janela nao ve o clique no topo vazio. Esta camada transparente (sem arrastar) cobre a janela
    // enquanto o popover esta aberto, recebe esse clique e pede para fechar. O popover (z-index 40) fica por cima dela.
    import { createEventDispatcher } from "svelte"
    const dispatch = createEventDispatcher<{ fechar: void }>()
</script>

<div class="cortina" role="none" data-acao="cortina" on:mousedown|preventDefault={() => dispatch("fechar")} />

<style>
    .cortina {
        position: fixed;
        inset: 0;
        z-index: 30;
        -webkit-app-region: no-drag;
    }
</style>
