<script lang="ts">
    import { slide } from "svelte/transition"
    import { activeEdit, activePage, activeProfile, activeProject, activeShow, cloudUsers, dictionary, drawSettings, drawTool, os, outputDisplay, outputs, paintCache, profiles, saved, settingsTab, shows } from "../../stores"
    import { onDestroy } from "svelte"
    import { getCloudUsers } from "../../utils/cloudSync"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { toggleOutputs } from "../helpers/output"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import TopButton from "../inputs/TopButton.svelte"
    import { DEFAULT_DISPLAY_NAME } from "../../utils/SocketHelper"

    export let isWindows = false

    $: show = $shows[$activeShow?.id || ""]
    $: showProfile = profile?.access.shows || {}
    $: isLocked = show?.locked || showProfile.global === "read" || showProfile[show?.category || ""] === "read"

    // && !$editHistory.length
    $: editDisabled = $activeEdit.id && ($activeEdit.type || "show") !== "show" ? false : $activeShow && ($activeShow?.type || "show") === "show" ? isLocked : $activeShow?.type === "pdf" || !$activeShow?.id
    $: physicalOutputWindows = Object.values($outputs).filter((a) => a.enabled && !a.invisible)

    let confirm = false
    let disableClick = false
    let cancelConfirmTimeout: NodeJS.Timeout | null = null
    function toggleOutput(e: any) {
        if (cancelConfirmTimeout) clearTimeout(cancelConfirmTimeout)

        const forceKey = e.ctrlKey || e.metaKey

        if (!$outputDisplay || confirm) {
            if (confirm) {
                // prevent displaying just after close
                disableClick = true
                setTimeout(() => (disableClick = false), 800)
            }

            confirm = false
            toggleOutputs(null, { force: forceKey })
            return
        }

        if (forceKey) return

        confirm = true
        cancelConfirmTimeout = setTimeout(() => {
            confirm = false
        }, 1800)
    }

    function openOutputSettings() {
        settingsTab.set("display_settings")
        activePage.set("settings")
    }

    // disabled tabs

    let settingsDisabled = false
    $: profile = $profiles[$activeProfile || ""]
    $: settingsDisabled = Object.keys(profile?.access.settings || {}).length > 7

    $: noPhysicalOutputWindows = (!$outputDisplay && !physicalOutputWindows.length) || disableClick

    $: users = getCloudUsers($cloudUsers)
    function goToUser(user: { [key: string]: any }) {
        if (user.activePage) activePage.set(user.activePage as any)
        if (user.activeProject) activeProject.set(user.activeProject)
        if (user.activeShow) {
            activeShow.set(user.activeShow)

            if (user.activeShow.type === "image" || user.activeShow.type === "video") activeEdit.set({ id: user.activeShow.id, type: "media", items: [] })
            else activeEdit.set({ type: "show", slide: 0, items: [], showId: user.activeShow.id })
        }
    }
    // Cronometro do culto para o badge NO AR: comeca quando a primeira saida
    // entra no ar e zera quando todas saem. Fica local a este componente
    // porque nada mais no app precisa dele.
    let noArDesde = 0
    let tempoNoAr = "00:00"
    let cronometro: ReturnType<typeof setInterval> | null = null

    function atualizarTempo() {
        if (!noArDesde) return
        const total = Math.floor((Date.now() - noArDesde) / 1000)
        const h = Math.floor(total / 3600)
        const m = Math.floor((total % 3600) / 60)
        const seg = total % 60
        tempoNoAr = (h ? h + ":" : "") + `${m}`.padStart(2, "0") + ":" + `${seg}`.padStart(2, "0")
    }

    function pararCronometro() {
        if (cronometro) clearInterval(cronometro)
        cronometro = null
        noArDesde = 0
    }

    $: if ($outputDisplay) {
        if (!cronometro) {
            noArDesde = Date.now()
            atualizarTempo()
            cronometro = setInterval(atualizarTempo, 1000)
        }
    } else if (cronometro) {
        pararCronometro()
    }

    onDestroy(pararCronometro)
</script>

