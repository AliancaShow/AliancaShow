<script lang="ts">
    // Cabine 6, fatia A (opcao b): a previa DESENHADA (Output mirror, como antes da captura) para quando a saida esta desligada ou nao tem
    // janela visivel. Liga o contexto `previaSemVideo`: dentro dela todo video (fundo e item de video do slide) vira a miniatura parada.
    // So a janela principal monta este componente.
    import { ligarPreviaSemVideo } from "../../utils/aliancaPreviaSemVideo"
    import PreviewOutput from "../output/preview/PreviewOutput.svelte"

    export let outputId: string
    ligarPreviaSemVideo()
</script>

<PreviewOutput {outputId} />
