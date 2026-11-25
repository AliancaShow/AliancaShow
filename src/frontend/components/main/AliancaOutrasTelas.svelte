<script lang="ts">
    // Leiaute v2, coluna No ar: as outras telas (uma aba por saida habilitada alem da principal), recolhivel (25/nov: titulo OUTRAS TELAS e abas so aberta). Cabine 6 (fatia A, D28): a
    // previa e a captura ao vivo da janela daquela saida (AliancaCaptura), sem decodificar o video de novo; aba fechada = captura parada.
    import { outputDisplay, outputs } from "../../stores"
    import { getResolution } from "../helpers/output"
    import { proporcaoDaSaida } from "../../utils/aliancaCamadasLogica"
    import { styles } from "../../stores"
    import AliancaCaptura from "../output/AliancaCaptura.svelte"
    import AliancaPreviaDesenhada from "./AliancaPreviaDesenhada.svelte"
    import AliancaSecaoNoAr from "./AliancaSecaoNoAr.svelte"
    import { CHAVE_OUTRAS, OUTRAS_ABERTA_PADRAO } from "../../utils/aliancaRecadosLogica"

    export let ids: string[] = []

    let escolhida = ""
    $: if (!ids.includes(escolhida)) escolhida = ids[0] || ""
    $: nome = (id: string) => $outputs[id]?.name || "Saída"
    $: res = escolhida ? getResolution(null, [$outputs, $styles], false, escolhida) : { width: 1920, height: 1080 }
    $: prop = proporcaoDaSaida(res.width, res.height)
</script>

{#if ids.length}
    <AliancaSecaoNoAr titulo="OUTRAS TELAS" chave={CHAVE_OUTRAS} padrao={OUTRAS_ABERTA_PADRAO} conta={ids.length} acao="outras-telas">
        <div class="abas" role="tablist" aria-label="Outras telas">
            {#each ids as id (id)}
                <button role="tab" class="aba" class:on={id === escolhida} aria-selected={id === escolhida} tabindex="-1" on:mousedown|preventDefault on:click={() => (escolhida = id)} title={nome(id)}>{nome(id)}</button>
            {/each}
        </div>
        {#if escolhida}
            <div class="tela">
                <div class="prev">
                    {#key escolhida}<AliancaCaptura outputId={escolhida} proporcao="{res.width}/{res.height}"><AliancaPreviaDesenhada outputId={escolhida} /></AliancaCaptura>{/key}
                    <span class="estado">{nome(escolhida)} · {prop}{$outputDisplay ? "" : " · desligado"}</span>
                </div>
                <div class="espaco" aria-hidden="true"></div>
            </div>
        {/if}
    </AliancaSecaoNoAr>
{/if}

<style>
    .abas {
        flex-grow: 1;
        min-width: 0;
        display: flex;
        gap: 2px;
        padding: 2px;
        background: var(--luz-trilho);
        border-radius: 7px;
    }
    .aba {
        flex: 1 1 0;
        min-width: 0;
        height: 26px;
        border: none;
        border-radius: 5px;
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: transparent;
        color: var(--luz-mudo);
        transition: background 120ms;
    }
    .aba.on {
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .tela {
        display: flex;
        gap: 4px;
        animation: luz-descer 140ms ease-out;
    }
    .prev {
        flex-grow: 1;
        min-width: 0;
        min-height: 168px;
        max-height: 168px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0b0b0a;
        border-radius: 6px;
        overflow: hidden;
        padding: 3px;
        box-sizing: border-box;
        box-shadow: 0 0 0 1px var(--luz-borda);
        position: relative;
    }
    /* a coluna de 30 px da faixa de camadas: a outra tela fica do MESMO tamanho da principal */
    .espaco {
        width: 30px;
        flex-shrink: 0;
    }
    .estado {
        position: absolute;
        left: 8px;
        bottom: 6px;
        margin: 0;
        font-size: 10px;
        color: var(--luz-fraco);
        pointer-events: none;
    }
</style>
