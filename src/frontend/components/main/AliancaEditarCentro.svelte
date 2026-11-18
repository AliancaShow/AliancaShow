<script lang="ts">
    // Leiaute v2, fatia 3: o centro de Editar. Cabecalho de 48 px (nome do item, vista Slide / Acordes / Texto / Dividir, zoom, modelo), o slide em edicao
    // (`edit/Editor.svelte`, o motor), a faixa de pendencia "O telao ainda mostra a versao anterior" com "Mandar pro ar" e a nota de uma linha.
    // Editar um slide que esta no ar e LIVRE: o telao mostra a foto do slide e so troca quando ele for mandado de novo. Fundo, sobreposicao e efeito sao lidos ao
    // vivo: la o aviso diz "muda no telao na hora". Nada aqui escreve em `outputs` a nao ser o botao "Mandar pro ar" (clique do mouse).
    import { activeEdit, activePopup, activeShow, editMode, groups, outputs, showsCache, templates } from "../../stores"
    import { dividirAberto, abrirDividir, fecharDividir } from "../../utils/aliancaDividir"
    import { atualizarSlideNoAr } from "../../utils/aliancaEditarAcoes"
    import { avisoAoVivo, faixaDefasada, notaDoCentro, saidasQueMostram, selosDoShow, situacaoDoSlide } from "../../utils/aliancaEditarLogica"
    import { zoomDoEditor } from "../../utils/aliancaEditarEstado"
    import { getAccess } from "../../utils/profile"
    import { getSlideChords } from "../edit/scripts/chords"
    import { getSlideText } from "../edit/scripts/textStyle"
    import { getActiveOutputs } from "../helpers/output"
    import { getLayoutRef } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import LazyLoad from "../helpers/LazyLoad.svelte"
    import AliancaDividir from "../show/AliancaDividir.svelte"

    $: ehShow = ($activeEdit.type || "show") === "show"
    $: showId = ehShow ? ($activeShow?.type === undefined || $activeShow?.type === "show" ? $activeShow?.id : "") || $activeEdit.showId || "" : ""
    $: show = showId ? $showsCache[showId] : undefined
    $: layout = show?.settings?.activeLayout || ""
    $: ref = showId && show ? getLayoutRef(showId, show) : []
    $: indice = typeof $activeEdit.slide === "number" ? $activeEdit.slide : null
    $: slide = show?.slides && indice !== null ? show.slides[ref[indice]?.id] : null

    // ----- nome e modelo -----
    $: nome = ehShow ? show?.name || "" : $activeEdit.type === "media" || $activeEdit.type === "audio" ? ($activeEdit.id || "").split(/[\\/]/).pop() || "" : ""
    $: nomeFora = nome || ($activeEdit.type === "overlay" ? "Sobreposição" : $activeEdit.type === "template" ? "Modelo" : $activeEdit.type === "effect" ? "Efeito" : $activeEdit.type === "camera" ? "Câmera" : "Nenhum item aberto")
    $: paiId = indice !== null && ref[indice] ? ref[indice].parent?.id || ref[indice].id : ""
    $: grupoGlobal = showId && paiId ? _show(showId).slides([paiId]).get()?.[0]?.globalGroup || "" : ""
    $: modeloId = slide?.settings?.template || $groups[grupoGlobal]?.template || show?.settings?.template || ""

    // ----- vistas -----
    const profile = getAccess("shows")
    $: travado = !!(show?.locked || slide?.locked || profile.global === "read" || profile[show?.category || ""] === "read")
    $: semAcordes = !!show?.reference?.type
    $: acordesOff = !slide || travado || !getSlideText(slide)
    $: nAcordes = slide ? getSlideChords(slide).length : 0
    $: dividindo = ehShow && !!showId && $dividirAberto === showId
    function vista(v: "default" | "chords" | "text_edit") {
        if (dividindo) fecharDividir()
        editMode.set(v)
    }
    function dividir() {
        if (dividindo) fecharDividir()
        else {
            editMode.set("default")
            abrirDividir(showId)
        }
    }
    $: vistaAtiva = dividindo ? "dividir" : $editMode

    // ----- zoom -----
    const passo = 0.1
    const limitar = (v: number) => Math.round(Math.max(0.2, Math.min(4, v)) * 100) / 100
    $: porCento = Math.round($zoomDoEditor * 100)

    // ----- no ar -----
    $: idsDasSaidas = getActiveOutputs($outputs, false, true, true)
    $: saidas = idsDasSaidas.map((id) => $outputs[id])
    $: selos = ehShow && showId && layout ? selosDoShow({ showId, layout, ref, slides: show?.slides, noAr: saidas.map((o: any) => o?.out?.slide) as any }) : {}
    $: situacao = situacaoDoSlide(selos, indice)
    $: nota = ehShow ? notaDoCentro(situacao) : ""
    $: aoVivo = !ehShow ? avisoAoVivo({ tipo: $activeEdit.type, id: $activeEdit.id, noAr: saidas.map((o: any) => ({ background: o?.out?.background, overlays: o?.out?.overlays, effects: o?.out?.effects })) }) : ""
    // a faixa nomeia as telas defasadas (so quando ha mais de uma tela) e reenvia SO para as que mostram este slide
    $: defasadas = ehShow && showId && layout && indice !== null ? saidasQueMostram({ showId, layout, ref, slides: show?.slides, posicao: indice, saidas: idsDasSaidas.map((s) => ({ saida: s, slide: ($outputs[s] as any)?.out?.slide })) }).filter((s) => s.editado) : []
    $: nomesDefasadas = idsDasSaidas.length < 2 ? [] : defasadas.map((d) => (($outputs[d.saida] as any)?.name || "").trim() || `Saída ${idsDasSaidas.indexOf(d.saida) + 1}`)
    function mandar() {
        if (indice === null || !showId) return
        atualizarSlideNoAr(showId, indice)
    }
