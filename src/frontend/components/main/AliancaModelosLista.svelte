<script lang="ts">
    // Modelos dentro do Editar (desenho C, "Sim, Modelos no Editar" 24/nov): a coluna da esquerda no modo MODELOS.
    // Busca, categorias que o usuario cria (as mesmas templateCategories do FreeShow) e as miniaturas. Clicar abre o modelo no editor do centro.
    // Criar modelo e criar/renomear categoria passam pelo history do FreeShow (Ctrl+Z desfaz). Conta e filtro: utils/aliancaModelosLogica.ts.
    import { tick } from "svelte"
    import { uid } from "uid"
    import { activeEdit, activeRename, templateCategories, templates } from "../../stores"
    import { categoriaDosModelos, ultimoModelo } from "../../utils/aliancaEditarEstado"
    import { TODOS, categoriaDoNovo, categoriasDaLista, modelosDaLista, nomeLivre } from "../../utils/aliancaModelosLogica"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import TemplateSlide from "../drawer/pages/TemplateSlide.svelte"
    import { EMPTY_SLIDE } from "../../values/empty"

    let busca = ""
    $: cats = categoriasDaLista($templates as any, $templateCategories as any, (k) => translateText(k))
    $: if (!cats.some((c) => c.id === $categoriaDosModelos)) categoriaDosModelos.set(TODOS)
    $: lista = modelosDaLista($templates as any, $templateCategories as any, { categoria: $categoriaDosModelos, busca })
    $: aberto = $activeEdit.type === "template" ? $activeEdit.id || "" : ""

    const perfil = getAccess("templates")
    $: soLeitura = perfil.global === "read"

    function abrir(id: string) {
        ultimoModelo.set(id)
        activeEdit.set({ type: "template", id, items: [] } as any)
    }

    function novoModelo() {
        if (soLeitura) return
        const id = uid()
        const nome = nomeLivre(
            "Novo modelo",
            Object.values($templates || {}).map((t: any) => t?.name || "")
        )
        const data = { ...clone(EMPTY_SLIDE), name: nome, category: categoriaDoNovo($categoriaDosModelos, $templateCategories as any) }
        history({ id: "UPDATE", oldData: { id }, newData: { data }, location: { page: "drawer", id: "template" } })
        busca = ""
        abrir(id)
    }

    // ---- categoria nova / renomear (duplo clique)
    let criando = false
    let renomeando = ""
    let campo: HTMLInputElement | undefined
    async function comecarNova() {
        renomeando = ""
        criando = true
        await tick()
        campo?.focus()
    }
    async function comecarRenomear(id: string) {
        if (soLeitura || ($templateCategories as any)[id]?.default) return
        criando = false
        renomeando = id
        await tick()
        campo?.select()
    }
    function confirmar(e: Event) {
        const nome = (e.currentTarget as HTMLInputElement).value.trim()
        if (criando && nome) {
            const id = uid()
            history({ id: "UPDATE", oldData: { id }, newData: { data: { name: nome, icon: "templates" } }, location: { page: "drawer", id: "category_templates" } })
            // o updater do FreeShow liga o "renomear" da gaveta (escondida no leiaute Luz): desliga
            activeRename.set(null)
            categoriaDosModelos.set(id)
        } else if (renomeando && nome && nome !== ($templateCategories as any)[renomeando]?.name) {
            history({ id: "UPDATE", oldData: { id: renomeando }, newData: { key: "name", data: nome }, location: { page: "drawer", id: "category_templates" } })
        }
        cancelar()
    }
    function cancelar() {
        criando = false
        renomeando = ""
    }
    function tecla(e: KeyboardEvent) {
        e.stopPropagation()
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
        else if (e.key === "Escape") {
            ;(e.currentTarget as HTMLInputElement).value = ""
            cancelar()
        }
    }
</script>

