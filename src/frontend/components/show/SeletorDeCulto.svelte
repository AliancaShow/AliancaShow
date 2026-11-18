<script lang="ts">
    /**
     * Seletor compacto de agenda e de culto (FV-S): dois botoes, "Aliança ▾" e "Dom 15/nov ▾", no lugar dos chips de agenda e
     * da faixa de dias. Escolher uma opcao fecha o popover.
     *
     * O Culto roda ao vivo, entao TUDO aqui e desenhado para que um clique ou uma tecla errada nao mexa em nada:
     *  - o popover mora numa CAMADA transparente em tela cheia, no body (fora do .panel, que tem backdrop-filter e overflow);
     *  - clicar fora nao "passa": a camada fica ate o fim do gesto e mais INERTE_MS (o segundo clique de um duplo clique e o
     *    dblclick nao chegam ao ShowButton). Nenhum ouvinte de ponteiro no window;
     *  - so UM ouvinte de teclado (captura, window), ligado enquanto aberto: engole tudo; tecla sem funcao FECHA e e engolida;
     *    depois de fechar por tecla ele vive ate o keyup dela (o auto-repeat de um Esc segurado nao pode limpar o telao);
     *  - o popover nunca recebe foco, e nada de blur() ao fechar: o foco fica onde estava;
     *  - escolher um dia chama o MESMO caminho da faixa antiga (openProject) e nunca escreve em `outputs`.
     */
    import { createEventDispatcher, onDestroy, tick } from "svelte"
    import type { Tree } from "../../../types/Projects"
    import { activePage, activePopup, activeProject, focusMode, folders, outputs, projects, projectView } from "../../stores"
    import { tela } from "../../utils/aliancaTela"
    import { escFechou } from "../../utils/aliancaToque"
    import { cultoDoProjeto } from "../../utils/agendas"
    import { algoNoAr } from "../../utils/aliancaModo"
    import { abaLateral } from "../../utils/aliancaBibliotecaEstado"
    import { quantosDoOperador } from "../../utils/aliancaSirvoProjeto"
    import { CARENCIA_ABERTURA_MS, CARENCIA_MUDANCA_MS, OCIOSO_MS, TETO_TECLA_MS, assinaturaDasOpcoes, camadaPodeSair, corDaAgenda, decidirTecla, dentroDaCarencia, ehHoje, estadoDoBotaoDia, hojeLocalISO, indiceInicial, larguraDoLayout, moverDestaque, montarOpcoesDeDia, nomeDaAgenda, opcoesPlanas, partesDoDia, posicaoDoPopover, subDaAgenda } from "../../utils/aliancaSeletorLogica"
    import { history } from "../helpers/history"
    import { openProject } from "./project"

    export let tree: Tree[] = []
    export let abas: { id: string; nome: string }[] = []
    export let agendaAtiva = "todos"

    const dispatch = createEventDispatcher()

    type Qual = "agenda" | "dia"
    let aberto: Qual | null = null
    let fase: "fechado" | "aberto" | "inerte" = "fechado"

    let linhaElem: HTMLDivElement | undefined
    let btnAgenda: HTMLButtonElement | undefined
    let btnDia: HTMLButtonElement | undefined
    let camadaElem: HTMLDivElement | undefined
    let popElem: HTMLDivElement | undefined
    let listaElem: HTMLDivElement | undefined
    let larguraLinha = 300

    $: layout = larguraDoLayout(larguraLinha)
    $: nomeAgenda = nomeDaAgenda(abas, agendaAtiva)
    $: emTodos = agendaAtiva === "todos"
    $: corAgenda = corDaAgenda(agendaAtiva)

    // ---------------------------------------------------------------- estado fechado

    $: pastasVivas = Object.fromEntries(Object.entries($folders).filter(([, f]) => !f.deleted))
    $: temCultos = tree.some((i) => i.type !== "grupo" && i.type !== "folder")
    $: noFiltro = !!$activeProject && tree.some((i) => i.id === $activeProject)
    $: projetoAberto = $activeProject ? $projects[$activeProject] : null
    $: cultoAberto = $activeProject && projetoAberto ? cultoDoProjeto($activeProject, $projects, pastasVivas) : null
    $: estadoDia = estadoDoBotaoDia({
        ativo: $activeProject && projetoAberto ? { nome: projetoAberto.name || "", cultoId: cultoAberto?.cultoId ?? null } : null,
        noFiltro,
        temCultos,
        agendaNome: nomeAgenda,
        anoAtual: new Date().getFullYear(),
        agendaDoAtivo: cultoAberto?.agenda.nome
    })

    // o selo HOJE do botao fechado: o culto aberto e o de hoje (o relogio e lido quando o culto aberto muda)
    const hojeAgora = (_aberto: unknown) => hojeLocalISO()
    $: diaEhHoje = ehHoje(cultoAberto?.cultoId, hojeAgora($activeProject))

    // ---------------------------------------------------------------- opcoes (so calculadas com o popover de dia aberto)

    let hojeISO = hojeLocalISO()
    let noAr = false
    $: grupos = aberto === "dia" && fase === "aberto" ? montarGrupos(tree, $projects, pastasVivas, $activeProject, hojeISO, emTodos) : []
    function montarGrupos(itens: Tree[], projetos: typeof $projects, pastas: typeof pastasVivas, ativoId: string | null, hoje: string, todos: boolean) {
        return montarOpcoesDeDia({
            itens,
            resolver: (id) => cultoDoProjeto(id, projetos, pastas),
            contar: (id) => quantosDoOperador(projetos[id]?.shows),
            hoje,
            ativoId,
            emTodos: todos
        })
    }
    $: planas = aberto === "dia" ? opcoesPlanas(grupos) : aberto === "agenda" ? abas.map((a) => ({ id: a.id, cultoId: "" })) : []
    $: idAtivo = aberto === "dia" ? $activeProject : agendaAtiva

    let destaqueId: string | null = null
    $: if (fase === "aberto" && destaqueId !== null && !planas.some((o) => o.id === destaqueId)) destaqueId = planas[indiceInicial(planas, idAtivo, hojeISO)]?.id ?? null

    // a lista pode mudar sob o cursor (sincronizacao, ordenacao por modificado): a carencia rearma
    let ateCarencia = 0
    let ultimaAssinatura = ""
    $: assinatura = assinaturaDasOpcoes(planas)
    $: if (fase === "aberto" && assinatura !== ultimaAssinatura) {
        if (ultimaAssinatura !== "") ateCarencia = performance.now() + CARENCIA_MUDANCA_MS
        ultimaAssinatura = assinatura
        if (destaqueId) tick().then(() => rolarPara(destaqueId, "nearest"))
    }
    // sem culto nenhum no filtro, o popover de dia nao tem o que mostrar
    $: if (aberto === "dia" && fase === "aberto" && !temCultos) fecharTudo()

    // ---------------------------------------------------------------- abrir

    let pos = { left: 0, top: 0, width: 300, maxHeight: 320 }

    function abrir(qual: Qual) {
        if (fase !== "fechado") return
        if (qual === "dia" && estadoDia.desabilitado) return
        if (!linhaElem || !btnAgenda || !btnDia) return
        const r = linhaElem.getBoundingClientRect()
        const bt = (qual === "agenda" ? btnAgenda : btnDia).getBoundingClientRect()
        const p = posicaoDoPopover({ linha: { left: r.left + 12, width: r.width - 24 }, base: bt.bottom, janelaAltura: window.innerHeight })
        // local: lista curta de 240 px; dia: a largura da coluna (grade de 3). Ate 380 de altura, como o prototipo.
        pos = { ...p, width: qual === "agenda" ? Math.min(240, p.width) : p.width, maxHeight: Math.max(120, Math.min(380, window.innerHeight - p.top - 12)) }
        hojeISO = hojeLocalISO()
        noAr = algoNoAr()
        ultimaAssinatura = ""
        aberto = qual
        fase = "aberto"
        destaqueId = null
        ateCarencia = performance.now() + CARENCIA_ABERTURA_MS
        aguardandoKeyup = false
        ligarOuvintes()
        observarStores()
        renovarOcioso()
        tick().then(() => {
            // o destaque inicial e o ativo (ou o 1o de hoje em diante); a lista abre ja rolada nele
            destaqueId = planas[indiceInicial(planas, idAtivo, hojeISO)]?.id ?? null
            rolarPara(idAtivo, "center")
        })
    }

    function rolarPara(id: string | null, modo: "center" | "nearest") {
        if (!id || !listaElem) return
        const alvo = listaElem.querySelector<HTMLElement>(`[data-opcao="${CSS.escape(id)}"]`)
        if (!alvo) return
        if (modo === "center") listaElem.scrollTop = alvo.offsetTop - (listaElem.clientHeight - alvo.offsetHeight) / 2
        else alvo.scrollIntoView({ block: "nearest" })
    }

    // ---------------------------------------------------------------- fechar (tres caminhos)

    let apertado = false
    let ultimoEvento = 0
    let inicioInerte = 0
    let aguardandoKeyup = false
    let teclaQueFechou = ""
    let timerInerte: ReturnType<typeof setInterval> | undefined
    let timerOcioso: ReturnType<typeof setTimeout> | undefined
    let timerTecla: ReturnType<typeof setTimeout> | undefined
    let soltarStores: (() => void)[] = []
    let soltarOutputs: (() => void) | undefined

    /** TUDO fora: popover, camada e ouvintes (fechamento automatico, troca de modo, desligar, destruir) */
    function fecharTudo() {
        fase = "fechado"
        aberto = null
        apertado = false
        aguardandoKeyup = false
        desligarOuvintes()
        pararTimers()
        pararObservacao()
    }

    /** fechou por clique/ponteiro: o popover some, a camada FICA ate o gesto acabar + INERTE_MS; o teclado volta ao app na hora */
    function irParaInerte() {
        if (fase !== "aberto") return
        fase = "inerte"
        aberto = null
        inicioInerte = performance.now()
        desligarOuvintes()
        clearTimeout(timerOcioso)
        pararObservacao()
        clearInterval(timerInerte)
        timerInerte = setInterval(() => {
            if (camadaPodeSair({ apertado, agora: performance.now(), ultimoEvento, inicioInerte })) fecharTudo()
        }, 50)
    }

    /** fechou por tecla: camada e popover somem; o ouvinte de teclado vive ate o keyup dessa tecla (ou TETO_TECLA_MS) engolindo o auto-repeat */
    function fecharPorTecla(tecla: string) {
        if (tecla === "Escape") escFechou()
        fase = "fechado"
        aberto = null
        pararTimers()
        pararObservacao()
        window.removeEventListener("mousedown", mousedownFora, true)
        window.removeEventListener("blur", blurJanela, true)
        window.removeEventListener("resize", redimensionou, true)
        aguardandoKeyup = true
        teclaQueFechou = tecla
        window.addEventListener("keyup", teclaSolta, true)
        timerTecla = setTimeout(fecharTudo, TETO_TECLA_MS)
    }

    function pararTimers() {
        clearInterval(timerInerte)
        clearTimeout(timerOcioso)
        clearTimeout(timerTecla)
    }

    // ---------------------------------------------------------------- ouvintes (so existem com o popover aberto)

    function ligarOuvintes() {
        window.addEventListener("keydown", tecla, true)
        window.addEventListener("mousedown", mousedownFora, true)
        window.addEventListener("blur", blurJanela, true)
        window.addEventListener("resize", redimensionou, true)
    }
    function desligarOuvintes() {
        window.removeEventListener("keydown", tecla, true)
        window.removeEventListener("keyup", teclaSolta, true)
        window.removeEventListener("mousedown", mousedownFora, true)
        window.removeEventListener("blur", blurJanela, true)
        window.removeEventListener("resize", redimensionou, true)
    }

    // um clique ACIMA da camada (barra de menu, z-index maior) nao a atravessa, mas o popover fecha. Nao engole nada.
    function mousedownFora(e: MouseEvent) {
        if (fase === "aberto" && camadaElem && !camadaElem.contains(e.target as Node)) fecharTudo()
    }
    // blur chega aqui tambem por captura, de qualquer elemento: so vale o da janela
    function blurJanela(e: FocusEvent) {
        if (e.target === window) fecharTudo()
    }
    function redimensionou() {
        fecharTudo()
    }
    function teclaSolta(e: KeyboardEvent) {
        if (aguardandoKeyup && e.key === teclaQueFechou) fecharTudo()
    }

    function renovarOcioso() {
        clearTimeout(timerOcioso)
        timerOcioso = setTimeout(fecharTudo, OCIOSO_MS)
    }

    // mudou de modo, de aba, de pagina, entrou em foco ou abriu um popup: o popover nao tem mais razao de estar la
    function observarStores() {
        pararObservacao()
        for (const store of [tela, abaLateral, focusMode, activePage, activePopup] as { subscribe: (f: () => void) => () => void }[]) {
            let primeira = true
            soltarStores.push(
                store.subscribe(() => {
                    if (primeira) {
                        primeira = false
                        return
                    }
                    fecharTudo()
                })
            )
        }
        // o aviso "ha conteudo no ar" acompanha a saida enquanto o popover esta aberto (so leitura)
        soltarOutputs = outputs.subscribe(() => {
            noAr = algoNoAr()
        })
    }
    function pararObservacao() {
        soltarStores.forEach((f) => f())
        soltarStores = []
        soltarOutputs?.()
        soltarOutputs = undefined
    }

    // ---------------------------------------------------------------- teclado

    function tecla(e: KeyboardEvent) {
        const d = decidirTecla(e)
        if (d.acao === "passar") return
        // TODA tecla some aqui: nada do resto do app age por baixo do popover
        e.preventDefault()
        e.stopImmediatePropagation()
        if (aguardandoKeyup || fase !== "aberto") return
        renovarOcioso()
        if (d.acao === "mover") {
            const i = planas.findIndex((o) => o.id === destaqueId)
            const novo = moverDestaque(i, planas.length, d.tecla)
            destaqueId = planas[novo]?.id ?? null
            tick().then(() => rolarPara(destaqueId, "nearest"))
            return
        }
        if (d.acao === "escolher") {
            // Enter no que ja e o ativo so fecha
            if (destaqueId && destaqueId !== idAtivo) escolher(destaqueId)
            fecharPorTecla(e.key)
            return
        }
        fecharPorTecla(e.key)
    }

    // ---------------------------------------------------------------- escolher

    // o MESMO caminho de ProjectStrip.abrir (faixa antiga): sai cedo quando ja e o ativo e a visao nao e a lista; nunca toca em `outputs`
    function escolherDia(id: string) {
        if ($activeProject === id && !$projectView) return
        projectView.set(false)
        openProject(id)
    }

    function escolher(id: string) {
        if (aberto === "dia") escolherDia(id)
        else if (aberto === "agenda") dispatch("agenda", id)
    }

    function criarAvulso() {
        if (fase !== "aberto" || dentroDaCarencia(performance.now(), ateCarencia)) return
        const pasta = (abas as { id: string; nome: string; pasta?: string }[]).find((a) => a.id === agendaAtiva)?.pasta
        const pai = pasta ? Object.entries(pastasVivas).find(([, f]) => f.parent === "/" && f.name === pasta)?.[0] : undefined
        history({ id: "UPDATE", newData: { replace: { parent: pai || "/" } }, location: { page: "show", id: "project" } })
        irParaInerte()
    }

    function clicarOpcao(id: string) {
        if (fase !== "aberto" || dentroDaCarencia(performance.now(), ateCarencia)) return
        escolher(id)
        irParaInerte()
    }

    function moverMouse(id: string) {
        renovarOcioso()
        if (destaqueId !== id) destaqueId = id
    }

    // ---------------------------------------------------------------- a camada

    const TIPOS_DA_CAMADA = ["pointerdown", "pointerup", "pointercancel", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "dragstart", "touchstart", "touchend"]

    /** nada do que acontece na camada chega ao que esta embaixo: pointerdown fora do popover fecha, o resto so e engolido */
    function gesto(e: Event) {
        e.stopPropagation()
        e.preventDefault()
        ultimoEvento = performance.now()
        const dentro = !!popElem && popElem.contains(e.target as Node)
        if (e.type === "pointerdown") {
            apertado = true
            if (fase === "aberto" && !dentro) irParaInerte()
        } else if (e.type === "pointerup" || e.type === "pointercancel") {
            apertado = (e as PointerEvent).buttons > 0
        } else if (e.type === "mouseup" || e.type === "touchend") {
            apertado = false
        }
    }

    function camada(node: HTMLElement) {
        document.body.appendChild(node)
        for (const t of TIPOS_DA_CAMADA) node.addEventListener(t, gesto)
        return {
            destroy() {
                for (const t of TIPOS_DA_CAMADA) node.removeEventListener(t, gesto)
                node.remove()
            }
        }
    }

    onDestroy(fecharTudo)

    function dicaDaOpcao(o: { nome: string; itens: number; vazio: boolean }) {
        return `${o.nome}${o.vazio ? " — vazio" : ` — ${o.itens} ${o.itens === 1 ? "item" : "itens"}`}`
    }
