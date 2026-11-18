<script lang="ts">
    // Leiaute v2, fatia 3: a coluna da esquerda de Editar. Cabecalho (EDITANDO, N slides), seletor do item ("No roteiro" / "Aberto da biblioteca",
    // ate 5 avulsos em memoria), as miniaturas com os selos EDITADO / NO AR (`edit/Slides.svelte`, que guarda a logica de selecao, arrastar e
    // lazy load), a dica do botao direito e o "＋ Slide" fixo no pe. Substitui `edit/Navigation.svelte` (apagado). Nada aqui escreve em `outputs`.
    import { onDestroy } from "svelte"
    import { activeEdit, activePopup, activeProject, activeShow, categories, effects, overlays, popupData, projects, refreshEditSlide, shows, showsCache, templates, textCache } from "../../stores"
    import { avulsosEditando, type Avulso } from "../../utils/aliancaEditarEstado"
    import { SIMBOLO_DO_TIPO, contagemDeSlides, editDoItemDoRoteiro, empurrarAvulso, estaNoRoteiro, itemEmEdicao, tipoDeEdicaoDesconhecido, opcoesDoSeletor, tirarAvulso, ROTULO_DO_TIPO, type OpcaoDoSeletor, type TipoEditavel } from "../../utils/aliancaEditarLogica"
    import { escFechou } from "../../utils/aliancaToque"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { abrirItemDoRoteiro } from "../../utils/aliancaRoteiroClique"
    import { showEstaSemLetra } from "../../utils/aliancaSemLetraLogica"
    import { getAccess } from "../../utils/profile"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getFileName, removeExtension } from "../helpers/media"
    import { getLayoutRef } from "../helpers/show"
    import { loadShows } from "../helpers/setShow"
    import Slides from "../edit/Slides.svelte"

    // ----- o item que esta em edicao -----
    const nomeDe = (tipo: TipoEditavel, id: string): string => {
        if (tipo === "show") return $shows[id]?.name || ""
        if (tipo === "media" || tipo === "audio") return removeExtension(getFileName(id))
        if (tipo === "overlay") return $overlays[id]?.name || ""
        if (tipo === "template") return $templates[id]?.name || ""
        if (tipo === "effect") return $effects[id]?.name || ""
        return ($activeEdit as any)?.data?.name || ""
    }
    $: atual = itemEmEdicao({ edit: $activeEdit as any, show: $activeShow as any, nomeDe: (t, i) => (void $shows, void $overlays, void $templates, void $effects, nomeDe(t, i)) })
    $: showId = atual?.tipo === "show" ? atual.id : ""
    $: roteiro = ($activeProject ? $projects[$activeProject]?.shows || [] : []) as { id: string; type?: string; name?: string }[]
    // um activeEdit.type que o seletor nao conhece (pdf, ppt) nao e silenciado: acende a falha, e o seletor diz "Nenhum item aberto"
    $: if (tipoDeEdicaoDesconhecido(($activeEdit as any)?.type)) falhaAlta("editar-tipo-desconhecido", `activeEdit.type ${($activeEdit as any).type} nao se edita aqui`)
    $: foraRoteiro = !!atual && !estaNoRoteiro(roteiro, atual.tipo, atual.id)

    // o que se abre e nao e do roteiro entra na lista de avulsos (a mais recente na frente)
    let ultimaChave = ""
    $: if (atual && atual.chave !== ultimaChave) {
        ultimaChave = atual.chave
        if (foraRoteiro) {
            const item: Avulso = { ...atual, edit: atual.tipo === "show" ? undefined : clone($activeEdit) }
            avulsosEditando.update((l) => empurrarAvulso(l, item) as Avulso[])
        }
    }
    // show apagado sai da lista
    $: for (const a of $avulsosEditando) if (a.tipo === "show" && !$shows[a.id]) avulsosEditando.update((l) => tirarAvulso(l, a.chave) as Avulso[])

    // ----- slides -----
    $: total = showId && $showsCache[showId] ? getLayoutRef(showId, $showsCache[showId]).length : 0
    $: temShow = !!showId && !!$showsCache[showId]

    const profile = getAccess("shows")
    $: show = showId ? $showsCache[showId] : undefined
    $: travado = !!(show?.locked || profile.global === "read" || profile[show?.category || ""] === "read")

    function maisSlide(e: MouseEvent) {
        if (travado || !temShow) return
        let index = 1
        const slide = ($activeEdit as any)?.slide
        if (slide !== null && slide !== undefined && getLayoutRef(showId)[slide]) index = slide + 1
        // shift cria um slide-pai (novo grupo); ctrl cria sem os itens do anterior (o que o botao de antes fazia)
        history({ id: "SLIDES", newData: { index, replace: { parent: e.shiftKey }, addItems: !(e.ctrlKey || e.metaKey) } })
    }

    // musica sem letra (veio da lista da banda): "Colar letra" no pe, com o "＋ Slide"
    $: semLetra = temShow && !travado && showEstaSemLetra(showId, $shows, $categories, $showsCache, $textCache)
    $: artista = (((show?.meta || {}) as any).artist as string) || ""
    function colarLetra() {
        popupData.set({ modo: "preencher", showId })
        activePopup.set("alianca_letra")
    }

    // ----- seletor -----
    let aberto = false
    let botao: HTMLElement | undefined
    let pop: HTMLElement | undefined
    let destaque = -1

    // a conta (chaves unicas, avulso que ja esta no roteiro nao se repete) mora em `opcoesDoSeletor`; aqui so se pendura o `abrir`
    type Opcao = OpcaoDoSeletor & { abrir: () => void }
    function opcoes(): Opcao[] {
        const avulsos = $avulsosEditando.filter((a) => a.tipo !== "show" || !!$shows[a.id])
        const nomeDeOpcao = (tipo: TipoEditavel, id: string, salvo: string) => (tipo === "show" ? $shows[id]?.name || salvo : tipo === "media" || tipo === "audio" ? removeExtension(getFileName(id)) : salvo)
        return opcoesDoSeletor({ roteiro, avulsos, atualChave: atual?.chave ?? null, indiceAtivo: typeof ($activeShow as any)?.index === "number" ? ($activeShow as any).index : null, nomeDe: nomeDeOpcao }).map((o) => {
            const avulso = o.avulso ? avulsos.find((a) => `avulso:${a.chave}` === o.chave) : undefined
            return { ...o, abrir: () => (avulso ? abrirAvulso(avulso) : abrirDoRoteiro(roteiro[o.indice as number], o.indice as number)) }
        })
    }
    $: lista = aberto ? (void $shows, void $avulsosEditando, void roteiro, void atual, opcoes()) : []

    function abrirDoRoteiro(it: { id: string; type?: string }, index: number) {
        try {
            abrirItemDoRoteiro(it as any, index)
            // cada tipo escreve o SEU activeEdit (sem isto o audio ficava com o show anterior e a midia nao trocava com um modelo aberto por cima)
            const edicao = editDoItemDoRoteiro(it)
            if (edicao) activeEdit.set(edicao as any)
            else falhaAlta("editar-abrir-item", `o item ${it.id} (${it.type}) do roteiro nao se edita aqui`)
            refreshEditSlide.set(true)
        } catch (erro) {
            falhaAlta("editar-abrir-item", erro)
        }
    }
    async function abrirAvulso(a: Avulso) {
        try {
            if (a.tipo === "show") {
                await loadShows([a.id])
                activeShow.set({ id: a.id, type: "show" } as any)
                activeEdit.set({ type: "show", slide: 0, items: [], showId: a.id } as any)
            } else if (a.edit) activeEdit.set(clone(a.edit))
            refreshEditSlide.set(true)
        } catch (erro) {
            falhaAlta("editar-abrir-avulso", erro)
        }
    }

    function escolher(o: Opcao) {
        fechar()
        if (!o.marcado) o.abrir()
    }
    function fechar() {
        aberto = false
        destaque = -1
        window.removeEventListener("mousedown", fora, true)
        window.removeEventListener("keydown", tecla, true)
    }
    function alternar() {
        if (aberto) return fechar()
        aberto = true
        destaque = Math.max(
            0,
            opcoes().findIndex((o) => o.marcado)
        )
        window.addEventListener("mousedown", fora, true)
        window.addEventListener("keydown", tecla, true)
    }
    function fora(e: MouseEvent) {
        const alvo = e.target as Node
        if (pop?.contains(alvo) || botao?.contains(alvo)) return
        fechar()
    }
    function tecla(e: KeyboardEvent) {
        if (e.key === "Escape") {
            // o Esc que FECHA o seletor nao chega ao Preview (em Editar o Esc limpa o telao): para aqui e segura o seguinte 700 ms
            e.preventDefault()
            e.stopImmediatePropagation()
            e.stopPropagation()
            escFechou()
            fechar()
            botao?.focus()
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            e.stopPropagation()
            const n = lista.length
            if (n) destaque = (destaque + (e.key === "ArrowDown" ? 1 : -1) + n) % n
        } else if (e.key === "Enter") {
            e.preventDefault()
            e.stopPropagation()
            const o = lista[destaque]
            if (o) escolher(o)
        }
    }
    onDestroy(fechar)

    $: etiqueta = atual ? (atual.tipo === "show" ? contagemDeSlides(total) : ROTULO_DO_TIPO[atual.tipo]) : ""
