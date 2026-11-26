<script lang="ts">
    // AliancaShow (26/nov, "janelas nossas"): confirmar (Sim/Nao) e perguntar um texto, como pergunta curta sem cabecalho.
    // Mesmo contrato do Confirm do FreeShow (utils/popup.ts confirmCustom/promptCustom): grava popupData { id: "confirm", value }
    // ou chama popupData.trigger. O Confirm original segue intacto no fecho.
    import { onMount } from "svelte"
    import { activePopup, popupData } from "../../../stores"

    const prompt: string = $popupData.prompt || ""
    const inputType: string = $popupData.inputType || ""
    const message: string = $popupData.message || ""

    let texto = ""
    let campo: HTMLInputElement
    let principal: HTMLButtonElement
    onMount(() => setTimeout(() => (inputType ? campo?.focus() : principal?.focus()), 30))

    function fechar() {
        popupData.set({})
        activePopup.set(null)
    }
    function confirmar() {
        if ($popupData.trigger) {
            $popupData.trigger(texto)
            activePopup.set(null)
        } else {
            popupData.set({ ...$popupData, id: "confirm", value: inputType ? texto : true })
        }
    }
    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            confirmar()
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="pergunta" data-janela="confirmar">
    {#if inputType}
        <h3>{@html prompt || "Confirmar"}</h3>
        {#if message}<p>{@html message}</p>{/if}
        <input class="jcampo" type={inputType} bind:this={campo} on:input={(e) => (texto = e.currentTarget.value)} />
        <div class="acoes">
            <button class="jb fantasma" on:click={fechar}>Cancelar</button>
            <button class="jb principal" bind:this={principal} on:click={confirmar}>Confirmar</button>
        </div>
    {:else}
        <h3>{@html prompt || "Tem certeza?"}</h3>
        <div class="acoes">
            <button class="jb fantasma" data-title="[Esc]" on:click={fechar}>Não</button>
            <button class="jb principal" bind:this={principal} data-title="[Enter]" on:click={confirmar}>Sim</button>
        </div>
    {/if}
</div>
