<script lang="ts">
    // AliancaShow (26/nov, "janelas nossas"): fechar o programa como pergunta curta, sem cabecalho. Mesma logica do Unsaved do FreeShow
    // (Esc/N cancela, Q sai sem salvar, Y ou Enter salva e sai); o Unsaved original segue intacto no fecho.
    import { onMount } from "svelte"
    import { activePopup, saved } from "../../../stores"
    import { closeApp, save, saveComplete } from "../../../utils/save"

    const cancelar = () => activePopup.set(null)
    const salvarESair = () => ($saved ? saveComplete({ closeWhenFinished: true }) : save(true))

    const atalhos: Record<string, () => void> = { n: cancelar, q: () => closeApp(), y: salvarESair, Enter: salvarESair }
    function keydown(e: KeyboardEvent) {
        const f = atalhos[e.key]
        if (!f) return
        e.preventDefault()
        f()
    }

    let principal: HTMLButtonElement
    onMount(() => principal?.focus())
</script>

<svelte:window on:keydown={keydown} />

<div class="pergunta" data-janela="sair">
    <h3>{$saved ? "Sair do AliançaShow?" : "Sair com mudanças não salvas?"}</h3>
    <p>{$saved ? "Tudo já está salvo." : "Há alterações que ainda não foram salvas."}</p>
    <div class="acoes">
        <button class="jb fantasma" data-title="Cancelar [N / Esc]" on:click={cancelar}>Cancelar</button>
        {#if !$saved}
            <button class="jb" data-title="Sair sem salvar [Q]" on:click={() => closeApp()}>Sair sem salvar</button>
        {/if}
        <button class="jb principal" bind:this={principal} data-title="[Enter / Y]" on:click={salvarESair}>{$saved ? "Sair" : "Salvar e sair"}</button>
    </div>
</div>
