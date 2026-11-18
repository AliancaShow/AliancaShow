<script lang="ts">
    import { gavetaNaoToca } from "../../../utils/aliancaGavetaToque"
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { outLocked, outputs } from "../../../stores"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../output/clear"
    import { tocavel } from "../tocavel"
    import Capture from "./Capture.svelte"

    let screens: { name: string; id: string }[] = []
    export let streams: MediaStream[]

    onMount(async () => {
        screens = (await requestMain(Main.GET_SCREENS)) || []
    })

    $: currentOutput = getFirstActiveOutput($outputs)

    // o clique so seleciona; o ▶ (e o "Mostrar agora" do botao direito) manda a tela ao fundo da saida (revisao da fatia 6, achado 4)
    function tocar(screen: { id: string }) {
        if (gavetaNaoToca() || $outLocked) return
        if (currentOutput?.out?.background?.id === screen.id) clearBackground()
        else setOutput("background", { id: screen.id, type: "screen" })
    }
</script>

{#each screens as screen}
    <div style="display: contents;" use:tocavel={{ aoTocar: () => tocar(screen), titulo: "Mandar a tela ao ar" }}>
        <Capture bind:streams {screen} />
    </div>
{/each}
