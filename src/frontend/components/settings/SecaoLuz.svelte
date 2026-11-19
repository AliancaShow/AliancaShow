<script lang="ts">
    // Secao do desenho C4: rotulo em caixa alta + fio. A rara (`recolhivel`) nasce recolhida e mostra o RESUMO do que tem dentro.
    // O visual mora em public/global.css (.luz-sec), sob o escopo .luz-pele.
    import Icon from "../helpers/Icon.svelte"

    export let titulo: string
    export let icone = ""
    export let resumo = ""
    export let recolhivel = false
    export let aberta = !recolhivel
    export let id = ""
</script>

{#if recolhivel}
    <button type="button" class="luz-sec dob" data-acao="secao-recolhivel" data-secao={id || titulo} aria-expanded={aberta} tabindex="-1" on:click={() => (aberta = !aberta)}>
        <Icon id="arrow_back_modern" size={0.6} white style="transition: transform 0.1s ease; transform: rotate({aberta ? -90 : 180}deg); opacity: 0.6;" />
        {titulo}
        {#if !aberta && resumo}<small>{resumo}</small>{/if}
    </button>
{:else}
    <div class="luz-sec" data-secao={id || titulo}>
        {#if icone}<Icon id={icone} size={0.8} white />{/if}
        {titulo}
    </div>
{/if}

{#if aberta}
    <slot />
{/if}
