<script lang="ts">
    // Roteiro enxuto (26/nov, pedido do André): no lugar das duas linhas "Ligado a um culto do Sirvo / Cabeçalhos trancados / Desligar do Sirvo",
    // uma bolinha no cabeçalho do roteiro. A explicação vai para a dica; o clique pede o "Desligar?" da faixa (SirvoProjetoFaixa), que confirma.
    import { activeProject, projects } from "../../stores"
    import { dicaSegura } from "../../utils/aliancaDica"
    import { sirvoMontagem } from "../../utils/aliancaSirvoMontar"
    import { pedirDesligarSirvo } from "./SirvoProjetoFaixa.svelte"

    $: projeto = $activeProject ? $projects[$activeProject] : null
    $: ligado = !!projeto?.sirvo?.eventId
    $: estado = $activeProject && $sirvoMontagem.projetoId === $activeProject ? $sirvoMontagem : null
    $: deste = !!estado && ligado && projeto?.sirvo?.eventId === estado.eventId
    $: pendente = !!(deste && estado?.pendente)
    $: dica = dicaSegura(`${deste && estado?.titulo ? `Ligado ao culto do Sirvo: ${estado.titulo}` : "Ligado a um culto do Sirvo"}${deste && estado?.blocos ? ` · ${estado.blocos} ${estado.blocos === 1 ? "bloco" : "blocos"}` : ""}. ` + "Os nomes dos blocos vêm do Sirvo e ficam trancados aqui. Clique para desligar.")
</script>

{#if ligado}
    <button class="selo" class:pendente data-acao="selo-sirvo" data-title={dica} aria-label="Sirvo" tabindex="-1" on:mousedown|preventDefault on:click={() => pedirDesligarSirvo.set(true)}>
        <span class="ponto" />
    </button>
{/if}

<style>
    .selo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
    }
    .selo:hover {
        background: var(--luz-campo);
    }
    .ponto {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--connected);
    }
    .pendente .ponto {
        background: #ff8000;
    }
</style>
