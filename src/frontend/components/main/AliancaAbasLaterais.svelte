<script lang="ts">
    // Preparar (FV-B): barra "Culto | Biblioteca" + "+ Novo" no alto da coluna esquerda, e a camada da aba Biblioteca.
    //
    // Só existe no Preparar, na página "show" (MainLayout monta este componente atrás desse `if`). O resto da coluna
    // (a lista do culto, `Projects`, e a gaveta, `LibraryTabs`) NÃO é tocado, movido nem remontado: na aba Biblioteca a
    // lista do culto some por CSS (`visibility: hidden`, que também a tira do foco, do ponteiro e do leitor de tela) e a
    // camada cobre exatamente a caixa dela. A gaveta continua a original, a mesma de sempre.
    import { onDestroy, onMount } from "svelte"
    import { abaLateral, iniciarEstadoDaBiblioteca } from "../../utils/aliancaBibliotecaEstado"
    import AliancaBiblioteca from "./AliancaBiblioteca.svelte"
    import AliancaNovo from "./AliancaNovo.svelte"

    iniciarEstadoDaBiblioteca()

    let barra: HTMLElement
    let largura = 999
    // abaixo disso o "+ Novo" vira só "+" (natural: ~208 px; o painel mínimo tem ~194)
    $: compacto = largura < 214

    let topo = 36
    let altura = 0
    function medir() {
        const painel = barra?.parentElement
        const caixa = painel?.querySelector(":scope > .projectsWrap") as HTMLElement | null
        if (!caixa) return
        // retângulos (fracionários), não offsetTop/offsetHeight (que arredondam e deixariam uma fresta de meio pixel)
        const p = painel!.getBoundingClientRect()
        const r = caixa.getBoundingClientRect()
        topo = r.top - p.top - painel!.clientTop
        altura = r.height
    }

    let observador: ResizeObserver | undefined
    onMount(() => {
        medir()
        observador = new ResizeObserver(medir)
        if (barra?.parentElement) observador.observe(barra.parentElement)
        const caixa = barra?.parentElement?.querySelector(":scope > .projectsWrap")
        if (caixa) observador.observe(caixa)
    })
    onDestroy(() => observador?.disconnect())
</script>

<div class="abas" class:naBiblioteca={$abaLateral === "biblioteca"} bind:this={barra} bind:clientWidth={largura}>
    <div class="seg" role="group" aria-label="Coluna esquerda">
        <button class:ativo={$abaLateral === "culto"} aria-pressed={$abaLateral === "culto"} tabindex="-1" on:mousedown|preventDefault on:click={() => abaLateral.set("culto")}>Culto</button>
        <button class:ativo={$abaLateral === "biblioteca"} aria-pressed={$abaLateral === "biblioteca"} tabindex="-1" on:mousedown|preventDefault on:click={() => abaLateral.set("biblioteca")}>Biblioteca</button>
    </div>
    <AliancaNovo {compacto} />
</div>

{#if $abaLateral === "biblioteca"}
    <div class="camada" style="top: {topo}px; height: {altura}px;">
        <AliancaBiblioteca />
    </div>
{/if}

<style>
    .abas {
        position: relative;
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        height: 36px;
        padding: 0 6px;
        box-sizing: border-box;
        background: var(--primary-darkest);
    }

    /* a lista do culto fica montada (rolagem e estado intactos) e some por CSS na aba Biblioteca */
    .abas.naBiblioteca ~ :global(.projectsWrap) {
        visibility: hidden;
    }
    /* o cabeçalho "BIBLIOTECA" da gaveta (LibraryTabs) leria como repetição da aba nova: no Preparar, esconde por CSS daqui,
       sem tocar o componente do Culto */
    .abas ~ :global(.library > .header) {
        display: none;
    }

    .seg {
        display: flex;
        flex: 0 1 auto;
        min-width: 0;
        padding: 2px;
        gap: 2px;
        border-radius: 8px;
        background: rgb(255 255 255 / 0.06);
        -webkit-app-region: no-drag;
    }
    .seg button {
        border: 0;
        border-radius: 6px;
        padding: 3px 9px;
        font-family: inherit;
        font-size: 12px;
        color: var(--text);
        background: transparent;
        opacity: 0.7;
        cursor: pointer;
        white-space: nowrap;
    }
    .seg button:hover {
        opacity: 1;
        background: rgb(255 255 255 / 0.08);
    }
    .seg button.ativo {
        opacity: 1;
        background: var(--modo-prep, #e0a030);
        color: var(--modo-prep-texto, #1a1200);
        font-weight: 600;
    }

    /* cobre só a caixa da lista do culto (top/height medidos dela) */
    .camada {
        position: absolute;
        z-index: 1;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        background: var(--primary-darker);
    }
</style>