{#if users.length}
    <div class="users" style="{isWindows ? 'top: 25px;' : ''}width: calc(17px + ((22px - 5px) * {users.length}));" data-title={translateText("settings.connections")}>
        {#each users as user, i}
            {@const isSameArea = $activeShow && user.activeShow?.id === $activeShow?.id}
            {@const name = user.displayName || DEFAULT_DISPLAY_NAME}

            <div class="user" class:isSameArea data-title={name} style="background-color: {user.color};transform: translateX(-{5 * i}px);" role="none" on:click={() => goToUser(user)}>
                {#if name === DEFAULT_DISPLAY_NAME}
                    <Icon id="profiles" size={1.2} white />
                {:else}
                    {name.charAt(0)}
                {/if}
            </div>
        {/each}
    </div>
{/if}

<div class="top panel" class:drag={!isWindows}>
    <!-- {#if !isWindows}
    <div class="dragZone" />
    {/if} -->
    <span style="width: var(--navigation-width);">
        {#if !$saved && $os.platform !== "win32"}
            <div class="unsaved" />
        {/if}
        <!-- marca -->
        <div class="marca">
            <span class="marcaSimbolo" />
            <span class="marcaTexto">ALIANÇA</span>
        </div>
        <span class="divisor" />
        <!-- <div class="logo">
            <img style="height: 35px;" src="./import-logos/aliancashow.webp" alt="AliançaShow-logo" draggable={false} />
            <h1 style="color: var(--text);font-size: 1.7em;">AliançaShow</h1>
        </div> -->
    </span>
    <span>
        <TopButton id="show" />
        <TopButton id="edit" disabled={editDisabled} />
        <TopButton id="stage" />
        <!-- AliancaShow: modo Biblia em tela cheia, ao lado de Palco -->
        <TopButton id="scripture" />
    </span>
    <span style="width: var(--navigation-width);justify-content: flex-end;">
        {#if $outputDisplay}
            <div class="noAr" data-title={translateText("menu._title_display_stop [Ctrl+O]", $dictionary)}>
                <span class="noArPonto" />
                NO AR · {tempoNoAr}
            </div>
        {/if}
        <TopButton id="draw" red={$drawTool === "fill" || ($drawTool === "zoom" && $drawSettings.zoom?.size !== 100) || !!($drawTool === "paint" && $paintCache?.length)} hideLabel />
        {#if !settingsDisabled}
            <TopButton id="settings" hideLabel />
        {/if}

        <!-- <MaterialButton id="output_window_button" class="context #output display {$outputDisplay ? 'on' : 'off'}" title="menu.{$outputDisplay ? (confirm ? 'again_confirm' : '_title_display_stop') : '_title_display'} [Ctrl+O]" style={$outputDisplay || disableClick ? "" : "border-bottom: 2px solid var(--secondary);"} on:click={toggleOutput} disabled={(!$outputDisplay && !physicalOutputWindows.length) || disableClick} red={$outputDisplay}>
            {#if $outputDisplay}
                {#if confirm}
                    <Icon id="close" size={1.6} white />
                {:else}
                    <Icon id="cancelDisplay" size={1.6} white />
                {/if}
            {:else}
                <Icon id="outputs" size={1.6} white />
            {/if}

            {#if $outputDisplay && confirm}
                <div class="click_again" transition:slide>
                    <T id="menu.again_confirm" />
                </div>
            {/if}
        </MaterialButton> -->
        <Button id="output_window_button" title={translateText(`menu.${$outputDisplay ? (confirm ? "again_confirm" : "_title_display_stop") : "_title_display"} [Ctrl+O]`, $dictionary)} style={$outputDisplay || disableClick ? "" : "background: rgb(242 26 39 / 0.16);box-shadow: inset 0 0 0 1px rgb(242 26 39 / 0.3);border-radius: 8px;"} on:click={toggleOutput} class="context #output display {$outputDisplay ? 'on' : 'off'}" red={$outputDisplay} disabled={noPhysicalOutputWindows}>
            {#if $outputDisplay}
                {#if confirm}
                    <Icon id="close" size={1.6} white />
                {:else}
                    <Icon id="cancelDisplay" size={1.6} white />
                {/if}
            {:else}
                <Icon id="outputs" size={1.6} white />
            {/if}

            {#if $outputDisplay && confirm}
                <div class="click_again" transition:slide>
                    <T id="menu.again_confirm" />
                </div>
            {/if}
        </Button>
        {#if !$outputDisplay && !physicalOutputWindows.length}
            <div data-title={translateText("No 'physical' outputs available!")} style="position: absolute;top: 0;inset-inline-end: 0;height: 100%;width: 60px;" role="none" on:click={openOutputSettings} />
        {/if}
    </span>
</div>

<style>
    .top {
        position: relative;
        display: flex;
        justify-content: space-between;
        z-index: 30;
        align-items: center;
        gap: 18px;
        padding: 0 16px;
        min-height: 54px;
        height: 54px;

        /* A barra e um painel de vidro como as colunas, so um pouco mais
           presente. A sombra projetada saiu: nesta direcao a profundidade vem
           do desfoque e da borda, e sombra fica reservada para overlays. */
        background: rgb(255 255 255 / 0.045);

        /* disabled because it's causing unexpected behaviour in Windows 11 */
        /* -webkit-app-region: drag; */
    }
    .top span {
        display: flex;
    }

    /* Marca: quadrado da cor da marca mais o wordmark. Substitui o titulo de
       1.8em, que competia com o conteudo da tela. */
    .marca {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-inline-start: 4px;
    }
    .marcaSimbolo {
        width: 9px;
        height: 9px;
        border-radius: 2px;
        background: var(--secondary);
    }
    .marcaTexto {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #eceded;
    }
    .divisor {
        width: 1px;
        height: 22px;
        background: rgb(255 255 255 / 0.08);
        align-self: center;
    }

    /* Badge NO AR: o unico elemento que pulsa na interface. O pulso e o que
       chama o olho de longe; por isso nada mais anima em laco. */
    .noAr {
        display: flex;
        align-items: center;
        gap: 8px;
        align-self: center;
        padding: 6px 12px;
        border-radius: 20px;
        background: rgb(242 26 39 / 0.14);
        border: 1px solid rgb(242 26 39 / 0.3);
        font-family: var(--font-mono);
        font-size: 11px;
        color: #ff8f97;
        white-space: nowrap;
    }
    .noArPonto {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ff5b66;
        animation: liveGlow 2s ease-in-out infinite;
    }
    @keyframes liveGlow {
        0%,
        100% {
            opacity: 0.55;
        }
        50% {
            opacity: 1;
        }
    }

    .top.drag {
        -webkit-app-region: drag;
    }

    .top.drag :global(button) {
        -webkit-app-region: no-drag;
    }

    /* .dragZone {
        position: absolute;

        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darker);
        width: 100%;
        height: 3px;

        z-index: 2;
        -webkit-app-region: drag;
    } */

    div :global(button.display) {
        display: flex;
        justify-content: center;
        min-width: 60px;
    }

    .unsaved {
        position: absolute;
        left: 0;
        height: 100%;
        width: 5px;
        background-color: var(--red);
    }

    /* .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0px 10px;
        width: 100%;
        gap: 10px;
    } */

    @media screen and (max-width: 580px) {
        .top span:first-child {
            display: none;
        }
    }

    .click_again {
        position: absolute;
        bottom: 0;
        inset-inline-end: 0;
        transform: translateY(100%);

        font-size: 1.1em;
        padding: 4px 10px;
        font-weight: normal;
        background-color: var(--primary-darker);
        color: var(--text);

        border: 2px solid var(--secondary);
        border-top: none;
        border-inline-end: none;
    }

    /* USERS */

    .users {
        position: absolute;
        top: 0;
        left: 0;
        height: calc(40px - 4px);

        display: flex;
        align-items: center;
        /* gap: 2px; */
        margin: 2px 0;
        padding: 0 5px;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-left: none;
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;

        z-index: 31;
    }

    .user {
        width: 22px;
        min-width: 22px;
        height: 22px;

        background-color: var(--secondary);
        color: var(--textInvert);
        border: 1px solid var(--primary-lighter);
        border-radius: 50%;

        font-size: 0.8em;
        font-weight: bold;

        display: flex;
        align-items: center;
        justify-content: center;
    }
    .user:hover {
        filter: brightness(0.9);
    }
    .user.isSameArea {
        box-shadow: 0 0 0 2px var(--secondary);
    }
</style>
