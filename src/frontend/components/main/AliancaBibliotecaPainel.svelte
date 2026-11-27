<script lang="ts">
    // Leiaute v2: a biblioteca, faixa de ponta a ponta por baixo do roteiro e do centro, nos dois modos. Sem estado fechado.
    // Cabecalho (rotulo, chips, busca, "＋ Novo") + arvore (largura = a da esquerda) + conteudo da pasta aberta. Shows usa a lista nova
    // (AliancaShowsLista); as demais pastas mostram o conteudo de hoje (components/drawer/Content.svelte) dentro do tema: declarado.
    //
    // Classes-gancho de upstream: a raiz mantem `drawer` e a busca mantem `search edit drawer_search` (Shows, Scripture, Editbox, BoxStyle).
    // Teclado que morava em Drawer.svelte: Ctrl+F foca a busca; Enter na busca (pasta Shows) abre o primeiro e o poe no projeto;
    // Ctrl+Enter manda o primeiro ao ar (atras de teclaIgnorada); Esc com a busca vazia a recolhe; `drawer_search` foca a busca.
    // Morrem, por nao existir mais gaveta fechada: Ctrl+D e a troca para Shows do Ctrl+F.
    import { activePage, activePopup, activeProject, activeShow, activeTriggerFunction, activeDrawerTab, categories, projects, shows, showsCache } from "../../stores"
    import { filtroSemCategoria } from "../../utils/aliancaArvoreLogica"
    import { getAccess } from "../../utils/profile"
    import { executarComandoNovo } from "../../utils/aliancaBiblioteca"
    import { buscaDaBiblioteca, soSemLetraNaBiblioteca } from "../../utils/aliancaBibliotecaEstado"
    import { teclaIgnorada } from "../../utils/aliancaModo"
    import { escFechou } from "../../utils/aliancaToque"
    import { getLayoutRef } from "../helpers/show"
    import { history } from "../helpers/history"
    import { loadShows } from "../helpers/setShow"
    import { setOutput } from "../helpers/output"
    import { updateOut } from "../helpers/showActions"
    import { shouldOpenReplace } from "../../utils/shortcuts"
    import Content from "../drawer/Content.svelte"
    import { drawerTabsData } from "../../stores"
    import AliancaArvore from "./AliancaArvore.svelte"
    import AliancaBibliotecaAbas from "./AliancaBibliotecaAbas.svelte"
    import Icon from "../helpers/Icon.svelte"
    import AliancaMidiaBarra from "./AliancaMidiaBarra.svelte"
    import AliancaMidiaControles from "./AliancaMidiaControles.svelte"
    import AliancaShowsLista from "./AliancaShowsLista.svelte"
    import AliancaModeloBiblia from "./AliancaModeloBiblia.svelte"

    export let esq = 280

    let searchValue = ""
    let firstMatch: null | any = null
    let campo: HTMLInputElement
    let novoAberto = false

    $: emShows = $activeDrawerTab === "shows"
    // C6: "Sem categoria · N" no cabecalho da lista (era a linha "Sem etiqueta" da arvore); some quando N chega a zero
    $: acessoShows = getAccess("shows")
    $: semCategoria = Object.values($shows).filter((s: any) => s && !s.private && acessoShows[s.category || ""] !== "none" && (s.category === null || s.category === undefined || !$categories[s.category])).length
    $: subShows = $drawerTabsData.shows?.activeSubTab || "all"
    $: filtro = filtroSemCategoria(semCategoria, subShows)
    function alternarSemCategoria() {
        drawerTabsData.update((a) => {
            a.shows = { ...a.shows, activeSubTab: filtro.ativo ? "all" : "unlabeled", enabled: a.shows?.enabled !== false }
            return a
        })
    }
    // funil/＋ (AliancaMidiaBarra) e exibicao (AliancaMidiaControles) da pasta Midia (nao valem nas abas online e de entradas)
    $: emMidia = $activeDrawerTab === "media" && !["online", "inputs"].includes($drawerTabsData.media?.activeSubTab || "")
    // a busca de Shows e a mesma `buscaDaBiblioteca` da lista; nas outras pastas vale o `searchValue` do Content
    $: if (emShows) buscaDaBiblioteca.set(searchValue)
    // trocar de pasta zera a busca (a do Content nao carrega de uma pasta para outra)
    let pastaVista = $activeDrawerTab
    $: if ($activeDrawerTab !== pastaVista) {
        pastaVista = $activeDrawerTab
        searchValue = ""
        soSemLetraNaBiblioteca.set(false)
    }

    async function teclar(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            if ($activePopup === "show" || shouldOpenReplace()) return
            e.preventDefault()
            campo?.focus()
        } else if (e.key === "Enter") {
            if (document.activeElement !== campo || !searchValue.length || !firstMatch || !emShows) return
            const match = firstMatch
            if (e.ctrlKey || e.metaKey) {
                if (teclaIgnorada()) return
                const showId = match.id
                await loadShows([showId])
                if (!$showsCache[showId]) return
                const layoutRef = getLayoutRef(showId)
                const primeiro = layoutRef.findIndex((a) => !a.data.disabled)
                if (primeiro === -1) return
                updateOut("active", primeiro, layoutRef)
                setOutput("slide", { id: showId, layout: $showsCache[showId].settings.activeLayout, index: primeiro })
                return
            }
            if (!$activeProject) return
            campo.select()
            const novoIndice = ($activeShow?.index ?? $projects[$activeProject]?.shows?.length - 1) + 1
            if ($activePage === "show") history({ id: "UPDATE", newData: { key: "shows", index: novoIndice, data: { id: match.id } }, oldData: { id: $activeProject }, location: { page: "show", id: "project_ref" } })
            activeShow.set({ ...match, index: novoIndice })
            searchValue = ""
        } else if (e.key === "Escape") {
            if (document.activeElement === campo && !searchValue.length) {
                escFechou()
                campo.blur()
            }
        }
    }
    $: if ($activeTriggerFunction === "drawer_search") campo?.focus()

    // O campo de busca NAO trata teclado por conta propria (como o do Drawer antigo): Ctrl+Enter, F1-F5, Esc e os atalhos com Ctrl seguem para o
    // ouvinte de janela (`teclar`) e para os atalhos globais UMA vez. Chamar `teclar` daqui mandava o primeiro slide ao ar duas vezes (Ctrl+Enter).

    const NOVOS = [
        { id: "musica", rotulo: "Nova música", icone: "music" },
        { id: "apresentacao", rotulo: "Nova apresentação", icone: "slide" },
        { id: "importar", rotulo: "Importar arquivo", icone: "import" }
    ] as const
    let filtroAberto = false
    // quantos filtros fogem do padrao (Musicas, tudo): a bolinha do funil
    $: nFiltros = ($soSemLetraNaBiblioteca ? 1 : 0) + (filtro.ativo ? 1 : 0)
    function novo(id: "musica" | "apresentacao" | "importar") {
        novoAberto = false
        executarComandoNovo(id)
    }
    function fora(e: MouseEvent) {
        if (novoAberto && !(e.target as HTMLElement).closest?.(".novoRaiz")) novoAberto = false
        if (filtroAberto && !(e.target as HTMLElement).closest?.(".filtroRaiz")) filtroAberto = false
    }
