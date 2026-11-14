<script lang="ts">
    // AliançaShow (Preparar F4): colar a lista de músicas da banda visitante. Casa com a biblioteca, pergunta quando
    // há parecidas, cria "sem letra" o que não existe e põe tudo no culto sem abrir nenhuma.
    import { onDestroy } from "svelte"
    import { activePopup, activeProject, activeShow, categories, editingProjectTemplate, projects, shows } from "../../../stores"
    import { casarComBiblioteca, lerLista, type Casamento } from "../../../utils/aliancaLista"
    import { catalogoDaBiblioteca, confirmarVarias, nomeDaCategoria, projetoAberto, rascunhoVarias, type ItemConfirmado } from "../../../utils/aliancaVarias"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    let texto = $rascunhoVarias
    let campo: HTMLTextAreaElement
    // o texto sobrevive ao fechar (Esc, clique fora, X): fica na memória da janela e volta ao reabrir
    $: rascunhoVarias.set(texto)

    // foco ao abrir
    import { onMount } from "svelte"
    onMount(() => setTimeout(() => campo?.focus(), 50))

    // `$shows` e `$categories` entram na conta pra refazer quando a biblioteca muda
    $: catalogo = catalogoDaBiblioteca($shows, $categories)
    $: linhas = lerLista(texto)
    $: casamentos = linhas.map((l) => casarComBiblioteca(l.nome, catalogo))
    $: projeto = projetoAberto($projects, $activeProject, $editingProjectTemplate)
    $: noCulto = new Set((projeto?.shows || []).filter((s) => (s.type || "show") === "show").map((s) => s.id))

    // o que o operador mexeu (por linha): marcar/desmarcar e a escolha do "qual?"
    let marcas: { [chave: string]: boolean } = {}
    let escolhas: { [chave: string]: string } = {}
    const chaveDe = (i: number) => `${i}|${linhas[i]?.original}`

    type Linha = { i: number; chave: string; nome: string; cantor: string; selo: "biblioteca" | "no_culto" | "qual" | "nova"; showId: string | null; candidatos: string[]; marcada: boolean; pendente: boolean }
    $: itens = linhas.map((l, i): Linha => {
        const chave = chaveDe(i)
        const c: Casamento = casamentos[i]
        let showId: string | null = null
        let selo: Linha["selo"] = "nova"
        let candidatos: string[] = []
        if (c.tipo === "uma") {
            showId = c.showId
            selo = "biblioteca"
        } else if (c.tipo === "varias") {
            candidatos = c.candidatos
            const e = escolhas[chave] ?? c.preSelecionado ?? ""
            if (e === "outra") selo = "nova"
            else if (e) {
                showId = e
                selo = "biblioteca"
            } else selo = "qual"
        }
        if (showId && noCulto.has(showId)) selo = "no_culto"
        // linha que parece cabeçalho e não casou com nada: nasce desmarcada
        const padrao = selo === "no_culto" ? false : selo === "nova" && c.tipo === "nenhuma" && l.pareceCabecalho ? false : true
        const marcada = marcas[chave] ?? padrao
        return { i, chave, nome: l.nome, cantor: l.cantor, selo, showId, candidatos, marcada, pendente: marcada && selo === "qual" }
    })
    $: marcadas = itens.filter((a) => a.marcada)
    $: pendentes = itens.filter((a) => a.pendente).length
    $: novas = marcadas.filter((a) => a.selo === "nova")
    $: daBiblioteca = marcadas.filter((a) => a.selo === "biblioteca" || a.selo === "no_culto")
    $: foraDoCulto = !projeto

    // onde entram
    let onde: "fim" | "depois" = "fim"
    $: abertoNoProjeto = typeof $activeShow?.index === "number" && projeto ? projeto.shows[$activeShow.index] : null
    $: nomeDoAberto = abertoNoProjeto ? $shows[abertoNoProjeto.id]?.name || (abertoNoProjeto as any).name || abertoNoProjeto.id : ""
    $: if (!abertoNoProjeto && onde === "depois") onde = "fim"

    const rotuloDaMusica = (id: string) => {
        const s = $shows[id]
        const cat = nomeDaCategoria($categories[s?.category || ""]?.name)
        const usada = (s?.timestamps as any)?.used
        const quando = usada ? ` · usada em ${new Date(usada).toLocaleDateString("pt-BR")}` : ""
        return `${s?.name || id}${cat ? ` (${cat})` : ""}${quando}`
    }

    function confirmar() {
        if (!marcadas.length || pendentes) return
        const lista: ItemConfirmado[] = foraDoCulto ? novas.map((a) => ({ nome: a.nome, cantor: a.cantor })) : marcadas.map((a) => (a.showId && a.selo !== "nova" ? { nome: a.nome, cantor: a.cantor, showId: a.showId } : { nome: a.nome, cantor: a.cantor }))
        if (!lista.length) return
        confirmarVarias(lista, onde)
        texto = ""
        marcas = {}
        escolhas = {}
        activePopup.set(null)
    }

    function limpar() {
        texto = ""
        marcas = {}
        escolhas = {}
        campo?.focus()
    }

    $: botao = foraDoCulto ? `Criar ${novas.length} na biblioteca` : `Pôr ${marcadas.length} no culto`
    $: podeConfirmar = (foraDoCulto ? novas.length : marcadas.length) > 0 && !pendentes

    onDestroy(() => {
        // nada: o texto já está guardado em `rascunhoVarias`
    })
