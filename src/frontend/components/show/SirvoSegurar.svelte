<script lang="ts">
    // Botão de segurar (F2): para o que não tem volta fácil (iniciar/encerrar
    // o culto, apagar bloco). Lição de 09/ago no Sirvo: destrutivo exige gesto
    // contínuo e nasce inerte; dois toques no mesmo pixel não podem bastar.
    // - Segurar `ms` milissegundos; soltar ou sair antes cancela.
    // - Inerte por 3 s depois de aparecer ou de trocar o rótulo.
    // - Não pega foco (o operador passa slide pelo teclado).
    // - Soltar cedo mostra "Segure…" no próprio botão (o rótulo é curto: o
    //   painel tem 290px e o texto do gesto não cabia).
    import { createEventDispatcher, onDestroy } from "svelte"

    export let rotulo: string
    export let dica = ""
    export let ms = 1200
    export let desabilitado = false
    export let perigo = false

    const dispatch = createEventDispatcher()
    const INERTE_MS = 3000

    let inerteAte = Date.now() + INERTE_MS
    let rotuloVisto = rotulo
    $: if (rotulo !== rotuloVisto) {
        rotuloVisto = rotulo
        inerteAte = Date.now() + INERTE_MS
        cancelar()
    }

    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 250)

    let inicio = 0
    let progresso = 0
    let quadro = 0
    $: inerte = agoraMs < inerteAte
    let avisoAte = 0
    $: avisando = agoraMs < avisoAte

    function comecar(e: PointerEvent) {
        if (e.button !== 0 || desabilitado || Date.now() < inerteAte) return
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        inicio = performance.now()
        const passo = () => {
            progresso = Math.min(1, (performance.now() - inicio) / ms)
            if (progresso >= 1) {
                inicio = 0
                progresso = 0
                inerteAte = Date.now() + INERTE_MS
                dispatch("feito")
                return
            }
            quadro = requestAnimationFrame(passo)
        }
        quadro = requestAnimationFrame(passo)
    }
    function soltar() {
        if (inicio) {
            avisoAte = Date.now() + 1500
            agoraMs = Date.now()
        }
        cancelar()
    }
    function cancelar() {
        if (quadro) cancelAnimationFrame(quadro)
        quadro = 0
        inicio = 0
        progresso = 0
    }

    onDestroy(() => {
        clearInterval(relogio)
        cancelar()
    })
</script>

<button class="segurar" class:perigo class:inerte tabindex="-1" disabled={desabilitado} data-title={dica} on:mousedown|preventDefault on:pointerdown={comecar} on:pointerup={soltar} on:pointercancel={cancelar} on:pointerleave={cancelar} on:contextmenu|preventDefault>
    <span class="enche" style="transform: scaleX({progresso});" />
    <span class="rotulo">{avisando ? "Segure…" : rotulo}</span>
</button>

<style>
    .segurar {
        position: relative;
        overflow: hidden;
        flex: none;
        padding: 3px 10px;
        border: 0;
        border-radius: 14px;
        background: rgb(255 255 255 / 0.06);
        color: var(--text);
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        touch-action: none;
    }
    .segurar:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.12);
    }
    .perigo {
        color: #ff8f97;
    }
    .inerte,
    .segurar:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .enche {
        position: absolute;
        inset: 0;
        transform-origin: left;
        background: rgb(255 128 0 / 0.35);
        pointer-events: none;
    }
    .perigo .enche {
        background: rgb(242 26 39 / 0.4);
    }
    .rotulo {
        position: relative;
    }
</style>
