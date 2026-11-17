<script lang="ts">
    // 1a, D4/D5: o menu ⋯ do Preparar: Configuracoes e o item do telao (ligar e desligar com pergunta e trava).
    // O item NUNCA presume o estado: a maquina (aliancaSaidaMenuLogica) deriva ao abrir. Sem resposta do telao: texto persistente.
    // SO MOUSE no item do telao: Enter e Espaco nao fazem nada nele. Padrao do AliancaNovo (botao sem foco por Tab, itens div role=menuitem,
    // teclado contido com stopPropagation: o keydown global tira o foco de qualquer BUTTON).
    import { onDestroy, tick } from "svelte"
    import { get } from "svelte/store"
    import { activePage, drawSettings, drawTool, modoAlianca, outputDisplay, outputs, paintCache, settingsTab } from "../../stores"
    import { algoNoAr } from "../../utils/aliancaModo"
    import { desenhoAtivo } from "../../utils/aliancaPilulaLogica"
    import { criarMaquinaDaSaida, itemDesabilitado, ROTULO_DESLIGAR_MESMO, ROTULOS, temSaidaHabilitada, type EstadoSaida } from "../../utils/aliancaSaidaMenuLogica"
    import { toggleOutputs } from "../helpers/output"

    export let settingsDisabled = false
    export let semTelaFisica = false

    let aberto = false
    let estado: EstadoSaida = "desligado"
    let ativo = 0
    let raiz: HTMLElement
    let botao: HTMLElement
    let menu: HTMLElement | undefined

    const maquina = criarMaquinaDaSaida({
        ligar: () => toggleOutputs(null, { state: true }),
        desligar: () => toggleOutputs(null, { state: false }),
        abrirConfig: () => {
            settingsTab.set("display_settings")
            activePage.set("settings")
        },
        fecharMenu: () => fechar(),
        ler: () => ({ outputDisplay: !!get(outputDisplay), semTelaFisica, temSaida: temSaidaHabilitada(get(outputs) as any), noAr: algoNoAr(), desenho: desenhoAtivo(get(drawTool), get(drawSettings), get(paintCache) as any) }),
        aoMudar: (s) => (estado = s)
    })

    // o mundo mudou (resposta do telao, conteudo no ar, desenho, saida habilitada): a maquina reavalia
    $: ($outputDisplay, $outputs, $drawTool, $drawSettings, $paintCache, semTelaFisica, maquina.mundoMudou())
    $: if ($modoAlianca !== "preparar" && aberto) fechar()

    onDestroy(() => maquina.destruir())

    $: itens = settingsDisabled ? ["saida"] : ["config", "saida"]
    $: pergunta = estado === "perguntando" || estado === "armado"

    async function abrir() {
        maquina.abrir()
        aberto = true
        ativo = 0
        await tick()
        menu?.focus()
    }

    function fechar(devolverFoco = false) {
        maquina.cancelar()
        aberto = false
        if (devolverFoco) botao?.focus()
    }

    function irParaConfig() {
        fechar()
        activePage.set("settings")
    }

    function tecla(e: KeyboardEvent) {
        // o menu e como um dialogo: nada do que se digita aqui chega aos atalhos do app (nem o Esc, que e so dele)
        e.stopPropagation()
        if (e.key === "ArrowDown") {
            e.preventDefault()
            ativo = (ativo + 1) % itens.length
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            ativo = (ativo - 1 + itens.length) % itens.length
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            // so Configuracoes aceita teclado; o item do telao e so mouse
            if (itens[ativo] === "config") irParaConfig()
        } else if (e.key === "Escape") {
            e.preventDefault()
            fechar(true)
        } else if (e.key === "Tab") {
            e.preventDefault()
            fechar(true)
        }
    }

    function fora(e: MouseEvent) {
        if (aberto && !raiz?.contains(e.target as Node)) fechar()
    }

    function perdeuOFoco(e: FocusEvent) {
        if (!aberto) return
        const para = e.relatedTarget as Node | null
        if (!para || !raiz?.contains(para)) fechar()
    }
</script>

<svelte:window on:mousedown={fora} />

<div class="prepararMenu" bind:this={raiz}>
    <button class="menuBotao" class:aberto bind:this={botao} tabindex="-1" aria-haspopup="menu" aria-expanded={aberto} data-title="Mais" on:mousedown|preventDefault on:click={() => (aberto ? fechar() : abrir())}>⋯</button>

    {#if aberto}
        <div class="menu" bind:this={menu} role="menu" tabindex="-1" on:keydown={tecla} on:focusout={perdeuOFoco}>
            {#if !settingsDisabled}
                <div class="item" class:ativo={itens[ativo] === "config"} role="menuitem" tabindex="-1" data-item="config" on:mousedown|preventDefault on:mouseenter={() => (ativo = itens.indexOf("config"))} on:click={irParaConfig} on:keydown={() => {}}>Configurações</div>
            {/if}
            <div class="item saida" class:ativo={itens[ativo] === "saida"} class:desabilitado={itemDesabilitado(estado)} class:erro={estado === "semResposta"} class:pergunta role="menuitem" aria-disabled={itemDesabilitado(estado)} tabindex="-1" data-item="saida" data-estado={estado} on:mousedown|preventDefault on:mouseenter={() => (ativo = itens.indexOf("saida"))} on:click={() => maquina.cliqueNoItem()} on:keydown={() => {}}>
                {ROTULOS[estado]}
            </div>
            {#if pergunta}
                <div class="item desligar" class:inerte={estado === "perguntando"} role="menuitem" aria-disabled={estado === "perguntando"} tabindex="-1" data-item="desligar-mesmo" on:mousedown|preventDefault on:click={() => maquina.cliqueDesligarMesmo()} on:keydown={() => {}}>{ROTULO_DESLIGAR_MESMO}</div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .prepararMenu {
        position: relative;
        flex: none;
        align-self: center;
        -webkit-app-region: no-drag;
    }
    .menuBotao {
        border: 0;
        border-radius: 6px;
        padding: 2px 10px;
        font-family: inherit;
        font-size: 16px;
        line-height: 1.2;
        color: var(--text);
        background: rgb(255 255 255 / 0.06);
        cursor: pointer;
    }
    .menuBotao:hover,
    .menuBotao.aberto {
        background: rgb(255 255 255 / 0.12);
    }
    /* acima dos botoes flutuantes da lista do culto (z-index 199/200), como o menu do AliancaNovo */
    .menu {
        position: absolute;
        z-index: 201;
        top: calc(100% + 4px);
        right: 0;
        min-width: 232px;
        padding: 4px;
        border: 1px solid var(--glass-line, rgb(255 255 255 / 0.07));
        border-radius: 8px;
        background: var(--primary-darkest);
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
        outline: none;
    }
    .item {
        padding: 7px 10px;
        border-radius: 6px;
        font-size: 12.5px;
        color: var(--text);
        cursor: pointer;
        user-select: none;
    }
    .item.ativo {
        background: rgb(255 255 255 / 0.08);
    }
    .item.desabilitado {
        opacity: 0.6;
        cursor: default;
    }
    .item.erro {
        color: #ff8f97;
        opacity: 1;
    }
    .item.pergunta {
        cursor: default;
    }
    .item.desligar {
        margin-top: 2px;
        background: rgb(242 26 39 / 0.22);
        color: #ffb3b8;
        font-weight: 600;
    }
    .item.desligar.inerte {
        opacity: 0.4;
        cursor: default;
    }
</style>
