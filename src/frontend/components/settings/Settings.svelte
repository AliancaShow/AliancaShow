<script lang="ts">
    import { resetAudioRouting } from "../../audio/routing/audioRoutingInit"
    import { dictionary, settingsTab } from "../../stores"
    import { configSecao, ROTULOS_CONFIG } from "../../utils/aliancaConfigSecao"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Tip from "../main/Tip.svelte"
    import AudioRouting from "./tabs/AudioRouting.svelte"
    import Connection from "./tabs/Connection.svelte"
    import Files from "./tabs/Files.svelte"
    import FilesButtons from "./tabs/FilesButtons.svelte"
    import General from "./tabs/General.svelte"
    import Other from "./tabs/Other.svelte"
    import OtherButtons from "./tabs/OtherButtons.svelte"
    import Outputs from "./tabs/Outputs.svelte"
    import OutputsGeneral from "./tabs/OutputsGeneral.svelte"
    import OutputsTabs from "./tabs/OutputsTabs.svelte"
    import Profiles from "./tabs/Profiles.svelte"
    import ProfilesButtons from "./tabs/ProfilesButtons.svelte"
    import ProfilesTabs from "./tabs/ProfilesTabs.svelte"
    import Styles from "./tabs/Styles.svelte"
    import StylesButtons from "./tabs/StylesButtons.svelte"
    import StylesTabs from "./tabs/StylesTabs.svelte"
    import Theme from "./tabs/Theme.svelte"
    import ThemeButtons from "./tabs/ThemeButtons.svelte"
    import ThemeTabs from "./tabs/ThemeTabs.svelte"

    $: tabId = $settingsTab

    let scrolled = false
    $: if (tabId === null) scrolled = false
    function scroll(e) {
        scrolled = e.target.scrollTop > 0
    }

    const hints = {
        display_settings: "settings.outputs_hint",
        styles: "settings.styles_hint",
        audio: "settings.audio_hint",
        profiles: "profile.profiles_hint"
    }

    let showMore = false
</script>

<main>
    <div class="title" style={scrolled ? "box-shadow: none;" : ""}>
        <h2>{(tabId === "connection" && $configSecao ? ROTULOS_CONFIG[$configSecao] : ROTULOS_CONFIG[tabId]) || translateText(`settings.${tabId}`, $dictionary)}</h2>

        <div style="display: flex;align-items: center;gap: 8px;">
            {#if hints[tabId]}
                <Tip type="info" value={translateText(hints[tabId])} style="opacity: 0.7;" hiddenText white />
            {/if}

            {#if tabId === "styles"}
                <StylesButtons />
            {:else if tabId === "audio"}
                <MaterialButton title="actions.reset" icon="reset" on:click={resetAudioRouting} />
            {:else if tabId === "profiles"}
                <ProfilesButtons />
            {:else if tabId === "theme"}
                <ThemeButtons />
            {:else if tabId === "display_settings"}
                <MaterialButton title="create_show.more_options" on:click={() => (showMore = !showMore)}>
                    <Icon id="options" white={!showMore} />
                </MaterialButton>
            {/if}
        </div>
    </div>

    <div class="scroll" style={tabId === "audio" ? "--padding: 20px;" : ""} on:scroll={scroll}>
        {#if tabId === "general"}
            <General />
        {:else if tabId === "display_settings"}
            {#if showMore}
                <OutputsGeneral />
            {:else}
                <Outputs />
            {/if}
        {:else if tabId === "styles"}
            <Styles />
        {:else if tabId === "audio"}
            <AudioRouting />
        {:else if tabId === "connection"}
            <Connection />
        {:else if tabId === "files"}
            <Files />
        {:else if tabId === "profiles"}
            <Profiles />
        {:else if tabId === "theme"}
            <Theme />
        {:else if tabId === "other"}
            <Other />
        {/if}
    </div>

    {#if !showMore}
        <div class="tabs">
            {#if tabId === "display_settings"}
                <OutputsTabs />
            {:else if tabId === "styles"}
                <StylesTabs />
            {:else if tabId === "files"}
                <FilesButtons />
            {:else if tabId === "profiles"}
                <ProfilesTabs />
            {:else if tabId === "theme"}
                <ThemeTabs />
            {:else if tabId === "other"}
                <OtherButtons />
            {/if}
        </div>
    {/if}
</main>

<style>
    /* C4: pagina do painel de Configuracoes (titulo 22 px, abas da pagina logo abaixo do titulo, conteudo com 24/32 de respiro) */
    main {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        position: relative;

        --padding: 32px;
    }

    .title {
        order: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;

        padding: 24px var(--padding) 0;

        transition: 0.2s box-shadow ease;
    }

    h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        font-variation-settings: "wdth" 112;
        letter-spacing: -0.01em;
        color: var(--luz-texto);

        overflow: visible;
        margin-right: 20px;
    }

    .scroll {
        order: 2;
        position: relative;

        overflow-y: auto;
        flex: 1;
        min-height: 0;
        padding: 8px var(--padding) 24px;
    }

    .tabs {
        order: 1;
        z-index: 1;
        flex-shrink: 0;
        padding: 16px var(--padding) 0;
    }
</style>
