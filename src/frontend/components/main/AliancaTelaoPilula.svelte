<script lang="ts">
    // Leiaute v2, topo: o botao UNICO do telao (cabine 6, pedido do Andre 23/nov: "o programa tem que iniciar com o telao ligado; e dai
    // escolhemos congelar ou desligar. E nesse mesmo botao aparecer de forma abreviada o visual selecionado").
    //   botao:  ponto + estado curto ("No ar" / "Congelado" / "Desligado") + " · " + o Visual que esta valendo + ▾. Clique abre o menu.
    //   menu:   Congelar/Descongelar (outLocked: nada muda no telao ate descongelar), Ligar/Desligar, Voltar o que foi limpo; depois a lista
    //           de Visuais (check no que vale) e "Editar visuais…".
    // Liga e desliga pela maquina de aliancaSaidaMenuLogica (1 s inerte, 3 s de janela, 0,8 s de trava); desligar continua pedindo
    // confirmacao num segundo botao ("Desligar mesmo"). So mouse: Enter e Espaco nao ligam nem desligam. Ctrl+O (liga/desliga) e Ctrl+L
    // (congela) continuam como estao (shortcuts.ts). A partida com o telao ligado e o `autoOutput` do FreeShow (aliancaTelaoPartida.ts).
    // Trocar o Visual muda todas as saidas de uma vez; o que esta no ar nao pula (D15), mas isso nao e anunciado aqui. Ponto laranja so
    // para problema de verdade do Visual (modelo ou leiaute apagado, saida fora do Visual).
    import { onDestroy, onMount } from "svelte"
    import { get } from "svelte/store"
    import { activePage, drawSettings, drawTool, outLocked, outputCache, outputDisplay, outputs, paintCache, settingsTab, special, stageShows, styles, templates } from "../../stores"
    import { configSecao } from "../../utils/aliancaConfigSecao"
    import { tela, trocarTela } from "../../utils/aliancaTela"
    import { escFechou } from "../../utils/aliancaToque"
    import { algoNoAr } from "../../utils/aliancaModo"
    import { desenhoAtivo } from "../../utils/aliancaPilulaLogica"
    import { motivoVoltarLimpo } from "../../utils/aliancaVoltarLimpoLogica"
    import { criarMaquinaDaSaida, itemDesabilitado, ROTULO_DESLIGAR_MESMO, ROTULOS, rotuloCurtoDoTelao, temSaidaHabilitada, type EstadoSaida } from "../../utils/aliancaSaidaMenuLogica"
    import { ativarVisual, aplicarVisualAtivo, visualPendente } from "../../utils/aliancaVisualAplicador"
    import { divergencias, lerVisuais, planoDeEscrita, visualAtivo } from "../../utils/aliancaVisualLogica"
    import { toggleOutputs } from "../helpers/output"
    import { restoreOutput } from "../output/clear"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { iniciarSoRetorno, soRetorno } from "../../utils/aliancaSoRetorno"
    import { ROTULO_FAIXA } from "../../utils/aliancaSoRetornoLogica"
    import AliancaCortina from "./AliancaCortina.svelte"
    import { avisar, resolverAviso } from "../../utils/aliancaAvisos"

    export let semTelaFisica = false

    let estado: EstadoSaida = "desligado"
    const CHAVE_SEM_RESPOSTA = "telao-sem-resposta"
    let raiz: HTMLElement

    const maquina = criarMaquinaDaSaida({
        ligar: () => toggleOutputs(null, { state: true }),
        desligar: () => toggleOutputs(null, { state: false }),
        abrirConfig: () => {
            settingsTab.set("display_settings")
            trocarTela("settings", "pilula-telao")
        },
        fecharMenu: () => {},
        ler: () => {
            const mostrar = get(activePage) === "show"
            return { outputDisplay: !!get(outputDisplay), semTelaFisica, temSaida: temSaidaHabilitada(get(outputs) as any), noAr: mostrar ? false : algoNoAr(), desenho: mostrar ? false : desenhoAtivo(get(drawTool), get(drawSettings), get(paintCache) as any) }
        },
        aoMudar: (s) => (estado = s)
    })
    $: ($outputDisplay, $outputs, $drawTool, $drawSettings, $paintCache, $activePage, $tela, semTelaFisica, maquina.mundoMudou())
    // 8b (R2): a recuperacao da queda do modo "so retorno" sobe uma vez, com a janela principal (o topo existe em toda tela), nao com a coluna No ar
    onMount(() => iniciarSoRetorno((m) => falhaAlta("so-retorno", m)))
    onDestroy(() => maquina.destruir())

    // cronometro "no ar ha mm:ss" (na dica do botao): comeca quando a saida entra no ar e zera quando sai
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
    $: curto = rotuloCurtoDoTelao(estado, $outLocked)
    $: dicaDoEstado = estado === "desligadoNoAr" || estado === "desligadoDesenho" ? ROTULOS[estado].replace("pelo Culto", "em Mostrar") : estado === "semResposta" ? ROTULOS[estado].replace("o botão do Culto", "o botão de Mostrar").replace("Use o botão do Culto.", "Tente de novo em Mostrar.") : ROTULOS[estado]
    $: ligarDesabilitado = itemDesabilitado(estado) && estado !== "semResposta"
    // cabine 6 (Andre, 23/nov): o telao que nao liga nao abre janela por cima do culto; a pilula diz "Nao respondeu" e a linha de avisos (no pe
    // do leiaute) guarda o motivo ate o estado sair de semResposta
    $: if (estado === "semResposta") avisar("O telão não respondeu ao ligar. Confira a tela de saída e tente de novo no botão do telão (topo, à direita).", "erro", CHAVE_SEM_RESPOSTA)
    else resolverAviso(CHAVE_SEM_RESPOSTA)
    $: rotuloLigar = ligado ? "Desligar telão" : estado === "semTela" ? "Configurar a tela de saída" : estado === "ligando" ? "Ligando…" : "Ligar telão"
    $: subLigar = ligarDesabilitado ? dicaDoEstado : ligado ? "a tela fica preta até ligar de novo" : estado === "semTela" ? "nenhuma saída habilitada" : "o telão volta a mostrar o que está no ar"

    // o Visual que esta valendo (antes era a pilula separada "Visual: X")
    $: visuais = lerVisuais($special)
    $: ativo = visualAtivo($special)
    $: fora = ativo ? divergencias(ativo, $outputs, $styles, $visualPendente.chaves) : []
    // reativo: modelo ou leiaute apagado aparece na hora (nunca calado)
    $: problemas = ativo ? planoDeEscrita(ativo, $outputs, $styles, $templates, $stageShows).problemas : []
    $: nProblemas = problemas.length + (fora.length ? 1 : 0)
    $: avisoVisual = visuais.length > 0 && (nProblemas > 0 || !ativo)

    $: dica = curto.tom === "noAr" ? `Telão no ar há ${tempoNoAr}` : curto.tom === "congelado" ? "Telão congelado: nada muda nele até descongelar" : dicaDoEstado

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
    $: motivoRestaurar = motivoVoltarLimpo({ travada: $outLocked, haCache: !!$outputCache, pronto: restauraPronto })
    $: if (pergunta) menuAberto = false

    function abrirOuFechar() {
        if (pergunta) return maquina.cancelar()
        if (!menuAberto) maquina.abrir()
        menuAberto = !menuAberto
    }
    function congelar() {
        outLocked.set(!$outLocked)
        menuAberto = false
    }
    function ligarOuDesligar() {
        if (ligarDesabilitado) return
        // "Desligar" abre a pergunta "Desligar mesmo" no lugar do menu; "Ligar" liga; sem tela abre Configuracoes
        menuAberto = false
        maquina.cliqueNoItem()
    }
    function restaurar() {
        if (!podeRestaurar) return
        restoreOutput()
        menuAberto = false
    }
    function trocarVisual(id: string) {
        menuAberto = false
        if (id !== ativo?.id) ativarVisual(id)
    }
    function reaplicar() {
        menuAberto = false
        aplicarVisualAtivo()
    }
    function editarVisuais() {
        menuAberto = false
        settingsTab.set("styles")
        configSecao.set("visual")
        trocarTela("settings", "botao-de-pagina")
    }

    function fora_(e: MouseEvent) {
        if (pergunta && !raiz?.contains(e.target as Node)) maquina.cancelar()
        if (menuAberto && !raiz?.contains(e.target as Node)) menuAberto = false
    }
    function tecla(e: KeyboardEvent) {
        if (pergunta && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            escFechou()
            maquina.cancelar()
        } else if (menuAberto && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            escFechou()
            menuAberto = false
        }
    }
    if (typeof window !== "undefined") window.addEventListener("keydown", tecla, true)
    onDestroy(() => typeof window !== "undefined" && window.removeEventListener("keydown", tecla, true))
