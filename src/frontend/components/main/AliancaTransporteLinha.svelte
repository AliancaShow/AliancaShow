<script lang="ts">
    // Leiaute v2, fatia 7: uma linha de transporte (video ou audio). Nome em cima, controles embaixo: tocar/pausar, tempo decorrido, barra
    // arrastavel, tempo que falta (clique troca por duracao total), repetir, mudo e volume. O que a fonte nao tem (repetir/mudo no audio)
    // chega `null` e o botao nao aparece. So apresentacao: quem liga ao player e o AliancaTransporte.
    import { createEventDispatcher } from "svelte"
    import { restante, tempoCurto } from "../../utils/aliancaTransporteLogica"
    import AliancaBarra from "./AliancaBarra.svelte"

    export let nome = ""
    export let cor = "var(--luz-texto)"
    export let pausado = true
    export let atual = 0
    export let duracao = 0
    export let repetir: boolean | null = null
    export let mudo: boolean | null = null
    export let volume: number | null = null
    export let travada = false
    export let tipo: "video" | "audio" = "video"

    const dispatch = createEventDispatcher<{ alternar: void; comecar: number; mover: number; soltar: number; repetir: void; mudo: void; volume: number }>()
    let total = false
    $: falta = restante(duracao, atual)
</script>

<div class="linha" data-transporte={tipo} data-sem-trava style="--cor: {cor}">
    <div class="nome" data-title={nome}>{nome || "—"}</div>
    <div class="ctl">
        <button type="button" class="ic" tabindex="-1" disabled={travada} aria-label={pausado ? "Tocar" : "Pausar"} data-title={pausado ? "Tocar" : "Pausar"} data-acao="transporte-tocar" on:mousedown|preventDefault on:click={() => dispatch("alternar")}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                {#if pausado}
                    <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
                {:else}
                    <path d="M5 3v10 M11 3v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" />
                {/if}
            </svg>
        </button>
        <span class="t" data-transporte-decorrido>{tempoCurto(atual)}</span>
        <AliancaBarra valor={atual} max={duracao} desligada={travada || !(duracao > 0)} rotulo="Posição" {cor} on:comecar on:mover on:soltar />
        <button type="button" class="t falta" tabindex="-1" data-title="Trocar entre o que falta e a duração" data-transporte-falta on:mousedown|preventDefault on:click={() => (total = !total)}>{total ? tempoCurto(duracao) : "−" + tempoCurto(falta)}</button>
        {#if repetir !== null}
            <button type="button" class="ic" class:lig={repetir} tabindex="-1" aria-pressed={repetir} aria-label="Repetir" data-title={repetir ? "Repetir: ligado" : "Repetir: desligado"} data-acao="transporte-repetir" on:mousedown|preventDefault on:click={() => dispatch("repetir")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5V7a2.5 2.5 0 0 1 2.5-2.5H13 M11 2.5l2 2-2 2 M13 8.5V9a2.5 2.5 0 0 1-2.5 2.5H3 M5 9.5l-2 2 2 2" /></svg>
            </button>
        {/if}
        {#if mudo !== null}
            <button type="button" class="ic" class:lig={mudo} tabindex="-1" disabled={travada} aria-pressed={mudo} aria-label="Mudo" data-title={mudo ? "Som desligado: ligar" : "Desligar o som"} data-acao="transporte-mudo" on:mousedown|preventDefault on:click={() => dispatch("mudo")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2.5 6h2.5l3-2.5v9L5 10H2.5z" />
                    {#if mudo}<path d="M11 6l3 4 M14 6l-3 4" />{:else}<path d="M11 5.5a3.5 3.5 0 0 1 0 5" />{/if}
                </svg>
            </button>
        {/if}
        {#if volume !== null}
            <div class="vol"><AliancaBarra valor={volume} max={1} desligada={travada} rotulo="Volume" cor="var(--luz-texto)" on:mover={(e) => dispatch("volume", e.detail)} on:soltar={(e) => dispatch("volume", e.detail)} /></div>
        {/if}
    </div>
</div>

<style>
    .linha {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
    }
    .nome {
        font-size: 11px;
        color: var(--luz-mudo);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .ctl {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
    }
    .ic {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 1px solid var(--luz-borda);
        border-radius: 5px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        cursor: pointer;
    }
    .ic:hover:not(:disabled) {
        background: var(--luz-hover, rgb(248 248 240 / 0.1));
    }
    .ic:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .ic.lig {
        color: var(--cor);
        border-color: var(--cor);
    }
    .t {
        flex-shrink: 0;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--luz-mudo);
        min-width: 30px;
        text-align: right;
    }
    button.t {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: inherit;
        text-align: left;
    }
    .vol {
        flex: 0 0 52px;
        display: flex;
    }
</style>