</script>

<svelte:window on:keydown={teclar} on:mousedown={fora} />

<div class="drawer painelBib" data-acao="biblioteca">
    <div class="cab">
        <!-- 26/nov: abas fixas (nivel 1) no lugar do rotulo e das raizes da arvore; os 4 chips de texto viraram dois icones: funil e ＋ -->
        <AliancaBibliotecaAbas />
        {#if emShows}
            <div class="menuRaiz filtroRaiz">
                <button class="ico" class:ligado={nFiltros > 0} data-acao="biblioteca-filtro" data-title={nFiltros ? `Filtros ligados: ${nFiltros}` : "Filtrar"} aria-label="Filtrar" aria-haspopup="menu" aria-expanded={filtroAberto} tabindex="-1" on:mousedown|preventDefault on:click={() => ((filtroAberto = !filtroAberto), (novoAberto = false))}>
                    <!-- funil desenhado aqui: a lista de icones (values/icons.ts) e do fecho e nao tem funil -->
                    <svg class="funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A1 1 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z" /></svg>
                    {#if nFiltros}<span class="bolinha">{nFiltros}</span>{:else if semCategoria}<span class="pingo" />{/if}
                </button>
                {#if filtroAberto}
                    <div class="pop" role="menu">
                        <!-- 26/nov: musicas/apresentacoes saiu daqui (as categorias da arvore ja fazem isso); o funil so filtra pendencias -->
                        <div class="sec">Mostrar só</div>
                        <button class="item" role="menuitemcheckbox" aria-checked={$soSemLetraNaBiblioteca} data-acao="filtro-sem-letra" tabindex="-1" on:mousedown|preventDefault on:click={() => soSemLetraNaBiblioteca.update((v) => !v)}><span class="ck">{$soSemLetraNaBiblioteca ? "✓" : ""}</span>Sem letra</button>
                        {#if filtro.visivel}
                            <button class="item" role="menuitemcheckbox" aria-checked={filtro.ativo} data-acao="filtro-sem-categoria" tabindex="-1" on:mousedown|preventDefault on:click={alternarSemCategoria}><span class="ck">{filtro.ativo ? "✓" : ""}</span>Sem categoria<span class="n">{semCategoria}</span></button>
                        {/if}
                    </div>
                {/if}
            </div>
            <div class="menuRaiz novoRaiz">
                <button class="ico" data-acao="biblioteca-novo" data-title="Novo" aria-label="Novo" aria-haspopup="menu" aria-expanded={novoAberto} tabindex="-1" on:mousedown|preventDefault on:click={() => ((novoAberto = !novoAberto), (filtroAberto = false))}><svg class="mais" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg></button>
                {#if novoAberto}
                    <div class="pop" role="menu">
                        {#each NOVOS as n (n.id)}
                            <button class="item" role="menuitem" tabindex="-1" on:mousedown|preventDefault on:click={() => novo(n.id)}><span class="ck"><Icon id={n.icone} size={0.8} white /></span>{n.rotulo}</button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
        {#if emMidia}
            <AliancaMidiaBarra />
        {/if}
        {#if $activeDrawerTab === "scripture"}
            <AliancaModeloBiblia />
        {/if}
        <span class="espaco"></span>
        {#if emMidia}
            <AliancaMidiaControles />
        {/if}
        <!-- cabine 26/nov: um X para limpar a busca e voltar a mostrar tudo (aparece so com texto) -->
        <div class="buscaCaixa">
            <input bind:this={campo} class="busca search edit drawer_search" type="text" placeholder="Buscar música, trecho da letra ou versículo" spellcheck="false" autocomplete="off" bind:value={searchValue} />
            {#if searchValue}
                <button class="limpar" data-acao="limpar-busca" data-title="Limpar a busca" aria-label="Limpar a busca" tabindex="-1" on:mousedown|preventDefault on:click={() => ((searchValue = ""), campo?.focus())}>✕</button>
            {/if}
        </div>
    </div>
    <div class="corpo">
        <div class="arv" style="width: {esq}px"><AliancaArvore /></div>
        <div class="sep" />
        <div class="conteudo">
            {#if emShows}
                <AliancaShowsLista bind:firstMatch />
            {:else}
                <Content id={$activeDrawerTab} bind:searchValue bind:firstMatch />
            {/if}
        </div>
    </div>
</div>

<style>
    .painelBib {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }
    .cab {
        height: 44px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 12px;
        border-bottom: 1px solid var(--luz-linha);
    }
    /* funil e ＋ (tambem na Midia e na Biblia: por isso :global sob .cab): botoes de icone de 28 px; o funil ligado fica claro, com a bolinha do numero de filtros */
    .cab :global(.ico) {
        position: relative;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
    }
    .cab :global(.ico:hover),
    .cab :global(.ico[aria-expanded="true"]) {
        background: var(--luz-hover);
    }
    .cab :global(.ico.ligado) {
        border-color: var(--luz-borda-forte);
        background: var(--luz-hover);
    }
    .cab :global(.bolinha) {
        position: absolute;
        top: -5px;
        right: -5px;
        min-width: 15px;
        height: 15px;
        padding: 0 3px;
        box-sizing: border-box;
        border-radius: 8px;
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font-size: 10px;
        font-weight: 700;
        line-height: 15px;
        text-align: center;
    }
    /* ha musica sem categoria (pendencia de arrumacao): pingo laranja no funil */
    .cab :global(.pingo) {
        position: absolute;
        top: -3px;
        right: -3px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--luz-laranja);
    }
    .cab :global(.funil),
    .cab :global(.mais) {
        width: 16px;
        height: 16px;
        fill: var(--luz-texto);
    }
    .cab :global(.menuRaiz) {
        position: relative;
    }
    .cab :global(.sec) {
        padding: 6px 10px 2px;
        font-size: 10px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--luz-mudo);
    }
    .cab :global(.ck) {
        display: inline-flex;
        justify-content: center;
        width: 16px;
        margin-inline-end: 8px;
    }
    .cab :global(.n) {
        margin-inline-start: auto;
        padding-inline-start: 10px;
        font-size: 11px;
        color: var(--luz-laranja);
    }
    .espaco {
        flex: 1;
    }
    .busca {
        height: 28px;
        width: 300px;
        box-sizing: border-box;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: transparent;
        padding: 0 10px;
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
    }
    .buscaCaixa {
        position: relative;
        display: flex;
        align-items: center;
    }
    .buscaCaixa .busca {
        padding-inline-end: 30px;
    }
    .limpar {
        position: absolute;
        right: 4px;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--luz-mudo);
        font-size: 12px;
        cursor: pointer;
    }
    .limpar:hover {
        background: var(--luz-hover);
        color: var(--luz-texto);
    }
    .busca::placeholder {
        color: var(--luz-mudo);
    }
    .cab :global(.pop) {
        position: absolute;
        z-index: 40;
        /* cabine-5: abre PARA BAIXO, sobre a lista. Para cima saia do painel (overflow: hidden) e sumia atras dos slides */
        top: calc(100% + 6px);
        left: 0;
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: 10px;
        box-shadow: inset 0 0 0 1px var(--luz-borda), var(--luz-sombra-pop);
        animation: luz-surgir 120ms ease-out;
    }
    .cab :global(.item) {
        display: flex;
        align-items: center;
        min-height: 30px;
        padding: 4px 8px;
        border: none;
        border-radius: 8px;
        background: transparent;
        font: inherit;
        font-size: 13px;
        text-align: left;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .cab :global(.item:hover) {
        background: var(--luz-hover);
    }
    .cab :global(.pop.direita) {
        left: auto;
        right: 0;
    }
    .cab :global(.ico:disabled) {
        opacity: 0.4;
        cursor: default;
    }
    .corpo {
        flex: 1;
        min-height: 0;
        display: flex;
    }
    .arv {
        flex-shrink: 0;
        min-height: 0;
    }
    .sep {
        width: 1px;
        flex-shrink: 0;
        margin: 0 4px 0 3px;
        background: var(--luz-linha);
    }
    .conteudo {
        flex: 1;
        min-width: 0;
        overflow: auto;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        position: relative;
    }
    .conteudo :global(.main) {
        background: transparent;
    }
</style>
