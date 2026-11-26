<script lang="ts">
    // AliancaShow (26/nov, "janelas nossas"): Novo Show como barra de comando, no jeito do "Adicionar ao roteiro" (Ctrl+K).
    // Digita o nome e escolhe: colar letra (abre a "Nova musica" do Preparar, ja com o nome), buscar a letra na web (o resultado
    // vai para a mesma "Nova musica") ou comecar vazio (mesma criacao do CreateShow do FreeShow). A categoria do show vazio e a da
    // aba aberta na biblioteca (igual ao padrao do FreeShow); o CreateShow original segue intacto no fecho.
    import { onMount } from "svelte"
    import { ShowObj } from "../../../classes/Show"
    import { activePopup, activeProject, activeShow, categories, drawerTabsData, popupData, quickTextCache, shows } from "../../../stores"
    import { chaveDeMusica } from "../../../utils/aliancaLista"
    import { rascunhosLetra, ultimaDivisao } from "../../../utils/aliancaVarias"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { history } from "../../helpers/history"
    import { checkName } from "../../helpers/show"
    import Icon from "../../helpers/Icon.svelte"
    import WebSearch from "../popups/createShow/WebSearch.svelte"

    let nome = $quickTextCache?.name || ""
    let campo: HTMLInputElement
    onMount(() => setTimeout(() => campo?.focus(), 30))
    $: quickTextCache.set({ name: nome, text: "" })

    // categoria do show vazio: a aba aberta, senao a do show ativo, senao "Cancoes", senao a primeira
    function categoriaDoVazio(): string | null {
        const aba = $drawerTabsData.shows?.activeSubTab
        if (aba && $categories[aba]) return aba
        const doAtivo = $shows[$activeShow?.id || ""]?.category
        if (doAtivo && $categories[doAtivo]) return doAtivo
        if ($categories.song) return "song"
        return Object.keys($categories)[0] || null
    }
    const nomeDaCategoria = (id: string | null) => {
        const n = (id && $categories[id]?.name) || ""
        return n.startsWith("category.") ? translateText(n) : n
    }

    let buscando = false
    // a busca na web sem resultado volta para a lista com um aviso na propria barra (antes so um toast rapido: parecia que nao fez nada)
    let semResultado = ""
    $: opcoes = [
        { id: "letra", icone: "text", rotulo: "Colar letra", atalho: "Enter", dica: "Abre a Nova música para colar a letra (com ou sem cifra)" },
        { id: "web", icone: "search", rotulo: "Buscar letra na web", atalho: "Ctrl F", dica: nome.trim() ? `Procura "${nome.trim()}" na web` : "Digite o nome primeiro", desligada: !nome.trim() },
        { id: "vazio", icone: "add", rotulo: "Começar vazio", atalho: "Ctrl Enter", dica: `Show sem slides em ${nomeDaCategoria(categoriaDoVazio()) || "sem categoria"}` }
    ]
    let marcada = 0

    function jaExiste(n: string) {
        const chave = chaveDeMusica(n)
        return !!chave && Object.values($shows).some((a) => !!a?.name && chaveDeMusica(a.name) === chave)
    }

    function abrirLetra(texto = "") {
        const atual = $rascunhosLetra.nova
        rascunhosLetra.update((a) => ({
            ...a,
            nova: { texto: texto || atual?.texto || "", nome: nome.trim() || atual?.nome || "", cantor: atual?.cantor || "", modo: atual?.modo || $ultimaDivisao.modo, n: atual?.n || $ultimaDivisao.n, manter: texto ? [] : atual?.manter || [] }
        }))
        quickTextCache.set({ name: "", text: "" })
        popupData.set({ modo: "nova" })
        activePopup.set("alianca_letra")
    }

    function criarVazio() {
        if (nome.trim() && jaExiste(nome)) newToast("create_show.exists")
        const show = new ShowObj(false, categoriaDoVazio())
        show.name = checkName(nome.trim())
        const indice = $activeShow?.index === undefined ? undefined : $activeShow.index + 1
        history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject, index: indice } }, location: { page: "show", id: "show" } })
        quickTextCache.set({ name: "", text: "" })
        activePopup.set(null)
    }

    function escolher(id: string) {
        if (id === "letra") abrirLetra()
        else if (id === "web") {
            if (!nome.trim()) return campo?.focus()
            buscando = true
        } else if (id === "vazio") criarVazio()
    }

    function daWeb(e: CustomEvent) {
        const d = e.detail || {}
        if (!d.lyrics) {
            semResultado = nome.trim()
            buscando = false
            return
        }
        if (d.title && nome.toLowerCase() === nome) nome = d.title
        abrirLetra(d.lyrics)
    }

    function keydown(e: KeyboardEvent) {
        if (buscando) {
            if (e.key === "Backspace" && document.activeElement === document.body) buscando = false
            return
        }
        const ctrl = e.ctrlKey || e.metaKey
        if (ctrl && e.key.toLowerCase() === "f") {
            e.preventDefault()
            escolher("web")
        } else if (e.key === "Enter") {
            e.preventDefault()
            escolher(ctrl ? "vazio" : opcoes[marcada].id)
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            marcada = (marcada + 1) % opcoes.length
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            marcada = (marcada + opcoes.length - 1) % opcoes.length
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="barra" data-janela="novo-show">
    <div class="topo">
        {#if buscando}
            <button class="voltar" data-title="Voltar" on:click={() => (buscando = false)}><Icon id="back" size={1} white /></button>
        {:else}
            <span class="ic"><Icon id="song" size={1} white /></span>
        {/if}
        <!-- class "edit": sem ela os atalhos do app (espaco, Backspace, setas) agem nos slides enquanto se digita (shortcuts.ts) -->
        <input class="edit" bind:this={campo} bind:value={nome} placeholder="Nome do show ou da música" spellcheck="false" on:input={() => ((buscando = false), (semResultado = ""))} />
        <button class="fechar" data-title="Fechar [Esc]" on:click={() => activePopup.set(null)}><Icon id="close" size={0.9} white /></button>
    </div>

    {#if buscando}
        <div class="web">
            <WebSearch query={nome.trim()} on:update={daWeb} />
        </div>
    {:else}
        <div class="opcoes">
            {#each opcoes as o, i (o.id)}
                <button class="op" class:marcada={i === marcada} class:desligada={o.desligada} data-acao={"novo-show-" + o.id} data-title={o.dica} on:mouseenter={() => (marcada = i)} on:click={() => escolher(o.id)}>
                    <Icon id={o.icone} size={0.95} white />
                    <span>{o.rotulo}</span>
                    <kbd>{o.atalho}</kbd>
                </button>
            {/each}
            {#if semResultado}
                <p class="aviso">Nada encontrado na web para "{semResultado}". Tente outro nome ou cole a letra.</p>
            {/if}
        </div>
    {/if}
</div>

<style>
    .barra {
        display: flex;
        flex-direction: column;
    }
    .topo {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 48px;
        padding: 0 8px 0 14px;
        border-bottom: 1px solid var(--luz-borda);
    }
    .ic {
        display: flex;
        opacity: 0.55;
    }
    .topo input {
        flex: 1;
        min-width: 0;
        height: 100%;
        background: transparent;
        border: 0;
        outline: none;
        color: var(--luz-texto);
        font-size: 15px;
        font-family: inherit;
    }
    .topo input::placeholder {
        color: var(--luz-fraco);
    }
    .voltar,
    .fechar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        opacity: 0.6;
    }
    .voltar:hover,
    .fechar:hover {
        background: var(--luz-hover);
        opacity: 1;
    }
    .opcoes {
        display: flex;
        flex-direction: column;
        padding: 4px;
    }
    .op {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 32px;
        padding: 0 10px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font-family: inherit;
        font-size: 13px;
        text-align: start;
        cursor: pointer;
    }
    .op :global(svg) {
        opacity: 0.65;
    }
    .op.marcada {
        background: var(--luz-hover);
    }
    .op.desligada {
        opacity: 0.4;
    }
    .op span {
        flex: 1;
    }
    kbd {
        font-family: inherit;
        font-size: 11px;
        color: var(--luz-fraco);
    }
    .aviso {
        margin: 4px 10px 6px;
        color: var(--luz-laranja);
        font-size: 12px;
    }
    .web {
        padding: 12px 14px;
        max-height: 60vh;
        overflow: auto;
    }
</style>