</script>

<div class="seletor" class:estreito={layout.semSemana} bind:this={linhaElem} bind:clientWidth={larguraLinha}>
    <button type="button" class="bt agenda" class:aberto={aberto === "agenda"} bind:this={btnAgenda} aria-haspopup="listbox" aria-expanded={aberto === "agenda"} aria-label="Agenda: {nomeAgenda}" data-title="Agenda: {nomeAgenda}" tabindex="-1" on:mousedown|preventDefault on:click={() => abrir("agenda")}>
        <span class="ponto" style="background: {corAgenda}"></span>
        <span class="txt">{nomeAgenda}</span>
        <span class="seta" aria-hidden="true">▾</span>
    </button>
    <button type="button" class="bt dia" class:aberto={aberto === "dia"} class:fora={estadoDia.foraDoFiltro} class:desabilitado={estadoDia.desabilitado} bind:this={btnDia} aria-haspopup="listbox" aria-expanded={aberto === "dia"} aria-disabled={estadoDia.desabilitado} aria-label="Culto: {estadoDia.dica}" data-title={estadoDia.dica} tabindex="-1" on:mousedown|preventDefault on:click={() => abrir("dia")}>
        <span class="txt">{layout.semSemana ? estadoDia.textoCurto : estadoDia.texto}</span>
        {#if diaEhHoje}<span class="hoje">HOJE</span>{/if}
        <span class="seta" aria-hidden="true">▾</span>
    </button>
</div>

{#if fase !== "fechado"}
    <div class="seletor-camada" role="presentation" bind:this={camadaElem} use:camada>
        {#if fase === "aberto"}
            <div class="seletor-pop" role="presentation" bind:this={popElem} style="left: {pos.left}px; top: {pos.top}px; width: {pos.width}px; max-height: {pos.maxHeight}px">
                {#if aberto === "dia" && noAr}
                    <div class="aviso">Há conteúdo no ar. Trocar de culto não mexe no telão.</div>
                {/if}
                <div class="lista" role="listbox" tabindex="-1" aria-label={aberto === "agenda" ? "Agenda" : "Culto"} bind:this={listaElem}>
                    {#if aberto === "agenda"}
                        {#each abas as aba (aba.id)}
                            <!-- svelte-ignore a11y-click-events-have-key-events -->
                            <div class="op local" role="option" tabindex="-1" aria-selected={agendaAtiva === aba.id} data-opcao={aba.id} class:ativa={agendaAtiva === aba.id} class:destaque={destaqueId === aba.id} on:click={() => clicarOpcao(aba.id)} on:mousemove={() => moverMouse(aba.id)}>
                                <span class="ponto grande" style="background: {corDaAgenda(aba.id)}"></span>
                                <span class="rot dupla"><b>{aba.nome}</b><span class="sub">{subDaAgenda(aba.id)}</span></span>
                                {#if agendaAtiva === aba.id}<svg class="ok" viewBox="0 0 10 10" width="11" height="11" aria-hidden="true"><path d="M1.8 5.3 4 7.5 8.3 2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
                            </div>
                        {/each}
                    {:else}
                        {#each grupos as g (g.chave)}
                            <div class="grupo" role="presentation">
                                <div class="cab" role="presentation"><span>{g.titulo}</span><span class="dica">próximos cultos</span></div>
                                <div class="grade" role="presentation">
                                    {#each g.opcoes as o (o.id)}
                                        {@const partes = partesDoDia(o.cultoId)}
                                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                                        <div class="op cartao" class:larga={!partes} role="option" tabindex="-1" aria-selected={$activeProject === o.id} data-opcao={o.id} data-title={dicaDaOpcao(o)} class:ativa={$activeProject === o.id} class:destaque={destaqueId === o.id} class:passado={o.passado} class:arquivado={o.arquivado} on:click={() => clicarOpcao(o.id)} on:mousemove={() => moverMouse(o.id)}>
                                            {#if partes}
                                                <span class="sem">{partes.semana}</span>
                                                <span class="num">{partes.num}</span>
                                                <span class="qtd" aria-label={o.vazio ? "sem material" : `${o.itens} itens`}>{o.vazio ? "vazio" : `${o.itens} ${o.itens === 1 ? "item" : "itens"}`}</span>
                                                <span class="tag" class:hojeTag={o.hoje}>{o.hoje ? (o.hora ? `hoje · ${o.hora}` : "hoje") : o.arquivado ? "arquivado" : o.evento || o.hora}</span>
                                            {:else}
                                                <span class="nomeCartao">{o.curto}</span>
                                                <span class="qtd">{o.vazio ? "vazio" : `${o.itens} ${o.itens === 1 ? "item" : "itens"}`}</span>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                        <!-- leiaute v2: culto avulso (o `newProject` de menuClick). Cria na pasta da agenda escolhida, ou na raiz em Todos. -->
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <div class="op avulso" role="option" tabindex="-1" aria-selected="false" data-opcao="culto-avulso" on:click={criarAvulso}>＋ Culto avulso</div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    /* leiaute v2: o seletor logo abaixo do cabecalho ROTEIRO (12 px de lado, 8 de baixo), botoes de 36 px como o prototipo */
    .seletor {
        display: flex;
        flex: none;
        gap: 6px;
        padding: 0 12px 8px;
    }
    .bt {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        height: 36px;
        box-sizing: border-box;
        padding: 0 10px;
        border: 1px solid var(--luz-borda, rgb(248 248 240 / 0.13));
        border-radius: 8px;
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
        color: var(--luz-texto, #f8f8f0);
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
    }
    .bt.agenda {
        flex: 0 0 auto;
    }
    .bt.dia {
        flex: 1 1 0;
    }
    .bt:hover {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .bt:focus-visible {
        outline: 2px solid var(--focus-ring, var(--secondary));
        outline-offset: 2px;
    }
    .bt.aberto {
        border-color: var(--luz-texto, #f8f8f0);
        box-shadow: 0 0 0 3px rgb(248 248 240 / 0.14);
    }
    .bt .txt {
        min-width: 0;
        flex: 1 1 auto;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .bt .seta {
        flex: none;
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
        font-weight: 400;
        display: inline-block;
        transition: transform 160ms ease;
    }
    .bt.aberto .seta {
        transform: rotate(180deg);
    }
    .ponto {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 4px;
    }
    .ponto.grande {
        width: 10px;
        height: 10px;
        border-radius: 5px;
    }
    .hoje {
        flex: none;
        padding: 2px 5px;
        border-radius: 4px;
        background: rgb(94 196 141 / 0.14);
        color: var(--luz-verde, #5ec48d);
        font-size: 10px;
        font-weight: 700;
    }
    /* o culto aberto esta fora do filtro: o texto fica atenuado (a dica diz o porque) */
    .bt.fora .txt {
        opacity: 0.6;
    }
    .bt.desabilitado {
        cursor: default;
        opacity: 0.6;
    }
    @media (prefers-reduced-motion: reduce) {
        .bt .seta {
            transition: none;
        }
        .seletor-pop {
            animation: none !important;
        }
    }

    /* a camada: cobre a janela inteira, nada passa por ela. No body, fora do .panel (backdrop-filter e overflow). */
    .seletor-camada {
        position: fixed;
        inset: 0;
        z-index: 5000;
        background: transparent;
        -webkit-app-region: no-drag;
        user-select: none;
        -webkit-user-select: none;
    }
    .seletor-pop {
        position: fixed;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
        background: var(--luz-pop, rgb(28 28 31 / 0.82));
        border: 1px solid var(--luz-borda, rgb(248 248 240 / 0.13));
        border-radius: 12px;
        box-shadow:
            inset 0 0 0 1px var(--luz-borda, rgb(248 248 240 / 0.13)),
            var(--luz-sombra-pop);
        backdrop-filter: var(--luz-vidro, none);
        transform-origin: top left;
        animation: luz-surgir 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
        font-family: inherit;
        font-size: 13px;
        color: var(--luz-texto, #f8f8f0);
    }
    .aviso {
        flex: none;
        padding: 7px 10px;
        font-size: 11.5px;
        line-height: 1.3;
        color: var(--text, #ffffff);
        background: var(--sel-wash, rgb(242 26 39 / 0.16));
        border-bottom: 1px solid var(--sel-line, rgb(242 26 39 / 0.3));
    }
    .lista {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 8px;
        outline: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    /* "Novembro 2026 · proximos cultos" ocupa a linha inteira da grade */
    .cab {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2px 4px 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
    }
    .cab .dica {
        font-weight: 400;
    }
    .grupo + .grupo {
        margin-top: 6px;
    }
    .grade {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
    }
    .op {
        cursor: pointer;
        font-variant-numeric: tabular-nums;
    }
    /* local: bolinha, nome e a segunda linha */
    .op.local {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 0 8px;
        border-radius: 6px;
    }
    .op.local.destaque {
        background: rgb(248 248 240 / 0.06);
    }
    .op.local.ativa {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
        box-shadow: inset 2px 0 0 var(--luz-texto, #f8f8f0);
        font-weight: 600;
    }
    .rot {
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        gap: 6px;
        white-space: nowrap;
    }
    .rot.dupla {
        flex-direction: column;
        gap: 1px;
    }
    .rot b {
        font-weight: 600;
    }
    .sub {
        font-size: 11px;
        font-weight: 400;
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
    }
    /* dia: cartao de grade (semana, numero, quantos itens, selo) */
    .op.cartao {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        min-width: 0;
        padding: 8px 4px 6px;
        border: 1px solid var(--luz-linha, rgb(248 248 240 / 0.075));
        border-radius: 10px;
        background: var(--luz-campo, rgb(248 248 240 / 0.06));
        color: var(--luz-texto, #f8f8f0);
        transition:
            background 120ms,
            transform 120ms;
    }
    .op.cartao.larga {
        grid-column: 1 / -1;
        flex-direction: row;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
    }
    .op.cartao.destaque {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .op.cartao.ativa {
        border-color: var(--luz-texto, #f8f8f0);
        background: var(--luz-texto, #f8f8f0);
        color: var(--luz-tinta, #161616);
    }
    .sem {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        opacity: 0.75;
    }
    .num {
        font-size: 22px;
        font-weight: 700;
        line-height: 1.1;
    }
    .qtd {
        font-size: 11px;
        opacity: 0.85;
    }
    .tag {
        height: 14px;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10px;
        font-weight: 700;
        color: var(--luz-mudo, rgb(248 248 240 / 0.5));
    }
    .tag.hojeTag {
        color: var(--luz-verde, #5ec48d);
    }
    .op.cartao.ativa .tag:not(.hojeTag) {
        color: rgb(22 22 22 / 0.6);
    }
    .nomeCartao {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
    }
    .op.cartao.passado .num {
        opacity: 0.78;
    }
    .op.arquivado {
        opacity: 0.7;
    }
    .op.avulso {
        margin-top: 6px;
        padding: 8px 10px;
        border: 1px dashed var(--luz-borda-forte, rgb(248 248 240 / 0.3));
        border-radius: 8px;
        text-align: center;
        font-weight: 600;
    }
    .op.avulso:hover {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .ok {
        flex: none;
        color: var(--luz-texto, #f8f8f0);
    }
</style>
