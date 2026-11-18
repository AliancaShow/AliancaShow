<script lang="ts">
    // Leiaute v2, topo: a pilula do telao. Liga e desliga pela maquina de aliancaSaidaMenuLogica (1 s inerte, 3 s de janela, 0,8 s de
    // trava). Desligar pede confirmacao num segundo botao ("Desligar mesmo"). So mouse: Enter e Espaco nao ligam nem desligam (botao sem
    // foco por Tab; o keydown global tira o foco de qualquer BUTTON). Ctrl+O continua como esta (shortcuts.ts).
    import { onDestroy } from "svelte"
    import { get } from "svelte/store"
    import { activePage, drawSettings, drawTool, modoAlianca, outLocked, outputCache, outputDisplay, outputs, paintCache, settingsTab } from "../../stores"
    import { algoNoAr } from "../../utils/aliancaModo"
    import { desenhoAtivo } from "../../utils/aliancaPilulaLogica"
    import { criarMaquinaDaSaida, itemDesabilitado, ROTULO_DESLIGAR_MESMO, ROTULOS, temSaidaHabilitada, type EstadoSaida } from "../../utils/aliancaSaidaMenuLogica"
    import { toggleOutputs } from "../helpers/output"
    import { restoreOutput } from "../output/clear"

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

    // menu do telao (decisao 16): Travar saida e Restaurar saida. Abre so por clique no ▾; nada aqui toca em `outputs` sem um clique no item.
    let menuAberto = false
    // Restaurar so vale 1 s depois de limpar (a mesma carencia do botao antigo de ClearButtons: o clique que limpou nao restaura)
    let restauraPronto = false
    let tRestaura: ReturnType<typeof setTimeout> | null = null
    $: if ($outputCache) {
        restauraPronto = false
        if (tRestaura) clearTimeout(tRestaura)
        tRestaura = setTimeout(() => (restauraPronto = true), 1000)
    } else {
        restauraPronto = false
    }
    onDestroy(() => tRestaura && clearTimeout(tRestaura))
    // aviso de desenho ativo (Preencher, zoom ou tracos): o telao pode estar coberto e nada mais no topo avisaria. Era o botao vermelho de Top.svelte.
    const lerDesenho = (_a: unknown, _b: unknown, _c: unknown) => desenhoAtivo(get(drawTool), get(drawSettings), get(paintCache) as any)
    $: desenho = lerDesenho($drawTool, $drawSettings, $paintCache)
    $: podeRestaurar = !$outLocked && !!$outputCache && restauraPronto
    $: motivoRestaurar = $outLocked ? "A saída está travada." : !$outputCache ? "Não há nada limpo para restaurar." : !restauraPronto ? "Espere um instante." : ""
    $: if (pergunta) menuAberto = false
    function travar() {
        outLocked.set(!$outLocked)
        menuAberto = false
    }
    function restaurar() {
        if (!podeRestaurar) return
        restoreOutput()
        menuAberto = false
    }

    function fora(e: MouseEvent) {
        if (pergunta && !raiz?.contains(e.target as Node)) maquina.cancelar()
        if (menuAberto && !raiz?.contains(e.target as Node)) menuAberto = false
    }
    function tecla(e: KeyboardEvent) {
        if (pergunta && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            maquina.cancelar()
        } else if (menuAberto && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            menuAberto = false
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
    <button class="seta" class:aberto={menuAberto} class:desenho data-title={desenho ? "Ferramentas de desenho ativas no telão (Preencher, zoom ou traços)" : ""} data-acao="telao-menu" aria-haspopup="menu" aria-expanded={menuAberto} aria-label="Mais opções do telão" tabindex="-1" on:mousedown|preventDefault on:click={() => (menuAberto = !menuAberto)}>▾{#if desenho}<span class="aviso" data-acao="desenho-ativo" />{/if}</button>
    {#if menuAberto}
        <div class="pop menu" role="menu" data-acao="telao-menu-pop">
            <button role="menuitem" class="item" data-item="travar" class:ativo={$outLocked} tabindex="-1" on:mousedown|preventDefault on:click={travar}><span class="it">{$outLocked ? "Destravar saída" : "Travar saída"}</span><span class="sub">{$outLocked ? "libera o telão para mudar" : "nada muda no telão até destravar"}</span></button>
            <button role="menuitem" class="item" data-item="restaurar" aria-disabled={!podeRestaurar} class:inerte={!podeRestaurar} title={motivoRestaurar} tabindex="-1" on:mousedown|preventDefault on:click={restaurar}><span class="it">Restaurar saída</span><span class="sub">{podeRestaurar ? "volta o que foi limpo por último" : motivoRestaurar}</span></button>
        </div>
    {/if}
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
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .seta {
        width: 28px;
        height: 40px;
        border: 0;
        border-radius: 14px;
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .seta {
        position: relative;
    }
    .seta .aviso {
        position: absolute;
        top: 8px;
        right: 4px;
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: var(--luz-laranja);
    }
    .seta:hover,
    .seta.aberto {
        background: var(--luz-campo);
        color: var(--luz-texto);
    }
    .pop.menu {
        width: 260px;
        padding: 6px;
        gap: 2px;
    }
    .item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        padding: 8px 10px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .item:hover {
        background: var(--luz-hover);
    }
    .item.ativo .it {
        color: var(--luz-laranja);
    }
    .item.inerte {
        opacity: 0.45;
        cursor: not-allowed;
    }
    .item .it {
        font-size: 13px;
        font-weight: 600;
    }
    .item .sub {
        font-size: 11px;
        color: var(--luz-mudo);
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
        backdrop-filter: var(--luz-vidro, none);
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
