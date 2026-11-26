<script lang="ts">
    import { fade, scale } from "svelte/transition"
    import type { Popups } from "../../../types/Main"
    import { activePopup, alertMessage, popupData, special } from "../../stores"
    import { popups } from "../../utils/popup"
    import { disablePopupClose } from "../../utils/shortcuts"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { EFFECTS_LIST } from "../../audio/effects/audioEffectsHelpers"
    import JanelaAviso from "./janelas/JanelaAviso.svelte"
    import JanelaConfirmar from "./janelas/JanelaConfirmar.svelte"
    import JanelaImportar from "./janelas/JanelaImportar.svelte"
    import JanelaModelos from "./janelas/JanelaModelos.svelte"
    import JanelaMonitor from "./janelas/JanelaMonitor.svelte"
    import JanelaNovoShow from "./janelas/JanelaNovoShow.svelte"
    import JanelaSair from "./janelas/JanelaSair.svelte"

    function mousedown(e: any) {
        // same logic for Escape in shortcuts.ts
        if (popupId && disablePopupClose.includes(popupId)) return
        if (popupId === "alert" && $alertMessage === "actions.closing") return

        if (e.target.classList.contains("popup")) activePopup.set(null)
    }

    // prevent svelte transition lock
    let popupId: Popups | null = null
    let popupTimeout: NodeJS.Timeout | null = null
    $: if ($activePopup !== undefined) updatePopup()
    function updatePopup() {
        if (popupTimeout) return

        popupId = $activePopup
        popupTimeout = setTimeout(() => {
            popupTimeout = null
            if (popupId !== $activePopup) updatePopup()
        }, 250)
    }

    let scrolled = false
    $: if (popupId === null) scrolled = false
    function scroll(e) {
        scrolled = e.target.scrollTop > 0
    }

    $: isOptimized = $special.optimizedMode

    // AliancaShow (26/nov, "janelas feias"): moldura unica no visual do app (REVISAO-LAYOUT-FABLE.md, "Janela padrao"). Tres larguras fixas
    // (420 / 560 / 960), cabecalho de 40 px, fundo preto 55% sem desfoque, botoes lado a lado a direita. O conteudo das janelas fica no fecho
    // da janela de saida e nao muda: os ajustes por janela sao CSS daqui, mirando `data-popup`.
    const PEQUENAS = ["unsaved", "confirm", "alert", "rename", "delete_show"]
    const GRANDES: string[] = []
    $: tamanho = popupId && PEQUENAS.includes(popupId) ? "p" : popupId && GRANDES.includes(popupId) ? "g" : popupId === "select_template" ? "m" : popupId === "choose_screen" ? "p2" : ""

    // 26/nov ("ousar mais"): as janelas mais vistas deixam de ser o miolo do FreeShow vestido; viram janelas nossas (components/main/janelas),
    // com a mesma logica. Os originais continuam no registro (utils/popup.ts, fecho) e nao mudam: so a moldura escolhe qual desenhar.
    const NATIVAS: { [id: string]: any } = { unsaved: JanelaSair, confirm: JanelaConfirmar, alert: JanelaAviso, show: JanelaNovoShow, select_template: JanelaModelos, choose_screen: JanelaMonitor, import: JanelaImportar }
    // perguntas curtas e a barra de comando nao tem faixa de titulo: o proprio conteudo diz o que e
    const SEM_CABECALHO = ["unsaved", "confirm", "alert", "show", "choose_screen"]
    $: nativa = popupId ? NATIVAS[popupId] || null : null
    $: semCabecalho = !!popupId && SEM_CABECALHO.includes(popupId)
    $: barraDeComando = popupId === "show"
</script>

