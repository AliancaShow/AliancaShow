<script lang="ts">
    // Cabine 6, fatia A (opcao b): o video de fundo na previa DESENHADA da janela principal vira a miniatura parada (loadThumbnail, a mesma da
    // biblioteca), com o mesmo encaixe (fit), filtro e espelhamento do Video.svelte. Nada de <video>: zero decodificacao.
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { loadThumbnail, mediaSize } from "../helpers/media"

    export let path: string
    export let mediaStyle: MediaStyle = {}
    export let animationStyle = ""
    /** MediaItem: o item usa fundo desfocado (o encaixe vem em `extra`) */
    export let blur = false
    /** estilo extra (MediaItem: recorte/posicao da caixa) */
    export let extra = ""

    const dispatch = createEventDispatcher()
    let src = ""
    $: carregar(path)
    async function carregar(p: string) {
        src = ""
        if (!p) return
        try {
            const m = await loadThumbnail(p, mediaSize.big)
            if (p === path) src = m || ""
        } catch (e) {
            falhaAlta("previa-miniatura", e)
        }
        // o Background espera `loaded` para a transicao: avisa mesmo sem miniatura
        if (p === path) dispatch("loaded")
    }

    $: fit = mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"
    $: transforma = `transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    $: estilo = `width: 100%;height: 100%;object-fit: ${fit};filter: ${mediaStyle.filter || ""};${transforma}mix-blend-mode: ${mediaStyle.blend || "normal"};${extra}`
    $: estiloBlur = `position: absolute;inset: 0;width: 100%;height: 100%;object-fit: cover;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});${transforma}`
</script>

<div class="miniatura" data-acao="previa-miniatura-video" style="display: flex;width: 100%;height: 100%;place-content: center;position: relative;{animationStyle}">
    {#if src}
        {#if blur || mediaStyle.fit === "blur"}<img alt="" {src} style={estiloBlur} draggable="false" />{/if}
        <img alt="" {src} style={estilo} draggable="false" />
    {/if}
</div>
