<script lang="ts">
    // Falha ALTA (fatia R2): faixa persistente no pe da janela principal. Sem botao, sem clique, sem foco: `pointer-events: none` e
    // `position: fixed` para nunca interceptar toque nem empurrar alvo (regra 4.2.2). Some so ao reabrir o programa.
    import { falhas } from "../../utils/aliancaFalha"

    $: primeira = $falhas[0]
    $: demais = $falhas.length - 1
    $: detalhe = $falhas.map((f) => `${f.origem} (${f.vezes}x): ${f.mensagem}`).join("\n")
</script>

{#if $falhas.length}
    <div class="faixaFalha" role="alert" data-title={detalhe}>
        Falha interna do AliançaShow: {primeira.origem} ({primeira.vezes}×){#if demais > 0}
            e mais {demais}{/if}. Avise quem cuida do programa.
    </div>
{/if}

<style>
    .faixaFalha {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 24px;
        z-index: 100000;
        pointer-events: none;
        user-select: none;
        background: var(--red);
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        line-height: 24px;
        padding: 0 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