</script>

<div class="varias">
    <div class="lado">
        <label for="alianca-varias-texto">Cole a lista (uma música por linha)</label>
        <textarea id="alianca-varias-texto" bind:this={campo} bind:value={texto} rows="14" spellcheck="false" placeholder={"1. Ousado Amor - Isaias Saad\n2. Bondade de Deus\n3. Oceanos (Tom: D)"}></textarea>
        <p class="dica">Com número ou sem. Cantor depois de " - ". O que está antes da primeira música numerada (o cabeçalho) é ignorado. Esc ou clique fora fecham sem perder o texto.</p>
        <div class="acoes">
            <MaterialButton variant="outlined" on:click={limpar} disabled={!texto}>Limpar</MaterialButton>
        </div>
    </div>

    <div class="lado">
        <div class="titulo">O que o Show achou</div>
        {#if !itens.length}
            <p class="dica">Nada ainda. Cole a lista ao lado.</p>
        {:else}
            <ul class="achados">
                {#each itens as it (it.chave)}
                    <li class:desmarcada={!it.marcada} data-selo={it.selo}>
                        <input type="checkbox" checked={it.marcada} on:change={(e) => (marcas = { ...marcas, [it.chave]: e.currentTarget.checked })} aria-label="Incluir {it.nome}" />
                        <div class="nome">
                            <span class="n">{it.nome}</span>
                            {#if it.cantor}<span class="cantor">{it.cantor}</span>{/if}
                            {#if it.selo === "qual"}
                                <select class="qual" value={escolhas[it.chave] ?? ""} on:change={(e) => (escolhas = { ...escolhas, [it.chave]: e.currentTarget.value })}>
                                    <option value="">Qual?</option>
                                    {#each it.candidatos as id}
                                        <option value={id}>{rotuloDaMusica(id)}</option>
                                    {/each}
                                    <option value="outra">Nenhuma: é outra (entra sem letra)</option>
                                </select>
                            {:else if it.candidatos.length}
                                <select class="qual" value={escolhas[it.chave] ?? it.showId ?? "outra"} on:change={(e) => (escolhas = { ...escolhas, [it.chave]: e.currentTarget.value })}>
                                    {#each it.candidatos as id}
                                        <option value={id}>{rotuloDaMusica(id)}</option>
                                    {/each}
                                    <option value="outra">Nenhuma: é outra (entra sem letra)</option>
                                </select>
                            {:else if it.showId}
                                <span class="achado">{$shows[it.showId]?.name}</span>
                            {/if}
                        </div>
                        <span class="selo s-{it.selo}">
                            {#if it.selo === "biblioteca"}na biblioteca{:else if it.selo === "no_culto"}já está no culto{:else if it.selo === "qual"}qual?{:else}nova · sem letra{/if}
                        </span>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if projeto}
            <div class="onde">
                <span class="titulo">Onde entram</span>
                <label><input type="radio" bind:group={onde} value="fim" /> No fim do culto</label>
                <label class:apagado={!abertoNoProjeto}><input type="radio" bind:group={onde} value="depois" disabled={!abertoNoProjeto} /> Depois de "{nomeDoAberto || "(nenhum item aberto)"}"</label>
            </div>
        {:else}
            <p class="dica">Não há culto aberto (ou é um modelo): as músicas novas só entram na biblioteca.</p>
        {/if}

        <div class="rodape">
            <span class="resumo">
                {#if itens.length}
                    {daBiblioteca.length} da biblioteca · {novas.length}
                    {novas.length === 1 ? "nova" : "novas"} sem letra{#if pendentes}
                        · {pendentes} esperando escolha{/if}
                {/if}
            </span>
            <div class="botoes">
                <MaterialButton variant="outlined" on:click={() => activePopup.set(null)}>Cancelar</MaterialButton>
                <MaterialButton variant="contained" disabled={!podeConfirmar} on:click={confirmar}>{botao}</MaterialButton>
            </div>
        </div>
    </div>
</div>

<style>
    .varias {
        display: flex;
        gap: 18px;
        /* o cartão do popup tem as margens da navegação dos dois lados: cabe nelas, sem cortar a coluna da direita */
        width: min(880px, calc(100vw - 2 * var(--navigation-width, 0px) - 56px));
        min-width: 0;
        max-width: 100%;
        font-size: 0.8em;
    }
    .lado {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    label,
    .titulo {
        font-weight: 600;
        opacity: 0.85;
    }
    textarea {
        width: 100%;
        resize: vertical;
        min-height: 260px;
        padding: 8px 10px;
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        font: inherit;
    }
    .dica {
        opacity: 0.6;
        font-size: 0.9em;
        margin: 0;
    }
    .acoes {
        display: flex;
        gap: 8px;
    }
    .achados {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 340px;
        overflow-y: auto;
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        background: var(--primary-darker);
    }
    .achados li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-bottom: 1px solid var(--primary-lighter);
    }
    .achados li:last-child {
        border-bottom: none;
    }
    .achados li.desmarcada .nome {
        opacity: 0.45;
    }
    .nome {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
    }
    .n {
        font-weight: 600;
    }
    .cantor,
    .achado {
        opacity: 0.6;
    }
    select.qual {
        max-width: 100%;
        background: var(--primary);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        padding: 2px 4px;
        font: inherit;
    }
    .selo {
        flex: none;
        padding: 1px 8px;
        border-radius: 10px;
        font-size: 0.85em;
        font-weight: 600;
        white-space: nowrap;
        background: rgb(255 255 255 / 0.12);
    }
    .s-qual {
        background: #e0a030;
        color: #1c1400;
    }
    .s-nova {
        background: rgb(255 255 255 / 0.2);
    }
    .s-no_culto {
        background: rgb(224 160 48 / 0.25);
    }
    .onde {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .onde label {
        font-weight: normal;
        opacity: 1;
        display: flex;
        gap: 6px;
        align-items: center;
    }
    .apagado {
        opacity: 0.5;
    }
    .rodape {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: auto;
    }
    .resumo {
        opacity: 0.7;
    }
    .botoes {
        display: flex;
        gap: 8px;
    }

    @media screen and (max-width: 1000px) {
        .varias {
            width: min(880px, calc(100vw - 96px));
        }
    }
</style>
