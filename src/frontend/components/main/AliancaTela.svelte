<script lang="ts">
    // Leiaute v2: a tela unica da janela principal (substitui MainLayout.svelte). Topo de 56 px + corpo
    //   [ (esquerda | centro) / biblioteca ] | direita
    // As larguras (esquerda, direita) e a altura (biblioteca) sao px, gravadas em `aliancaTela`; o centro absorve a sobra.
    // Cada regiao leva `data-regiao` (topo, roteiro, centro, no-ar, biblioteca, corpo-pagina): a Prova do Culto e a de fidelidade usam.
    //
    // MOTOR (montado desde o primeiro dia e fora de qualquer {#if}): <Preview escondida /> (teclado do telao, temporizadores de slide),
    // FaixaDeFalha, AnteparoDeModo, ProfileChangerMenu e o disparo de show_opened. Nada disso tem markup visivel.
    import { onMount } from "svelte"
    import { customActionActivation } from "../actions/actions"
    import { isOutCleared } from "../helpers/output"
    import Preview from "../output/preview/Preview.svelte"
    import { activePage, activeProfile, activeShow, outputs, saved, showChangeProfileMenu, special } from "../../stores"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { aliancaTela } from "../../utils/aliancaTelaEstado"
    import { arrastar, prender } from "../../utils/aliancaTelaLogica"
    import Navigation from "../edit/Navigation.svelte"
    import LazyLoad from "../helpers/LazyLoad.svelte"
    import AliancaEditarFerramentas from "./AliancaEditarFerramentas.svelte"
    import AliancaCentro from "./AliancaCentro.svelte"
    import AliancaRoteiro from "./AliancaRoteiro.svelte"
    import AliancaBibliotecaPainel from "./AliancaBibliotecaPainel.svelte"
    import AliancaCorpoPagina from "./AliancaCorpoPagina.svelte"
    import AliancaDivisoria from "./AliancaDivisoria.svelte"
    import AliancaNoAr from "./AliancaNoAr.svelte"
    import AliancaTopo from "./AliancaTopo.svelte"
    import AnteparoDeModo from "./AnteparoDeModo.svelte"
    import FaixaDeFalha from "./FaixaDeFalha.svelte"
    import ProfileChangerMenu from "./ProfileChangerMenu.svelte"

    $: pagina = $activePage
    $: emPagina = pagina === "settings" || pagina === "stage" || pagina === "draw"
    // pagina sem lugar na tela nova (scripture, calendar, reflow ou valor novo do upstream): corpo vazio com o nome, e a faixa de falha acende.
    // Nunca cai calado numa tela antiga e nunca "volta para show". (O guarda de activePage, commit 11, recusa a escrita antes de chegar aqui.)
    $: semLugar = !emPagina && pagina !== "show" && pagina !== "edit"
    $: if (semLugar) falhaAlta("pagina-sem-lugar", pagina)

    // ----- medidas do conteudo (o `main`) e divisorias -----
    let w = 1920
    let h = 1080
    $: valores = prender($aliancaTela, { w, h })

    let arrasto: { qual: "esq" | "dir" | "bib"; x: number; y: number; inicio: number } | null = null
    function pegar(qual: "esq" | "dir" | "bib") {
        return (e: CustomEvent<{ x: number; y: number }>) => {
            arrasto = { qual, x: e.detail.x, y: e.detail.y, inicio: valores[qual] }
        }
    }
    function mover(e: MouseEvent) {
        if (!arrasto) return
        const delta = arrasto.qual === "bib" ? e.clientY - arrasto.y : e.clientX - arrasto.x
        aliancaTela.set(arrastar(arrasto.qual, valores, arrasto.inicio, delta, { w, h }))
    }
    function soltar() {
        if (!arrasto) return
        arrasto = null
        // o valor preso e o que fica gravado: persiste ao fechar e abrir
        aliancaTela.set(valores)
        saved.set(false)
    }

    // ----- luz ambiente: acende quando ha fundo no ar -----
    $: luz = !isOutCleared("background", $outputs)

    // ----- show_opened (acao configurada pelo usuario) -----
    let anterior = ""
    $: if ($activeShow?.id !== anterior) showAberto()
    function showAberto() {
        if (!$activeShow?.id || $activeShow?.type !== "show") return
        setTimeout(() => customActionActivation("show_opened"), 50)
        anterior = $activeShow.id
    }

    onMount(() => {
        // dado salvo antigo ou fora dos limites: preso na carga
        try {
            aliancaTela.set(prender($aliancaTela, { w, h }))
        } catch (e) {
            falhaAlta("aliancaTela-carga", e)
        }
    })
