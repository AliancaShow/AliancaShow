<script lang="ts">
    import type { Resolution } from "../../../types/Settings"
    import { createEventDispatcher } from "svelte"
    import { mediaOptions, outputs, styles } from "../../stores"
    import { tela } from "../../utils/aliancaTela"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { getResolution } from "../helpers/output"
    import Loader from "../main/Loader.svelte"
    import Label from "./Label.svelte"
    import TocarAgora from "./TocarAgora.svelte"

    export let loaded = true
    export let preview = false
    export let active = false
    export let outlineColor: string | null = null
    export let label: string
    // leiaute v2: o cartao de midia desenha o nome e o "＋" abaixo (MediaCard), sem a faixa de nome do cartao
    export let semRotulo = false
    export let count = 0
    export let renameId = ""
    export let title = ""
    export let mediaData = ""
    export let width = 0
    export let icon: null | string = null
    export let color: null | string = null
    export let white = true
    export let showPlayOnHover = false
    export let showApplyOnHover = false
    // AliançaShow (Preparar F6): na gaveta do Preparar o card marca em vez de tocar (✓ no lugar do play)
    export let marcavel = false
    // no Preparar nenhum card da gaveta toca: o ▶ ao passar o mouse só aparece no Culto
    // (quem toca fora da gaveta, como a pasta aberta no centro, passa tocaNoPreparar)
    export let tocaNoPreparar = false
    // leiaute v2, fatia 6: na biblioteca o clique so seleciona. `tocar`: o cartao ganha o ▶ (evento `tocar`); `soSeleciona`: sem ▶ proprio (quem usa
    // desenha o seu), mas o cartao tambem nao promete tocar ao clicar. So o cartao do CENTRO (pasta aberta) ainda toca ao clicar.
    export let tocar = false
    export let soSeleciona = false
    const dispatch = createEventDispatcher()
    $: tocaAoClicar = !tocar && !soSeleciona && showPlayOnHover && (tocaNoPreparar || $tela === "mostrar")
    export let marcado = false
    export let checkered = false
    export let mode: "grid" | "list" | "lyrics" = "grid"
    export let resolution: Resolution = getResolution(null, { $outputs, $styles })
    $: resolution = getResolution(resolution, { $outputs, $styles })
    $: mainWidth = width || (mode === "grid" ? 100 / $mediaOptions.columns : 100)
</script>

<!-- display: table; -->
<div class="main" data-tocavel style="{outlineColor ? 'outline: 2px solid ' + outlineColor + ';' : ''}flex-direction: {mode === 'grid' ? 'column' : 'row'};width: {mainWidth}%;" class:preview class:active>
    <div class="over" style="flex-direction: {mode === 'grid' ? 'column' : 'row'};width: 100%;" on:mousedown on:click on:dblclick on:keydown={triggerClickOnEnterSpace} tabindex="0" role="button">
        {#if preview}
            <div class="overlay" />
        {:else}
            <div class="hover overlay" />
        {/if}
        <div data-title={marcavel ? (marcado ? "Desmarcar" : "Marcar para o culto") : tocaAoClicar ? translateText(active ? "clear.general" : "media.play") : ""} data-media={mediaData} class="card {$$props.class || ''}" class:checkered style="{$$props.style || ''};aspect-ratio: {resolution.width}/{resolution.height};" on:mouseenter on:mouseleave on:mousemove>
            {#if !loaded}
                <div class="loader">
                    <Loader />
                </div>
            {:else if marcavel}
                <div class="overlayIcon">
                    <Icon id="check" size={2} white />
                </div>
            {:else if tocaAoClicar}
                <div class="overlayIcon">
                    <Icon id={active ? "clear" : "play"} size={2} white />
                </div>
            {:else if showApplyOnHover && !active}
                <div class="overlayIcon">
                    <Icon id="export" size={2} white />
                </div>
            {/if}
            {#if marcado}<span class="marcadoGaveta" data-title="Marcado para o culto"><Icon id="check" size={0.9} white /></span>{/if}
            {#if tocar && loaded}<TocarAgora flutuante titulo={active ? "Tirar do ar" : "Mandar ao ar"} on:tocar={() => dispatch("tocar")} />{/if}
            <slot />
        </div>
        {#if !semRotulo}<Label {label} {count} {renameId} {title} {icon} {white} {color} {mode} />{/if}
    </div>
</div>

<style>
    .main {
        display: flex;
        padding: 2px;
        position: relative;
    }

    .over {
        display: flex;
        flex-direction: column;
        position: relative;
    }
    .over:hover > .hover {
        /* background-color: var(--primary-lighter); */
        /* filter: brightness(1.1); */
        opacity: 1;
    }
    .hover.overlay {
        opacity: 0;
        /* transition: 0.1s opacity; */
        background-color: rgb(255 255 255 / 0.05);
        position: absolute;
        top: 0;
        left: 0;
    }

    .over:hover > .card .overlayIcon {
        opacity: 0.6;
    }
    .overlayIcon {
        display: flex;
        cursor: pointer;

        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);

        z-index: 1;
        pointer-events: none;

        transition: 0.3s opacity;
        opacity: 0;
    }

    /* Apenas selecionado: destaque neutro, por fundo. Contorno em volta da
       linha inteira briga com o texto; fundo separa sem riscar. */
    .main.preview {
        background: rgb(255 255 255 / 0.09);
        z-index: 1;
        /* outline: 3px solid var(--primary-lighter);
    outline-offset: -2px;
    outline-offset: -5px; */
    }
    .overlay {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        background-color: rgb(0 0 0 / 0.3);
        height: 100%;
        width: 100%;
        z-index: 1;
    }
    /* Em uso no ar: wash de marca com uma barra de 3px na entrada da linha,
       o mesmo gesto das abas da Biblioteca. Sem contorno em volta. */
    .main.active {
        background: rgb(242 26 39 / 0.16);
        box-shadow: inset 3px 0 0 0 var(--live, var(--secondary));
        z-index: 2;
        /* outline: 3px solid var(--secondary);
    outline-offset: -2px;
    outline-offset: -5px; */
    }

    .main :global(video),
    .main :global(canvas),
    .main :global(img) {
        max-width: 100%;
        max-height: 100%;
        align-self: center;
        pointer-events: none;
    }
    .main :global(.observer) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
    }

    .card {
        display: flex;
        position: relative;
        /* flex-direction: column; */
        justify-content: center;
        /* aspect-ratio: 16/9; */
        background-color: var(--primary);
    }

    .marcadoGaveta {
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 3;
        display: flex;
        padding: 3px;
        border-radius: 50%;
        background: var(--secondary);
        pointer-events: none;
    }

    .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
</style>
