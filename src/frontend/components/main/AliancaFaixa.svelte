<script lang="ts">
    // Faixa fina sob o topo, so no Preparar: lembra que o teclado nao mexe no telao.
    // Com algo no ar ela fica mais forte; tecla ignorada troca o texto por 3 s.
    import { onDestroy } from "svelte"
    import { modoAlianca, outputs } from "../../stores"
    import { paraConferir } from "../../utils/aliancaConferir"
    import { algoNoAr, avisoTecla } from "../../utils/aliancaModo"

    $: noAr = $outputs ? algoNoAr() : false

    let aviso = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let primeira = true
    const parar = avisoTecla.subscribe(() => {
        if (primeira) {
            primeira = false
            return
        }
        aviso = true
        clearTimeout(timer)
        timer = setTimeout(() => (aviso = false), 3000)
    })
    onDestroy(() => {
        parar()
        clearTimeout(timer)
    })
    $: if ($modoAlianca !== "preparar") aviso = false
</script>

{#if $modoAlianca === "preparar"}
    <div class="faixa" class:forte={noAr} class:aviso role="status">
        {#if aviso}
            Tecla ignorada: você está no Preparar. Vá pro Culto pra controlar o telão.
        {:else if noAr}
            Preparando, com algo no ar: o teclado não mexe no telão. Pra controlar o telão, vá pro Culto.{#if $paraConferir > 0}&nbsp;· {$paraConferir} pra conferir{/if}
        {:else}
            Preparando: o teclado não mexe no telão. Pra controlar o telão, vá pro Culto.{#if $paraConferir > 0}&nbsp;· {$paraConferir} pra conferir{/if}
        {/if}
    </div>
{/if}

<style>
    .faixa {
        flex: none;
        padding: 3px 12px;
        font-size: 12px;
        text-align: center;
        color: var(--text);
        background: rgb(255 255 255 / 0.07);
        border-bottom: 1px solid rgb(255 255 255 / 0.08);
    }
    .faixa.forte {
        background: rgb(224 160 48 / 0.2);
        border-bottom-color: rgb(224 160 48 / 0.5);
    }
    .faixa.aviso {
        background: rgb(224 160 48 / 0.45);
        border-bottom-color: #e0a030;
        font-weight: 600;
    }
</style>
