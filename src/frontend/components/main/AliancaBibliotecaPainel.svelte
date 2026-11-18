<script lang="ts">
    // Leiaute v2: a biblioteca, faixa de ponta a ponta por baixo do roteiro e do centro, nos dois modos. Sem estado fechado.
    // Cabecalho (rotulo, chips, busca, "＋ Novo") + arvore (largura = a da esquerda) + conteudo da pasta aberta. Shows usa a lista nova
    // (AliancaShowsLista); as demais pastas mostram o conteudo de hoje (components/drawer/Content.svelte) dentro do tema: declarado.
    //
    // Classes-gancho de upstream: a raiz mantem `drawer` e a busca mantem `search edit drawer_search` (Shows, Scripture, Editbox, BoxStyle).
    // Teclado que morava em Drawer.svelte: Ctrl+F foca a busca; Enter na busca (pasta Shows) abre o primeiro e o poe no projeto;
    // Ctrl+Enter manda o primeiro ao ar (atras de teclaIgnorada); Esc com a busca vazia a recolhe; `drawer_search` foca a busca.
    // Morrem, por nao existir mais gaveta fechada: Ctrl+D e a troca para Shows do Ctrl+F.
    import { activePage, activePopup, activeProject, activeShow, activeTriggerFunction, activeDrawerTab, projects, showsCache } from "../../stores"
    import { executarComandoNovo } from "../../utils/aliancaBiblioteca"
    import { buscaDaBiblioteca, soSemLetraNaBiblioteca, tipoDaBiblioteca } from "../../utils/aliancaBibliotecaEstado"
    import { teclaIgnorada } from "../../utils/aliancaModo"
    import { getLayoutRef } from "../helpers/show"
    import { history } from "../helpers/history"
    import { loadShows } from "../helpers/setShow"
    import { setOutput } from "../helpers/output"
    import { updateOut } from "../helpers/showActions"
    import { shouldOpenReplace } from "../../utils/shortcuts"
    import Content from "../drawer/Content.svelte"
    import AliancaFiltros from "../drawer/media/AliancaFiltros.svelte"
    import { drawerTabsData } from "../../stores"
    import AliancaArvore from "./AliancaArvore.svelte"
    import AliancaMidiaControles from "./AliancaMidiaControles.svelte"
    import AliancaShowsLista from "./AliancaShowsLista.svelte"

    export let esq = 280

    let searchValue = ""
    let firstMatch: null | any = null
    let campo: HTMLInputElement
    let novoAberto = false

    $: emShows = $activeDrawerTab === "shows"
    // chips Video/Foto/Audio e zoom/modo da pasta Midia (nao valem nas abas online e de entradas)
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
            if (document.activeElement === campo && !searchValue.length) campo.blur()
        }
    }
    $: if ($activeTriggerFunction === "drawer_search") campo?.focus()

    function teclaDoCampo(e: KeyboardEvent) {
        // Backspace/Delete/Enter/Esc digitados aqui nunca chegam ao keydown global; Ctrl+Enter/Ctrl+F sao tratados em `teclar` (janela)
        if (!(e.key === "Enter" && (e.ctrlKey || e.metaKey)) && !((e.ctrlKey || e.metaKey) && e.key === "f")) e.stopPropagation()
        if (e.key === "Escape") {
            e.preventDefault()
            if (searchValue.length) searchValue = ""
            else campo.blur()
        }
        if (e.key === "Enter") teclar(e)
    }

    const NOVOS = [
        { id: "musica", rotulo: "＋ Nova música" },
        { id: "apresentacao", rotulo: "＋ Nova apresentação" },
        { id: "importar", rotulo: "Importar arquivo" }
    ] as const
    function novo(id: "musica" | "apresentacao" | "importar") {
        novoAberto = false
        executarComandoNovo(id)
    }
    function fora(e: MouseEvent) {
        if (novoAberto && !(e.target as HTMLElement).closest?.(".novoRaiz")) novoAberto = false
    }
</script>

<svelte:window on:keydown={teclar} on:mousedown={fora} />

<div class="drawer painelBib" data-acao="biblioteca">
    <div class="cab">
        <span class="rotulo">BIBLIOTECA</span>
        {#if emShows}
            <button class="chip" class:on={$tipoDaBiblioteca === "musicas" && !$soSemLetraNaBiblioteca} tabindex="-1" on:mousedown|preventDefault on:click={() => (tipoDaBiblioteca.set("musicas"), soSemLetraNaBiblioteca.set(false))}>Músicas</button>
            <button class="chip" class:on={$tipoDaBiblioteca === "apresentacoes"} tabindex="-1" on:mousedown|preventDefault on:click={() => (tipoDaBiblioteca.set("apresentacoes"), soSemLetraNaBiblioteca.set(false))}>Apresentações</button>
            <button class="chip" class:on={$soSemLetraNaBiblioteca} tabindex="-1" on:mousedown|preventDefault on:click={() => (tipoDaBiblioteca.set("musicas"), soSemLetraNaBiblioteca.update((v) => !v))}>Sem letra</button>
            <div class="novoRaiz">
                <button class="chip" tabindex="-1" aria-haspopup="menu" aria-expanded={novoAberto} on:mousedown|preventDefault on:click={() => (novoAberto = !novoAberto)}>＋ Novo</button>
                {#if novoAberto}
                    <div class="pop" role="menu">
                        {#each NOVOS as n (n.id)}
                            <button class="item" role="menuitem" tabindex="-1" on:mousedown|preventDefault on:click={() => novo(n.id)}>{n.rotulo}</button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
        {#if emMidia}
            <AliancaFiltros />
        {/if}
        <span class="espaco"></span>
        {#if emMidia}
            <AliancaMidiaControles />
        {/if}
        <input bind:this={campo} class="busca search edit drawer_search" type="text" placeholder="Buscar música, trecho da letra ou versículo" spellcheck="false" autocomplete="off" bind:value={searchValue} on:keydown={teclaDoCampo} />
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
    .rotulo {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
        margin-right: 4px;
    }
    .chip {
        height: 28px;
        padding: 0 10px;
        border-radius: 14px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid var(--luz-borda);
        background: var(--luz-campo);
        color: var(--luz-texto);
    }
    .chip.on {
        border-color: var(--luz-texto);
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .espaco {
        flex: 1;
    }
    .busca {
        height: 32px;
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
    .busca::placeholder {
        color: var(--luz-mudo);
    }
    .novoRaiz {
        position: relative;
    }
    .pop {
        position: absolute;
        z-index: 40;
        bottom: 34px;
        left: 0;
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: 10px;
        box-shadow: inset 0 0 0 1px var(--luz-borda), 0 18px 40px rgba(0, 0, 0, 0.5);
        animation: luz-surgir 120ms ease-out;
    }
    .item {
        min-height: 36px;
        padding: 6px 10px;
        border: none;
        border-radius: 8px;
        background: transparent;
        font: inherit;
        font-size: 13px;
        text-align: left;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .item:hover {
        background: var(--luz-hover);
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
