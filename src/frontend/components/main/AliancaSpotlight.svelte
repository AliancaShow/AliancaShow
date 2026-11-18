<script lang="ts">
    // Leiaute v2, fatia 5: a busca Spotlight (Ctrl+K). Substitui o QuickSearch do FreeShow. Um popover de vidro opaco (estilo Luz) no alto do
    // centro, aberto por Ctrl+K (e pelo "＋ Adicionar ao roteiro"), que procura musicas e apresentacoes (titulo e trecho da letra), midia, audio,
    // versiculos ("Rm 8:28") e acoes do app. Nao flutua: so existe aberto e fecha com Esc, clique fora ou ao escolher.
    //
    // Setas navegam; Enter = acao primaria, Ctrl+Enter = alternativa (o que cada uma faz e `acaoDaTecla` em aliancaSpotlightLogica.ts; a barra de
    // baixo diz o que as duas fazem no resultado marcado). Em Mostrar o show vai ao roteiro com Enter e ao ar (roteiro + 1o slide) com Ctrl+Enter, o
    // versiculo vai ao ar com Enter; em Editar nada vai ao ar. Esc fecha SEM limpar o telao (o Esc de `shortcuts.ts` fecha a busca e `aliancaToque`
    // arma os 700 ms para o proximo).
    //
    // O aberto/fechado e o store `quickSearchActive` (do FreeShow): `common.ts`, `shortcuts.ts` e `aliancaToque.ts` ja o conhecem e ficam no fecho
    // da saida (ancora). A raiz leva a classe `quicksearch`, que `focusArea` (common.ts) usa para NAO fechar no clique de dentro.
    // Ctrl+G e F8 (a "Busca rapida" do menu de contexto, em contextMenus.ts, tambem no fecho da saida) abrem esta mesma busca.
    import { tick } from "svelte"
    import { quickSearchActive, activePopup } from "../../stores"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { acaoDoResultado, buscarAcoes, buscarAudio, buscarMidia, buscarShows, buscarVersiculo, executarResultado, type Resultado } from "../../utils/aliancaSpotlight"
    import { andar, destinoDaTecla, enterDepoisDeFechar, enterRepetido, indiceDaChave, listaEmDia, SECOES, type AcaoDeTecla } from "../../utils/aliancaSpotlightLogica"
    import { tela } from "../../utils/aliancaTela"
    import { escFechou } from "../../utils/aliancaToque"
    import { highlightText } from "../quicksearch/searchHighlight"
    import Icon from "../helpers/Icon.svelte"

    let consulta = ""
    let porSecao: { [id: string]: Resultado[] } = {}
    // o selecionado e a CHAVE do resultado, nunca o indice: quando uma secao chega depois a lista muda de tamanho e o selecionado continua o mesmo
    let selChave: string | null = null
    let campo: HTMLInputElement
    let buscando = false
    // a consulta que gerou a lista na tela, e se ha busca por fazer (debounce pendente ou rodando): o Enter so age sobre a lista da consulta escrita
    let busca = 0
    let adiar: ReturnType<typeof setTimeout> | undefined
    let consultaDaLista = ""
    let pendente = false
    // o Enter que chegou antes da lista alcançar o campo: executa assim que a lista da consulta pintar
    let fila: { ctrl: boolean } | null = null

    // a lista plana, na ordem das secoes (a seta anda por ela)
    $: lista = SECOES.flatMap((s) => porSecao[s.id] || [])
    $: marcado = indiceDaChave(lista, selChave)
    $: atual = lista[marcado] || null

    const ROTULO: { [id in AcaoDeTecla]: string } = {
        roteiro: "pôr no roteiro",
        tocar: "roteiro e primeiro slide no ar",
        "abrir-show": "abrir",
        "abrir-editar": "abrir no editor",
        "abrir-midia": "abrir",
        "ao-ar": "mandar ao ar",
        "abrir-biblia": "abrir na Bíblia",
        executar: "executar"
    }
    $: enter = atual ? acaoDoResultado(atual, false) : null
    $: ctrlEnter = atual ? acaoDoResultado(atual, true) : null
    // as duas teclas fazem a mesma coisa em midia, audio e acao: a barra so mostra uma
    $: mostrarCtrl = !!ctrlEnter && ctrlEnter !== enter

    // ---------- abrir e fechar
    $: if ($quickSearchActive) abriu()
    let jaAberta = false
    // onde o foco estava ao abrir (o chat, o campo da mensagem pro palco...): fechar sem escolher devolve o foco para la
    let focoAnterior: HTMLElement | null = null
    let escolheu = false
    async function abriu() {
        if (jaAberta) return
        jaAberta = true
        const a = document.activeElement as HTMLElement | null
        focoAnterior = a && a !== document.body && a !== campo ? a : null
        escolheu = false
        zerar()
        await tick()
        campo?.focus()
    }
    // ao abrir e ao fechar: nada da busca anterior sobrevive (promessa em voo, debounce pendente, Enter na fila, lista)
    function zerar() {
        busca++
        clearTimeout(adiar)
        adiar = undefined
        fila = null
        pendente = false
        consultaDaLista = ""
        buscando = false
        consulta = ""
        porSecao = {}
        selChave = null
    }
    function fechou() {
        if (!jaAberta) return
        jaAberta = false
        zerar()
        const voltar = focoAnterior
        focoAnterior = null
        // escolher um resultado leva a atencao para onde o resultado foi aberto: so Esc, Ctrl+K e clique fora devolvem o foco
        if (!escolheu && voltar?.isConnected) tick().then(() => (!document.activeElement || document.activeElement === document.body) && voltar.focus())
    }
    $: if (!$quickSearchActive) fechou()

    // ---------- buscar
    function digitou() {
        clearTimeout(adiar)
        fila = null
        const q = consulta
        if (!q.trim()) {
            busca++
            porSecao = {}
            buscando = false
            pendente = false
            consultaDaLista = ""
            return
        }
        pendente = true
        adiar = setTimeout(() => {
            adiar = undefined
            void rodar(q)
        }, 90)
    }
    // a lista da consulta pintou: libera e executa o Enter que esperava por ela
    async function listaPintou(q: string) {
        if (consulta.trim() !== q.trim()) return
        consultaDaLista = q.trim()
        pendente = false
        if (!fila) return
        const f = fila
        fila = null
        await tick()
        if (atual) void escolher(atual, acaoDoResultado(atual, f.ctrl))
    }
    async function rodar(q: string) {
        const minha = ++busca
        buscando = true
        try {
            // primeira pintura: versiculo (le a Biblia ja carregada, nao espera disco), musicas e acoes juntos, na ordem das secoes; o selecionado e o topo.
            // Depois disso a selecao nunca mais sai do lugar: midia e audio (leem pasta) entram ABAIXO, cada um quando chega, sem esperar o outro
            const versiculo = await buscarVersiculo(q)
            if (minha !== busca) return
            selChave = null
            porSecao = { versiculo, show: buscarShows(q), acao: buscarAcoes(q) }
            void listaPintou(q)
            const entrar = async (id: "midia" | "audio", procurar: Promise<Resultado[]>) => {
                const achados = await procurar
                if (minha === busca) porSecao = { ...porSecao, [id]: achados }
            }
            await Promise.all([entrar("midia", buscarMidia(q)), entrar("audio", buscarAudio(q))])
        } catch (erro) {
            falhaAlta("spotlight-buscar", erro)
        } finally {
            if (minha === busca) buscando = false
        }
    }

    // ---------- escolher
    let ultimo: { chave: string; em: number } | null = null
    async function escolher(r: Resultado, acao: AcaoDeTecla | null) {
        if (!acao) return
        // o segundo Enter (ou clique) no mesmo resultado em menos de 400 ms nao faz nada: auto-repeat da tecla e duplo clique
        escolheu = true
        const chave = r.chave + "|" + acao
        const agora = performance.now()
        if (enterRepetido(ultimo, chave, agora)) return
        ultimo = { chave, em: agora }
        await executarResultado(r, acao)
    }

    function manterFoco(e: MouseEvent) {
        if (e.target !== campo) e.preventDefault()
    }
    function marcar(i: number) {
        selChave = lista[i]?.chave ?? null
    }

    function teclar(e: KeyboardEvent) {
        const ctrl = e.ctrlKey || e.metaKey
        const k = e.key.toLowerCase()
        // abrir: Ctrl+K (e Ctrl+G / F8, a "Busca rapida" de sempre). Com um popup aberto a tecla fica para o popup.
        if ((ctrl && (k === "k" || k === "g")) || e.key === "F8") {
            if ($activePopup) return
            e.preventDefault()
            // Ctrl+K segurado repete o keydown: sem isto abriria e fecharia a cada repeticao
            if (e.repeat) return
            quickSearchActive.set(!$quickSearchActive)
            return
        }
        // depois de executar, o Enter que sobrar (tecla segurada, segundo toque) nao pode chegar ao Scripture.svelte, que manda ao ar com Ctrl+Enter
        if (e.key === "Enter" && enterDepoisDeFechar(ultimo?.em ?? null, performance.now(), $quickSearchActive)) {
            e.preventDefault()
            e.stopImmediatePropagation()
            return
        }
        if (!$quickSearchActive) return
        // a tecla que ainda compoe texto (IME, teclado de emoji) e do campo
        if (e.isComposing || e.key === "Process") return
        // o foco escapou do campo: o teclado do telao nao pode agir (Esc limparia o telao, seta e espaco avancariam o slide no ar)
        const destino = destinoDaTecla({ key: e.key, ctrl, alt: e.altKey }, document.activeElement === campo)
        if (destino !== "deixar" && e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") {
            e.preventDefault()
            e.stopImmediatePropagation()
            if (destino === "fechar") {
                escFechou()
                quickSearchActive.set(false)
            } else campo?.focus()
            return
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            e.stopPropagation()
            marcar(andar(marcado, e.key === "ArrowDown" ? 1 : -1, lista.length))
            tick().then(() => document.querySelector(".quicksearch .linha.sel")?.scrollIntoView({ block: "nearest" }))
        } else if (e.key === "Enter") {
            e.preventDefault()
            e.stopPropagation()
            // Enter segurado nao executa de novo (nem empilha avisos)
            if (e.repeat || !consulta.trim()) return
            if (!listaEmDia(consulta, consultaDaLista, pendente)) {
                // a lista ainda e da consulta anterior: o Enter espera por ela (e adianta a busca, sem esperar o debounce)
                fila = { ctrl }
                if (adiar) {
                    clearTimeout(adiar)
                    adiar = undefined
                    void rodar(consulta)
                }
                return
            }
            if (atual) void escolher(atual, ctrl ? ctrlEnter : enter)
        }
    }

    const acaoPrimaria = (r: Resultado) => acaoDoResultado(r, false)
    // ＋ roteiro (todo show) e ▶ (so em Mostrar): os mesmos dois botoes da linha da biblioteca
    const ehShow = (r: Resultado) => r.tipo === "show"
