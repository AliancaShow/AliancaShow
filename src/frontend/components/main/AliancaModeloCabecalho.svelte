<script lang="ts">
    // Modelos dentro do Editar (desenho C, 24/nov): o cabecalho do centro quando o item aberto e um modelo.
    // Nome editavel, categoria e "Aplicar numa musica…" (so aplica quando se pede; depois abre a musica em SLIDES para ver o resultado).
    // Tudo pelo history do FreeShow (Ctrl+Z desfaz). A aplicacao usa o mesmo TEMPLATE da gaveta de modelos do FreeShow.
    import { onDestroy, tick } from "svelte"
    import { activeEdit, activePopup, activeShow, alertMessage, refreshEditSlide, shows, showsCache, templateCategories, templates } from "../../stores"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { TODOS, SEM_CATEGORIA, categoriasDaLista, musicasDaBusca } from "../../utils/aliancaModelosLogica"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { history } from "../helpers/history"
    import { loadShows } from "../helpers/setShow"
    import { _show } from "../helpers/shows"
    import AliancaEscolha from "../settings/AliancaEscolha.svelte"

    $: id = $activeEdit.id || ""
    $: modelo = ($templates as any)[id]
    const perfil = getAccess("templates")
    $: soLeitura = perfil.global === "read" || perfil[modelo?.category || ""] === "read"

    // ---- nome
    function renomear(e: Event) {
        const alvo = e.currentTarget as HTMLInputElement
        const nome = alvo.value.trim()
        if (!nome) {
            alvo.value = modelo?.name || ""
            return
        }
        if (nome === modelo?.name) return
        history({ id: "UPDATE", oldData: { id }, newData: { key: "name", data: nome }, location: { page: "drawer", id: "template_name" } })
    }

    // ---- categoria
    $: opcoesDeCategoria = categoriasDaLista($templates as any, $templateCategories as any, (k) => translateText(k))
        .filter((c) => c.id !== TODOS && c.id !== SEM_CATEGORIA)
        .map((c) => ({ id: c.id, nome: c.nome }))
    $: categoriaAtual = modelo?.category && ($templateCategories as any)[modelo.category] ? modelo.category : ""
    function mudarCategoria(nova: string) {
        history({ id: "UPDATE", oldData: { id }, newData: { key: "category", data: nova || null }, location: { page: "drawer", id: "template_category" } })
    }

    // ---- aplicar numa musica
    let aberto = false
    let busca = ""
    let botao: HTMLButtonElement | undefined
    let pop: HTMLDivElement | undefined
    let campo: HTMLInputElement | undefined
    let destaque = 0
    $: achadas = aberto ? musicasDaBusca($shows as any, busca) : []
    $: if (busca !== undefined) destaque = 0

    async function abrir() {
        if (aberto) return fechar()
        aberto = true
        busca = ""
        window.addEventListener("mousedown", fora, true)
        await tick()
        campo?.focus()
    }
    function fechar() {
        aberto = false
        window.removeEventListener("mousedown", fora, true)
    }
    function fora(e: MouseEvent) {
        const alvo = e.target as Node
        if (pop?.contains(alvo) || botao?.contains(alvo)) return
        fechar()
    }
    function tecla(e: KeyboardEvent) {
        e.stopPropagation()
        if (e.key === "Escape") fechar()
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            const n = achadas.length
            if (n) destaque = (destaque + (e.key === "ArrowDown" ? 1 : -1) + n) % n
        } else if (e.key === "Enter") {
            e.preventDefault()
            const m = achadas[destaque]
            if (m) aplicar(m.id)
        }
    }
    onDestroy(fechar)

    function avisar(chave: string) {
        alertMessage.set(chave)
        activePopup.set("alert")
    }
    async function aplicar(showId: string) {
        fechar()
        const modeloId = id
        try {
            await loadShows([showId])
            const show = ($showsCache as any)[showId]
            if (!show) return falhaAlta("modelo-aplicar", `a musica ${showId} nao carregou`)
            if (show.locked) return avisar("show.locked")
            const perfilShows = getAccess("shows")
            if (perfilShows.global === "read" || perfilShows[show.category || ""] === "read") return avisar("profile.locked")

            // o TEMPLATE do FreeShow le a musica do activeShow na hora: abre ela, aplica e mostra o resultado em SLIDES
            activeShow.set({ id: showId, type: "show" } as any)
            history({ id: "TEMPLATE", newData: { id: modeloId, data: { createItems: true } }, location: { page: "none", override: "show#" + showId } })
            // ja colado: a abertura da musica (show/Slides.svelte) nao recola
            _show(showId).set({ key: "settings.aliancaModeloColado", value: modeloId })
            activeEdit.set({ type: "show", slide: 0, items: [], showId } as any)
            refreshEditSlide.set(true)
        } catch (erro) {
            falhaAlta("modelo-aplicar", erro)
        }
    }
