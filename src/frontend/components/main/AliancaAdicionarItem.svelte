<script lang="ts">
    // Cabine 18/nov, C5 (opcao A aprovada): o menu "＋ Adicionar item ▾" ancorado no botao da barra do Editar, no desenho do menu Luz (fundo opaco, raio 12, linhas de 38 px).
    // Substitui o ItemAddMenu na barra do Editar (o ItemAddMenu continua so no editor de layouts de Palco: a janela de saida o importa e ele nao muda).
    // "Mais" TROCA o conteudo na mesma caixa ("‹ Mais itens" volta). Teclado: ↑ ↓ andam, Enter escolhe, ← volta do "Mais", Esc fecha; o 1o item nasce marcado.
    // A conta das linhas e do teclado e de aliancaAdicionarItemLogica.ts; os itens sao os de sempre (`itensDoMenuAdicionar(slideItems)`: nenhum some).
    import { activeEdit, activePopup, dictionary, selected } from "../../stores"
    import { acaoDoEnter, linhasDoMenu, moverFoco } from "../../utils/aliancaAdicionarItemLogica"
    import { itensDoMenuAdicionar } from "../../utils/aliancaEditorLogica"
    import { estiloDaForma } from "../../utils/aliancaTextoLigadoLogica"
    import { translateText } from "../../utils/language"
    import { addItem } from "../edit/scripts/itemHelpers"
    import { slideItems } from "../edit/values/items"
    import Icon from "../helpers/Icon.svelte"

    export let isLocked = false

    let aberto = false
    let vista: "raiz" | "mais" = "raiz"
    let foco = -1
    let raiz: HTMLDivElement

    // "Forma" (24/nov): o shape do ProPresenter = caixa de texto vazia com fundo; fica logo depois de "Texto"
    const FORMAS = [
        { id: "forma", icon: "item", label: "Forma (retângulo)" },
        { id: "forma_circulo", icon: "item", label: "Forma (círculo)" }
    ]
    const grupos = itensDoMenuAdicionar(slideItems).map((g, i) => (i === 0 ? { ...g, items: [...g.items, ...FORMAS] } : g))
    $: linhas = linhasDoMenu(grupos, vista)
    $: if (!aberto) {
        vista = "raiz"
        foco = -1
    }

    function abrir() {
        aberto = !aberto
        if (aberto) foco = moverFoco(linhasDoMenu(grupos, "raiz"), -1, "ArrowDown")
    }
    function mudarVista(v: "raiz" | "mais") {
        vista = v
        foco = moverFoco(linhasDoMenu(grupos, v), -1, "ArrowDown")
    }
    function escolher(tipo: string) {
        aberto = false
        if (tipo === "icon") {
            selected.set({ id: "slide_icon", data: [{ ...$activeEdit }] })
            activePopup.set("icon")
            return
        }
        if (tipo === "forma" || tipo === "forma_circulo") return addItem("text", null, {}, "", estiloDaForma(tipo === "forma" ? "retangulo" : "circulo"))
        const textoDeExemplo = tipo === "text" && $activeEdit.type === "template" ? translateText("example.text", $dictionary) : ""
        addItem(tipo as any, null, {}, textoDeExemplo)
    }
    function enter() {
        const a = acaoDoEnter(linhas[foco])
        if (!a) return
        if (a.fazer === "adicionar") escolher(a.id)
        else if (a.fazer === "abrir-mais") mudarVista("mais")
        else mudarVista("raiz")
    }

    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement).closest?.("[data-acao=editar-adicionar-item]")) aberto = false
    }
    function teclar(e: KeyboardEvent) {
        if (!aberto) return
        if (e.key === "Escape") {
            aberto = false
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            foco = moverFoco(linhas, foco, e.key)
        } else if (e.key === "Enter") {
            enter()
        } else if (e.key === "ArrowLeft" && vista === "mais") {
            mudarVista("raiz")
        } else if (e.key === "ArrowRight" && vista === "raiz" && linhas[foco]?.tipo === "mais") {
            mudarVista("mais")
        } else return
        // o menu esta na mao do operador: a tecla e dele (Esc nao limpa o telao, setas nao andam de slide, Enter nao dispara outro atalho)
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
    }
    $: if (aberto && raiz) raiz.querySelector<HTMLElement>(".mi.foco")?.scrollIntoView({ block: "nearest" })
