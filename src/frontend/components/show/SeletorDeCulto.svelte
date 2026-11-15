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
    import { activePage, activePopup, activeProject, focusMode, folders, modoAlianca, outputs, projects, projectView } from "../../stores"
    import { cultoDoProjeto } from "../../utils/agendas"
    import { algoNoAr } from "../../utils/aliancaModo"
    import { abaLateral } from "../../utils/aliancaBibliotecaEstado"
    import { quantosDoOperador } from "../../utils/aliancaSirvoProjeto"
    import { CARENCIA_ABERTURA_MS, CARENCIA_MUDANCA_MS, OCIOSO_MS, POPOVER_SEM_CONTAGEM, TETO_TECLA_MS, assinaturaDasOpcoes, camadaPodeSair, decidirTecla, dentroDaCarencia, estadoDoBotaoDia, hojeLocalISO, indiceInicial, larguraDoLayout, moverDestaque, montarOpcoesDeDia, nomeDaAgenda, opcoesPlanas, posicaoDoPopover } from "../../utils/aliancaSeletorLogica"
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
    $: semContagem = pos.width < POPOVER_SEM_CONTAGEM

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
        pos = posicaoDoPopover({ linha: { left: r.left + 10, width: r.width - 20 }, base: bt.bottom, janelaAltura: window.innerHeight })
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
        for (const store of [modoAlianca, abaLateral, focusMode, activePage, activePopup] as { subscribe: (f: () => void) => () => void }[]) {
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
    <button type="button" class="bt agenda" class:aberto={aberto === "agenda"} style="flex: 0 1 {layout.agendaPct}%" bind:this={btnAgenda} aria-haspopup="listbox" aria-expanded={aberto === "agenda"} aria-label="Agenda: {nomeAgenda}" data-title="Agenda: {nomeAgenda}" tabindex="-1" on:mousedown|preventDefault on:click={() => abrir("agenda")}>
        <span class="txt">{nomeAgenda}</span>
        <svg class="seta" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <button type="button" class="bt dia" class:aberto={aberto === "dia"} class:fora={estadoDia.foraDoFiltro} class:desabilitado={estadoDia.desabilitado} bind:this={btnDia} aria-haspopup="listbox" aria-expanded={aberto === "dia"} aria-disabled={estadoDia.desabilitado} aria-label="Culto: {estadoDia.dica}" data-title={estadoDia.dica} tabindex="-1" on:mousedown|preventDefault on:click={() => abrir("dia")}>
        <span class="txt">{layout.semSemana ? estadoDia.textoCurto : estadoDia.texto}</span>
        <svg class="seta" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
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
                            <div class="op" role="option" tabindex="-1" aria-selected={agendaAtiva === aba.id} data-opcao={aba.id} class:ativa={agendaAtiva === aba.id} class:destaque={destaqueId === aba.id} on:click={() => clicarOpcao(aba.id)} on:mousemove={() => moverMouse(aba.id)}>
                                <span class="rot"
                                    >{aba.nome}{#if aba.id === "todos"}<span class="sub">todas as agendas</span>{/if}</span
                                >
                                {#if agendaAtiva === aba.id}<svg class="ok" viewBox="0 0 10 10" width="11" height="11" aria-hidden="true"><path d="M1.8 5.3 4 7.5 8.3 2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
                            </div>
                        {/each}
                    {:else}
                        {#each grupos as g (g.chave)}
                            <div class="grupo" role="presentation">
                                <div class="cab" role="presentation"><span>{g.titulo}</span></div>
                                {#each g.opcoes as o (o.id)}
                                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                                    <div class="op" role="option" tabindex="-1" aria-selected={$activeProject === o.id} data-opcao={o.id} data-title={dicaDaOpcao(o)} class:ativa={$activeProject === o.id} class:destaque={destaqueId === o.id} class:passado={o.passado} class:arquivado={o.arquivado} on:click={() => clicarOpcao(o.id)} on:mousemove={() => moverMouse(o.id)}>
                                        <span class="rot">
                                            <span class="data">{semContagem ? o.semSemana : o.curto}</span>
                                            {#if o.evento}<span class="ev">· {o.evento}</span>{/if}
                                            {#if o.hoje}<span class="selo">hoje</span>{/if}
                                            {#if o.arquivado}<span class="selo arq">arquivado</span>{/if}
                                        </span>
                                        <span class="info" class:cheio={!o.vazio} aria-label={o.vazio ? "sem material" : `${o.itens} itens`}>
                                            <i class="pip" class:cheio={!o.vazio}></i>
                                            {#if !semContagem}<span class="n">{o.vazio ? "vazio" : `${o.itens} ${o.itens === 1 ? "item" : "itens"}`}</span>{/if}
                                        </span>
                                        {#if $activeProject === o.id}<svg class="ok" viewBox="0 0 10 10" width="11" height="11" aria-hidden="true"><path d="M1.8 5.3 4 7.5 8.3 2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    /* o cabecalho do painel e absoluto, 30px, e flutua por cima: o seletor comeca abaixo dele */
    .seletor {
        display: flex;
        flex: none;
        gap: 6px;
        margin-top: 30px;
        padding: 6px 10px 8px;
    }
    .bt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        min-width: 0;
        height: 30px;
        padding: 0 10px;
        border: none;
        border-radius: 8px;
        background: rgb(255 255 255 / 0.06);
        color: var(--text, #c2c3c9);
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
        transition: background-color 120ms ease;
    }
    .bt.dia {
        flex: 1 1 0;
    }
    /* painel estreito: o botao aperta o respiro para o nome da agenda caber */
    .seletor.estreito .bt {
        gap: 4px;
        padding: 0 7px;
    }
    .bt:hover {
        background: rgb(255 255 255 / 0.1);
    }
    .bt:focus-visible {
        outline: 2px solid var(--focus-ring, var(--secondary));
        outline-offset: 2px;
    }
    .bt .txt {
        opacity: 0.82;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .bt .seta {
        flex: none;
        transition: transform 120ms ease;
    }
    .bt.aberto {
        background: var(--sel-wash, rgb(242 26 39 / 0.16));
        box-shadow: inset 0 0 0 1px var(--sel-line, rgb(242 26 39 / 0.3));
        color: var(--text, #ffffff);
    }
    .bt.aberto .txt {
        opacity: 1;
    }
    .bt.aberto .seta {
        transform: rotate(180deg);
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
        .bt.aberto .seta {
            transform: none;
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
        background: var(--primary-darker);
        border: 1px solid var(--glass-line, rgb(255 255 255 / 0.1));
        border-radius: 10px;
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
        font-family: inherit;
        font-size: 12.5px;
        color: var(--text, #c2c3c9);
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
        padding: 4px;
        outline: none;
    }
    .cab {
        position: sticky;
        top: -4px;
        z-index: 1;
        padding: 6px 8px 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--text, #c2c3c9);
        background: var(--primary-darker);
    }
    .cab span {
        opacity: 0.72;
    }
    .op {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        padding: 0 8px;
        border-radius: 6px;
        cursor: pointer;
        font-variant-numeric: tabular-nums;
    }
    .op.destaque {
        background: rgb(128 128 128 / 0.2);
    }
    .op.ativa {
        background: var(--sel-wash, rgb(242 26 39 / 0.16));
        color: var(--text, #ffffff);
    }
    .rot {
        display: flex;
        align-items: baseline;
        flex: 1 1 auto;
        min-width: 0;
        gap: 6px;
        white-space: nowrap;
    }
    .data {
        flex: none;
    }
    .ev {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.8;
    }
    .sub {
        margin-left: 8px;
        font-size: 11px;
        opacity: 0.68;
    }
    .op.passado .data {
        opacity: 0.78;
    }
    .op.arquivado {
        opacity: 0.7;
    }
    .selo {
        flex: none;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 10.5px;
        color: var(--text, #ffffff);
        box-shadow: inset 0 0 0 1px var(--sel-line, rgb(242 26 39 / 0.3));
    }
    .info {
        display: flex;
        flex: none;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        opacity: 0.78;
    }
    .info.cheio {
        opacity: 0.95;
    }
    .pip {
        flex: none;
        box-sizing: border-box;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        border: 1.5px solid currentColor;
    }
    .pip.cheio {
        border-color: #4ade80;
        background: #4ade80;
    }
    .ok {
        flex: none;
        color: var(--text, #ffffff);
    }
</style>
