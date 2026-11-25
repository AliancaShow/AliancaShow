<script lang="ts">
    // Leiaute v2: a coluna da direita em Mostrar ("o que a igreja ve"): a tela principal em proporcao real com a faixa de icones colada
    // (camadas), as outras telas (abas, do mesmo tamanho), a caixa "Mensagem pro palco" e o chat do culto, que ocupa o resto. A faixa de transporte (video, audio, medidor, temporizadores, Spotify) fica logo abaixo da tela (fatia 7, D6).
    // O `Preview` antigo continua montado e escondido em AliancaTela: e ele que escuta o teclado.
    import { onDestroy, onMount } from "svelte"
    import { get } from "svelte/store"
    import { outputDisplay, outputs, styles } from "../../stores"
    import { falhas } from "../../utils/aliancaFalha"
    import { RECUSA_MS, estadoDaTarja, nomeDaRecusa, recusaNova, vezesJaVistas } from "../../utils/aliancaTarjaLogica"
    import { consumirTentativa, ligarTentativas } from "../../utils/aliancaTentativa"
    import { proporcaoDaSaida } from "../../utils/aliancaCamadasLogica"
    import { desligarSoRetorno, soRetorno } from "../../utils/aliancaSoRetorno"
    import { ROTULO_FAIXA } from "../../utils/aliancaSoRetornoLogica"
    import { saidasDasAbas } from "../../utils/aliancaTransporteLogica"
    import { getResolution } from "../helpers/output"
    import AliancaCaptura from "../output/AliancaCaptura.svelte"
    import AliancaPreviaDesenhada from "./AliancaPreviaDesenhada.svelte"
    import AliancaCamadas from "./AliancaCamadas.svelte"
    import AliancaChat from "./AliancaChat.svelte"
    import AliancaMensagemPalco from "./AliancaMensagemPalco.svelte"
    import AliancaChamadas from "./AliancaChamadas.svelte"
    import AliancaOutrasTelas from "./AliancaOutrasTelas.svelte"
    import AliancaTransporte from "./AliancaTransporte.svelte"

    // saidas habilitadas; a primeira com janela e a principal ("Telao") e a que a faixa de transporte controla (`saidasHabilitadas`), as demais viram abas
    // (A1, cabine 18/nov: a saida de rede, NDI, tambem vira aba: `saidasDasAbas`)
    $: abas = saidasDasAbas($outputs)
    $: principal = abas.principal
    $: outras = abas.outras
    $: resolucao = principal ? getResolution(null, [$outputs, $styles], false, principal) : { width: 1920, height: 1080 }
    $: proporcao = proporcaoDaSaida(resolucao.width, resolucao.height)
    // C3: a recusa do modo (falha `so-retorno-recusa`, que a linha de avisos nao mostra) escreve na tarja por 5 s; outra recusa nesse intervalo reinicia a conta e troca o nome
    let recusa: { nome: string; n: number } | null = null
    // achado 2 (PR #40): a tarja nasce vendo o contador de agora; recusa que ja existia (voltou de Editar) nao pisca de novo
    let vistas = vezesJaVistas(get(falhas))
    let relogio: ReturnType<typeof setTimeout> | undefined
    $: aviso = $falhas.find((f) => f.origem === "so-retorno-recusa")
    $: if (aviso && recusaNova(aviso.vezes, vistas)) {
        vistas = aviso.vezes
        // achado 1 (PR #40): o nome vem da tentativa gravada no clique (a recusa e sincrona); sem ela, so a 1a recusa da sessao tem mensagem confiavel
        recusa = { nome: nomeDaRecusa(consumirTentativa(), Date.now(), aviso.vezes, aviso.mensagem), n: vistas }
        clearTimeout(relogio)
        relogio = setTimeout(() => (recusa = null), RECUSA_MS)
    }
    $: if (!$soRetorno && recusa) {
        recusa = null
        clearTimeout(relogio)
    }
    let desligarTentativas = () => {}
    onMount(() => {
        desligarTentativas = ligarTentativas()
    })
    onDestroy(() => {
        clearTimeout(relogio)
        desligarTentativas()
    })
    $: estado = estadoDaTarja($soRetorno, !!recusa)
    $: nomePrincipal = $outputs[principal]?.name || "Telão"
</script>

