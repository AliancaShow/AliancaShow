<script lang="ts">
    // Leiaute v2, topo: a pilula do telao. Liga e desliga pela maquina de aliancaSaidaMenuLogica (1 s inerte, 3 s de janela, 0,8 s de
    // trava). Desligar pede confirmacao num segundo botao ("Desligar mesmo"). So mouse: Enter e Espaco nao ligam nem desligam (botao sem
    // foco por Tab; o keydown global tira o foco de qualquer BUTTON). Ctrl+O continua como esta (shortcuts.ts).
    import { onDestroy } from "svelte"
    import { get } from "svelte/store"
    import { activePage, drawSettings, drawTool, modoAlianca, outputDisplay, outputs, paintCache, settingsTab } from "../../stores"
    import { algoNoAr } from "../../utils/aliancaModo"
    import { desenhoAtivo } from "../../utils/aliancaPilulaLogica"
    import { criarMaquinaDaSaida, itemDesabilitado, ROTULO_DESLIGAR_MESMO, ROTULOS, temSaidaHabilitada, type EstadoSaida } from "../../utils/aliancaSaidaMenuLogica"
    import { toggleOutputs } from "../helpers/output"

    export let semTelaFisica = false

    let estado: EstadoSaida = "desligado"
    let raiz: HTMLElement

    // Em Mostrar liga com conteudo carregado (regra do Culto); em Editar vale a regra de hoje do Preparar.
    $: emMostrar = $activePage === "show"

    const maquina = criarMaquinaDaSaida({
        ligar: () => toggleOutputs(null, { state: true }),
        desligar: () => toggleOutputs(null, { state: false }),
        abrirConfig: () => {
            settingsTab.set("display_settings")
            activePage.set("settings")
        },
        fecharMenu: () => {},
        ler: () => {
            const mostrar = get(activePage) === "show"
            return { outputDisplay: !!get(outputDisplay), semTelaFisica, temSaida: temSaidaHabilitada(get(outputs) as any), noAr: mostrar ? false : algoNoAr(), desenho: mostrar ? false : desenhoAtivo(get(drawTool), get(drawSettings), get(paintCache) as any) }
        },
        aoMudar: (s) => (estado = s)
    })
    $: ($outputDisplay, $outputs, $drawTool, $drawSettings, $paintCache, $activePage, $modoAlianca, semTelaFisica, maquina.mundoMudou())
    onDestroy(() => maquina.destruir())

    // cronometro "Telao no ar · mm:ss": comeca quando a saida entra no ar e zera quando sai
    let noArDesde = 0
    let tempoNoAr = "00:00"
    let cronometro: ReturnType<typeof setInterval> | null = null
    function atualizar() {
        if (!noArDesde) return
        const total = Math.floor((Date.now() - noArDesde) / 1000)
        const h = Math.floor(total / 3600)
        const m = Math.floor((total % 3600) / 60)
        tempoNoAr = (h ? h + ":" : "") + `${m}`.padStart(2, "0") + ":" + `${total % 60}`.padStart(2, "0")
    }
    function parar() {
        if (cronometro) clearInterval(cronometro)
        cronometro = null
        noArDesde = 0
    }
    $: if ($outputDisplay) {
        if (!cronometro) {
            noArDesde = Date.now()
            atualizar()
            cronometro = setInterval(atualizar, 1000)
        }
    } else if (cronometro) parar()
    onDestroy(parar)

    $: pergunta = estado === "perguntando" || estado === "armado"
    $: ligado = estado === "ligado" || pergunta || estado === "desligando"
    $: rotulo = estado === "ligado" || pergunta || estado === "desligando" ? (estado === "desligando" ? "Desligando…" : `Telão no ar · ${tempoNoAr}`) : estado === "ligando" ? "Ligando…" : estado === "semResposta" ? "O telão não respondeu" : estado === "semTela" ? "Sem tela de saída" : "Ligar telão"
    $: dica = estado === "desligadoNoAr" || estado === "desligadoDesenho" ? ROTULOS[estado].replace("pelo Culto", "em Mostrar") : estado === "semResposta" ? ROTULOS[estado].replace("o botão do Culto", "o botão de Mostrar").replace("Use o botão do Culto.", "Tente de novo em Mostrar.") : ROTULOS[estado]
    $: desabilitada = itemDesabilitado(estado) && estado !== "semResposta"

    function fora(e: MouseEvent) {
        if (pergunta && !raiz?.contains(e.target as Node)) maquina.cancelar()
    }
    function tecla(e: KeyboardEvent) {
        if (pergunta && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            maquina.cancelar()
        }
    }
    if (typeof window !== "undefined") window.addEventListener("keydown", tecla, true)
    onDestroy(() => typeof window !== "undefined" && window.removeEventListener("keydown", tecla, true))
    void emMostrar
</script>

<svelte:window on:mousedown={fora} />

<div class="raiz" bind:this={raiz}>
    <button class="telao" class:ligado class:erro={estado === "semResposta"} class:desabilitada data-acao="telao" data-estado={estado} aria-disabled={desabilitada} tabindex="-1" data-title={dica} on:mousedown|preventDefault on:click={() => maquina.cliqueNoItem()}>
        <span class="ponto" />
        <span>{rotulo}</span>
    </button>
    {#if pergunta}
        <div class="pop" role="dialog" aria-label="Desligar o telão?">
            <div class="titulo">Desligar o telão?</div>
            <button class="mesmo" class:inerte={estado === "perguntando"} data-item="desligar-mesmo" aria-disabled={estado === "perguntando"} tabindex="-1" on:mousedown|preventDefault on:click={() => maquina.cliqueDesligarMesmo()}>{ROTULO_DESLIGAR_MESMO}</button>
        </div>
    {/if}
</div>

<style>
    .raiz {
        position: relative;
    }
    .telao {
        height: 40px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
        border-radius: 20px;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        background: var(--luz-campo);
        color: var(--luz-texto);
        border: 1px solid var(--luz-borda-forte);
        font-variant-numeric: tabular-nums;
    }
    .telao .ponto {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: var(--luz-fraco);
    }
    .telao.ligado {
        background: var(--luz-vermelho);
        color: #fff;
        border-color: var(--luz-vermelho);
    }
    .telao.ligado .ponto {
        background: var(--luz-campo);
    }
    .telao.erro {
        border-color: var(--luz-vermelho);
        color: #ff9aa0;
    }
    .telao.desabilitada {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .pop {
        position: absolute;
        z-index: 40;
        top: 46px;
        right: 0;
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: 12px;
        box-shadow: inset 0 0 0 1px var(--luz-borda), 0 18px 40px rgba(0, 0, 0, 0.5);
        transform-origin: top right;
        animation: luz-surgir 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .titulo {
        font-size: 13px;
        font-weight: 600;
    }
    .mesmo {
        height: 40px;
        border: 1px solid var(--luz-vermelho);
        border-radius: 8px;
        background: var(--luz-vermelho);
        color: #fff;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }
    .mesmo.inerte {
        opacity: 0.35;
        cursor: not-allowed;
    }
</style>
