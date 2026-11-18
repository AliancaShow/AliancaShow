<script lang="ts">
    // Leiaute v2, fatia 7: barra de tempo/volume da faixa de transporte. Nao e `<input type="range">`: aquele pede o foco (e o foco na barra
    // faria o espaco/setas do teclado do telao irem para ela) e o `mousedown` nao pode ser barrado sem travar o arrasto. Aqui o ponteiro e
    // capturado e o foco nunca sai de onde estava. `comecar` / `mover` / `soltar` levam o valor (0..max); quem usa decide o que escrever.
    import { createEventDispatcher, onDestroy } from "svelte"
    import { fracao, valorNaBarra } from "../../utils/aliancaTransporteLogica"

    export let valor = 0
    export let max = 0
    export let desligada = false
    export let rotulo = ""
    export let cor = "var(--luz-texto)"

    const dispatch = createEventDispatcher<{ comecar: number; mover: number; soltar: number }>()
    let el: HTMLDivElement
    let arrastando = false
    let seguro = 0

    function ler(e: PointerEvent): number {
        const r = el.getBoundingClientRect()
        return valorNaBarra(e.clientX, r.left, r.width, max)
    }
    function baixo(e: PointerEvent) {
        if (desligada || !(max > 0) || e.button !== 0) return
        e.preventDefault()
        el.setPointerCapture(e.pointerId)
        arrastando = true
        seguro = ler(e)
        dispatch("comecar", seguro)
        dispatch("mover", seguro)
    }
    function mexer(e: PointerEvent) {
        if (!arrastando) return
        seguro = ler(e)
        dispatch("mover", seguro)
    }
    function soltar(e: PointerEvent) {
        if (!arrastando) return
        arrastando = false
        try {
            el.releasePointerCapture(e.pointerId)
        } catch {
            // captura ja solta
        }
        dispatch("soltar", ler(e))
    }
    // o arrasto acaba sem `pointerup`: cancelado (o `clientX` dele nao vale), captura perdida, ou a barra desmontou com o botao apertado
    // (o fundo foi limpo, o audio acabou). Solta no ultimo ponto bom, para quem a escuta nunca ficar com a flag presa.
    function soltarSemPonto() {
        if (!arrastando) return
        arrastando = false
        dispatch("soltar", seguro)
    }
    onDestroy(soltarSemPonto)
    $: mostrado = arrastando ? seguro : valor
    $: pct = fracao(mostrado, max) * 100
</script>

<div bind:this={el} class="barra" class:desligada class:arrastando role="slider" tabindex="-1" aria-label={rotulo} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(mostrado)} aria-disabled={desligada} data-title={rotulo} style="--cor: {cor}" on:pointerdown={baixo} on:pointermove={mexer} on:pointerup={soltar} on:pointercancel={soltarSemPonto} on:lostpointercapture={soltarSemPonto}>
    <div class="trilho"><div class="cheio" style="width: {pct}%" /></div>
    <div class="bolinha" style="left: {pct}%" />
</div>

<style>
    .barra {
        position: relative;
        flex: 1 1 0;
        min-width: 40px;
        height: 22px;
        display: flex;
        align-items: center;
        cursor: pointer;
        touch-action: none;
        user-select: none;
    }
    .trilho {
        width: 100%;
        height: 4px;
        border-radius: 2px;
        background: var(--luz-trilho, rgb(248 248 240 / 0.1));
        overflow: hidden;
    }
    .cheio {
        height: 100%;
        background: var(--cor);
    }
    .bolinha {
        position: absolute;
        top: 50%;
        width: 10px;
        height: 10px;
        margin: -5px 0 0 -5px;
        border-radius: 50%;
        background: var(--cor);
        opacity: 0;
        transition: opacity 120ms;
        pointer-events: none;
    }
    .barra:hover .bolinha,
    .barra.arrastando .bolinha {
        opacity: 1;
    }
    .barra.desligada {
        opacity: 0.4;
        cursor: default;
    }
    .barra.desligada .bolinha {
        display: none;
    }
</style>
