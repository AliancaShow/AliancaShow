<script lang="ts">
    // Preparar (FV-B): a aba Biblioteca. Busca, tipo (Músicas | Apresent.), lista virtualizada e o botão de criar.
    //
    // NADA aqui vai para o ar: clicar (ou dar duplo clique) numa linha só ABRE o show no centro (`openShow`, o mesmo do
    // "Visualizar" do botão direito da gaveta); o "+" da linha põe o show no fim do culto (uma entrada de histórico).
    // A linha não usa `SelectElem`: não entra no `selected`, então `Delete` nunca apaga show da biblioteca.
    import { onDestroy, onMount } from "svelte"
    import { activePopup, activeProfile, activeProject, activeShow, categories, editingProjectTemplate, focusedArea, projects, selected, shows, showsCache, textCache } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { formatSearch, showSearch } from "../../utils/search"
    import { motivoSemCulto } from "../../utils/aliancaGaveta"
    import { executarComandoNovo, porShowNoFim } from "../../utils/aliancaBiblioteca"
    import { buscaDaBiblioteca, soSemLetraNaBiblioteca, tipoDaBiblioteca } from "../../utils/aliancaBibliotecaEstado"
    import { idsNoCulto, listarBiblioteca, resumoDaBiblioteca, textoVazio, type LinhaDaBiblioteca, type TipoDaBiblioteca } from "../../utils/aliancaBibliotecaLogica"
    import { categoriasDeMusica, ehSemLetra } from "../../utils/aliancaSemLetraLogica"
    import { openShow } from "../helpers/show"
    import VirtualList from "../drawer/VirtualList.svelte"

    // ---- a lista
    $: acesso = ($activeProfile ? getAccess("shows") : {}) as { [categoria: string]: string | undefined }
    $: musicasCat = categoriasDeMusica($categories as Parameters<typeof categoriasDeMusica>[0])
    // um show carregando (sem `textCache`) não conta como "sem letra"; a conta é a da fatia 4
    $: ehSemLetraDe = (id: string) => {
        const s = $shows[id]
        return !!s && ehSemLetra({ ehMusica: musicasCat.has(s.category || ""), carregado: $showsCache[id], textoDoCache: $textCache[id] })
    }
    $: base = listarBiblioteca({ shows: $shows, categorias: $categories, acesso, tipo: $tipoDaBiblioteca, soSemLetra: $soSemLetraNaBiblioteca, ehSemLetraDe })
    $: resumo = resumoDaBiblioteca({ shows: $shows, categorias: $categories, acesso, ehSemLetraDe })
    $: noCulto = idsNoCulto($projects, $activeProject, !!$editingProjectTemplate)

    // ---- a busca: a mesma `showSearch` da gaveta (nome e letra, com tolerância a erro); ordena por relevância
    let lista: LinhaDaBiblioteca[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    $: filtrando = $buscaDaBiblioteca.trim().length > 1 || $soSemLetraNaBiblioteca
    $: atualizar(base, $buscaDaBiblioteca)
    function atualizar(linhas: LinhaDaBiblioteca[], q: string) {
        clearTimeout(timer)
        if (q.trim().length < 2) {
            lista = linhas
            return
        }
        const executar = () => {
            const porId = new Map(linhas.map((l) => [l.id, l]))
            const achados = showSearch(
                formatSearch(q),
                linhas.map((l) => ({ ...$shows[l.id], id: l.id }))
            )
            lista = achados.map((a) => porId.get(a.id)).filter((l): l is LinhaDaBiblioteca => !!l)
        }
        // lista grande: só refaz quando para de digitar por 100 ms (como a gaveta)
        if (linhas.length > 300) timer = setTimeout(executar, 100)
        else executar()
    }

    // ---- reativos do "+" (`motivoSemCulto` lê stores com `get`: o template não o acompanha sozinho)
    const calcularMotivo = (..._deps: unknown[]) => motivoSemCulto()
    $: motivo = calcularMotivo($activeProject, $projects, $editingProjectTemplate, $activeProfile)

    function mais(id: string) {
        // o foco sai do campo de busca: um Ctrl+Z depois é o do app, não o de desfazer texto
        campo?.blur()
        if (motivo) return
        porShowNoFim(id)
    }

    function abrir(id: string) {
        openShow(id)
    }

    // ---- tipo e filtro
    function escolherTipo(t: TipoDaBiblioteca) {
        tipoDaBiblioteca.set(t)
        buscaDaBiblioteca.set("")
        soSemLetraNaBiblioteca.set(false)
    }

    // ---- teclado
    let campo: HTMLInputElement
    function teclaDoCampo(e: KeyboardEvent) {
        // Backspace/Delete/Enter/Esc digitados aqui nunca chegam ao keydown global (apagaria o item selecionado do culto)
        e.stopPropagation()
        if (e.key === "Enter") {
            e.preventDefault()
            if (lista[0]) abrir(lista[0].id)
        } else if (e.key === "Escape") {
            e.preventDefault()
            campo.blur()
        }
    }

    /**
     * Com a aba Biblioteca na tela, a lista do culto está escondida; as teclas dela não podem agir no que não se vê.
     * Captura no `window`, antes de qualquer outro ouvinte. Não toca em campo de texto, no menu "+ Novo" nem com popup aberto.
     */
    function guarda(e: KeyboardEvent) {
        const alvo = e.target as HTMLElement | null
        if (alvo === campo || alvo?.closest?.(".alianca-novo, input, textarea, select, [contenteditable]")) return
        if ($activePopup) return
        const ctrl = e.ctrlKey || e.metaKey
        const tecla = (e.key || "").toLowerCase()
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !ctrl) e.stopPropagation()
        else if (ctrl && tecla === "f") {
            // Ctrl+F é a busca: aqui é a desta aba, não a da gaveta (que está escondida)
            e.preventDefault()
            e.stopPropagation()
            campo?.focus()
        } else if (ctrl && tecla === "a") e.stopPropagation()
        else if ((e.key === "Delete" || e.key === "Backspace") && ["show", "project", "folder"].includes($selected.id || "")) e.stopPropagation()
    }

    // a primeira rolagem leva até o show aberto (para o "Voltar" do editor cair onde estava); depois a lista não rola sozinha
    let alvoInicial: number | null = null
    onMount(() => {
        selected.set({ id: null, data: [] })
        focusedArea.set("")
        const aberto = $activeShow?.type === "show" || $activeShow?.type === undefined ? $activeShow?.id : null
        const i = aberto ? lista.findIndex((l) => l.id === aberto) : -1
        if (i >= 0) alvoInicial = i
    })
    onDestroy(() => clearTimeout(timer))

    $: aberto = $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined) ? $activeShow.id : ""
    const nomeDaCategoria = (id: string | null): string => (id && $categories[id]?.name ? translateText($categories[id].name) : "sem categoria")
