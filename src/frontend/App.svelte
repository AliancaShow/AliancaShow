<script lang="ts">
    import AliancaTela from "./components/main/AliancaTela.svelte"
    import MainOutput from "./MainOutput.svelte"
    import ContextMenu from "./components/context/ContextMenu.svelte"
    import Pdf from "./components/export/Pdf.svelte"
    import { getContrast } from "./components/helpers/color"
    import { getBlending } from "./components/helpers/output"
    import { checkTimers, startEventTimer, startTimer } from "./components/helpers/timerTick"
    import Loader from "./components/main/Loader.svelte"
    import ProgressPanel from "./components/main/ProgressPanel.svelte"
    import Popup from "./components/main/Popup.svelte"
    import ProfileSelector from "./components/main/ProfileSelector.svelte"
    import Recorder from "./components/main/Recorder.svelte"
    import Toast from "./components/main/Toast.svelte"
    import TooltipManager from "./components/main/TooltipManager.svelte"
    import AliancaSpotlight from "./components/main/AliancaSpotlight.svelte"
    import Center from "./components/system/Center.svelte"
    import { activeProfile, activeTimers, closeAd, currentWindow, disabledServers, events, language, loaded, localeDirection, outputDisplay, outputs, profiles, theme, themes, timers } from "./stores"
    import { focusArea, logerror, mainClick, toggleRemoteStream } from "./utils/common"
    import { iniciarMarcaDeTecla } from "./utils/aliancaModo"
    import { keydown } from "./utils/shortcuts"
    import { startup } from "./utils/startup"

    startup()
    iniciarMarcaDeTecla()

    ///// UPDATERS /////

    // countdown timer tick
    $: if ($activeTimers.length) startTimer()
    $: if (Object.keys($timers).length) checkTimers()

    // check for show event
    $: if (Object.keys($events).length) startEventTimer()

    // stream to OutputShow
    $: if (($loaded && $disabledServers.output_stream !== "") || !$outputDisplay) setTimeout(toggleRemoteStream, 1000)

    // close youtube ad
    $: if ($closeAd) setTimeout(() => closeAd.set(false), 10)

    // edge blending
    let blending = ""
    $: if ($currentWindow === "output" && Object.values($outputs)[0]?.blending) blending = getBlending()

    // set language direction
    $: document.documentElement.setAttribute("dir", $localeDirection)
    $: document.documentElement.setAttribute("lang", $language)

    $: contrastColor = getContrast($themes[$theme]?.colors?.secondary || "")
    $: secondaryContrast = `--secondary-text: ${contrastColor === "#000000" ? "#161616" : "#f8f8f0"};`
    $: globalStyle = `${secondaryContrast}${blending}`

    let ready = false
    $: if ($loaded) hasLoaded()
    function hasLoaded() {
        setTimeout(() => {
            // prevent brief flash
            ready = true
        }, 51)
    }
</script>

<svelte:window on:keydown={keydown} on:mousedown={focusArea} on:click={mainClick} on:error={logerror} on:unhandledrejection={logerror} />

{#if $currentWindow === "pdf"}
    <Pdf />
{:else}
    <main style={globalStyle} class:closeAd={$closeAd} class:background={$currentWindow === "output"}>
        <ContextMenu />
        <TooltipManager />

        {#if $currentWindow === "output"}
            <MainOutput />
        {:else if $loaded}
            <Popup />
            <AliancaSpotlight />
            <Toast />
            <Recorder />
            <ProgressPanel />

            <AliancaTela />

            {#if ready && Object.keys($profiles).filter((a) => a !== "admin").length && $activeProfile === null}
                <ProfileSelector />
            {/if}
        {:else}
            <Center>
                <Loader size={2} />
            </Center>
        {/if}
    </main>
{/if}

<style>
    main {
        height: 100%;
    }
    main:not(.background) {
        background-color: var(--primary);
        /* background: linear-gradient(130deg, var(--primary) 0%, rgb(42, 44, 62) 100%); */
    }

    .closeAd {
        height: 1px;
    }
</style>
