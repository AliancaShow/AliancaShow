<script lang="ts">
    import { tick } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import type { ClickEvent } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { checkPrimaryOutputRouting, createOutputAudioChannel } from "../../../audio/routing/audioRoutingInit"
    import { activeRename, activeTriggerFunction, currentOutputSettings, outputDisplay, outputs, popupData, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { estadoDaSaida } from "../../../utils/aliancaSaidasLogica"
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

    // vermelho = a saida esta mostrando conteudo AGORA (janela ligada e algo no ar); verde = habilitada; sem ponto = desligada
    const estado = (tab: Output, janelasLigadas: boolean) => estadoDaSaida(tab as any, janelasLigadas)

    // "Renomear" do menu de contexto da aba: leva ao campo Nome desta pagina (a aba e so um botao, nao um campo)
    $: if (typeof $activeRename === "string" && $activeRename.startsWith("output_")) renomearPeloCampo($activeRename.slice("output_".length))
    async function renomearPeloCampo(id: string) {
        activeRename.set(null)
        if (!$outputs[id]) return
        currentOutputSettings.set(id)
        await tick()
        await new Promise((r) => setTimeout(r, 80))
        const campo = document.querySelector("[data-acao=saida-nome] input") as HTMLInputElement | null
        campo?.focus()
        campo?.select()
    }

    function criar(e: MouseEvent) {
        createOutput({ detail: { ctrl: e.ctrlKey } } as unknown as ClickEvent)
    }

    async function identificar() {
        const telas = (await requestMain(Main.GET_DISPLAYS)) || []
        send(OUTPUT, ["IDENTIFY_SCREENS"], telas)
    }
</script>

<div class="topo">
<div class="faixa" data-acao="saidas-faixa">
    <div class="luz-seg" role="tablist" data-acao="saidas-abas">
        {#each outputsList as tab (tab.id)}
            <SelectElem id="output" data={{ id: tab.id }} fill>
                <button type="button" role="tab" aria-selected={$currentOutputSettings === tab.id} class="aba context #output_screen{tab.stageOutput ? "_stage" : ""}" class:a={$currentOutputSettings === tab.id} data-saida={tab.id} tabindex="-1" on:click={() => currentOutputSettings.set(tab.id || "")}>
                    {#if estado($outputs[tab.id || ""] || tab, $outputDisplay) !== ""}<i class="pt {estado($outputs[tab.id || ""] || tab, $outputDisplay)}" data-estado={estado($outputs[tab.id || ""] || tab, $outputDisplay)}></i>{/if}
                    <span class="tipos" data-acao="saida-tipos">
                        {#if tab.stageOutput}<Icon id="stage" size={0.7} white title={translateText("menu.stage")} />{:else if !tab.invisible}<Icon id="hdmi" size={0.7} white title={translateText("settings.window")} />{/if}
                        {#if tab.blackmagic}<Icon id="blackmagic" size={0.7} white title="Blackmagic Design" />{/if}
                        {#if tab.ndi}<Icon id="ndi" size={0.7} white title="NDI" />{/if}
                        {#if tab.webrtc}<Icon id="broadcast" size={0.7} white title="WebRTC" />{/if}
                        {#if tab.rtmp}<Icon id="broadcast" size={0.7} white title="RTMP" />{/if}
                    </span>
                    {tab.name || "Sem nome"}
                    {#if tab.color}<span class="cor" data-acao="saida-cor" style="--color: {tab.color};"></span>{/if}
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
<p class="naHora" data-acao="saidas-na-hora">Criar e apagar saídas, ligar e desligar saída, janela ou NDI e mover de tela aplicam na hora: não entram em “alterações não salvas” nem no Descartar.</p>
</div>

<style>
    .naHora {
        margin: 6px 0 0;
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .tipos {
        display: inline-flex;
        gap: 3px;
        opacity: 0.75;
    }
    .cor {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: var(--color);
        flex-shrink: 0;
    }
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