</script>

<svelte:window on:keydown|capture={guarda} />

<div class="bib">
    <div class="busca">
        <input bind:this={campo} class="campo" type="text" placeholder="Nome ou letra" spellcheck="false" autocomplete="off" bind:value={$buscaDaBiblioteca} on:keydown={teclaDoCampo} />
        {#if $buscaDaBiblioteca}
            <button class="limpar" tabindex="-1" title="Limpar a busca" on:mousedown|preventDefault on:click={() => buscaDaBiblioteca.set("")}>×</button>
        {/if}
    </div>

    <div class="chips">
        <button class="chip" class:on={$tipoDaBiblioteca === "musicas"} tabindex="-1" title="{resumo.musicas} músicas" on:mousedown|preventDefault on:click={() => escolherTipo("musicas")}>Músicas</button>
        <button class="chip" class:on={$tipoDaBiblioteca === "apresentacoes"} tabindex="-1" title="{resumo.apresentacoes} apresentações" on:mousedown|preventDefault on:click={() => escolherTipo("apresentacoes")}>Apresent.</button>
        {#if $tipoDaBiblioteca === "musicas" && resumo.semLetra > 0}
            <button class="chip alerta" class:on={$soSemLetraNaBiblioteca} tabindex="-1" title="Músicas que só têm o nome, sem letra" on:mousedown|preventDefault on:click={() => soSemLetraNaBiblioteca.update((v) => !v)}>{resumo.semLetra} sem letra{$soSemLetraNaBiblioteca ? " ✕" : ""}</button>
        {/if}
    </div>

    <div class="lista">
        {#if lista.length}
            <VirtualList items={lista} let:item={linha} activeIndex={alvoInicial}>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div class="brow" class:on={aberto === linha.id} role="button" tabindex="-1" on:click={() => abrir(linha.id)}>
                    <div class="nome">
                        <div class="titulo">{linha.nome}</div>
                        <div class="sub">{nomeDaCategoria(linha.categoria)}</div>
                    </div>
                    {#if linha.semLetra}<span class="selo aviso">sem letra</span>{/if}
                    {#if noCulto.has(linha.id)}<span class="selo noculto">no culto</span>{/if}
                    <button class="mais" aria-disabled={!!motivo} tabindex="-1" title={motivo || "Pôr no fim do culto"} on:mousedown|preventDefault on:click|stopPropagation={() => mais(linha.id)}>+</button>
                </div>
            </VirtualList>
        {:else}
            <div class="vazio">
                <p>{textoVazio({ tipo: $tipoDaBiblioteca, filtrando })}</p>
                {#if !filtrando && $tipoDaBiblioteca === "musicas"}
                    <button class="rodape secundario" tabindex="-1" on:mousedown|preventDefault on:click={() => executarComandoNovo("importar")}>Importar arquivo</button>
                {/if}
            </div>
        {/if}
    </div>

    <div class="pe">
        {#if $tipoDaBiblioteca === "musicas"}
            <button class="rodape" tabindex="-1" on:mousedown|preventDefault on:click={() => executarComandoNovo("musica")}>+ Nova música</button>
        {:else}
            <button class="rodape" tabindex="-1" on:mousedown|preventDefault on:click={() => executarComandoNovo("apresentacao")}>+ Nova apresentação</button>
        {/if}
    </div>
</div>

<style>
    .bib {
        display: flex;
        flex: 1 1 0;
        flex-direction: column;
        min-height: 0;
    }

    .busca {
        position: relative;
        flex: none;
        padding: 8px 8px 4px;
    }
    .campo {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 26px 6px 9px;
        border: 1px solid var(--glass-line, rgb(255 255 255 / 0.07));
        border-radius: 6px;
        background: var(--primary);
        color: var(--text);
        font-family: inherit;
        font-size: 12.5px;
    }
    .campo:focus {
        outline: none;
        border-color: var(--secondary);
    }
    .limpar {
        position: absolute;
        top: 50%;
        right: 14px;
        transform: translateY(-35%);
        padding: 0 4px;
        border: 0;
        background: transparent;
        color: var(--text);
        font-size: 16px;
        line-height: 1;
        opacity: 0.6;
        cursor: pointer;
    }
    .limpar:hover {
        opacity: 1;
    }

    .chips {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        gap: 4px;
        padding: 4px 8px 6px;
    }
    .chip {
        padding: 3px 9px;
        border: 1px solid var(--glass-line, rgb(255 255 255 / 0.07));
        border-radius: 999px;
        background: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 11.5px;
        white-space: nowrap;
        opacity: 0.75;
        cursor: pointer;
    }
    .chip:hover {
        opacity: 1;
    }
    .chip.on {
        opacity: 1;
        border-color: var(--secondary);
        background: var(--sel-wash, rgb(242 26 39 / 0.16));
    }
    /* o aviso é a BORDA (o texto fica na cor do tema: em tema claro o âmbar sobre fundo claro não lê) */
    .chip.alerta {
        border-color: var(--aviso, #ffa94d);
    }

    .lista {
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
    }

    .brow {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 2px 8px;
        padding: 6px 8px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--primary);
        cursor: pointer;
        user-select: none;
    }
    .brow:hover {
        border-color: var(--glass-line, rgb(255 255 255 / 0.07));
    }
    .brow.on {
        border-color: var(--secondary);
    }
    .nome {
        flex: 1;
        min-width: 0;
    }
    .titulo {
        overflow: hidden;
        font-size: 12.5px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .sub {
        overflow: hidden;
        font-size: 10.5px;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.55;
    }
    .selo {
        flex: none;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 10px;
        white-space: nowrap;
    }
    .selo.aviso {
        background: var(--aviso, #ffa94d);
        color: var(--sobre-acento, #1a1200);
    }
    .selo.noculto {
        background: #17381f;
        color: #69db7c;
    }
    .mais {
        flex: none;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 1px solid var(--glass-line, rgb(255 255 255 / 0.07));
        border-radius: 6px;
        background: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
    }
    .mais:hover {
        border-color: var(--secondary);
        color: var(--secondary);
    }
    .mais[aria-disabled="true"] {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .mais[aria-disabled="true"]:hover {
        border-color: var(--glass-line, rgb(255 255 255 / 0.07));
        color: var(--text);
    }

    .vazio {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 20px 12px;
        font-size: 12.5px;
        opacity: 0.8;
    }
    .vazio p {
        margin: 0;
    }

    .pe {
        flex: none;
        padding: 6px 8px 8px;
    }
    .rodape {
        width: 100%;
        padding: 7px 10px;
        border: 0;
        border-radius: 6px;
        background: var(--modo-prep, #e0a030);
        color: var(--modo-prep-texto, #1a1200);
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
    }
    .rodape.secundario {
        width: auto;
        border: 1px solid var(--glass-line, rgb(255 255 255 / 0.07));
        background: transparent;
        color: var(--text);
        font-weight: 400;
    }
</style>
