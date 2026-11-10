<script lang="ts">
    // AliançaShow: interruptor do modo "Só no Retorno" (pacote Saídas, fatia 1).
    //
    // Fica à vista na barra da prévia (no ProPresenter era um atalho escondido).
    // Um toque liga, um toque desliga; F6 faz o mesmo. Ligado, vira uma faixa
    // laranja fixa: o operador não esquece que o público não está vendo.
    // A altura é a mesma nos dois estados: a prévia não pula.
    // Não pega foco: o operador passa slide pelo teclado.
    import { outputs } from "../../../stores"
    import { alternarModoSoRetorno } from "../../../utils/aliancaRetorno"
    import { modoSoRetornoLigado } from "../../../utils/aliancaRetornoLogica"

    $: ligado = modoSoRetornoLigado($outputs)
    $: temPalco = Object.values($outputs || {}).some((o) => o?.enabled && !!o.stageOutput)
</script>

{#if ligado}
    <div class="faixa" role="status">
        <span class="texto"><b>SÓ NO RETORNO</b> — o público não vê nem ouve o que você clicar</span>
        <button tabindex="-1" class="desligar" data-title="Volta tudo como estava. Esc também desliga, e limpa o salão e o Retorno." on:click={alternarModoSoRetorno}>Desligar · F6</button>
    </div>
{:else if temPalco}
    <div class="linha">
        <button tabindex="-1" class="ligar" data-title="O que você clicar vai só para o palco (Retorno). O público não vê nem ouve: sem som, ações nem MIDI." on:click={alternarModoSoRetorno}>
            <span class="ponto"></span>Só Retorno · F6
        </button>
    </div>
{/if}

<style>
    .linha,
    .faixa {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
        margin: 5px 5px 0;
    }

    .ligar {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        justify-content: center;
        padding: 6px 10px;
        border: 1px solid rgb(255 138 0 / 0.45);
        border-radius: 16px;
        background: transparent;
        color: #ffb36b;
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color 120ms ease;
    }
    .ligar:hover {
        background: rgb(255 138 0 / 0.12);
    }
    .ponto {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1px solid #ff8a00;
    }

    .faixa {
        padding: 4px 4px 4px 12px;
        border-radius: 16px;
        background: #ff8a00;
        color: #1a1100;
    }
    .texto {
        flex: 1;
        font-size: 11px;
        line-height: 1.25;
    }
    .desligar {
        flex-shrink: 0;
        padding: 5px 10px;
        border: 0;
        border-radius: 12px;
        background: #1a1100;
        color: #ffb36b;
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
    }
    .desligar:hover {
        background: #000;
    }
</style>
