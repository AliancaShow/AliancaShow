<script lang="ts">
    import type { ClickEvent } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { dictionary, ndiData, outputs, outputState } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    // onMount(() => {
    //     currentOutputId = getActiveOutputs({}, true, true)[0]
    // })

    $: outs = sortObject(sortByName(keysToID($outputs).filter((a) => a.enabled)), "stageOutput")

    function toggleOutput(e: ClickEvent, id: string) {
        if (outs.length <= 1) return

        outputs.update((a) => {
            if (e.detail.ctrl) {
                let newState = false
                let getAllActive = Object.values(a).filter((a) => !a.stageOutput && a.active)
                if ((getAllActive.length === 1 && a[id].active) || a[id].stageOutput) newState = true

                Object.keys(a).forEach((id) => {
                    a[id].active = a[id].stageOutput ? true : newState
                })
                a[id].active = true
            } else {
                a[id].active = a[id].stageOutput ? true : !a[id].active

                let activeList = Object.values(a).filter((a) => !a.stageOutput && a.enabled && a.active === true)
                if (!activeList.length) {
                    a[id].active = true
                    newToast("toast.one_output")
                }
            }

            return a
        })
    }

    // let allSameState = true
    // // wait for all windows to update first
    // $: if ($outputState) setTimeout(updateState, 100)
    // function updateState() {
    //     allSameState = new Set($outputState.map((a) => a.active)).size < 2
    // }

    function getOutputStateTitle(output: Output, _updater: any) {
        if (!output.active) return "output.state_locked"
        if ($outputState.find((a) => a.id === output.id)?.active) return "settings.enabled"
        if ($ndiData[output?.id || ""]?.connections > 0) return "NDI"
        if (output.invisible) return "settings.network_output"
        return "output.state_inactive"
    }
</script>

{#if outs.length > 1}
    <div class="outputTitles">
        {#each outs as output (output.id)}
            <MaterialButton id={output.id} title={output.stageOutput ? "" : "actions.toggle_output_lock"} active={output.active} style="flex: 1;font-weight: {output.active ? 700 : 400};border-radius: 16px;padding: 6px 8px;" class="output_button context #output_active_button" on:click={(e) => toggleOutput(e, output.id)}>
                <div class="indicator" class:locked={!output.active} class:invisible={output.invisible} class:ndi={$ndiData[output?.id || ""]?.connections > 0} class:active={$outputState.find((a) => a.id === output.id)?.active === true} data-title={translateText(getOutputStateTitle(output, { $outputState, $ndiData }), $dictionary)}></div>
                {#if output.stageOutput}<Icon id="stage" size={0.8} white />{/if}
                <!-- {#if !allSameState && $outputState.find((a) => a.id === output.id)?.active}<Icon id="check" />{/if} -->

                <p style={output.active ? "" : "text-decoration: line-through;"}>{output.name}</p>
            </MaterialButton>
        {/each}
    </div>
{/if}

<style>
    /* Segmented control do handoff: trilha escura com as opcoes dentro, no
       lugar das abas com regua colorida embaixo.

       O clique continua fazendo o que sempre fez -- travar e destravar aquela
       saida. O handoff propunha que passasse a so trocar o preview, mas essa
       funcao ja mora aqui e nao teria para onde ir. Mudanca de comportamento
       fica para uma decisao separada; isto e so a roupa nova. */
    .outputTitles {
        display: flex;
        gap: 2px;
        margin: 5px 5px 0;
        padding: 3px;
        border-radius: 20px;
        background: rgb(0 0 0 / 0.35);
    }

    .outputTitles :global(button) {
        cursor: pointer;
        white-space: nowrap;
        justify-content: center;
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #83848b;
        background: transparent !important;
        transition:
            background-color 120ms ease,
            color 120ms ease;
    }
    /* saida no ar: destaque neutro. O vermelho fica reservado para o slide. */
    .outputTitles :global(button.active) {
        background: rgb(255 255 255 / 0.1) !important;
        color: #fff;
    }
    .outputTitles :global(button:hover) {
        background: rgb(255 255 255 / 0.05) !important;
    }

    .indicator {
        padding: 0;
        width: 8px;
        height: 8px;
        border-radius: 50%;

        transition: 0.3s background-color ease;
        background-color: #ce3535;
    }
    .indicator.invisible {
        background-color: #897f7f;
    }
    .indicator.ndi {
        background-color: #48cbe9;
    }
    .indicator.active {
        background-color: #6dff85;
    }
    .indicator.locked {
        background-color: #c98b55;
    }
    .indicator.locked.active,
    .indicator.locked.ndi {
        background-color: #ffb16d;
    }
</style>