</script>

<div class="cab" data-acao="editar-cabecalho">
    <span class="item">{nomeFora}</span>
    {#if modeloId && $templates[modeloId]}
        <button type="button" class="modelo" title="Modelo aplicado: {$templates[modeloId]?.name || ''}" on:click={() => activePopup.set("template_info")}>▤ {$templates[modeloId]?.name || "Modelo"}</button>
    {/if}
    {#if ehShow && show}
        <div class="vistas" role="tablist" aria-label="Vista do editor" data-acao="editar-vistas">
            <button type="button" role="tab" aria-selected={vistaAtiva === "default"} class:on={vistaAtiva === "default"} on:click={() => vista("default")}>Slide</button>
            {#if !semAcordes}
                <button type="button" role="tab" aria-selected={vistaAtiva === "chords"} class:on={vistaAtiva === "chords"} disabled={acordesOff} on:click={() => vista("chords")}>Acordes{#if nAcordes > 0}&nbsp;{nAcordes}{/if}</button>
            {/if}
            <button type="button" role="tab" aria-selected={vistaAtiva === "text_edit"} class:on={vistaAtiva === "text_edit"} title="Editar tudo como texto [Ctrl+Shift+T]" on:click={() => vista("text_edit")}>Texto</button>
            <button type="button" role="tab" aria-selected={vistaAtiva === "dividir"} class:on={vistaAtiva === "dividir"} title="Cortar os slides com a tesoura" on:click={dividir}>Dividir</button>
        </div>
    {/if}
    <span class="folga"></span>
    {#if ehShow && show && !dividindo && $editMode === "default"}
        <div class="zoom" data-acao="editar-zoom">
            <button type="button" aria-label="Menos zoom" disabled={$zoomDoEditor <= 0.2} on:click={() => zoomDoEditor.update((v) => limitar(v - passo))}>−</button>
            <button type="button" class="pct" title="Voltar a 100%" on:click={() => zoomDoEditor.set(1)}>{porCento}%</button>
            <button type="button" aria-label="Mais zoom" disabled={$zoomDoEditor >= 4} on:click={() => zoomDoEditor.update((v) => limitar(v + passo))}>＋</button>
        </div>
    {/if}
    <span class="dica">{dividindo ? "clique na tesoura entre as linhas" : "clique no texto para editar"}</span>
</div>

<div class="corpo" class:noAr={situacao !== "livre"} data-acao="editar-slide">
    {#if dividindo && showId}
        <div class="dividir"><AliancaDividir {showId} /></div>
    {:else}
        <div class="editor"><LazyLoad component={() => import("../edit/Editor.svelte")} show={true} /></div>
    {/if}
    {#if situacao !== "livre"}<span class="seloNoAr">NO AR</span>{/if}
</div>

{#if situacao === "defasado"}
    <div class="faixa" role="status" data-acao="editar-pendencia">
        <span class="txt">{faixaDefasada(nomesDefasadas)}</span>
        <button type="button" class="mandar" data-acao="editar-mandar-pro-ar" on:click={mandar}>Mandar pro ar</button>
    </div>
{:else if aoVivo}
    <div class="faixa aviso" role="status" data-acao="editar-aviso-ao-vivo"><span class="txt">{aoVivo}</span></div>
{/if}
{#if nota}<div class="nota">{nota}</div>{/if}

<style>
    .cab {
        height: 48px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 16px;
        border-bottom: 1px solid var(--luz-linha);
    }
    .item {
        font-size: 17px;
        font-weight: 600;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .modelo {
        flex-shrink: 0;
        height: 26px;
        padding: 0 8px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        color: var(--luz-mudo);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .vistas {
        display: flex;
        gap: 2px;
        padding: 3px;
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        border-radius: 8px;
        flex-shrink: 0;
    }
    .vistas button {
        height: 28px;
        padding: 0 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .vistas button.on {
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font-weight: 600;
    }
    .vistas button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .folga {
        flex: 1;
    }
    .zoom {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
    }
    .zoom button {
        height: 28px;
        min-width: 28px;
        padding: 0 6px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    .zoom button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .zoom .pct {
        min-width: 52px;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }
    .dica {
        font-size: 12px;
        color: var(--luz-mudo);
        white-space: nowrap;
    }
    .corpo {
        position: relative;
        flex: 1;
        min-height: 0;
        margin: 16px 16px 0;
        border-radius: 6px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .corpo.noAr {
        box-shadow: inset 0 0 0 3px var(--luz-vermelho);
    }
    .editor,
    .dividir {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: auto;
    }
    .seloNoAr {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 30;
        font-size: 11px;
        font-weight: 700;
        color: #fff;
        background: var(--luz-vermelho);
        border-radius: 4px;
        padding: 3px 8px;
        pointer-events: none;
    }
    .faixa {
        flex-shrink: 0;
        margin: 10px 16px 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 8px 8px 12px;
        border: 1px solid rgba(242, 26, 39, 0.45);
        border-radius: 8px;
        background: rgba(242, 26, 39, 0.12);
    }
    .faixa.aviso {
        padding: 8px 12px;
        border-color: rgba(241, 210, 120, 0.5);
        background: rgba(241, 210, 120, 0.1);
    }
    .faixa .txt {
        flex-grow: 1;
        font-size: 13px;
        color: var(--luz-texto);
    }
    .mandar {
        height: 36px;
        padding: 0 14px;
        border: 1px solid var(--luz-vermelho);
        border-radius: 8px;
        background: var(--luz-vermelho);
        color: #fff;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }
    .nota {
        flex-shrink: 0;
        padding: 10px 16px;
        font-size: 12px;
        color: var(--luz-mudo);
        text-align: center;
    }
    .corpo + :global(.faixa),
    .corpo + .nota {
        margin-top: 10px;
    }
</style>
