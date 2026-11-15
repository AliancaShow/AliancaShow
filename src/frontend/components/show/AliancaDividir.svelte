<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Line } from "../../../types/Show"
    import { groups, outputs, showsCache } from "../../stores"
    import { fecharDividir } from "../../utils/aliancaDividir"
    import { indiceDaFoto } from "../../utils/aliancaFotoLogica"
    import type { ModoDeDivisao } from "../../utils/aliancaLetra"
    import { contagemDepoisDeRedividir, cortarNaLinha, dadosDoFilhoNoLayout, gruposDaVista, juntarSlide, motivoDeNaoRedividir, redividirDoGrupo, textoDaLinha } from "../../utils/aliancaTesoura"
    import { translateText } from "../../utils/language"
    import { getActiveOutputs } from "../helpers/output"
    import { _show } from "../helpers/shows"

    export let showId: string

    $: show = $showsCache[showId] as any
    $: layoutId = show?.settings?.activeLayout || ""
    $: grupos = show ? gruposDaVista(show, layoutId) : []

    // ---------------------------------------------------------------- selo "no ar"
    // o slide no ar e o da FOTO; achamos a posição dele no layout vivo e daí o id do slide
    let noAr: { [slideId: string]: "no ar" | "no ar · mudou" } = {}
    $: calcularNoAr($outputs, show)
    function calcularNoAr(..._deps: any[]) {
        const novo: { [slideId: string]: "no ar" | "no ar · mudou" } = {}
        const ref: any[] = show ? _show(showId).layouts([layoutId]).ref()[0] || [] : []
        getActiveOutputs($outputs, false, true).forEach((outputId) => {
            const out = $outputs[outputId]?.out?.slide
            if (!out || out.id !== showId || out.layout !== layoutId || typeof out.index !== "number") return
            const pos = out.foto ? indiceDaFoto(out.foto, out.index, ref) : out.index
            const id = ref[pos]?.id
            if (!id || novo[id]) return
            const aoVivo = show?.slides?.[id]
            const mudou = !!out.foto && JSON.stringify(aoVivo?.items || []) !== JSON.stringify(out.foto.slide?.items || [])
            novo[id] = mudou ? "no ar · mudou" : "no ar"
        })
        noAr = novo
    }

    // ---------------------------------------------------------------- nomes
    function nomeDoGrupo(paiId: string): string {
        const s = show?.slides?.[paiId]
        if (!s) return ""
        if (s.group) return s.group
        if (s.globalGroup && $groups[s.globalGroup]) {
            const n = $groups[s.globalGroup].default ? translateText("groups." + $groups[s.globalGroup].name) : $groups[s.globalGroup].name
            return n || ""
        }
        return "Sem nome"
    }

    // ---------------------------------------------------------------- acordes (só leitura, em cinza)
    type Pedaco = { acorde: string; texto: string }
    function pedacos(linha: Line): Pedaco[] {
        const texto = textoDaLinha(linha)
        const acordes = [...(linha.chords || [])].sort((a, b) => a.pos - b.pos)
        if (!acordes.length) return [{ acorde: "", texto }]
        const r: Pedaco[] = []
        let ultimo = 0
        acordes.forEach((a, i) => {
            const pos = Math.min(Math.max(a.pos, 0), texto.length)
            if (i === 0 && pos > 0) r.push({ acorde: "", texto: texto.slice(0, pos) })
            const fim = acordes[i + 1] ? Math.min(Math.max(acordes[i + 1].pos, pos), texto.length) : texto.length
            r.push({ acorde: a.key, texto: texto.slice(pos, fim) })
            ultimo = fim
        })
        if (ultimo < texto.length) r.push({ acorde: "", texto: texto.slice(ultimo) })
        return r
    }
    const temAcorde = (linha: Line) => !!linha.chords?.length

    // ---------------------------------------------------------------- ações
    let confirmando: string | null = null
    let confirmarTimer: ReturnType<typeof setTimeout> | undefined
    onDestroy(() => clearTimeout(confirmarTimer))

    function cortar(slideId: string, caixa: number, linhaIdx: number) {
        cortarNaLinha(showId, slideId, caixa, linhaIdx)
    }

    function juntar(slideId: string) {
        if (dadosDoFilhoNoLayout(show, slideId) && confirmando !== slideId) {
            // fundo/áudio/ações próprios do slide de baixo vão se perder: pede o 2º gesto, no próprio vão (some em 3 s)
            confirmando = slideId
            clearTimeout(confirmarTimer)
            confirmarTimer = setTimeout(() => (confirmando = null), 3000)
            return
        }
        confirmando = null
        juntarSlide(showId, slideId)
    }

    // Enter/Espaço no vão: faz o que o clique faz e NÃO chega no resto do app (o Preview manda o slide pro ar com o espaço)
    function tecla(e: KeyboardEvent, acao: () => void) {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        e.stopPropagation()
        if (!e.repeat) acao()
    }
    function soltou(e: KeyboardEvent) {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            e.stopPropagation()
        }
    }
    function clique(e: MouseEvent, acao: () => void) {
        // clique "de teclado" (detail 0) já foi tratado no keydown
        if (e.detail === 0) return
        acao()
    }

    // ---------------------------------------------------------------- "Dividir de novo"
    let redividindo: string | null = null
    let modo: ModoDeDivisao = "n"
    let n = 2
    $: if (redividindo && show) {
        // o grupo sumiu, ou ficou impossível: fecha
        if (!show.slides?.[redividindo]) redividindo = null
    }
    $: previa = redividindo && show ? { antes: 1 + (show.slides?.[redividindo]?.children?.length || 0), depois: contagemDepoisDeRedividir(show, redividindo, modo, n) } : null
    $: motivoModo = redividindo && show ? motivoDeNaoRedividir(show, redividindo, modo) : null

    function aplicarRedividir() {
        if (!redividindo) return
        const r = redividirDoGrupo(showId, redividindo, modo, n)
        if (r) redividindo = null
    }
