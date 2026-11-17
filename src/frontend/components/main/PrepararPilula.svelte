<script lang="ts">
    // 1a, D2/D3: a pilula "N pra conferir · K sem letra · W nao chegou" e o aviso de tecla ignorada (3 s).
    // So le stores e abre o primeiro pendente (selecionar item, como o clique no item do culto). Nunca escreve em `outputs`.
    import { onDestroy } from "svelte"
    import { modoAlianca } from "../../stores"
    import { avisoTecla } from "../../utils/aliancaModo"
    import { abrirPrimeiroPendente, pilula } from "../../utils/aliancaPilula"

    let aviso = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let primeira = true
    const parar = avisoTecla.subscribe(() => {
        // a primeira chamada e o valor inicial
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

    function clicar() {
        // durante o aviso de tecla o clique nao faz nada
        if (aviso || !$pilula.clicavel) return
        abrirPrimeiroPendente()
    }
</script>

{#if aviso}
    <div class="aviso" role="status">Tecla ignorada: você está no Preparar. Vá pro Culto pra controlar o telão.</div>
{:else}
    <button class="pilula" class:pronto={$pilula.pronto} class:semClique={!$pilula.clicavel} tabindex="-1" data-title={$pilula.dica} on:mousedown|preventDefault on:click={clicar}>{$pilula.texto}</button>
{/if}

<style>
    .pilula,
    .aviso {
        flex: 0 1 auto;
        min-width: 0;
        align-self: center;
        padding: 3px 10px;
        border-radius: 6px;
        font-family: inherit;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        -webkit-app-region: no-drag;
    }
    .pilula {
        border: 1px solid rgb(var(--prep-rgb, 224 160 48) / 0.5);
        background: rgb(var(--prep-rgb, 224 160 48) / 0.2);
        color: var(--text);
        cursor: pointer;
    }
    .pilula:hover:not(.semClique) {
        background: rgb(var(--prep-rgb, 224 160 48) / 0.32);
    }
    .pilula.semClique {
        cursor: default;
    }
    .pilula.pronto {
        border-color: rgb(255 255 255 / 0.1);
        background: rgb(255 255 255 / 0.07);
        color: var(--text);
        opacity: 0.8;
    }
    .aviso {
        background: rgb(var(--prep-rgb, 224 160 48) / 0.45);
        border: 1px solid var(--prep, #e0a030);
        color: var(--text);
        font-weight: 600;
    }
    @media (max-width: 899px) {
        .pilula {
            max-width: 220px;
        }
    }
</style>
