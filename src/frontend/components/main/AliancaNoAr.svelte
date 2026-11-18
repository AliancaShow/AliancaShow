<script lang="ts">
    // Leiaute v2: a coluna da direita em Mostrar ("o que a igreja ve"): a tela principal em proporcao real com a faixa de icones colada
    // (camadas), as outras telas e o chat do culto, que ocupa o resto. A caixa "Mensagem pro palco" e da fatia 8 (D7); os controles do
    // video sobre a tela sao da fatia 7 (D6). O `Preview` antigo continua montado e escondido em AliancaTela: e ele que escuta o teclado.
    import { outputDisplay, outputs, styles } from "../../stores"
    import { proporcaoDaSaida } from "../../utils/aliancaCamadasLogica"
    import { getResolution } from "../helpers/output"
    import PreviewOutput from "../output/preview/PreviewOutput.svelte"
    import AliancaCamadas from "./AliancaCamadas.svelte"
    import AliancaChat from "./AliancaChat.svelte"
    import AliancaOutrasTelas from "./AliancaOutrasTelas.svelte"

    // saidas habilitadas e visiveis; a primeira e a principal ("Telao"), as demais viram abas
    $: habilitadas = Object.entries($outputs)
        .filter(([, o]) => o?.enabled && !o?.invisible)
        .map(([id]) => id)
    $: principal = habilitadas[0] || ""
    $: outras = habilitadas.slice(1)
    $: resolucao = principal ? getResolution(null, [$outputs, $styles], false, principal) : { width: 1920, height: 1080 }
    $: proporcao = proporcaoDaSaida(resolucao.width, resolucao.height)
    $: nomePrincipal = $outputs[principal]?.name || "Telão"
</script>

<div class="cab">
    <span class="rotulo">NO AR</span>
    <span class="meta">{nomePrincipal} · {proporcao}</span>
</div>

<div class="par">
    <div class="programa" class:ligado={$outputDisplay} data-acao="tela-principal">
        {#if principal}
            <PreviewOutput outputId={principal} />
        {:else}
            <span class="vazio">Sem saída habilitada</span>
        {/if}
    </div>
    <AliancaCamadas />
</div>

<AliancaOutrasTelas ids={outras} />

<AliancaChat />

<style>
    .cab {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
    }
    .rotulo {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
    }
    .meta {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .par {
        display: flex;
        flex-shrink: 0;
        align-items: stretch;
        gap: 4px;
    }
    .programa {
        flex-grow: 1;
        min-width: 0;
        min-height: 168px;
        max-height: 168px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        border-radius: 6px;
        overflow: hidden;
        padding: 3px;
        box-sizing: border-box;
        box-shadow: 0 0 0 1px var(--luz-borda);
    }
    .programa.ligado {
        box-shadow: 0 0 0 3px var(--luz-vermelho);
    }
    .vazio {
        font-size: 11px;
        color: var(--luz-fraco);
    }
</style>
