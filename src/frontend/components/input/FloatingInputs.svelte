<script lang="ts">
    import { special } from "../../stores"
    import { isDarkTheme } from "../../utils/common"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    export let side: "right" | "left" | "center" = "right"
    export let onlyOne = false
    export let gradient = false
    export let round = false
    export let arrow = false
    export let bottom = 10
    // leiaute v2 (fatia 9): a barra deixa de flutuar sobre o conteudo e assenta no rodape da area, no tema Luz
    export let dock = false

    let open = false

    const light = !isDarkTheme()
    $: isOptimized = $special.optimizedMode
</script>

<!-- in:fade={{ duration: 80 }} -->
<div class="row {side}" class:isOptimized class:light class:onlyOne class:gradient class:round class:dock style="bottom: {bottom}px;{$$props.style || ''}" on:mousedown>
    {#if arrow}
        <MaterialButton style={open ? "" : "opacity: 0.6;"} class="expand" title={open ? "actions.close" : "create_show.more_options"} isActive={open} on:click={() => (open = !open)}>
            <Icon class="submenu_{open ? 'close' : 'open'}" id="arrow_back_modern" size={0.9} white={!open} />
        </MaterialButton>

        <div class="divider"></div>

        {#if open}
            <!-- transition:slide={{ duration: 500, axis: "x" }} -->
            <div class="menu">
                <slot name="menu" />
            </div>

            <!-- <div class="divider"></div> -->
        {/if}
    {/if}

    <slot {open} />
</div>

<style>
    .row {
        --size: 40px;
        --padding: 12px;

        display: flex;
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);

        height: var(--size);

        position: absolute;
        bottom: var(--padding);

        border-radius: var(--size);
        /* padding: 0 18px; */
        overflow: hidden;
        z-index: 199; /* over edit items */

        max-width: calc(100% - 22px);

        --background: rgba(25, 25, 35, 0.85);
        background-color: var(--background);
        backdrop-filter: blur(3px);
    }
    .row.light {
        --background: rgba(225, 225, 225, 0.85);
    }
    .row:has(.overflow) {
        overflow: visible;
    }
    .row:has(.overflow-interact) {
        bottom: 0 !important;
        height: calc(var(--size) + var(--padding));
        border-radius: calc(var(--size) * 0.5);
        border: none;
        box-shadow: none;
        background: transparent;
        backdrop-filter: unset;
    }
    .row:has(.overflow-interact) :global(button) {
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);
    }

    .row.round {
        border-radius: 50%;

        --size: 45px;
    }

    .row.right {
        right: var(--padding);
    }
    .row.left {
        left: var(--padding);
    }
    .row.center {
        left: 50%;
        transform: translateX(-50%);
    }

    .row :global(.divider) {
        height: 100%;
        width: 1px;
        background-color: var(--primary-lighter);
    }

    .row :global(button) {
        background-color: transparent !important;
        height: calc(var(--size) - 2px);
        /* aspect-ratio: 1; */
        padding: 0 12px !important;
        border-radius: 0;
    }
    .row.onlyOne :global(button) {
        padding: 0 20px !important;
    }
    .row.round :global(button) {
        aspect-ratio: 1;
        /* width: var(--size);
        height: var(--size); */
    }
    .row.round :global(button.isActive) {
        border: 2px solid var(--secondary) !important;
        border-radius: 50%;
        cursor: pointer;
    }

    .row :global(button.expand.isActive) {
        border: none !important;
        cursor: pointer;
    }
    .row :global(button.expand svg) {
        transition: 0.3s transform ease;
    }
    .row :global(button.expand.isActive svg) {
        transform: rotate(180deg);
    }

    .row.gradient :global(button) {
        font-size: 1em;

        border-radius: 50px;

        /* gradient border */
        background:
            linear-gradient(var(--background), var(--background)) padding-box,
            linear-gradient(160deg, #750b0b 0%, #9c1114 20%, #f1d278 60%, var(--secondary) 100%) border-box !important;
        border: 2px solid transparent;

        transition: 0.4s filter ease;
    }
    .row.gradient :global(button:not(.isActive):not(:disabled):hover),
    .row.gradient :global(button:not(.isActive):not(:disabled):active) {
        background:
            linear-gradient(var(--background), var(--background)) padding-box,
            linear-gradient(160deg, #750b0b 0%, #9c1114 20%, #f1d278 60%, var(--secondary) 100%) border-box !important;

        filter: hue-rotate(15deg);
    }
    .row.gradient :global(button:not(.isActive):not(:disabled):active) {
        filter: hue-rotate(30deg);
    }

    /* acoplada (leiaute v2, fatia 9): fica no rodape da area em vez de boiar sobre os cartoes; tokens Luz, raio 8 px */
    .row.dock {
        position: sticky;
        bottom: 0 !important;
        left: auto;
        right: auto;
        transform: none;
        flex: none;
        margin-top: auto;
        width: max-content;
        height: 34px;
        border-radius: 8px;
        border: 1px solid var(--luz-borda, var(--primary-lighter));
        background-color: var(--luz-campo, var(--background));
        box-shadow: none;
        backdrop-filter: none;
    }
    .row.dock.left {
        align-self: flex-start;
    }
    .row.dock.right {
        align-self: flex-end;
    }
    .row.dock.center {
        align-self: center;
    }
    .row.dock :global(button) {
        height: 32px;
        color: var(--luz-texto, inherit);
    }
    .row.dock :global(button:focus-visible) {
        outline: 2px solid var(--luz-texto, currentColor);
        outline-offset: -2px;
    }

    .menu {
        display: flex;
        flex-direction: column;
    }
</style>
