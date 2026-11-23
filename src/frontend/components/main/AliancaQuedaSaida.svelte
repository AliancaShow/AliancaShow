<script lang="ts">
    // Cabine 6 (F1, vigia de queda): faixa VERMELHA na janela principal quando a janela de uma saida cai ou trava, ate ela voltar.
    // Como a FaixaDeFalha: fixa, sem clique, sem foco (pointer-events: none), logo acima dela. Cada queda tambem vai para falhaAlta (rodape
    // persistente + rastro em disco). Montada uma vez em AliancaTela (so a janela principal).
    import { onDestroy, onMount } from "svelte"
    import { ALIANCA_QUEDA_SAIDA, type QuedaSaida } from "../../../types/aliancaSaidaCanais"
    import { outputs } from "../../stores"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { aplicarAviso, comNomesAtuais, limparVencidos, linhasDoQuadro, type QuadroQuedas } from "../../utils/aliancaQuedaLogica"

    let quadro: QuadroQuedas = {}
    $: linhas = linhasDoQuadro(comNomesAtuais(quadro, $outputs))
    const ESCUTA = "alianca-queda-saida"

    function receber(aviso: QuedaSaida) {
        quadro = aplicarAviso(quadro, aviso)
        if (aviso?.estado === "caiu" || aviso?.estado === "travou" || aviso?.estado === "fora") falhaAlta("saida-" + aviso.estado + ":" + ($outputs[aviso.outputId]?.name || aviso.nome || aviso.outputId), aviso.motivo)
    }

    let relogio: ReturnType<typeof setInterval> | undefined
    onMount(() => {
        ;(window as any).api?.receive(ALIANCA_QUEDA_SAIDA, receber, ESCUTA)
        relogio = setInterval(() => (quadro = limparVencidos(quadro, Date.now())), 1000)
    })
    onDestroy(() => {
        ;(window as any).api?.removeListener(ALIANCA_QUEDA_SAIDA, ESCUTA)
        clearInterval(relogio)
    })
</script>

{#if linhas.length}
    <div class="quedas" role="alert" data-acao="queda-saida">
        {#each linhas as l (l.outputId)}
            <div class="linha" class:grave={l.grave}>{l.texto}</div>
        {/each}
    </div>
{/if}

<style>
    .quedas {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 24px;
        z-index: 100000;
        pointer-events: none;
        user-select: none;
        display: flex;
        flex-direction: column;
    }
    .linha {
        height: 32px;
        line-height: 32px;
        padding: 0 12px;
        font-size: 15px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: var(--luz-verde);
        color: var(--luz-tinta);
    }
    .linha.grave {
        background: var(--luz-vermelho);
        color: var(--luz-branco);
    }
</style>