</script>

<svelte:window on:mousedown={fora_} />

<div class="raiz" bind:this={raiz}>
    <button class="telao {curto.tom}" class:aberto={menuAberto} data-acao="telao-menu" data-estado={estado} data-tom={curto.tom} aria-haspopup="menu" aria-expanded={menuAberto} aria-label={`Telão: ${curto.texto}${ativo ? ` · Visual ${ativo.nome}` : ""}`} data-title={menuAberto ? "" : dica} tabindex="-1" on:mousedown|preventDefault on:click={abrirOuFechar}>
        <span class="ponto" />
        <span class="estado" data-acao="telao">{curto.texto}</span>
        {#if visuais.length}
            <span class="sep">·</span>
            <span class="vis" data-acao="telao-visual">{ativo?.nome || "sem Visual"}</span>
            {#if avisoVisual}<span class="avisoVis" data-acao="visual-problema" />{/if}
        {/if}
        {#if desenho}<span class="aviso" data-acao="desenho-ativo" data-title="Ferramentas de desenho ativas no telão (Preencher, zoom ou traços)" />{/if}
        <svg class="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
    </button>
    {#if $soRetorno}<span class="so-retorno" data-acao="pilula-so-retorno">{ROTULO_FAIXA}</span>{/if}
    {#if menuAberto || pergunta}
        <AliancaCortina
            on:fechar={() => {
                if (pergunta) maquina.cancelar()
                menuAberto = false
            }}
        />
    {/if}
    {#if menuAberto}
        <div class="pop menu" role="menu" data-acao="telao-menu-pop">
            <div class="tit">TELÃO</div>
            <button role="menuitem" class="item" data-item="travar" class:gelo={$outLocked} tabindex="-1" on:mousedown|preventDefault on:click={congelar}
                ><span class="it">{$outLocked ? "Descongelar" : "Congelar"}</span><span class="sub">{$outLocked ? "o telão volta a seguir o que você manda" : "nada muda no telão até descongelar"}</span></button
            >
            <button role="menuitem" class="item" data-item={ligado ? "desligar" : "ligar"} aria-disabled={ligarDesabilitado} class:inerte={ligarDesabilitado} tabindex="-1" on:mousedown|preventDefault on:click={ligarOuDesligar}
                ><span class="it">{rotuloLigar}</span><span class="sub" class:motivo={ligarDesabilitado}>{subLigar}</span></button
            >
            <button role="menuitem" class="item" data-item="restaurar" aria-disabled={!podeRestaurar} class:inerte={!podeRestaurar} title={motivoRestaurar} tabindex="-1" on:mousedown|preventDefault on:click={restaurar}
                ><span class="it">Voltar o que foi limpo</span><span class="sub" class:motivo={!podeRestaurar}>{podeRestaurar ? "traz de volta o último conteúdo limpo" : motivoRestaurar}</span></button
            >
            {#if visuais.length}
                <hr />
                <div class="tit">VISUAL</div>
                {#each visuais as v (v.id)}
                    <button role="menuitemradio" aria-checked={v.id === ativo?.id} class="mi" class:h={v.id === ativo?.id} data-visual={v.id} tabindex="-1" on:mousedown|preventDefault on:click={() => trocarVisual(v.id)}>
                        <span class="marca">{v.id === ativo?.id ? "✓" : ""}</span><span class="miNome">{v.nome}</span>
                    </button>
                {/each}
                {#if nProblemas}
                    <div class="prob" data-acao="visual-problemas-menu">{nProblemas === 1 ? "1 problema" : `${nProblemas} problemas`} no Visual (detalhes em Editar visuais)</div>
                    {#if fora.length}<button role="menuitem" class="mi" tabindex="-1" on:mousedown|preventDefault on:click={reaplicar}><span class="marca" />Reaplicar o Visual</button>{/if}
                {/if}
                <button role="menuitem" class="mi" data-acao="visual-editar" tabindex="-1" on:mousedown|preventDefault on:click={editarVisuais}><span class="marca" />Editar visuais…</button>
            {/if}
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
        gap: 6px;
    }
    .telao {
        position: relative;
        height: 40px;
        max-width: 340px;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 12px 0 14px;
        border-radius: 20px;
        border: 1px solid var(--luz-borda-forte);
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
    }
    .ponto {
        width: 9px;
        height: 9px;
        flex-shrink: 0;
        border-radius: 5px;
        background: var(--luz-fraco);
    }
    .estado {
        flex-shrink: 0;
    }
    .sep {
        opacity: 0.55;
    }
    .vis {
        min-width: 0;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
        opacity: 0.85;
    }
    .avisoVis,
    .aviso {
        width: 8px;
        height: 8px;
        flex-shrink: 0;
        border-radius: 4px;
        background: var(--luz-laranja);
    }
    .chev {
        flex-shrink: 0;
        opacity: 0.8;
        transition: transform 140ms ease;
    }
    .telao.aberto .chev {
        transform: rotate(180deg);
    }

    /* NO AR: vermelho cheio */
    .telao.noAr {
        background: var(--luz-vermelho);
        border-color: var(--luz-vermelho);
        color: var(--luz-branco);
    }
    .telao.noAr .ponto {
        background: var(--luz-branco);
    }
    /* CONGELADO: gelo cheio (cor propria, nunca confundir com o vermelho do no ar) */
    .telao.congelado {
        background: var(--luz-gelo);
        border-color: var(--luz-gelo);
        color: var(--luz-tinta);
    }
    .telao.congelado .ponto {
        background: var(--luz-tinta);
        border-radius: 2px;
    }
    /* DESLIGADO: apagado, tracejado */
    .telao.desligado {
        background: transparent;
        border-style: dashed;
        border-color: var(--luz-borda-forte);
        color: var(--luz-mudo);
    }
    .telao.desligado .estado {
        color: var(--luz-texto-80);
    }
    .telao.transicao {
        color: var(--luz-texto-80);
    }
    .telao.erro {
        border-color: var(--luz-vermelho);
        color: var(--luz-vermelho-claro);
    }
    .telao.erro .ponto {
        background: var(--luz-vermelho);
    }
    .telao.desligado:hover,
    .telao.transicao:hover,
    .telao.erro:hover,
    .telao.desligado.aberto {
        background: var(--luz-hover);
    }
    .telao.noAr:hover,
    .telao.congelado:hover,
    .telao.noAr.aberto,
    .telao.congelado.aberto {
        filter: brightness(1.08);
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
        border-radius: var(--luz-raio-menu);
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            var(--luz-sombra-pop);
        backdrop-filter: var(--luz-vidro, none);
        transform-origin: top right;
        animation: luz-surgir 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .pop.menu {
        width: 290px;
        padding: 6px;
        gap: 2px;
    }
    .tit {
        padding: 6px 10px 4px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--luz-mudo);
    }
    .item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        padding: 8px 10px;
        border: 0;
        border-radius: var(--luz-raio-botao);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .item:hover {
        background: var(--luz-hover);
    }
    .item.gelo {
        background: var(--luz-gelo-lavagem);
    }
    .item.gelo .it {
        color: var(--luz-gelo);
    }
    .item.inerte {
        cursor: not-allowed;
    }
    .item.inerte .it {
        opacity: 0.5;
    }
    .item .it {
        font-size: 13px;
        font-weight: 600;
    }
    .item .sub {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .item .sub.motivo {
        color: var(--luz-ambar);
    }
    .mi {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 0;
        border-radius: var(--luz-raio-botao);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
    }
    .mi:hover,
    .mi.h {
        background: var(--luz-hover);
    }
    .mi.h {
        font-weight: 600;
    }
    .miNome {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .marca {
        width: 14px;
        flex-shrink: 0;
    }
    .prob {
        padding: 4px 10px;
        font-size: 12px;
        color: var(--luz-laranja);
    }
    hr {
        border: 0;
        border-top: 1px solid var(--luz-linha);
        margin: 4px 6px;
    }
    .titulo {
        font-size: 13px;
        font-weight: 600;
    }
    .mesmo {
        height: 40px;
        border: 1px solid var(--luz-vermelho);
        border-radius: var(--luz-raio-acao);
        background: var(--luz-vermelho);
        color: var(--luz-branco);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }
    .mesmo.inerte {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .so-retorno {
        height: 22px;
        padding: 0 8px;
        display: flex;
        align-items: center;
        border-radius: 11px;
        background: var(--luz-laranja);
        color: var(--luz-tinta);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        white-space: nowrap;
    }
</style>
