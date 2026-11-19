<script lang="ts">
    // Cabine 18/nov, C2: o cartao de transporte de UMA midia (video ou audio), compacto e quieto: 2 linhas de 24 px = 60 px.
    //   linha 1: tocar/pausar, [ponto vermelho = esta no telao], nome, [etiqueta da saida, so quando ha duvida], o que FALTA (o decorrido so aparece enquanto se arrasta a barra)
    //   linha 2: barra (alvo de 24 px de altura, toda a largura que sobra), a casa fixa do repetir, mudo e volume
    // So apresentacao: quem liga ao player e o AliancaTransporteVideo / AliancaTransporte. O que a fonte nao tem (repetir/mudo no audio) chega `null` e a casa nao existe.
    import { createEventDispatcher } from "svelte"
    import { restante, tempoCurto, VOLUME_MAXIMO } from "../../utils/aliancaTransporteLogica"
    import AliancaBarra from "./AliancaBarra.svelte"

    export let nome = ""
    export let saida = "" // so quando ha duvida de qual saida este cartao comanda
    export let cor = "var(--luz-texto)"
    export let pausado = true
    export let atual = 0
    export let duracao = 0
    export let repetir: boolean | null = null
    export let mudo: boolean | null = null
    export let volume: number | null = null
    export let travada = false
    export let noTelao = false
    export let tipo: "video" | "audio" = "video"

    const dispatch = createEventDispatcher<{ alternar: void; comecar: number; mover: number; soltar: number; repetir: void; mudo: void; volume: number; volumefim: number }>()
    let total = false
    let arrastando = false
    $: falta = restante(duracao, atual)
    $: textoFalta = arrastando ? tempoCurto(atual) : total ? tempoCurto(duracao) : "−" + tempoCurto(falta)
    // a largura do rotulo de tempo e fixa (em `ch`): com digitos proporcionais o que vem depois andaria sob o dedo enquanto se arrasta
    $: larguraTempo = Math.max(5, textoFalta.length)
</script>

<div class="tk" data-transporte={tipo} data-sem-trava style="--cor: {cor}">
    <div class="tk-a">
        <button type="button" class="q p" tabindex="-1" disabled={travada} aria-label={pausado ? "Tocar" : "Pausar"} data-title={pausado ? "Tocar" : "Pausar"} data-acao="transporte-tocar" on:mousedown|preventDefault on:click={() => dispatch("alternar")}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                {#if pausado}
                    <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
                {:else}
                    <path d="M5 3v10 M11 3v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" />
                {/if}
            </svg>
        </button>
        {#if noTelao}<i class="pt" data-title="No telão" data-transporte-ponto></i>{/if}
        <span class="nome" data-title={nome}>{nome || "—"}</span>
        {#if saida}<span class="sd" data-title="Este cartão comanda: {saida}" data-transporte-saida>{saida}</span>{/if}
        <button type="button" class="t1" tabindex="-1" data-title="Falta — clique troca pela duração total" data-transporte-falta style="width: {larguraTempo}ch" on:mousedown|preventDefault on:click={() => (total = !total)}>{textoFalta}</button>
    </div>
    <div class="tk-b">
        <AliancaBarra valor={atual} max={duracao} desligada={travada || !(duracao > 0)} rotulo="Posição" {cor} alto on:comecar={(e) => ((arrastando = true), dispatch("comecar", e.detail))} on:mover on:soltar={(e) => ((arrastando = false), dispatch("soltar", e.detail))} />
        {#if repetir !== null}
            <button type="button" class="q" class:lig={repetir} tabindex="-1" aria-pressed={repetir} aria-label="Repetir" data-title={repetir ? "Repetir: ligado" : "Repetir: desligado"} data-acao="transporte-repetir" on:mousedown|preventDefault on:click={() => dispatch("repetir")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5V7a2.5 2.5 0 0 1 2.5-2.5H13 M11 2.5l2 2-2 2 M13 8.5V9a2.5 2.5 0 0 1-2.5 2.5H3 M5 9.5l-2 2 2 2" /></svg>
            </button>
        {/if}
        {#if mudo !== null}
            <button type="button" class="q" class:lig={mudo} tabindex="-1" disabled={travada} aria-pressed={mudo} aria-label="Mudo" data-title={mudo ? "Som desligado: ligar" : "Desligar o som"} data-acao="transporte-mudo" on:mousedown|preventDefault on:click={() => dispatch("mudo")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2.5 6h2.5l3-2.5v9L5 10H2.5z" />
                    {#if mudo}<path d="M11 6l3 4 M14 6l-3 4" />{:else}<path d="M11 5.5a3.5 3.5 0 0 1 0 5" />{/if}
                </svg>
            </button>
        {/if}
        {#if volume !== null}
            <div class="vol"><AliancaBarra valor={volume} max={VOLUME_MAXIMO} desligada={travada} rotulo="Volume {Math.round(volume * 100)}%" cor="var(--luz-texto)" alto on:mover={(e) => dispatch("volume", e.detail)} on:soltar={(e) => dispatch("volumefim", e.detail)} /></div>
        {/if}
    </div>
</div>

<style>
    .tk {
        flex-shrink: 0;
        min-width: 0;
        height: 60px;
        box-sizing: border-box;
        padding: 6px 8px 4px 6px;
        border-radius: 8px;
        background: var(--luz-trilho);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .tk-a,
    .tk-b {
        display: flex;
        align-items: center;
        height: 24px;
        min-width: 0;
    }
    .tk-a {
        gap: 6px;
    }
    .tk-b {
        gap: 2px;
    }
    /* botoes de 24 px com icone de 14: alvo de mouse, sem borda nem botao cheio; "ligado" = icone claro sobre fundo leve (nunca inversao) */
    .q {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto-60);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
    .q:hover:not(:disabled) {
        background: var(--luz-hover);
        color: var(--luz-texto);
    }
    .q:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .q.p {
        box-shadow: inset 0 0 0 1px var(--luz-borda);
        color: var(--luz-texto-85);
    }
    .q.lig {
        color: var(--luz-texto);
        background: var(--luz-hover);
    }
    /* o unico ponto de cor: "isto esta no telao" */
    .pt {
        width: 6px;
        height: 6px;
        border-radius: 3px;
        background: var(--luz-vermelho);
        flex-shrink: 0;
    }
    .nome {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--luz-texto-80);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .sd {
        flex-shrink: 0;
        padding: 0 5px;
        border-radius: 4px;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.05em;
        line-height: 16px;
        color: var(--luz-mudo);
        box-shadow: inset 0 0 0 1px var(--luz-borda);
    }
    .t1 {
        flex-shrink: 0;
        min-width: 44px;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        text-align: right;
        color: var(--luz-texto-85);
        cursor: pointer;
    }
    .vol :global(.barra) {
        margin: 0 2px;
    }
    .vol {
        flex: 0 0 40px;
        display: flex;
        margin: 0 2px;
    }
</style>