<!-- C3: a faixa de 32 px do topo da coluna e SEMPRE a mesma: cabecalho "NO AR" (desligado), tarja laranja (so retorno) ou tarja invertida com a recusa. Mesma altura e margem nos tres: nada se desloca. -->
<div class="topo" data-acao="topo-no-ar" data-estado={estado}>
    {#if estado === "desligado"}
        <span class="rotulo">NO AR</span>
        <span class="meta">{nomePrincipal} · {proporcao}</span>
    {:else}
        {#key recusa?.n ?? 0}
            <div class="tarja" class:rec={estado === "recusa"} class:vai={estado === "recusa"} role={estado === "recusa" ? "alert" : "status"} data-acao="faixa-so-retorno">
                <svg class="ti" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    {#if estado === "recusa"}<path d="M4 4l8 8M12 4l-8 8" />{:else}<path d="M3 5.5h7v7H3zM6 3h7v7" />{/if}
                </svg>
                {#if estado === "recusa"}
                    <b class="tt">Não foi ao ar:</b><span class="ts" data-acao="tarja-recusa">{recusa?.nome}</span>
                {:else}
                    <b class="tt">{ROTULO_FAIXA}</b><span class="ts" data-acao="retorno-mostra">· telão parado</span>
                {/if}
                <button type="button" class="tb" tabindex="-1" data-acao="desligar-so-retorno" title="Volta a mandar para o telão" on:mousedown|preventDefault on:click={desligarSoRetorno}>Desligar</button>
            </div>
        {/key}
    {/if}
</div>

<div class="par">
    <div class="programa" class:ligado={$outputDisplay} data-acao="tela-principal">
        {#if principal}
            <!-- cabine 6 (fatia A, D3): captura ao vivo da janela do telao, sem decodificar o video de novo; desligado = desenho com o video em miniatura (b) -->
            {#key principal}<AliancaCaptura outputId={principal} proporcao="{resolucao.width}/{resolucao.height}"><AliancaPreviaDesenhada outputId={principal} /></AliancaCaptura>{/key}
        {:else}
            <span class="vazio">Sem saída habilitada</span>
        {/if}
    </div>
    <AliancaCamadas />
</div>

<AliancaTransporte />

<AliancaOutrasTelas ids={outras} />

<AliancaMensagemPalco />

<AliancaChamadas />

<AliancaChat />

<style>
    /* a faixa de 32 px: encosta no topo e nas laterais do painel (anula o respiro de 12 px da coluna) */
    .topo {
        flex-shrink: 0;
        height: 32px;
        margin: -12px -12px 0;
        border-radius: var(--luz-raio) var(--luz-raio) 0 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-sizing: border-box;
    }
    .tarja {
        flex: 1;
        min-width: 0;
        height: 32px;
        padding: 0 5px 0 12px;
        border-radius: var(--luz-raio) var(--luz-raio) 0 0;
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--luz-laranja);
        color: var(--luz-tinta);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        box-sizing: border-box;
    }
    .tt {
        flex-shrink: 0;
        font-weight: 700;
    }
    .ts {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
        letter-spacing: 0;
        opacity: 0.85;
    }
    .ti {
        flex-shrink: 0;
    }
    .tb {
        flex-shrink: 0;
        height: 24px;
        padding: 0 10px;
        border: 0;
        border-radius: 6px 10px 6px 6px;
        background: var(--luz-tinta);
        color: var(--luz-laranja);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0;
        cursor: pointer;
    }
    /* recusa: invertida (fundo escuro, letra e contorno laranja); pisca duas vezes em 0,9 s ao chegar */
    .tarja.rec {
        background: var(--luz-tinta);
        color: var(--luz-laranja);
        box-shadow: inset 0 0 0 2px var(--luz-laranja);
    }
    .tarja.rec .ts {
        opacity: 1;
        font-weight: 600;
    }
    .tarja.rec .tb {
        background: var(--luz-laranja);
        color: var(--luz-tinta);
    }
    .tarja.vai {
        animation: pisca 0.9s steps(1, end) 1;
    }
    @keyframes pisca {
        0%,
        40%,
        80% {
            background: var(--luz-laranja);
            color: var(--luz-tinta);
        }
        20%,
        60%,
        100% {
            background: var(--luz-tinta);
            color: var(--luz-laranja);
        }
    }
    .rotulo {
        margin-left: 12px;
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
    }
    .meta {
        margin-right: 12px;
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
        color: var(--luz-mudo);
    }
</style>