</script>

<div class="dividir" role="none">
    <div class="topo">
        <div class="titulo"><b>Dividir</b> · corte entre as linhas ou junte. Cada passo tem o seu Ctrl+Z.</div>
        <button class="fechar" title="Voltar para os slides (Esc)" on:click={fecharDividir}>Voltar para os slides</button>
    </div>

    {#each grupos as grupo (grupo.paiId)}
        <section class="grupo">
            <header>
                <span class="nome">{nomeDoGrupo(grupo.paiId)}</span>
                {#if grupo.ocorrencias > 1}
                    <span class="vezes" title="O que você mudar aqui vale para todas as ocorrências desse grupo no culto.">aparece {grupo.ocorrencias}× · a mudança vale nas {grupo.ocorrencias}</span>
                {/if}
                <span class="espaco"></span>
                <button class="redividir" disabled={!!grupo.motivoRedividir} title={grupo.motivoRedividir || "Refazer a divisão deste grupo (por parágrafo, cada linha ou a cada N linhas)"} on:click={() => (redividindo = redividindo === grupo.paiId ? null : grupo.paiId)}>Dividir de novo…</button>
            </header>

            {#if redividindo === grupo.paiId}
                <div class="refazer">
                    <label><input type="radio" bind:group={modo} value="paragrafo" /> por parágrafo</label>
                    <label><input type="radio" bind:group={modo} value="linha" /> cada linha</label>
                    <label><input type="radio" bind:group={modo} value="n" /> a cada <input class="n" type="number" min="1" max="8" bind:value={n} disabled={modo !== "n"} /> linhas</label>
                    <span class="previa"
                        >{#if motivoModo}{motivoModo}{:else if previa}{previa.antes} → {previa.depois} slides{/if}</span
                    >
                    <button class="aplicar" disabled={!!motivoModo} on:click={aplicarRedividir}>Dividir de novo</button>
                    <button on:click={() => (redividindo = null)}>Cancelar</button>
                </div>
            {/if}

            {#each grupo.slides as s, si (s.id)}
                {#if si > 0}
                    <!-- vão entre dois slides do MESMO grupo: já marcado, "Juntar" -->
                    <button class="vao juntar" class:confirma={confirmando === s.id} disabled={!!s.motivoJuntar} title={s.motivoJuntar || "Juntar este slide com o de cima"} data-juntar={s.id} on:keydown={(e) => tecla(e, () => juntar(s.id))} on:keyup={soltou} on:click={(e) => clique(e, () => juntar(s.id))}>
                        <span class="linha"></span>
                        <span class="rotulo">{confirmando === s.id ? "O slide de baixo tem fundo/áudio próprio, que vai se perder. Juntar mesmo assim?" : "✂ Juntar"}</span>
                        <span class="linha"></span>
                    </button>
                {/if}

                <div class="slide" class:escondido={s.escondido} class:noar={!!noAr[s.id]} data-slide={s.id}>
                    <div class="selos">
                        {#if noAr[s.id]}<span class="selo" class:mudou={noAr[s.id] !== "no ar"}>{noAr[s.id]}</span>{/if}
                        {#if s.escondido}<span class="selo esc" title="Escondido em todas as ocorrências: não vai pro ar.">escondido</span>{/if}
                        {#if s.temMidia}<span class="selo midia" title="Esse slide tem mídia ou camada solta; ela fica nas duas metades quando você corta.">mídia</span>{/if}
                    </div>
                    {#each s.linhas as linha, li}
                        {#if li > 0}
                            <button class="vao" disabled={!!s.motivoCortar} title={s.motivoCortar || "Dividir aqui"} data-cortar={s.id + ":" + li} on:keydown={(e) => tecla(e, () => cortar(s.id, s.caixa, li))} on:keyup={soltou} on:click={(e) => clique(e, () => cortar(s.id, s.caixa, li))}>
                                <span class="linha"></span>
                                <span class="rotulo">✂ Dividir aqui</span>
                                <span class="linha"></span>
                            </button>
                        {/if}
                        <div class="l" class:vazia={!textoDaLinha(linha).trim()} class:comAcorde={temAcorde(linha)}>
                            {#if !textoDaLinha(linha).trim()}
                                <span class="fina" title="Linha vazia"></span>
                            {:else}
                                {#each pedacos(linha) as p}
                                    <span class="pedaco"
                                        >{#if p.acorde}<b class="acorde">{p.acorde}</b>{/if}{p.texto}</span
                                    >
                                {/each}
                            {/if}
                        </div>
                    {/each}
                </div>
            {/each}
        </section>
    {/each}
</div>

<style>
    .dividir {
        width: 100%;
        padding: 10px 16px 70px;
        font-size: 0.95em;
        user-select: none;
    }
    .topo {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        opacity: 0.9;
    }
    .titulo {
        flex: 1;
        min-width: 0;
    }
    button {
        font: inherit;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        padding: 3px 10px;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    button:not(:disabled):hover {
        background: var(--hover);
    }
    .grupo {
        margin-bottom: 18px;
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 8px 12px 10px;
        background: var(--primary-darkest);
    }
    header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
    }
    .nome {
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        font-size: 0.8em;
        color: var(--secondary);
    }
    .vezes {
        font-size: 0.75em;
        opacity: 0.65;
    }
    .espaco {
        flex: 1;
    }
    .redividir {
        font-size: 0.8em;
    }
    .refazer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 14px;
        padding: 6px 8px;
        margin-bottom: 8px;
        background: var(--primary-darker);
        border-radius: 6px;
        font-size: 0.85em;
    }
    .refazer .n {
        width: 3.2em;
        background: var(--primary);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
    }
    .previa {
        opacity: 0.8;
    }
    .aplicar:not(:disabled) {
        background: var(--secondary);
        color: var(--secondary-text, #fff);
    }
    .slide {
        position: relative;
        padding: 6px 10px;
        background: var(--primary);
        border-left: 3px solid var(--primary-lighter);
        border-radius: 6px;
    }
    .slide.noar {
        border-left-color: var(--secondary);
    }
    .slide.escondido .l {
        text-decoration: line-through;
        opacity: 0.5;
    }
    .selos {
        position: absolute;
        top: 4px;
        right: 8px;
        display: flex;
        gap: 4px;
    }
    .selo {
        font-size: 0.65em;
        padding: 1px 6px;
        border-radius: 8px;
        background: var(--secondary);
        color: var(--secondary-text, #fff);
    }
    .selo.mudou {
        background: var(--aviso, #e0a030);
        color: #1a1200;
    }
    .selo.esc,
    .selo.midia {
        background: var(--primary-lighter);
        color: var(--text);
    }
    .l {
        line-height: 1.5;
        min-height: 1.5em;
    }
    .l.comAcorde {
        padding-top: 1.1em;
    }
    .l.vazia {
        min-height: 0.6em;
    }
    .fina {
        display: block;
        height: 0.5em;
        border-top: 1px dashed var(--primary-lighter);
        margin-top: 0.25em;
    }
    .pedaco {
        position: relative;
        white-space: pre-wrap;
    }
    .acorde {
        position: absolute;
        top: -1.05em;
        left: 0;
        font-size: 0.75em;
        color: var(--text);
        opacity: 0.5;
        font-weight: 600;
    }
    .vao {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        height: 14px;
        padding: 0;
        margin: 1px 0;
        border: none;
        background: transparent;
        opacity: 0.25;
        font-size: 0.75em;
        transition: opacity 0.1s;
    }
    .vao .linha {
        flex: 1;
        height: 0;
        border-top: 1px dashed var(--text);
    }
    .vao .rotulo {
        opacity: 0;
        white-space: nowrap;
    }
    .vao:not(:disabled):hover,
    .vao:not(:disabled):focus-visible {
        opacity: 1;
        background: transparent;
        outline: none;
    }
    .vao:not(:disabled):hover .rotulo,
    .vao:not(:disabled):focus-visible .rotulo {
        opacity: 1;
        color: var(--secondary);
    }
    .vao.juntar {
        opacity: 0.7;
        height: 22px;
        margin: 2px 0;
    }
    .vao.juntar .linha {
        border-top-style: solid;
        border-color: var(--secondary);
    }
    .vao.juntar .rotulo {
        opacity: 0.7;
    }
    .vao.juntar.confirma {
        opacity: 1;
    }
    .vao.juntar.confirma .rotulo {
        opacity: 1;
        color: var(--prep, #e0a030);
    }
    .vao:disabled {
        cursor: not-allowed;
        opacity: 0.15;
    }
</style>
