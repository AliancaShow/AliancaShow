<script lang="ts">
    import { fade, scale } from "svelte/transition"
    import type { Popups } from "../../../types/Main"
    import { activePopup, alertMessage, popupData, special } from "../../stores"
    import { popups } from "../../utils/popup"
    import { disablePopupClose } from "../../utils/shortcuts"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { EFFECTS_LIST } from "../../audio/effects/audioEffectsHelpers"

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
    const GRANDES = ["select_template", "choose_screen"]
    $: tamanho = popupId && PEQUENAS.includes(popupId) ? "p" : popupId && GRANDES.includes(popupId) ? "g" : ""
</script>

{#if popupId !== null}
    {#key popupId}
        <div class="popup luz-pele" class:isOptimized transition:fade={{ duration: isOptimized ? 20 : 100 }} on:mousedown={mousedown}>
            <div class="card {tamanho}" data-popup={popupId} transition:scale={{ duration: isOptimized ? 50 : 150, start: 0.97 }}>
                {#if popupId !== "alert"}
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
                        <svelte:component this={popups[popupId]} />
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

    /* fechar o programa: Cancelar / Sair sem salvar / Salvar e sair numa linha, a direita, altura normal; a letra do atalho some (N/Q/Y continuam) */
    .card[data-popup="unsaved"] .body :global(.list) {
        flex-direction: row;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
    }
    .card[data-popup="unsaved"] .body :global(.list > button) {
        width: auto !important;
        margin-top: 0 !important;
        height: 30px;
        padding: 0 14px !important;
        font-size: 13px;
    }
    .card[data-popup="unsaved"] .body :global(.list > button > span:not(.ripple)) {
        display: none;
    }
    .card[data-popup="unsaved"] .body :global(.list > button > div) {
        opacity: 1 !important;
    }

    /* confirmar (Sim / Nao): a direita, botoes compactos */
    .card[data-popup="confirm"] .body :global(.row) {
        justify-content: flex-end !important;
        gap: 8px !important;
    }
    .card[data-popup="confirm"] .body :global(.row > button) {
        min-width: 88px !important;
        height: 30px;
        padding: 0 14px !important;
        font-size: 13px;
    }
    .card[data-popup="confirm"] .body :global(.row > button > svg) {
        display: none;
    }
    /* "Sim" e a acao principal: botao claro */
    .card[data-popup="confirm"] .body :global(.row > button:last-child) {
        background: var(--luz-texto, #f8f8f0) !important;
        color: #111 !important;
        border-color: transparent !important;
    }
    .card[data-popup="confirm"] .body > :global(button) {
        align-self: flex-end;
        height: 30px;
        padding: 0 14px !important;
        margin-top: 16px !important;
    }

    /* aviso: o texto e o botao "ok" no canto, sem o <br> que empurrava */
    .card[data-popup="alert"] .body {
        margin-top: 18px;
    }
    .card[data-popup="alert"] .body > :global(br) {
        display: none;
    }
    .card[data-popup="alert"] .body > :global(button) {
        align-self: flex-end;
        margin-top: 14px;
        height: 30px;
        padding: 0 18px !important;
    }

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

    /* escolher modelo: a grade usa a largura da janela, nao a da tela inteira */
    .card[data-popup="select_template"] .body > :global(div[style*="overflow-y"]) {
        width: 100% !important;
        max-height: calc(100vh - 220px);
    }
</style>
