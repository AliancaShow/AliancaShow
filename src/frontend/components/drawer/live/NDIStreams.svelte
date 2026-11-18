<script lang="ts">
    import { gavetaNaoToca } from "../../../utils/aliancaGavetaToque"
    import { soRetornoLigado } from "../../../utils/aliancaSoRetorno"
    import { onDestroy } from "svelte"
    import { NDI } from "../../../../types/Channels"
    import { outLocked, outputs, special } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Loader from "../../main/Loader.svelte"
    import { clearBackground } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import { tocavel } from "../tocavel"
    import NDIStream from "./NDIStream.svelte"

    let sources: { name: string; id: string }[] = []

    $: currentOutput = getFirstActiveOutput($outputs)

    let loading = true
    const receiveNDI = {
        RECEIVE_LIST: (msg) => {
            loading = false
            if (!msg || sources.length) return

            sources = JSON.parse(msg).map(({ name, urlAddress }) => ({ name, id: urlAddress }))
        }
    }

    $: groups = $special?.ndiInputGroups || ""

    // o clique so seleciona; o ▶ (e o "Mostrar agora") manda a entrada NDI ao fundo da saida (revisao da fatia 6, achado 4)
    function tocar(screen: { id: string }) {
        if (gavetaNaoToca() || $outLocked) return
        if (!soRetornoLigado() && currentOutput?.out?.background?.id === screen.id) clearBackground()
        else setOutput("background", { id: screen.id, type: "ndi" })
    }

    receive(NDI, receiveNDI, "NDI_CAPTURE")
    $: send(NDI, ["RECEIVE_LIST"], { groups })
    onDestroy(() => destroy(NDI, "NDI_CAPTURE"))
</script>

{#if loading}
    <Center>
        <Loader />
    </Center>
{:else if sources.length}
    {#each sources as screen}
        <div style="display: contents;" use:tocavel={{ aoTocar: () => tocar(screen), titulo: "Mandar a entrada NDI ao ar" }}>
            <NDIStream {screen} />
        </div>
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}
