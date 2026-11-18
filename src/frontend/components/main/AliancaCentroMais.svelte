<script lang="ts">
    // Leiaute v2, centro de Mostrar: o menu ⋮ do cabecalho. Leva o que o ⋮ da linha de titulo antiga (ShowHeader, apagada) fazia e nao existe em
    // outro lugar de Mostrar: notas do show, linha do tempo do show, bloquear alteracoes e o modelo aplicado. Nada aqui escreve em `outputs`.
    import { activePopup, activeShow, showNotesActive, shows, showsCache, special, templates } from "../../stores"
    import { removeTemplatesFromShow } from "../helpers/show"

    $: id = $activeShow?.id || ""
    $: ehShow = !!id && ($activeShow?.type || "show") === "show"
    $: atual = ehShow ? $showsCache[id] : undefined
    $: modeloId = atual?.settings?.template || ""
    $: temModelo = !!(modeloId && $templates[modeloId])

    let aberto = false
    $: if (!atual) aberto = false

    function travar() {
        const travado = !atual?.locked
        showsCache.update((a) => {
            if (!a[id]) return a
            a[id].locked = travado
            removeTemplatesFromShow(id)
            return a
        })
        shows.update((a) => {
            if (!a[id]) return a
            if (travado) a[id].locked = true
            else delete a[id].locked
            return a
        })
    }

    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement)?.closest?.(".maisRaiz")) aberto = false
    }
</script>

<svelte:window on:mousedown={fora} />

{#if atual}
    <div class="maisRaiz" data-acao="centro-mais">
        <button type="button" class="mais" class:aberto aria-haspopup="menu" aria-expanded={aberto} aria-label="Mais opções do show" title="Mais opções do show" tabindex="-1" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>⋮</button>
        {#if aberto}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
            <div class="menu" role="menu" on:click={() => (aberto = false)}>
                <button type="button" role="menuitem" tabindex="-1" on:click={() => showNotesActive.set(!$showNotesActive)}><span class="ck">{$showNotesActive ? "✓" : ""}</span>Notas do show</button>
                <button type="button" role="menuitem" tabindex="-1" on:click={() => special.update((a) => ({ ...a, timelineActive: !a.timelineActive }))}><span class="ck">{$special.timelineActive ? "✓" : ""}</span>Linha do tempo do show</button>
                <button type="button" role="menuitem" tabindex="-1" on:click={travar}><span class="ck">{atual.locked ? "✓" : ""}</span>Bloquear alterações</button>
                {#if temModelo}
                    <div class="sep"></div>
                    <button type="button" role="menuitem" tabindex="-1" on:click={() => activePopup.set("template_info")}><span class="ck"></span>Modelo: {$templates[modeloId]?.name || "aplicado"}</button>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .maisRaiz {
        position: relative;
        flex-shrink: 0;
    }
    .mais {
        width: 32px;
        height: 32px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
    }
    .mais:hover,
    .mais.aberto {
        background: var(--luz-campo);
        color: var(--luz-texto);
    }
    .menu {
        position: absolute;
        z-index: 40;
        top: 36px;
        right: 0;
        width: 240px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: 10px;
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            0 18px 40px rgb(0 0 0 / 0.5);
        backdrop-filter: var(--luz-vidro, none);
        transform-origin: top right;
        animation: luz-surgir 120ms ease-out;
    }
    .menu button {
        height: 36px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px 0 4px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
    }
    .menu button:hover {
        background: var(--luz-hover);
    }
    .ck {
        width: 18px;
        text-align: center;
        font-weight: 700;
    }
    .sep {
        height: 1px;
        margin: 4px 0;
        background: var(--luz-linha);
    }
    @media (prefers-reduced-motion: reduce) {
        .menu {
            animation: none;
        }
    }
</style>