<div class="modelos" data-acao="modelos-lista">
    <input class="busca" type="search" placeholder="Buscar modelo" bind:value={busca} on:keydown|stopPropagation data-acao="modelos-busca" />

    <div class="cats" data-acao="modelos-categorias">
        {#each cats as c (c.id)}
            {#if renomeando === c.id}
                <input class="chip campo" bind:this={campo} value={c.nome} on:blur={confirmar} on:keydown={tecla} />
            {:else}
                <button type="button" class="chip" class:on={$categoriaDosModelos === c.id} title={c.fixa ? "" : "Duplo clique: renomear"} tabindex="-1" on:click={() => categoriaDosModelos.set(c.id)} on:dblclick={() => comecarRenomear(c.id)}>
                    {c.nome}<small>{c.total}</small>
                </button>
            {/if}
        {/each}
        {#if criando}
            <input class="chip campo" bind:this={campo} placeholder="Nome da categoria" on:blur={confirmar} on:keydown={tecla} />
        {:else if !soLeitura}
            <button type="button" class="chip mais" tabindex="-1" data-acao="modelos-nova-categoria" on:click={comecarNova}>+ Categoria</button>
        {/if}
    </div>

    <div class="grade" data-acao="modelos-grade">
        {#each lista as m (m.id)}
            {@const t = $templates[m.id]}
            <button type="button" class="card" class:on={aberto === m.id} title={m.nome} tabindex="-1" data-modelo={m.id} on:click={() => abrir(m.id)}>
                <span class="mini"
                    >{#if t}<TemplateSlide templateId={m.id} template={t} preview />{/if}</span
                >
                <span class="nome">{m.nome}</span>
            </button>
        {:else}
            <p class="vazio">{busca ? "Nenhum modelo com esse nome." : "Nenhum modelo nesta categoria."}</p>
        {/each}
    </div>
</div>

{#if !soLeitura}
    <button type="button" class="novo" data-acao="modelos-novo" on:click={novoModelo}>＋ Modelo</button>
{/if}

<style>
    .modelos {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 0 12px;
    }
    .busca {
        height: 32px;
        flex-shrink: 0;
        padding: 0 10px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-campo);
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12.5px;
    }
    .busca:focus {
        outline: none;
        border-color: var(--luz-borda-forte);
    }
    .cats {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        flex-shrink: 0;
    }
    .chip {
        height: 24px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 0 8px;
        border: 0;
        border-radius: 12px;
        background: var(--luz-campo);
        color: var(--luz-texto-80);
        font: inherit;
        font-size: 11.5px;
        white-space: nowrap;
        cursor: pointer;
    }
    .chip small {
        font-size: 10px;
        color: var(--luz-mudo);
        font-variant-numeric: tabular-nums;
    }
    .chip:hover {
        background: var(--luz-hover);
    }
    .chip.on {
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font-weight: 600;
    }
    .chip.on small {
        color: var(--luz-tinta);
        opacity: 0.6;
    }
    .chip.mais {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--luz-borda);
        color: var(--luz-mudo);
    }
    .chip.campo {
        width: 130px;
        cursor: text;
        box-shadow: inset 0 0 0 1px var(--luz-borda-forte);
        outline: none;
    }
    .grade {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-content: start;
        gap: 8px;
        padding-bottom: 8px;
    }
    .card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding: 4px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .card:hover {
        background: var(--luz-hover);
    }
    .card.on {
        background: var(--luz-hover);
        box-shadow: inset 0 0 0 2px var(--luz-texto);
    }
    .mini {
        position: relative;
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 4px;
        overflow: hidden;
        background: #000;
        pointer-events: none;
    }
    .mini :global(.slide) {
        position: absolute !important;
        inset: 0;
    }
    .nome {
        padding: 0 2px;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .vazio {
        grid-column: 1 / -1;
        margin: 16px 0;
        color: var(--luz-mudo);
        font-size: 12px;
        text-align: center;
    }
    .novo {
        margin: 8px;
        flex-shrink: 0;
        height: 40px;
        border: 1px dashed var(--luz-borda-forte);
        border-radius: 8px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        color: var(--luz-texto);
        cursor: pointer;
    }
</style>