</script>

<svelte:window on:mousemove={mover} on:mouseup={soltar} />

<div class="tela" class:arrastando={!!arrasto} class:otimizado={$special.optimizedMode} bind:clientWidth={w} bind:clientHeight={h} data-tela="luz">
    <div class="ambiente" class:acesa={luz} aria-hidden="true" />
    <div class="vinheta" aria-hidden="true" />

    <AliancaTopo />

    {#if semLugar}
        <div class="corpo" data-regiao="corpo-pagina" data-pagina={pagina}>
            <div class="painel semLugar" style="flex: 1; min-width: 0">Página sem lugar: {pagina}</div>
        </div>
    {:else if emPagina}
        <div class="corpo" data-regiao="corpo-pagina" data-pagina={pagina}>
            <div class="painel" style="flex: 1; min-width: 0">
                <AliancaCorpoPagina pagina={emPagina ? pagina : "settings"} esq={valores.esq} dir={valores.dir} />
            </div>
        </div>
    {:else}
        <div class="corpo">
            <div class="area">
                <div class="faixa">
                    <section class="painel col" data-regiao="roteiro" style="width: {valores.esq}px">
                        {#if pagina === "edit"}<Navigation />{:else}<AliancaRoteiro />{/if}
                    </section>
                    <AliancaDivisoria eixo="v" on:pegar={pegar("esq")} />
                    <section class="painel centro" data-regiao="centro">
                        {#if pagina === "edit"}
                            <div class="editor"><LazyLoad component={() => import("../edit/Editor.svelte")} show={true} /></div>
                        {:else}<AliancaCentro />{/if}
                    </section>
                </div>
                <AliancaDivisoria eixo="h" on:pegar={pegar("bib")} />
                <section class="painel bib" data-regiao="biblioteca" style="height: {valores.bib}px">
                    <AliancaBibliotecaPainel esq={valores.esq} />
                </section>
            </div>
            <AliancaDivisoria eixo="v" on:pegar={pegar("dir")} />
            <aside class="painel dir" data-regiao="no-ar" style="width: {valores.dir}px">
                {#if pagina === "edit"}<AliancaEditarFerramentas />{:else}<AliancaNoAr />{/if}
            </aside>
        </div>
    {/if}
</div>

<!-- motor: sem markup visivel, sempre montado -->
<Preview escondida />
<FaixaDeFalha />
<AnteparoDeModo />
{#if $showChangeProfileMenu && $activeProfile !== null}
    <ProfileChangerMenu />
{/if}

<style>
    .tela {
        position: relative;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        padding: 0 10px 10px;
        overflow: hidden;
        background: var(--luz-fundo);
        color: var(--luz-texto);
        font-family: var(--luz-fonte);
        font-size: 13px;
    }
    .tela.arrastando {
        user-select: none;
    }
    .ambiente,
    .vinheta {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
    }
    .ambiente {
        opacity: 0;
        transition: opacity 400ms;
        background: radial-gradient(70% 90% at 78% 28%, #5b3aa8 0%, transparent 62%), radial-gradient(60% 80% at 25% 90%, #b4366b 0%, transparent 60%), linear-gradient(160deg, #2a1650, #120a22);
    }
    .ambiente.acesa {
        opacity: 0.55;
    }
    .vinheta {
        background: radial-gradient(130% 100% at 60% 40%, transparent 30%, #0d0d0f 95%);
    }
    .corpo {
        position: relative;
        z-index: 1;
        flex: 1;
        display: flex;
        min-height: 0;
    }
    .area {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }
    .faixa {
        flex: 1;
        min-height: 0;
        display: flex;
    }
    .painel {
        background: var(--luz-painel);
        border-radius: var(--luz-raio);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        display: flex;
        flex-direction: column;
        min-height: 0;
        position: relative;
    }
    .col,
    .dir {
        flex-shrink: 0;
    }
    .editor {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: auto;
    }
    .semLugar {
        align-items: center;
        justify-content: center;
        color: var(--luz-mudo);
    }
    .centro {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }
    .bib {
        flex-shrink: 0;
        overflow: hidden;
    }
    .dir {
        padding: 12px;
        gap: 10px;
        box-sizing: border-box;
        overflow: auto;
    }
</style>
