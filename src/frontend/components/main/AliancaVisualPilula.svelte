<script lang="ts">
    // Cabine 6, fatia V1 (board P2, "onde se troca"): a pilula "Visual: X ▾" da barra de cima, em Mostrar e em Editar, sempre no mesmo lugar.
    // Trocar muda todas as saidas de uma vez; o que esta no ar nao pula: entra no proximo slide (D15). Ponto laranja so para problema (D14).
    // O menu abre por clique no proprio botao e fecha por clique fora (AliancaCortina) ou Esc, como o menu do telao.
    import { onDestroy } from "svelte"
    import { outputs, settingsTab, special, stageShows, styles, templates } from "../../stores"
    import { configSecao } from "../../utils/aliancaConfigSecao"
    import { trocarTela } from "../../utils/aliancaTela"
    import { escFechou } from "../../utils/aliancaToque"
    import { ativarVisual, aplicarVisualAtivo, visualPendente } from "../../utils/aliancaVisualAplicador"
    import { divergencias, lerVisuais, planoDeEscrita, visualAtivo } from "../../utils/aliancaVisualLogica"
    import AliancaCortina from "./AliancaCortina.svelte"

    let aberto = false
    $: lista = lerVisuais($special)
    $: ativo = visualAtivo($special)
    $: esperando = $visualPendente.saidas.size > 0
    $: fora = ativo ? divergencias(ativo, $outputs, $styles, $visualPendente.chaves) : []
    // reativo: saida criada/apagada, modelo ou leiaute apagado aparecem na hora (nunca calado)
    $: problemas = ativo ? planoDeEscrita(ativo, $outputs, $styles, $templates, $stageShows).problemas : []
    $: nProblemas = problemas.length + (fora.length ? 1 : 0)

    function trocar(id: string) {
        aberto = false
        if (id !== ativo?.id) ativarVisual(id)
    }
    function editar() {
        aberto = false
        settingsTab.set("styles")
        configSecao.set("visual")
        trocarTela("settings", "botao-de-pagina")
    }
    function reaplicar() {
        aberto = false
        aplicarVisualAtivo()
    }
    function tecla(e: KeyboardEvent) {
        if (!aberto || e.key !== "Escape") return
        e.preventDefault()
        e.stopImmediatePropagation()
        escFechou()
        aberto = false
    }
    if (typeof window !== "undefined") window.addEventListener("keydown", tecla, true)
    onDestroy(() => typeof window !== "undefined" && window.removeEventListener("keydown", tecla, true))
</script>

{#if lista.length}
    <div class="raiz" data-acao="visual-pilula-raiz">
        <button class="pil" class:aberto data-acao="visual-pilula" aria-haspopup="menu" aria-expanded={aberto} tabindex="-1" data-title={esperando ? "O Visual novo entra no próximo slide que for ao ar" : "Qual modelo cada saída usa"} on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>
            <small>Visual:</small><span class="nome">{ativo?.nome || "nenhum"}</span>
            {#if esperando}<span class="esp" data-acao="visual-pilula-proximo">vale no próximo slide</span>{/if}
            {#if nProblemas || !ativo}<span class="ponto" data-acao="visual-pilula-problema" />{/if}
            <svg class="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
        </button>
        {#if aberto}
            <AliancaCortina on:fechar={() => (aberto = false)} />
            <div class="pop" role="menu" data-acao="visual-pilula-menu">
                <div class="tit">VISUAL QUE ESTÁ VALENDO</div>
                {#each lista as v (v.id)}
                    <button role="menuitemradio" aria-checked={v.id === ativo?.id} class="mi" class:h={v.id === ativo?.id} data-visual={v.id} tabindex="-1" on:mousedown|preventDefault on:click={() => trocar(v.id)}>
                        <span class="marca">{v.id === ativo?.id ? "✓" : ""}</span>{v.nome}
                        {#if v.id === ativo?.id}<small>{esperando ? "entra no próximo slide" : "agora"}</small>{/if}
                    </button>
                {/each}
                {#if nProblemas}
                    <hr />
                    <div class="prob">{nProblemas === 1 ? "1 problema" : `${nProblemas} problemas`} no Visual (detalhes em Editar visuais)</div>
                    {#if fora.length}<button role="menuitem" class="mi" tabindex="-1" on:mousedown|preventDefault on:click={reaplicar}><span class="marca" />Reaplicar o Visual</button>{/if}
                {/if}
                <hr />
                <button role="menuitem" class="mi" data-acao="visual-editar" tabindex="-1" on:mousedown|preventDefault on:click={editar}><span class="marca" />Editar visuais…</button>
            </div>
        {/if}
    </div>
{/if}

<style>
    .raiz {
        position: relative;
        display: flex;
        align-items: center;
    }
    .pil {
        position: relative;
        height: 40px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 12px 0 14px;
        border: 1px solid var(--luz-borda);
        border-radius: 20px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
    }
    .pil:hover,
    .pil.aberto {
        background: var(--luz-hover);
        border-color: var(--luz-borda-forte);
    }
    .pil small {
        font-size: 12px;
        font-weight: 500;
        color: var(--luz-mudo);
    }
    .nome {
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .esp {
        font-size: 11px;
        font-weight: 600;
        color: var(--luz-mudo);
    }
    .ponto {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: var(--luz-laranja);
    }
    .chev {
        color: var(--luz-texto-80);
        transition: transform 140ms ease;
    }
    .pil.aberto .chev {
        transform: rotate(180deg);
    }
    .pop {
        position: absolute;
        z-index: 40;
        top: 46px;
        right: 0;
        width: 290px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-menu);
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            var(--luz-sombra-pop);
        transform-origin: top right;
        animation: luz-surgir 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .tit {
        padding: 6px 10px 4px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--luz-mudo);
    }
    .mi {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 0;
        border-radius: var(--luz-raio-botao);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
    }
    .mi:hover,
    .mi.h {
        background: var(--luz-hover);
    }
    .mi.h {
        font-weight: 600;
    }
    .mi small {
        margin-left: auto;
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .marca {
        width: 14px;
        flex-shrink: 0;
    }
    .prob {
        padding: 4px 10px;
        font-size: 12px;
        color: var(--luz-laranja);
    }
    hr {
        border: 0;
        border-top: 1px solid var(--luz-linha);
        margin: 4px 6px;
    }
</style>
