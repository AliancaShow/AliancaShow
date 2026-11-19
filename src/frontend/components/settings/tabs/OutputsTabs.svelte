<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import type { ClickEvent } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { checkPrimaryOutputRouting, createOutputAudioChannel } from "../../../audio/routing/audioRoutingInit"
    import { activeTriggerFunction, currentOutputSettings, outputDisplay, outputs, popupData, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { waitForPopupData } from "../../../utils/popup"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { clone, keysToID, sortByName, sortObject } from "../../helpers/array"
    import { addOutput, checkFFmpeg, enableStageOutput, refreshOut } from "../../helpers/output"
    import SelectElem from "../../system/SelectElem.svelte"

    // prevent "resetting" rename if output changed while renaming
    $: updatedOutputs = $outputs
    let currentOutputs = clone($outputs)
    $: {
        let newOutputs = clone(updatedOutputs)
        Object.values(newOutputs).map((a) => {
            delete a.out
            return a
        })
        let currOutputs = clone(currentOutputs)
        Object.values(currOutputs).map((a) => {
            delete a.out
            return a
        })

        if (JSON.stringify(newOutputs) !== JSON.stringify(currOutputs)) {
            currentOutputs = clone(updatedOutputs)
        }
    }

    ///

    let outputsList: Output[] = []
    $: outputsList = sortObject(sortByName(keysToID(currentOutputs)), "stageOutput")

    $: if (outputsList.length && (!$currentOutputSettings || !currentOutputs[$currentOutputSettings])) currentOutputSettings.set(outputsList.find((a) => a.enabled)?.id || outputsList[0].id || "")

    let currentOutput: Output | null = null
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...currentOutputs[$currentOutputSettings] }

    function updateOutput(key: string, value: any, outputId = currentOutput?.id || "") {
        if (!outputId || !$outputs[outputId]) return

        if (key === "style") setTimeout(refreshOut)

        outputs.update((a: any) => {
            const out = a[outputId]

            // Update value
            if (key.includes(".")) {
                const [p1, p2] = key.split(".")
                out[p1][p2] = value
                if (p2 === "lines" && !Number(value)) delete out[p1][p2]
            } else {
                out[key] = value
            }

            if (key === "enabled" && value) {
                send(OUTPUT, ["CREATE"], { ...out, id: outputId })
                // checkWindowCapture()
                AudioAnalyser.recorderActivate()
            }

            const captureTypeKeys = ["blackmagic", "ndi", "webrtc", "rtmp"]
            const ipcKeys = ["alwaysOnTop", "transparent", "invisible"]
            if (out.enabled && (captureTypeKeys.includes(key) || ipcKeys.includes(key))) {
                if (value && captureTypeKeys.includes(key)) newToast("toast.output_capture_enabled")
                send(OUTPUT, ["SET_VALUE"], { id: outputId, key, value: key === "blackmagic" ? out : value })
            }

            return a
        })
    }

    // CREATE

    $: if ($activeTriggerFunction === "create_output") createOutput()
    async function createOutput(e?: ClickEvent) {
        const skipPopup = e?.detail.ctrl
        const stageLayouts = keysToID($stageShows)

        // input type (normal/stage)
        const type = stageLayouts.length && !skipPopup ? await waitForPopupData("choose_output_input") : "normal"
        if (!type) return

        // data (style/layout)
        let styleId = ""
        let stageId = ""
        if (type === "stage") {
            const sorted = sortByName(stageLayouts)
            const firstId = sorted[0]?.id || ""
            stageId = stageLayouts.length > 1 ? (await waitForPopupData("select_stage_layout")) || firstId : firstId
        } else if (Object.keys($styles).length && !skipPopup) {
            popupData.set({ outputId: currentOutput?.id, skip: true })
            styleId = await waitForPopupData("select_style")
        }

        // output type (local/network)
        let setup = { localType: "window", networkType: "" }
        if (!skipPopup) setup = (await waitForPopupData("choose_output_type")) || setup
        const { localType, networkType } = setup

        // FFmpeg check for RTMP
        if (networkType === "rtmp" && !(await checkFFmpeg())) return

        // create
        let outputId = ""
        if (type === "stage") {
            toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
            outputId = enableStageOutput({ stageOutput: stageId, name: $stageShows[stageId]?.name || "" })
        } else {
            let name = ""
            if (networkType && !localType) {
                if (networkType === "ndi") name = "NDI"
                else if (networkType === "webrtc") name = "WebRTC"
                else if (networkType === "rtmp") name = "RTMP"
            }

            outputId = addOutput(false, styleId, false, name)
        }

        // apply settings
        if (!skipPopup) {
            if (localType !== "window") {
                updateOutput("invisible", true, outputId)
                if (!localType && networkType === "ndi") updateOutput("transparent", true, outputId)
            }

            if (localType === "blackmagic") updateOutput("blackmagic", true, outputId)
            if (networkType === "ndi") updateOutput("ndi", true, outputId)
            else if (networkType === "webrtc") updateOutput("webrtc", true, outputId)
            else if (networkType === "rtmp") updateOutput("rtmp", true, outputId)

            updateOutput("enabled", true, outputId)

            if (networkType) createOutputAudioChannel(outputId)
            else checkPrimaryOutputRouting()
        }
    }

    // C4: saidas criadas depois que esta pagina abriu levam o selo NOVO (ambar) ate a pagina fechar
    const iniciais = new Set(Object.keys($outputs))
    $: novas = outputsList.filter((o) => !iniciais.has(o.id || "")).map((o) => o.id || "")

    /** vermelho = saida NO AR agora; verde = habilitada; sem ponto = desligada (so o no ar leva vermelho) */
    const estado = (tab: Output, noAr: boolean) => (tab.enabled === false ? "" : noAr ? "ar" : "ligada")

    function criar(e: MouseEvent) {
        createOutput({ detail: { ctrl: e.ctrlKey } } as unknown as ClickEvent)
    }

    async function identificar() {
        const telas = (await requestMain(Main.GET_DISPLAYS)) || []
        send(OUTPUT, ["IDENTIFY_SCREENS"], telas)
    }
