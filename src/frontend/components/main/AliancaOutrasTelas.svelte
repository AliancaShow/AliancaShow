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

    // cabine 27/nov: as outras telas lado a lado, sem abas. Com abas, trocar a escolhida passava por um {#key} cujas transicoes internas
    // (OutputTransition, globais no Svelte 3) seguravam a previa antiga montada: as telas "somavam" e encolhiam uma ao lado da outra.
    // Agora cada saida monta uma vez e fica; recolher a secao continua parando todas as capturas.
    $: nome = (id: string) => $outputs[id]?.name || "Saída"
    $: resDe = (id: string, ..._deps: unknown[]) => getResolution(null, [$outputs, $styles], false, id) || { width: 1920, height: 1080 }
</script>

{#if ids.length}
    <AliancaSecaoNoAr titulo="OUTRAS TELAS" chave={CHAVE_OUTRAS} padrao={OUTRAS_ABERTA_PADRAO} conta={ids.length} acao="outras-telas">
        <div class="tela">
            <div class="grade" style="--n: {Math.min(ids.length, 3)}" data-acao="outras-telas-grade">
                {#each ids as id (id)}
                    {@const r = resDe(id, $outputs, $styles)}
                    <div class="prev" data-saida={id} title={nome(id)}>
                        <AliancaCaptura outputId={id} proporcao="{r.width}/{r.height}"><AliancaPreviaDesenhada outputId={id} /></AliancaCaptura>
                        <span class="estado">{nome(id)} · {proporcaoDaSaida(r.width, r.height)}{$outputDisplay ? "" : " · desligado"}</span>
                    </div>
                {/each}
            </div>
            <div class="espaco" aria-hidden="true"></div>
        </div>
    </AliancaSecaoNoAr>
{/if}

<style>
    .tela {
        display: flex;
        gap: 4px;
        animation: luz-descer 140ms ease-out;
    }
    .grade {
        flex-grow: 1;
        min-width: 0;
        display: grid;
        grid-template-columns: repeat(var(--n), minmax(0, 1fr));
        gap: 4px;
    }
    .prev {
        min-width: 0;
        min-height: 96px;
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
