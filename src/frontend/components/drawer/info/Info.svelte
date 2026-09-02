<script lang="ts">
    import { activeShow, forceClock } from "../../../stores"
    import Center from "../../system/Center.svelte"
    import Clock from "../../system/Clock.svelte"
    import Date from "../../system/Date.svelte"
    import AudioInfo from "./AudioInfo.svelte"
    import CalendarInfo from "./CalendarInfo.svelte"
    import FunctionsInfo from "./FunctionsInfo.svelte"
    import MediaInfo from "./MediaInfo.svelte"
    import ScriptureInfo from "./ScriptureInfo.svelte"
    import ShowInfo from "./ShowInfo.svelte"
    import TemplateInfo from "./TemplateInfo.svelte"

    export let id: string
    // Layout D: optionsOpen virou prop para o Drawer decidir se este painel tem
    // conteudo (e portanto se merece largura) sem duplicar estado.
    export let optionsOpen = false

</script>

<div class="main {id !== 'shows' || $activeShow !== null ? 'context #drawer_info' : ''}">
    {#if !$forceClock && id === "shows"}
        <ShowInfo {optionsOpen} />
    {:else if !$forceClock && id === "media"}
        <MediaInfo {optionsOpen} />
    {:else if !$forceClock && id === "audio"}
        <AudioInfo />
        <!-- {:else if !$forceClock && id === "overlays"}
        <OverlayInfo /> -->
    {:else if !$forceClock && id === "templates"}
        <TemplateInfo {optionsOpen} />
    {:else if !$forceClock && id === "scripture"}
        <ScriptureInfo {optionsOpen} />
    {:else if !$forceClock && id === "calendar"}
        <CalendarInfo {optionsOpen} />
    {:else if !$forceClock && id === "functions"}
        <FunctionsInfo />
    {:else if $forceClock}
        <!-- Layout D: relogio grande so quando o usuario liga essa opcao no menu de
             contexto. O relogio normal agora e fixo no rodape da coluna direita. -->
        <Center>
            <Clock />
            <Date />
        </Center>
    {/if}

</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
    }

    div :global(h2) {
        color: var(--text);
    }
</style>
