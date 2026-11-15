<script lang="ts">
    // Seletor Culto | Preparar (topo, esquerda). Sem atalho de teclado, de proposito:
    // trocar de modo e um gesto de mouse. O app sempre abre no Culto.
    import { onDestroy } from "svelte"
    import { modoAlianca } from "../../stores"
    import { avisoTecla } from "../../utils/aliancaModo"

    let piscando = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let primeira = true
    const parar = avisoTecla.subscribe(() => {
        // a primeira chamada e o valor inicial
        if (primeira) {
            primeira = false
            return
        }
        piscando = true
        clearTimeout(timer)
        timer = setTimeout(() => (piscando = false), 2500)
    })
    onDestroy(() => {
        parar()
        clearTimeout(timer)
    })

    function escolher(modo: "culto" | "preparar") {
        modoAlianca.set(modo)
        piscando = false
    }
</script>

<div class="modo" class:piscando role="group" aria-label="Modo">
    <button class:ativo={$modoAlianca === "culto"} aria-pressed={$modoAlianca === "culto"} tabindex="-1" on:mousedown|preventDefault on:click={() => escolher("culto")}>Culto</button>
    <button class:ativo={$modoAlianca === "preparar"} class:preparar={$modoAlianca === "preparar"} aria-pressed={$modoAlianca === "preparar"} tabindex="-1" on:mousedown|preventDefault on:click={() => escolher("preparar")}>Preparar</button>
</div>

<style>
    .modo {
        flex: none;
        display: flex;
        align-self: center;
        padding: 2px;
        gap: 2px;
        border-radius: 8px;
        background: rgb(255 255 255 / 0.06);
        -webkit-app-region: no-drag;
    }
    button {
        border: 0;
        border-radius: 6px;
        padding: 3px 10px;
        font-family: inherit;
        font-size: 12px;
        color: var(--text);
        background: transparent;
        opacity: 0.7;
        cursor: pointer;
    }
    button:hover {
        opacity: 1;
        background: rgb(255 255 255 / 0.08);
    }
    button.ativo {
        opacity: 1;
        background: var(--modo-culto, var(--secondary));
        color: var(--modo-culto-texto, var(--secondary-text));
        font-weight: 600;
    }
    button.preparar.ativo {
        background: var(--modo-prep, #e0a030);
        color: var(--modo-prep-texto, #1a1200);
    }
    .piscando {
        animation: avisoModo 0.5s ease-in-out 3;
    }
    @keyframes avisoModo {
        0%,
        100% {
            box-shadow: 0 0 0 0 var(--modo-prep-brilho0, rgb(224 160 48 / 0));
        }
        50% {
            box-shadow: 0 0 0 4px var(--modo-prep-brilho, rgb(224 160 48 / 0.6));
        }
    }
</style>
