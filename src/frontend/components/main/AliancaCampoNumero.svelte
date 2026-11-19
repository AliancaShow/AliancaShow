<script lang="ts">
    // Cabine 4, pedido 2: campo de numero COM REGUA (prancha C4, "Numero com regua"). O mesmo contrato do MaterialNumberInput (`change`/`input` com o
    // numero, `keyframe`), mas fora do fecho da saida: rotulo dentro em cima, valor + unidade, a regua DENTRO do campo e - / + de 22 px.
    // O CSS mora em public/global.css (.luz-num, so tokens --luz-*), sob a casca .luz-pele.
    import { createEventDispatcher } from "svelte"
    import { fracaoNaRegua, lerNumero, mostrarNumero, mudouDoPadrao, prender, temRegua } from "../../utils/aliancaCampoNumeroLogica"
    import { translateText } from "../../utils/language"

    export let value: number | string = 0
    export let label = ""
    export let id = ""
    export let unit = ""
    export let defaultValue: number | null = null
    export let disabled = false
    export let step = 1
    export let min: number | null = 0
    export let max: number | null = null
    export let maxDecimals = 2
    export let showSlider: boolean | undefined = undefined
    export let sliderValues: { min?: number; max?: number; step?: number } = {}
    export let style = ""
    export let enableKeyframe = false
    export let hasTimelineAction = false
    // o resto que as definicoes de campo trazem e que este campo nao usa (evita aviso de propriedade desconhecida)
    export let placeholder = ""
    export let center = false
    export let autofocus = false
    export let hideWhenZero = false
    export let padLength = 0
    export let currentProgress: number | null = null
    export let name = ""
    $: void [placeholder, center, autofocus, hideWhenZero, padLength, currentProgress, name]

    const dispatch = createEventDispatcher()

    $: numero = Number(value || 0)
    $: sliderMin = sliderValues?.min ?? min ?? 0
    $: sliderMax = sliderValues?.max ?? max ?? 100
    $: sliderStep = sliderValues?.step ?? step
    $: regua = temRegua(showSlider, min, max, sliderValues?.min, sliderValues?.max)
    $: fracao = fracaoNaRegua(numero, sliderMin, sliderMax)
    $: mudou = mudouDoPadrao(numero, defaultValue)

    let digitado: string | null = null
    $: mostrado = digitado ?? mostrarNumero(numero, maxDecimals)

    function aplicar(v: number) {
        if (disabled) return
        const r = prender(v, min, max, maxDecimals)
        digitado = null
        dispatch("input", r)
        dispatch("change", r)
    }
    function confirmar() {
        if (digitado === null) return
        const v = lerNumero(digitado)
        if (v === null) digitado = null
        else aplicar(v)
    }
    const passo = (e: { shiftKey?: boolean }) => step * (e.shiftKey ? 10 : 1)
    const mais = (e: { shiftKey?: boolean }) => aplicar(Number((numero + passo(e)).toFixed(3)))
    const menos = (e: { shiftKey?: boolean }) => aplicar(Number((numero - passo(e)).toFixed(3)))

    function tecla(e: KeyboardEvent) {
        if (e.key === "ArrowUp") (e.preventDefault(), mais(e))
        else if (e.key === "ArrowDown") (e.preventDefault(), menos(e))
        else if (e.key === "Enter") (e.preventDefault(), confirmar())
        dispatch("keydown", e)
    }
    function roda(e: WheelEvent) {
        if (disabled || (!e.ctrlKey && !e.metaKey)) return
        e.preventDefault()
        e.deltaY < 0 ? mais(e) : menos(e)
    }
</script>

<div class="luz-num" class:disabled class:regua class:sozinho={regua} data-campo="numero" style={style || null}>
    <label for={id || undefined}>{@html translateText(label)}{#if mudou}<button type="button" class="ponto" tabindex="-1" title="Voltar ao padrão" aria-label="Voltar ao padrão" on:mousedown|preventDefault on:click={() => defaultValue !== null && aplicar(defaultValue)}></button>{/if}</label>
    <span class="v">
        <input {id} type="text" inputmode="decimal" autocomplete="off" {disabled} value={mostrado} style="width: {Math.max(1, mostrado.length)}ch" on:input={(e) => (digitado = e.currentTarget.value)} on:change={confirmar} on:blur={confirmar} on:keydown={tecla} on:wheel={roda} />
        {#if unit}<i>{unit}</i>{/if}
    </span>
    {#if regua}
        <input class="reg" type="range" tabindex="-1" {disabled} min={sliderMin} max={sliderMax} step={sliderStep} value={numero} style="--luz-reg: {fracao * 100}%" aria-label={translateText(label)} on:input={(e) => aplicar(Number(e.currentTarget.value))} />
    {/if}
    <span class="dir">
        {#if enableKeyframe}
            <button type="button" class="q" tabindex="-1" title="Keyframe" aria-label="Keyframe" on:click={() => dispatch("keyframe", numero)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill={hasTimelineAction ? "currentColor" : "none"} stroke="currentColor" stroke-width="2"><path d="M12 2L22 12L12 22L2 12L12 2Z" /></svg>
            </button>
        {/if}
        <button type="button" class="q" data-acao="numero-menos" tabindex="-1" aria-label="Diminuir" {disabled} on:mousedown|preventDefault on:click={menos}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12" /></svg>
        </button>
        <button type="button" class="q" data-acao="numero-mais" tabindex="-1" aria-label="Aumentar" {disabled} on:mousedown|preventDefault on:click={mais}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12M12 6v12" /></svg>
        </button>
    </span>
</div>
