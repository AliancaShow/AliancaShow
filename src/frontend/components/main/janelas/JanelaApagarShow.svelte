<script lang="ts">
    // AliancaShow (26/nov, cabine): apagar show(s) da biblioteca como pergunta curta. Mesma acao do DeleteShow do FreeShow
    // (history SHOWS sobre os selecionados que nao estao trancados; Ctrl+Z desfaz); o DeleteShow original segue no fecho.
    import { onMount } from "svelte"
    import { activePopup, selected, shows } from "../../../stores"
    import { history } from "../../helpers/history"

    const alvos = ($selected?.data || []).filter((a: any) => a?.id && $shows[a.id] && !$shows[a.id]?.locked)
    const nomes = alvos.map((a: any) => $shows[a.id]?.name || "Sem nome")

    function apagar() {
        if (alvos.length) history({ id: "SHOWS", oldData: { data: alvos }, location: { page: "drawer" } })
        selected.set({ id: null, data: [] })
        activePopup.set(null)
    }
    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            apagar()
        }
    }
    let principal: HTMLButtonElement
    onMount(() => principal?.focus())
</script>

<svelte:window on:keydown={keydown} />

<div class="pergunta" data-janela="apagar-show">
    {#if !alvos.length}
        <h3>Nada para apagar</h3>
        <p>Essa música está trancada ou já não existe.</p>
        <div class="acoes"><button class="jb principal" bind:this={principal} on:click={() => activePopup.set(null)}>Ok</button></div>
    {:else}
        <h3>{alvos.length === 1 ? `Apagar "${nomes[0]}" da biblioteca?` : `Apagar ${alvos.length} músicas da biblioteca?`}</h3>
        {#if alvos.length > 1}<p class="lista">{nomes.join(", ")}</p>{/if}
        <p>Ctrl+Z desfaz.</p>
        <div class="acoes">
            <button class="jb fantasma" data-title="[Esc]" on:click={() => activePopup.set(null)}>Cancelar</button>
            <button class="jb principal" bind:this={principal} data-title="[Enter]" on:click={apagar}>Apagar</button>
        </div>
    {/if}
</div>

<style>
    .lista {
        max-height: 120px;
        overflow: auto;
    }
</style>
