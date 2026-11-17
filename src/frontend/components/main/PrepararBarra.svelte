<script lang="ts">
    // 1a, D1: o centro e a direita da barra do topo no Preparar (a esquerda, com o seletor Culto | Preparar, e do Top e nao muda).
    // Pagina `show`: pilula, chips, "+ Novo", NO AR, relogio e o menu ⋯. Fora de `show` (a 1b troca isto pela moldura): so "← Voltar".
    // Nada aqui escreve em `outputs`. O telao so liga/desliga pelo item do menu ⋯ (PrepararMenu), com pergunta e trava.
    import { activePage, outputDisplay, outputs } from "../../stores"
    import { algoNoAr } from "../../utils/aliancaModo"
    import { chips, irAoCulto } from "../../utils/aliancaPilula"
    import Clock from "../system/Clock.svelte"
    import AliancaNovo from "./AliancaNovo.svelte"
    import PrepararMenu from "./PrepararMenu.svelte"
    import PrepararPilula from "./PrepararPilula.svelte"

    export let tempoNoAr = "00:00"
    export let settingsDisabled = false
    export let semTelaFisica = false

    $: pagina = $activePage
    $: tipo = pagina === "show" ? "show" : "fora"
    // algo no ar: a barra fica mais forte (fundo ambar)
    $: noAr = $outputs ? algoNoAr() : false

    const ICONES: Record<string, string> = { roteiro: "↻", chat: "✉", desenho: "✎" }
</script>

<div class="prepararBarra" class:forte={noAr} data-moldura={tipo} data-title="Preparando: o teclado não mexe no telão">
    {#if tipo === "show"}
        <PrepararPilula />
        {#each $chips as chip (chip.id)}
            <button class="chip" class:vermelho={chip.id === "desenho"} data-chip={chip.id} data-title={chip.titulo} tabindex="-1" on:mousedown|preventDefault on:click={irAoCulto}>
                <span class="icone" aria-hidden="true">{ICONES[chip.id]}</span>
                <span class="texto">{chip.texto}</span>
                {#if chip.numero !== null}<span class="numero">{chip.numero}</span>{/if}
            </button>
        {/each}
        <AliancaNovo />
    {:else}
        <button class="voltar" tabindex="-1" on:mousedown|preventDefault on:click={() => activePage.set("show")}>← Voltar</button>
    {/if}

    <span class="folga" />

    {#if $outputDisplay}
        <div class="noAr">
            <span class="noArPonto" />
            NO AR · {tempoNoAr}
        </div>
    {/if}
    <span class="relogio"><Clock seconds={false} /></span>
    <PrepararMenu {settingsDisabled} {semTelaFisica} />
</div>

<style>
    .prepararBarra {
        flex: 1;
        min-width: 0;
        align-self: stretch;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 8px;
        border-radius: 8px;
    }
    .prepararBarra.forte {
        background: rgb(var(--prep-rgb, 224 160 48) / 0.2);
        box-shadow: inset 0 0 0 1px rgb(var(--prep-rgb, 224 160 48) / 0.5);
    }
    .prepararBarra :global(button) {
        -webkit-app-region: no-drag;
    }
    .folga {
        flex: 1;
        min-width: 0;
    }

    /* chips: as cores do SirvoAviso (ambar); o de desenho, vermelho. Nunca piscam, nunca somem sozinhos. */
    .chip {
        flex: none;
        display: flex;
        align-items: center;
        gap: 6px;
        align-self: center;
        padding: 3px 10px;
        border-radius: 14px;
        border: 1px solid rgb(255 128 0 / 0.4);
        background: rgb(255 128 0 / 0.08);
        color: #ffb066;
        font-family: inherit;
        font-size: 12px;
        white-space: nowrap;
        cursor: pointer;
    }
    .chip:hover {
        background: rgb(255 128 0 / 0.18);
    }
    .chip.vermelho {
        border-color: rgb(242 26 39 / 0.45);
        background: rgb(242 26 39 / 0.14);
        color: #ff8f97;
    }
    .chip.vermelho:hover {
        background: rgb(242 26 39 / 0.24);
    }
    .chip .icone,
    .chip .numero {
        display: none;
    }

    .voltar {
        flex: none;
        align-self: center;
        padding: 3px 10px;
        border: 0;
        border-radius: 6px;
        background: rgb(255 255 255 / 0.08);
        color: var(--text);
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .voltar:hover {
        background: rgb(255 255 255 / 0.14);
    }

    /* Badge NO AR: o mesmo do Top (a regra de la e escopada e nao chega aqui) */
    .noAr {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        align-self: center;
        padding: 6px 12px;
        border-radius: 20px;
        background: rgb(242 26 39 / 0.14);
        border: 1px solid rgb(242 26 39 / 0.3);
        font-family: var(--font-mono);
        font-size: 11px;
        color: #ff8f97;
        white-space: nowrap;
    }
    .noArPonto {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ff5b66;
        animation: liveGlow 2s ease-in-out infinite;
    }
    @keyframes liveGlow {
        0%,
        100% {
            opacity: 0.55;
        }
        50% {
            opacity: 1;
        }
    }

    .relogio {
        flex: none;
        align-self: center;
        white-space: nowrap;
    }
    /* o Clock da interface tem 30 px (pensado para o rodape da coluna direita); na barra ele cabe em 15 px */
    .relogio :global(.align.styled) {
        font-size: 15px;
    }

    /* aperto: abaixo de 1100 px os chips viram icone com numero; abaixo de 760 px o relogio some (a pilula corta em 899, na propria) */
    @media (max-width: 1099px) {
        .chip {
            padding: 3px 8px;
            gap: 4px;
        }
        .chip .texto {
            display: none;
        }
        .chip .icone,
        .chip .numero {
            display: inline;
        }
    }
    @media (max-width: 759px) {
        .relogio {
            display: none;
        }
    }
</style>
