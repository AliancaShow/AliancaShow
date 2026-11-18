<script lang="ts">
    import { gavetaNaoToca } from "../../../utils/aliancaGavetaToque"
    import { onDestroy } from "svelte"
    import { BLACKMAGIC } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import { clearBackground } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import { tocavel } from "../tocavel"
    import BmdStream from "./BMDStream.svelte"

    let sources: any[] = []

    $: currentOutput = getFirstActiveOutput($outputs)

    const receiveBMD: any = {
        GET_DEVICES: (msg) => {
            if (!msg || sources.length) return

            sources = JSON.parse(msg).map((a) => ({ id: a.deviceHandle, name: a.displayName || a.modelName, data: { displayModes: a.inputDisplayModes } }))
        }
    }

    send(BLACKMAGIC, ["GET_DEVICES"])
    receive(BLACKMAGIC, receiveBMD, "GET_DEVICES_RECEIVER")
    onDestroy(() => destroy(BLACKMAGIC, "GET_DEVICES_RECEIVER"))

    $: console.log(sources)

    // o clique so seleciona; o ▶ (e o "Mostrar agora") manda a entrada Blackmagic ao fundo da saida (revisao da fatia 6, achado 4)
    function tocar(screen: { id: string }) {
        if (gavetaNaoToca() || $outLocked) return
        if (currentOutput?.out?.background?.id === screen.id) clearBackground()
        else setOutput("background", { id: screen.id, type: "blackmagic" })
    }
</script>

{#if sources.length}
    {#each sources as screen}
        <div style="display: contents;" use:tocavel={{ aoTocar: () => tocar(screen), titulo: "Mandar a entrada ao ar" }}>
            <BmdStream {screen} />
        </div>
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}
