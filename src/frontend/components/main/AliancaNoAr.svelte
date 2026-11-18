<script lang="ts">
    // Leiaute v2: a coluna da direita em Mostrar ("o que a igreja ve"): a tela principal em proporcao real com a faixa de icones colada
    // (camadas), as outras telas (abas, do mesmo tamanho), a caixa "Mensagem pro palco" e o chat do culto, que ocupa o resto. A faixa de transporte (video, audio, medidor, temporizadores, Spotify) fica logo abaixo da tela (fatia 7, D6).
    // O `Preview` antigo continua montado e escondido em AliancaTela: e ele que escuta o teclado.
    import { outputDisplay, outputs, styles } from "../../stores"
    import { proporcaoDaSaida } from "../../utils/aliancaCamadasLogica"
    import { desligarSoRetorno, soRetorno } from "../../utils/aliancaSoRetorno"
    import { ROTULO_FAIXA, SUBTITULO_FAIXA } from "../../utils/aliancaSoRetornoLogica"
    import { saidasHabilitadas } from "../../utils/aliancaTransporteLogica"
    import { getResolution } from "../helpers/output"
    import PreviewOutput from "../output/preview/PreviewOutput.svelte"
    import AliancaCamadas from "./AliancaCamadas.svelte"
    import AliancaChat from "./AliancaChat.svelte"
    import AliancaMensagemPalco from "./AliancaMensagemPalco.svelte"
    import AliancaOutrasTelas from "./AliancaOutrasTelas.svelte"
    import AliancaTransporte from "./AliancaTransporte.svelte"

    // saidas habilitadas e visiveis; a primeira e a principal ("Telao"), as demais viram abas
    // (a mesma conta da faixa de transporte logo abaixo: `saidasHabilitadas`)
    $: habilitadas = saidasHabilitadas($outputs)
    $: principal = habilitadas[0] || ""
    $: outras = habilitadas.slice(1)
    $: resolucao = principal ? getResolution(null, [$outputs, $styles], false, principal) : { width: 1920, height: 1080 }
    $: proporcao = proporcaoDaSaida(resolucao.width, resolucao.height)
    $: nomePrincipal = $outputs[principal]?.name || "Telão"
</script>

<!-- a faixa ambar SOBREPOE o cabecalho "NO AR" (position:absolute dentro do .topo): nunca entra no fluxo, nunca reserva espaco, nunca empurra a coluna (regra da casa: nada se desloca, ate o toque duplo cair no mesmo lugar) -->
<div class="topo">
{#if $soRetorno}
    <div class="faixa-retorno" role="status" data-acao="faixa-so-retorno"><span class="fr-t">{ROTULO_FAIXA}</span><span class="fr-s">{SUBTITULO_FAIXA}</span><button type="button" class="fr-b" tabindex="-1" data-acao="desligar-so-retorno" on:mousedown|preventDefault on:click={desligarSoRetorno}>Desligar</button></div>
{/if}

<div class="cab">
    <span class="rotulo">NO AR</span>
    <span class="meta">{nomePrincipal} · {proporcao}</span>
</div>
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

<AliancaTransporte />

<AliancaOutrasTelas ids={outras} />

<AliancaMensagemPalco />

<AliancaChat />

<style>
    .topo {
        position: relative;
        flex-shrink: 0;
    }
    .faixa-retorno {
        position: absolute;
        z-index: 2;
        top: -6px;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 28px;
        padding: 0 8px;
        border-radius: 6px;
        background: var(--luz-laranja);
        color: var(--luz-tinta);
        font-size: 12px;
    }
    .fr-t {
        font-weight: 700;
        letter-spacing: 0.06em;
    }
    .fr-s {
        flex-grow: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
    }
    .fr-b {
        height: 20px;
        padding: 0 8px;
        border: 1px solid var(--luz-tinta);
        border-radius: 10px;
        background: transparent;
        color: var(--luz-tinta);
        font: inherit;
        font-size: 11px;
        font-weight: 650;
        cursor: pointer;
    }
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
