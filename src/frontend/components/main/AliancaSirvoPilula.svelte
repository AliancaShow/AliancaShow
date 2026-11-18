<script lang="ts">
    // Leiaute v2, topo: a pilula "Sirvo" (bolinha na cor do estado + a palavra). O texto do estado e a dica ficam no title.
    // Fatia 1: so estado; clicavel so com problema (laranja/vermelho), e o clique abre Configuracoes na conexao, como o indicador de antes.
    import { onDestroy } from "svelte"
    import { activePage, settingsTab } from "../../stores"
    import { dicaSegura } from "../../utils/aliancaDica"
    import { sirvo } from "../../utils/aliancaSirvo"
    import { calcular } from "../../utils/aliancaSirvoPilulaLogica"
    import { sirvoMaterialEstado } from "../../utils/aliancaSirvoMaterial"

    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 2_000)
    onDestroy(() => clearInterval(relogio))

    // F5 (v5): ha quanto tempo a limpeza do material esta adiada (laranja depois de 7 dias)
    let adiadaDesde = 0
    function lerAdiadaDesde(): number {
        try {
            const salvo = Number(localStorage.getItem("sirvoLimpezaAdiadaDesde"))
            if (salvo) return salvo
            localStorage.setItem("sirvoLimpezaAdiadaDesde", String(Date.now()))
        } catch {}
        return Date.now()
    }
    $: if (!$sirvoMaterialEstado.disco?.limpeza?.adiada) {
        adiadaDesde = 0
        try {
            localStorage.removeItem("sirvoLimpezaAdiadaDesde")
        } catch {}
    } else if (!adiadaDesde) adiadaDesde = lerAdiadaDesde()

    $: culto = $sirvo.cultos.find((c) => c.event_id === $sirvo.cultoId) || null
    $: visual = calcular($sirvo, culto, agoraMs, $sirvoMaterialEstado, adiadaDesde)

    function abrirConexao() {
        if (!visual?.clicavel) return
        settingsTab.set("connection")
        activePage.set("settings")
    }
</script>

{#if visual}
    <button class="sirvo {visual.tom}" data-acao="sirvo" aria-label={`Sirvo: ${visual.texto}`} data-title={dicaSegura(`${visual.texto}. ${visual.dica}`)} tabindex="-1" on:mousedown|preventDefault on:click={abrirConexao}>
        <span class="ponto" />
        Sirvo
    </button>
{/if}

<style>
    .sirvo {
        height: 32px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        border: none;
        border-radius: 16px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: default;
        color: var(--luz-mudo);
    }
    .sirvo.verde,
    .sirvo.laranja,
    .sirvo.vermelho {
        cursor: default;
    }
    .sirvo.laranja,
    .sirvo.vermelho {
        cursor: pointer;
    }
    .ponto {
        width: 7px;
        height: 7px;
        border-radius: 4px;
        background: var(--luz-mudo);
    }
    .verde {
        background: rgba(94, 196, 141, 0.14);
        color: var(--luz-verde);
    }
    .verde .ponto {
        background: var(--luz-verde);
        box-shadow: 0 0 0 3px rgba(94, 196, 141, 0.28);
    }
    .laranja {
        background: rgba(235, 166, 64, 0.14);
        color: var(--luz-laranja);
    }
    .laranja .ponto {
        background: var(--luz-laranja);
        box-shadow: 0 0 0 3px rgba(235, 166, 64, 0.28);
    }
    .vermelho {
        background: rgba(242, 26, 39, 0.14);
        color: #ff9aa0;
    }
    .vermelho .ponto {
        background: var(--luz-vermelho);
        box-shadow: 0 0 0 3px rgba(242, 26, 39, 0.28);
    }
</style>