{#if popupId !== null}
    {#key popupId}
        <div class="popup luz-pele" class:isOptimized class:topo={barraDeComando} transition:fade={{ duration: isOptimized ? 20 : 100 }} on:mousedown={mousedown}>
            <div class="card {tamanho}" class:nativa={!!nativa} class:semCabecalho data-popup={popupId} transition:scale={{ duration: isOptimized ? 50 : 150, start: 0.97 }}>
                {#if !semCabecalho}
                    <div class="headerContent" class:scrolled>
                        <div class="headerMargin">
                            {#key popupId}
                                <h2>
                                    {#if popupId === "alianca_varias"}
                                        Adicionar várias músicas
                                    {:else if popupId === "alianca_letra"}
                                        {$popupData?.modo === "preencher" ? "Colar letra" : "Nova música"}
                                    {:else if popupId === "pco_picker"}
                                        Planning Center
                                    {:else if popupId === "audio_effect" && $popupData?.effect}
                                        <T id={EFFECTS_LIST.find((a) => a.id === $popupData.effect)?.label || "popup.audio_effect"} />
                                    {:else}
                                        <T id="popup.{popupId}" />
                                    {/if}
                                </h2>
                            {/key}

                            {#if !disablePopupClose.includes(popupId)}
                                <MaterialButton class="popup-close" icon="close" iconSize={1} title="actions.close [esc]" on:click={() => activePopup.set(null)} />
                            {/if}
                        </div>
                    </div>
                {/if}
                <div class="scroll" on:scroll={scroll}>
                    <div class="body">
                        <svelte:component this={nativa || popups[popupId]} />
                    </div>
                </div>
            </div>
        </div>
    {/key}
{/if}

<style>
    h2 {
        color: var(--text);
        font-size: 14px;
        font-weight: 600;
        margin: 0;
        padding-inline-end: 36px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .popup {
        position: absolute;
        background-color: rgb(0 0 0 / 0.55);
        /* pointer-events: none; */
        width: 100%;
        height: 100%;
        padding: 20px var(--navigation-width);
        z-index: 5000;
        /* tela inteira por cima do topo: sem isto a faixa de arrastar do topo vence por baixo e o X do cabecalho vira alca da janela */
        -webkit-app-region: no-drag;

        /* sem desfoque: o que esta no ar continua legivel atras da janela */
        font-size: 1em;

        display: flex;
        align-items: center;
        justify-content: center;
    }
    .popup.isOptimized {
        background-color: rgb(0 0 0 / 0.8);
    }

    @media screen and (max-width: 1000px) {
        .popup {
            padding: 20px;
            position: absolute;
            left: 50%;
            top: 50%;
            /* 12px for windows menu bar */
            transform: translate(-50%, calc(-50% + 12px));
        }
    }

    .card {
        position: relative;
        background-color: var(--luz-pop-opaco, var(--primary));

        border-radius: 8px;

        min-width: 560px;
        min-height: 50px;
        max-width: 100%;
        max-height: 100%;

        border: 1px solid var(--luz-borda, var(--primary-lighter));
        box-shadow: 0 16px 48px rgb(0 0 0 / 0.5);
    }
    /* tres larguras: pequena (confirmacoes), padrao, grande (grades de modelos e mapa de telas) */
    .card.p {
        min-width: 0;
        width: 420px;
    }
    .card.g {
        min-width: 0;
        width: min(960px, 100%);
    }

    .headerContent {
        position: relative;
        display: flex;

        z-index: 1;

        transition: 0.2s box-shadow ease;

        height: 40px;
        border-bottom: 1px solid var(--luz-borda, var(--primary-lighter));
    }
    .headerContent.scrolled {
        box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
    }
    .headerMargin {
        margin: 0 4px 0 16px;
        position: relative;
        width: 100%;

        display: flex;
        align-items: center;
    }

    .scroll {
        overflow: auto;
        overflow-x: hidden;
        /* 40px(margem da janela) + 40px(cabecalho) + 32px(corpo) */
        max-height: calc(100vh - 112px);
    }

    .body {
        display: flex;
        flex-direction: column;
        margin: 16px;
        min-width: min(38vw, 528px);
        font-size: 13px;
    }
    .card.p .body,
    .card.g .body {
        min-width: 0;
    }

    .card :global(.popup-close),
    .card :global(.popup-back),
    .card :global(.popup-options),
    .card :global(.popup-reset) {
        position: absolute;
        inset-inline-end: 0;
        top: 6px;
        width: 28px;
        height: 28px;
        padding: 0 !important;
        border-radius: 4px;
        justify-content: center;

        z-index: 1;
    }

    .card :global(.popup-back) {
        left: 6px;
        top: 6px;
    }
    .card:has(.popup-back) h2 {
        margin-left: 28px;
    }

    .card :global(.popup-options) {
        inset-inline-end: 34px;

        /* overflow: visible; */
    }
    .card :global(.popup-options.active) {
        color: var(--secondary) !important;
        background-color: var(--primary-darkest) !important;
    }

    .card :global(.popup-options .state) {
        position: absolute;
        bottom: 0; /* -1px; */
        right: 0; /* -1px; */

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--primary-darkest);
        color: var(--text);
        padding: 2px;
        border-radius: 50%;

        font-size: 0.65em;
        opacity: 0.8;

        width: 18px;
        height: 18px;

        pointer-events: none;
    }

    .card :global(.popup-reset) {
        inset-inline-end: 68px;
    }

    /* ----- ajustes por janela (o conteudo e do fecho; aqui so a disposicao) ----- */

    /* dicas (lampada + frase) em todas as janelas: texto pequeno cinza a esquerda, sem icone */
    .body :global(.tip) {
        justify-content: flex-start !important;
        margin-bottom: 12px !important;
    }
    .body :global(.tip > svg) {
        display: none;
    }
    .body :global(.tip p) {
        font-size: 12px !important;
        opacity: 0.6 !important;
    }

    /* escolher monitor: "Mudar valores de saida" vira botao discreto no tamanho do texto (antes largura toda, vazando a direita) */
    .card[data-popup="choose_screen"] .body :global(main) {
        min-width: 0 !important;
        display: flex;
        flex-direction: column;
    }
    .card[data-popup="choose_screen"] .body :global(main > button.outlined) {
        width: auto !important;
        align-self: flex-start;
        height: 28px;
        padding: 0 12px !important;
        font-size: 12px;
    }
    .card[data-popup="choose_screen"] .body :global(main > br) {
        display: none;
    }

    /* ----- janelas nossas (components/main/janelas) ----- */
    .popup.topo {
        align-items: flex-start;
        padding-top: 14vh;
    }
    .card.p2 {
        min-width: 0;
        width: min(520px, 100%);
    }
    .card.p2 .body {
        min-width: 0;
    }
    .card.m {
        min-width: 0;
        width: min(780px, 100%);
    }
    .card.m .body {
        min-width: 0;
    }
    .card[data-popup="show"] {
        min-width: 0;
        width: min(560px, 100%);
        overflow: hidden;
    }
    .card[data-popup="show"] .body {
        margin: 0;
        min-width: 0;
    }
    .card.semCabecalho .scroll {
        max-height: calc(100vh - 72px);
    }
    .card :global(.pergunta) {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .card :global(.pergunta h3) {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.35;
        color: var(--luz-texto);
        white-space: initial;
    }
    .card :global(.pergunta > p) {
        margin: 0;
        font-size: 12px;
        color: var(--luz-mudo);
        white-space: initial;
    }
    .card :global(.pergunta .acoes) {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
    }
    .card :global(.jb) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 30px;
        padding: 0 14px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font-family: inherit;
        font-size: 13px;
        white-space: nowrap;
        cursor: pointer;
    }
    .card :global(.jb:hover) {
        background: var(--luz-hover);
    }
    .card :global(.jb.fantasma) {
        border-color: transparent;
        color: var(--luz-mudo);
    }
    .card :global(.jb.fantasma:hover) {
        color: var(--luz-texto);
    }
    .card :global(.jb.principal) {
        background: var(--luz-texto);
        border-color: transparent;
        color: var(--luz-tinta);
        font-weight: 600;
    }
    .card :global(.jb.principal:hover) {
        background: #fff;
    }
    .card :global(.jb:focus-visible) {
        outline: none;
        box-shadow: 0 0 0 3px var(--luz-halo-foco, rgba(248, 248, 240, 0.25));
    }
    .card :global(.jcampo) {
        height: 30px;
        margin-top: 8px;
        padding: 0 10px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        font-family: inherit;
        font-size: 13px;
        outline: none;
    }
    .card :global(.jcampo:focus) {
        border-color: var(--luz-borda-forte);
    }
</style>