</script>

<svelte:window on:mousedown={fora} on:keydown|capture={teclar} />

<button type="button" class="gatilho" class:lig={aberto} tabindex="-1" disabled={isLocked} aria-haspopup="menu" aria-expanded={aberto} data-acao="adicionar-item" title="Adicionar item ao slide" on:mousedown|preventDefault on:click={abrir}>
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
    Adicionar item
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
</button>

{#if aberto}
    <div class="addMenu menu" role="menu" bind:this={raiz} data-vista={vista}>
        {#each linhas as l, i}
            {#if l.tipo === "titulo"}
                <div class="tit">{l.texto}</div>
            {:else if l.tipo === "fio"}
                <hr />
            {:else if l.tipo === "voltar"}
                <button type="button" class="mi voltar" class:foco={foco === i} role="menuitem" tabindex="-1" data-acao="adicionar-voltar" on:mousedown|preventDefault on:mouseenter={() => (foco = i)} on:click={() => mudarVista("raiz")}>
                    <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
                    Mais itens
                </button>
            {:else}
                <button type="button" class="mi" class:foco={foco === i} role="menuitem" tabindex="-1" data-item-id={l.id} title={l.item.title ? translateText(l.item.title, $dictionary) : ""} on:mousedown|preventDefault on:mouseenter={() => (foco = i)} on:click={() => (l.tipo === "mais" ? mudarVista("mais") : escolher(l.id))}>
                    {#if l.tipo === "mais"}
                        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="3.5" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="12.5" cy="8" r="1" /></svg>
                        Mais
                        <svg class="seta" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
                    {:else}
                        <Icon id={l.item.icon} size={1.2} white />
                        {translateText(l.item.label, $dictionary)}
                    {/if}
                </button>
            {/if}
        {/each}
    </div>
{/if}

<style>
    /* o gatilho: botao COM NOME na barra do Editar, ao lado do zoom (a barra e flex; o wrapper .addCab e a ancora do menu) */
    .gatilho {
        height: 30px;
        padding: 0 8px 0 10px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-botao);
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
    }
    .gatilho:hover:not(:disabled),
    .gatilho.lig {
        background: var(--luz-hover);
    }
    .gatilho:disabled {
        opacity: 0.4;
        cursor: default;
    }
    /* o menu: a mesma peca dos outros menus do Luz (fundo opaco, raio 12, borda de 1 px, sombra do pop); abre para baixo, colado no botao, alinhado pela direita */
    .menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 999;
        width: 252px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        background: var(--luz-pop-opaco);
        border-radius: var(--luz-raio-menu);
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            var(--luz-sombra-pop);
        max-height: calc(100vh - 140px);
        overflow-y: auto;
    }
    .tit {
        height: 28px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--luz-mudo);
    }
    .mi {
        flex-shrink: 0;
        height: 38px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 10px;
        border: 0;
        border-radius: var(--luz-raio-item);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
    }
    .mi :global(svg) {
        color: var(--luz-mudo);
        flex-shrink: 0;
    }
    .mi.voltar {
        font-weight: 600;
    }
    .mi.foco {
        background: var(--luz-hover);
    }
    .mi.foco :global(svg) {
        color: var(--luz-texto);
    }
    .mi :global(.seta) {
        margin-left: auto;
    }
    hr {
        flex-shrink: 0;
        border: 0;
        border-top: 1px solid var(--luz-linha);
        margin: 5px 10px;
    }
</style>