</script>

<div class="faixa" data-acao="saidas-faixa">
    <div class="luz-seg" role="tablist" data-acao="saidas-abas">
        {#each outputsList as tab (tab.id)}
            <SelectElem id="output" data={{ id: tab.id }} fill>
                <button type="button" role="tab" aria-selected={$currentOutputSettings === tab.id} class="aba context #output_screen{tab.stageOutput ? "_stage" : ""}" class:a={$currentOutputSettings === tab.id} data-saida={tab.id} tabindex="-1" on:click={() => currentOutputSettings.set(tab.id || "")}>
                    {#if estado(tab, $outputDisplay) !== ""}<i class="pt {estado(tab, $outputDisplay)}"></i>{/if}
                    {tab.name || "Sem nome"}
                    {#if novas.includes(tab.id)}<span class="luz-tag-novo">NOVO</span>{/if}
                </button>
            </SelectElem>
        {/each}
    </div>
    <button type="button" class="luz-bt" data-acao="saidas-nova" tabindex="-1" on:click={criar}>
        <Icon id="add" size={0.9} white />
        {translateText("settings.new_output")}
    </button>
    <span class="espaco"></span>
    <button type="button" class="luz-bt fan" data-acao="saidas-identificar" tabindex="-1" on:click={identificar}>
        <Icon id="screen" size={0.9} white />
        Identificar telas
    </button>
</div>

<style>
    .faixa {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }
    .luz-seg :global(.selectElem) {
        width: auto;
    }
    .espaco {
        flex: 1;
    }
    .pt {
        width: 7px;
        height: 7px;
        border-radius: 4px;
        background: var(--luz-fraco);
        flex-shrink: 0;
    }
    .pt.ar {
        background: var(--luz-vermelho);
    }
    .pt.ligada {
        background: var(--luz-verde);
    }
</style>