</script>

<div class="cab">
    <span class="rot">EDITANDO</span>
    <span class="cont" data-acao="editando-contagem">{etiqueta}</span>
</div>

<div class="seletor">
    <button bind:this={botao} class="sel" class:aberto type="button" aria-haspopup="listbox" aria-expanded={aberto} data-acao="editando-seletor" on:click={alternar}>
        <span class="nome">{atual?.nome || "Nenhum item aberto"}</span>
        {#if atual && foraRoteiro}<span class="etq">BIBLIOTECA</span>{/if}
        <span class="chev" class:aberto>▾</span>
    </button>
    {#if aberto}
        <div bind:this={pop} class="pop" role="listbox" data-acao="editando-lista">
            {#each lista as o, i (o.chave)}
                {#if i === 0 || lista[i - 1].secao !== o.secao}<div class="secao">{o.secao}</div>{/if}
                <button type="button" role="option" aria-selected={o.marcado} class="op" class:marcado={o.marcado} class:destaque={destaque === i} on:mouseenter={() => (destaque = i)} on:click={() => escolher(o)}>
                    <span class="tp">{SIMBOLO_DO_TIPO[o.tipo]}</span>
                    <span class="on">{o.nome || "—"}</span>
                    <span class="ck">{o.marcado ? "✓" : ""}</span>
                </button>
            {:else}
                <div class="vazio">Nada para abrir</div>
            {/each}
        </div>
    {/if}
</div>

<div class="slides" data-acao="editando-slides">
    {#if atual?.tipo === "show"}
        {#key showId}
            <Slides />
        {/key}
    {:else if atual}
        <div class="semSlides">Este item não tem slides. As propriedades ficam à direita.</div>
    {:else}
        <div class="semSlides">Abra um item pelo roteiro ou pelo botão direito na biblioteca.</div>
    {/if}
</div>

{#if temShow}
    <div class="dica">Botão direito num slide: mandar pro ar</div>
    {#if semLetra}
        <button type="button" class="mais letra" title="Colar a letra desta música (pode ter acordes em cima)" on:click={colarLetra}
            >Colar letra{#if artista}&nbsp;· {artista}{/if}</button
        >
    {/if}
    <button type="button" class="mais" disabled={travado} data-acao="editando-mais-slide" title="Shift: novo grupo · Ctrl: em branco" on:click={maisSlide}>＋ Slide</button>
{/if}

<style>
    .cab {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 12px 6px;
    }
    .rot {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
    }
    .cont {
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .seletor {
        position: relative;
        padding: 0 12px 8px;
    }
    .sel {
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 10px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-sizing: border-box;
    }
    .sel.aberto {
        border-color: var(--luz-texto);
    }
    .nome {
        flex-grow: 1;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .etq {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 700;
        color: var(--luz-mudo);
        background: var(--luz-trilho);
        border-radius: 4px;
        padding: 2px 5px;
    }
    .chev {
        flex-shrink: 0;
        color: var(--luz-mudo);
        font-size: 12px;
        font-weight: 400;
        transition: transform 120ms;
    }
    .chev.aberto {
        transform: rotate(180deg);
    }
    .pop {
        position: absolute;
        z-index: 40;
        left: 12px;
        right: 12px;
        top: 44px;
        max-height: 420px;
        overflow: auto;
        padding: 6px;
        border: 1px solid var(--luz-borda);
        border-radius: 10px;
        background: var(--luz-pop);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .secao {
        padding: 6px 10px 2px;
        font-size: 11px;
        font-weight: 600;
        color: var(--luz-mudo);
    }
    .op {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 0 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
    }
    .op.destaque {
        background: var(--luz-hover);
    }
    .op.marcado {
        font-weight: 600;
    }
    .tp {
        width: 20px;
        color: var(--luz-mudo);
        font-size: 12px;
    }
    .on {
        flex-grow: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .ck {
        width: 14px;
        font-weight: 700;
    }
    .vazio {
        padding: 10px;
        color: var(--luz-mudo);
        font-size: 12px;
    }
    .slides {
        flex: 1;
        min-height: 0;
        display: flex;
        padding: 0 4px 0 6px;
    }
    .slides :global(.autoscroll),
    .slides :global(.scroll) {
        min-height: 0;
    }
    .semSlides {
        margin: auto;
        padding: 16px;
        color: var(--luz-mudo);
        font-size: 12px;
        text-align: center;
    }
    .dica {
        padding: 6px 12px 0;
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .mais {
        margin: 8px;
        flex-shrink: 0;
        height: 40px;
        border: 1px dashed var(--luz-borda-forte);
        border-radius: 8px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .mais:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .mais.letra {
        margin-bottom: 0;
        border-style: solid;
    }
</style>