</script>

<svelte:window on:keydown|capture={teclar} />

{#if $quickSearchActive}
    <!-- o mousedown em qualquer parte que nao seja o campo nao tira o foco dele (o foco fora do campo deixaria o teclado do telao agir) -->
    <div class="quicksearch spotlight" data-acao="spotlight" role="dialog" aria-label="Buscar" on:mousedown={manterFoco}>
        <div class="campo">
            <span class="lupa" aria-hidden="true"><Icon id="search" size={1.2} white /></span>
            <input bind:this={campo} class="edit" data-acao="spotlight-campo" type="text" placeholder="Buscar música, letra, mídia, versículo (Rm 8:28) ou ação" spellcheck="false" autocomplete="off" bind:value={consulta} on:input={digitou} />
            <span class="atalho">Ctrl+K</span>
        </div>

        {#if consulta.trim() && lista.length}
            <div class="resultados" role="listbox">
                {#each SECOES as secao (secao.id)}
                    {#if (porSecao[secao.id] || []).length}
                        <div class="titulo">{secao.titulo}</div>
                        {#each porSecao[secao.id] as r (r.chave)}
                            {@const i = lista.indexOf(r)}
                            <!-- svelte-ignore a11y-click-events-have-key-events -->
                            <div class="linha" class:sel={i === marcado} class:aviso={!!r.versiculo?.motivo} role="option" aria-selected={i === marcado} tabindex="-1" data-resultado={r.chave} data-tipo={r.tipo} on:mousemove={() => marcar(i)} on:mousedown|preventDefault on:click={() => escolher(r, acaoPrimaria(r))}>
                                <span class="icone"><Icon id={r.icone || "slide"} size={1.1} white /></span>
                                <span class="texto">
                                    <span class="nome">{r.titulo}</span>
                                    {#if r.detalhe}<span class="detalhe">{#if r.tipo === "show"}{@html highlightText(r.detalhe, consulta)}{:else}{r.detalhe}{/if}</span>{/if}
                                </span>
                                {#if r.atalho}<span class="atalho">{r.atalho}</span>{/if}
                                {#if ehShow(r)}
                                    <button class="mini" data-acao="spotlight-roteiro" tabindex="-1" data-title="Pôr no fim do roteiro" on:mousedown|preventDefault|stopPropagation on:click|stopPropagation={() => escolher(r, "roteiro")}>＋ roteiro</button>
                                    {#if $tela === "mostrar"}
                                        <button class="mini tocar" data-acao="spotlight-tocar" tabindex="-1" data-title="Põe no roteiro e manda o primeiro slide ao ar" on:mousedown|preventDefault|stopPropagation on:click|stopPropagation={() => escolher(r, "tocar")}>▶</button>
                                    {/if}
                                {/if}
                            </div>
                        {/each}
                    {/if}
                {/each}
            </div>
        {:else if consulta.trim()}
            <div class="vazio">{buscando ? "Procurando…" : "Nada encontrado."}</div>
        {:else}
            <div class="vazio">Música ou trecho da letra, mídia, áudio, versículo (<b>Rm 8:28</b>, <b>Jo 3.16</b>) ou uma ação (<b>Configurações</b>, <b>Telas</b>…).</div>
        {/if}

        <div class="dicas">
            <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
            {#if enter}<span><kbd>Enter</kbd> {ROTULO[enter]}</span>{/if}
            {#if mostrarCtrl && ctrlEnter}<span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> {ROTULO[ctrlEnter]}</span>{/if}
            <span class="fim"><kbd>Esc</kbd> fecha</span>
        </div>
    </div>
{/if}

<style>
    .spotlight {
        position: fixed;
        z-index: 5001;
        left: 50%;
        top: 12vh;
        transform: translateX(-50%);
        width: 680px;
        max-width: calc(100vw - 32px);
        max-height: 72vh;
        display: flex;
        flex-direction: column;
        background: var(--luz-pop-opaco);
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio);
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            0 24px 64px rgba(0, 0, 0, 0.6);
        color: var(--luz-texto);
        font-family: var(--luz-fonte);
        -webkit-app-region: no-drag;
        animation: luz-surgir 120ms ease-out;
    }
    .campo {
        position: relative;
        display: flex;
        align-items: center;
        flex-shrink: 0;
        padding: 12px;
        border-bottom: 1px solid var(--luz-linha);
    }
    .lupa {
        position: absolute;
        left: 26px;
        display: flex;
        opacity: 0.5;
        pointer-events: none;
    }
    input {
        flex: 1;
        height: 48px;
        padding: 0 70px 0 46px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        color: inherit;
        font: inherit;
        font-size: 17px;
        outline: none;
    }
    input:focus {
        border-color: var(--luz-borda-forte);
    }
    .campo .atalho {
        position: absolute;
        right: 26px;
        font-size: 12px;
        color: var(--luz-mudo);
        pointer-events: none;
    }
    .resultados {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 6px;
    }
    .titulo {
        padding: 10px 10px 4px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--luz-mudo);
    }
    .linha {
        min-height: 48px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
    }
    .linha.sel {
        background: var(--luz-hover);
    }
    .linha.aviso .nome {
        color: var(--luz-ambar);
    }
    .icone {
        display: flex;
        flex-shrink: 0;
        width: 22px;
        justify-content: center;
        opacity: 0.7;
    }
    .texto {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }
    .nome {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .detalhe {
        font-size: 12px;
        color: var(--luz-mudo);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .detalhe :global(mark) {
        background: var(--luz-hover);
        color: var(--luz-texto);
        border-radius: 3px;
        padding: 0 2px;
    }
    .linha > .atalho {
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .mini {
        flex-shrink: 0;
        min-width: 36px;
        height: 32px;
        padding: 0 10px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        color: inherit;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .mini:hover {
        background: var(--luz-hover);
        border-color: var(--luz-borda-forte);
    }
    .vazio {
        padding: 22px 18px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--luz-mudo);
    }
    .vazio b {
        color: var(--luz-texto);
        font-weight: 600;
    }
    .dicas {
        flex-shrink: 0;
        display: flex;
        gap: 16px;
        align-items: center;
        padding: 9px 14px;
        border-top: 1px solid var(--luz-linha);
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .dicas .fim {
        margin-left: auto;
    }
    kbd {
        display: inline-block;
        min-width: 18px;
        padding: 1px 5px;
        margin-right: 3px;
        border: 1px solid var(--luz-borda);
        border-radius: 5px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 11px;
        text-align: center;
        color: var(--luz-texto);
    }
</style>