</script>

{#if modelo}
    <input class="nome" value={modelo.name || ""} disabled={soLeitura} aria-label="Nome do modelo" title="Nome do modelo" data-acao="modelo-nome" on:change={renomear} on:keydown|stopPropagation={(e) => e.key === "Enter" && e.currentTarget.blur()} />
    <div class="cat" data-acao="modelo-categoria">
        <AliancaEscolha rotulo="Categoria" valor={categoriaAtual} opcoes={opcoesDeCategoria} neutra={{ id: "", nome: "Sem categoria" }} on:escolher={(e) => mudarCategoria(e.detail)} />
    </div>
    <div class="aplicar">
        <button bind:this={botao} type="button" class="bt" class:aberto data-acao="modelo-aplicar" title="Copia este modelo para os slides de uma música" on:click={abrir}>Aplicar numa música…</button>
        {#if aberto}
            <div bind:this={pop} class="pop" data-acao="modelo-aplicar-lista">
                <input bind:this={campo} class="buscaMus" type="search" placeholder="Buscar música" bind:value={busca} on:keydown={tecla} />
                <div class="lista">
                    {#each achadas as m, i (m.id)}
                        <button type="button" class="op" class:destaque={destaque === i} on:mouseenter={() => (destaque = i)} on:click={() => aplicar(m.id)}>{m.nome}</button>
                    {:else}
                        <p class="vazio">Nenhuma música com esse nome.</p>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{:else}
    <span class="semNome">Modelo</span>
{/if}

<style>
    .nome {
        min-width: 120px;
        width: 240px;
        height: 32px;
        padding: 0 8px;
        border: 1px solid transparent;
        border-radius: var(--luz-raio-campo);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 17px;
        font-weight: 600;
        text-overflow: ellipsis;
    }
    .nome:hover:not(:disabled),
    .nome:focus {
        border-color: var(--luz-borda);
        background: var(--luz-campo);
        outline: none;
    }
    .semNome {
        font-size: 17px;
        font-weight: 600;
    }
    .cat {
        width: 210px;
        flex-shrink: 0;
    }
    .aplicar {
        position: relative;
        flex-shrink: 0;
    }
    .bt {
        height: 28px;
        padding: 0 12px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-botao);
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
    }
    .bt:hover,
    .bt.aberto {
        background: var(--luz-hover);
    }
    .pop {
        position: absolute;
        z-index: 60;
        top: 34px;
        left: 0;
        width: 300px;
        padding: 6px;
        border-radius: var(--luz-raio-menu);
        background: var(--luz-pop-opaco);
        box-shadow:
            var(--luz-sombra-pop),
            inset 0 0 0 1px var(--luz-borda);
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .buscaMus {
        height: 30px;
        padding: 0 8px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-campo);
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12.5px;
        outline: none;
    }
    .lista {
        max-height: 300px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }
    .op {
        min-height: 28px;
        padding: 0 8px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 12.5px;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
    }
    .op.destaque {
        background: var(--luz-hover);
    }
    .vazio {
        margin: 8px;
        font-size: 12px;
        color: var(--luz-mudo);
    }
</style>
