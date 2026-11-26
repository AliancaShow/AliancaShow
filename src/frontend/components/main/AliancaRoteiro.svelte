<script lang="ts">
    // Leiaute v2: a coluna do roteiro em Mostrar. Faixa AO VIVO, cabecalho (ROTEIRO, N itens), os dois botoes de local e dia (SeletorDeCulto),
    // a linha reservada de 36 px para o aviso "o roteiro mudou" (D12), a lista em blocos com selo NO AR e o bloco ao vivo, e
    // "＋ Adicionar ao roteiro" (sem rotulo de atalho: Ctrl+K so existe na fatia 5; hoje abre a busca de Ctrl+G/F8). Marcacao nova; da lista de antes ficam a ordem, a selecao e o arrastar (SelectElem + DropArea), os
    // rastros do Sirvo (itens tirados com Desfazer) e a faixa do Sirvo do projeto (SirvoProjetoFaixa), sem mudar a regra de nenhum.
    //
    // Ouvintes de janela de Projects.svelte / ProjectContentList.svelte (conferidos ao portar):
    //  - Projects: `checkInput` (keydown): MORTO aqui (so tratava campos de renomear pasta/projeto, que nao existem mais);
    //    `keydown|capture handleKeydown` (Esc do menu de "novo"): MORTO (o menu de novo projeto nao existe; o "＋ Culto avulso" fica no
    //    popover do dia); `mousedown`, `dragenter`, `dragstart`, `dragend`, `drop`, `mouseup` (arrasto de projeto entre pastas): MORTOS (pastas de
    //    projeto acabam).
    //  - ProjectContentList: `mousedown` (limpar a selecao ao clicar fora) e `keydown|capture` (Esc/Delete na lista) tratam `selected`, que o
    //    SelectElem ja limpa sozinho; MORTOS aqui, sem perda de efeito (conferido: Delete so age com selecao e o clique fora limpa pelo SelectElem).
    import type { ProjectShowRef, Tree } from "../../../types/Projects"
    import { activeDrawerTab, activeProject, activeShow, categories, drawSettings, drawTool, drawerTabsData, editingProjectTemplate, folders, outputState, outputs, paintCache, playingAudio, projects, quickSearchActive, shows, sorted, special } from "../../stores"
    import { avisoDoRoteiro, contarAvisos, ehAvisoDeMusica } from "../../utils/aliancaRoteiroAvisos"
    import { CATEGORIA_NOVAS } from "../../utils/aliancaSirvoMusicas"
    import { soSemLetraNaBiblioteca, tipoDaBiblioteca } from "../../utils/aliancaBibliotecaEstado"
    import SirvoSelo from "../show/SirvoSelo.svelte"
    import { algoNoArEm, faixaAoVivo, telaoLigadoEm } from "../../utils/aliancaAoVivoLogica"
    import { desenhoAtivo } from "../../utils/aliancaPilulaLogica"
    import { noAr } from "../../utils/aliancaModo"
    import { abrirItemDoRoteiro } from "../../utils/aliancaRoteiroClique"
    import { ABAS, CHAVE_ABA, montarArvoreDeCultos } from "../../utils/aliancaRoteiroLogica"
    import { sirvoRoteiro } from "../../utils/aliancaSirvo"
    import { cabecalhoTrancado } from "../../utils/aliancaSirvoProjeto"
    import { desfazerTirado, desfazerTiradoDoSirvo, rastrosParaLista, tirados, type RastroNaLista } from "../../utils/aliancaTirados"
    import { lerDispensas } from "../../utils/aliancaSirvoDispensar"
    import { categoriasDeMusica } from "../../utils/aliancaSemLetraLogica"
    import { getAccess } from "../../utils/profile"
    import { getFileName, removeExtension } from "../helpers/media"
    import Autoscroll from "../system/Autoscroll.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import SeletorDeCulto from "../show/SeletorDeCulto.svelte"
    import SirvoProjetoFaixa from "../show/SirvoProjetoFaixa.svelte"
    import SirvoAviso from "./SirvoAviso.svelte"
    import AliancaBlocoVivo from "./AliancaBlocoVivo.svelte"

    const profile = getAccess("projects")
    const readOnly = profile.global === "read"

    // ----- agenda ativa (a mesma chave de antes) -----
    function lerAba(): string {
        try {
            const salva = localStorage.getItem(CHAVE_ABA)
            return ABAS.some((a) => a.id === salva) ? salva! : "todos"
        } catch {
            return "todos"
        }
    }
    let agendaAtiva = lerAba()
    function escolherAba(id: string) {
        agendaAtiva = id
        try {
            localStorage.setItem(CHAVE_ABA, id)
        } catch {
            // sem armazenamento: vale so ate fechar
        }
    }
    $: tree = montarArvoreDeCultos({ folders: $folders, projects: $projects, sorted: $sorted, profile: profile as any, agenda: agendaAtiva }) as Tree[]

    // ----- projeto aberto -----
    $: projetoId = $activeProject
    $: projeto = projetoId ? $projects[projetoId] : null
    $: if ($activeProject && !projeto) activeProject.set(null)
    $: itens = (projeto?.shows || []).filter((a) => typeof a === "object") as ProjectShowRef[]
    $: totalItens = itens.filter((a) => a.type !== "section" || ehAvisoDeMusica(a)).length
    $: projetoSoLeitura = readOnly || profile[projeto?.parent || ""] === "read" || !!tree.find((a) => a.id === projeto?.parent)?.readOnly
    $: podeTirar = !projetoSoLeitura

    const dispensasDe = (_special: unknown) => lerDispensas()
    // ----- rastros do Sirvo (item tirado fica no lugar, com Desfazer) -----
    $: rastros = rastrosParaLista(projetoId || null, projeto, $tirados, dispensasDe($special), $sirvoRoteiro, $shows, !!projetoSoLeitura)
    const rastroPorPos = (r: RastroNaLista[]) => {
        const m = new Map<number, RastroNaLista[]>()
        for (const x of r) m.set(x.pos, [...(m.get(x.pos) || []), x])
        return m
    }
    $: rastrosPorPos = rastroPorPos(rastros)

    // ----- blocos: cada `section` abre um bloco; o que vem antes da primeira fica num bloco sem nome -----
    type Linha = { item: ProjectShowRef; index: number }
    type Bloco = { chave: string; cabecalho: Linha | null; linhas: Linha[] }
    $: blocos = ((): Bloco[] => {
        const saida: Bloco[] = []
        itens.forEach((item, index) => {
            // roteiro enxuto (26/nov): o aviso de musica do Sirvo e gravado como section, mas na lista e uma linha do bloco, nao abre bloco
            if (item.type === "section" && !ehAvisoDeMusica(item)) saida.push({ chave: item.id, cabecalho: { item, index }, linhas: [] })
            else {
                if (!saida.length) saida.push({ chave: "sem-bloco", cabecalho: null, linhas: [] })
                saida[saida.length - 1].linhas.push({ item, index })
            }
        })
        return saida
    })()

    $: r = $sirvoRoteiro
    $: roteiroVivo = !!r && !!r.iniciado_em && !r.encerrado_em ? r.bloco_no_ar : null
    const blocoDoSirvo = (b: Bloco): string | null => (b.cabecalho && !$editingProjectTemplate && cabecalhoTrancado(projeto, b.cabecalho.item) ? ((b.cabecalho.item as any).data?.sirvo?.blocoId ?? null) : null)
    const nomeBloco = (b: Bloco): string => (b.cabecalho?.item as any)?.name || ""
    const duracaoDoBloco = (b: Bloco): string => {
        const it = b.cabecalho?.item as any
        if (it?.data?.sirvo?.duracaoMin) return `${it.data.sirvo.duracaoMin} min`
        return it?.data?.time || ""
    }

    // ----- NO AR -----
    const lerNoAr = (_saidas: unknown) => noAr().ids
    $: noArIds = lerNoAr($outputs)
    $: extrasNoAr = { desenho: desenhoAtivo($drawTool, $drawSettings, $paintCache), audio: Object.keys($playingAudio).length > 0 }
    $: telaoLigado = telaoLigadoEm($outputs, $outputState)
    $: ao = faixaAoVivo({ telaoLigado, algoNoAr: algoNoArEm($outputs, $outputState, extrasNoAr) })
    $: musicas = categoriasDeMusica($categories as Parameters<typeof categoriasDeMusica>[0])
    // `_deps` existe so para o Svelte reavaliar o texto quando os stores chegam depois da montagem
    function tipoDe(item: ProjectShowRef, _deps?: unknown): string {
        const t = (item.type || "show") as string
        if (t === "show") return musicas.has($shows[item.id]?.category || "") ? "♪" : "T"
        if (t === "video" || t === "image" || t === "player") return "▶"
        if (t === "audio") return "♪"
        if (t === "scripture") return "✝"
        return "T"
    }
    function nomeDe(item: ProjectShowRef, _deps?: unknown): string {
        if ((item.type || "show") === "show") return $shows[item.id]?.name || item.name || "(sem nome)"
        return item.name || removeExtension(getFileName(item.id)) || "(sem nome)"
    }
    const contextoDe = (t: string | undefined) => ((t || "show") === "show" ? "show" : t === "video" || t === "image" ? "media" : t)
    const noArDe = (item: ProjectShowRef) => telaoLigado && (item.type || "show") === "show" && noArIds.has(item.id)

    // ----- roteiro enxuto (26/nov): avisos do Sirvo agrupados num selo do cabecalho -----
    $: avisos = contarAvisos(itens)
    function irParaNovas() {
        tipoDaBiblioteca.set("musicas")
        soSemLetraNaBiblioteca.set(false)
        activeDrawerTab.set("shows")
        drawerTabsData.update((a) => {
            a.shows = { ...a.shows, activeSubTab: CATEGORIA_NOVAS, enabled: a.shows?.enabled !== false }
            return a
        })
    }

    // o clique faz o mesmo que o ShowButton de antes (utils/aliancaRoteiroClique.ts): leiaute do item, ultimo do culto, conferido, editor
    function abrir(item: ProjectShowRef, index: number, e?: MouseEvent) {
        abrirItemDoRoteiro(item as any, index, { ctrl: !!(e?.ctrlKey || e?.metaKey), shift: !!e?.shiftKey })
    }

</script>

{#if ao.aceso}
    <div class="aoVivo"><span class="b" />AO VIVO <span class="m">· {ao.motivo}</span></div>
{/if}

<div class="cab">
    <span class="rot">ROTEIRO</span>
    <span class="selos">
        {#if avisos.rascunhos}
            <button class="selo rasc" data-acao="selo-rascunhos" data-title="{avisos.rascunhos} {avisos.rascunhos === 1 ? 'música é rascunho' : 'músicas são rascunho'}: a letra veio do Sirvo e ainda não foi revisada. Clique para abrir Novas do Sirvo." tabindex="-1" on:mousedown|preventDefault on:click={irParaNovas}>✎ {avisos.rascunhos}</button>
        {/if}
        {#if avisos.faltas}
            <span class="selo falta" data-title="{avisos.faltas} {avisos.faltas === 1 ? 'música do Sirvo ainda não existe' : 'músicas do Sirvo ainda não existem'} na biblioteca deste computador.">⚠ {avisos.faltas}</span>
        {/if}
        <SirvoSelo />
        <span class="cont">{totalItens} {totalItens === 1 ? "item" : "itens"}</span>
    </span>
</div>

<div class="seletor" data-acao="seletor-culto">
    <SeletorDeCulto {tree} abas={ABAS} {agendaAtiva} on:agenda={(e) => escolherAba(e.detail)} />
</div>

<!-- lugar reservado (36 px) para o aviso do Sirvo: a chegada de um aviso nao empurra os itens debaixo do mouse -->
<div class="avisoLugar"><SirvoAviso /></div>

{#if projetoId && projeto}
    <div class="lista" data-acao="lista-roteiro">
        <SirvoProjetoFaixa />
        <Autoscroll timeout={150}>
            <DropArea id="project" selectChildren hoverTimeout={150} file let:fileOver>
                {#each blocos as b (b.chave)}
                    {#if b.cabecalho}
                        {@const cab = b.cabecalho}
                        {@const idSirvo = blocoDoSirvo(b)}
                        {#if idSirvo && idSirvo === roteiroVivo}
                            <AliancaBlocoVivo blocoId={idSirvo} nome={nomeBloco(b)} />
                        {:else}
                            <SelectElem id="show" data={{ ...cab.item, index: cab.index }} {fileOver} borders="edges" trigger="column" draggable={!(projeto?.sectionsLocked || blocoDoSirvo(b))} selectable={!(projeto?.sectionsLocked || blocoDoSirvo(b))}>
                                <button class="bloco {projetoSoLeitura ? '' : 'context #project_section'}" data-indice={cab.index} data-id={cab.item.id} data-menu-titulo={nomeBloco(b) || "Bloco"} tabindex="-1" on:click={(e) => abrir(cab.item, cab.index, e)}>
                                    <span>{nomeBloco(b) || "(sem nome)"}</span><span class="tempo">{duracaoDoBloco(b)}</span>
                                </button>
                            </SelectElem>
                        {/if}
                        {#each rastrosPorPos.get(b.cabecalho.index + 1) || [] as t (t.chave)}
                            <div class="tirado" role="listitem">
                                <span class="tn">{t.nome}</span><span class="tr">tirado{t.nota ? ` · ${t.nota}` : ""}</span>
                                {#if !t.semBotao}<button class="td" tabindex="-1" on:mousedown|stopPropagation on:click|stopPropagation={() => (t.sintetico ? desfazerTiradoDoSirvo(t.rmId || "") : desfazerTirado(t.chave))}>Desfazer</button>{/if}
                            </div>
                        {/each}
                    {/if}
                    {#each b.linhas as l (l.item.id + ":" + l.index)}
                        {@const trava = projeto?.sectionsLocked}
                        {@const av = avisoDoRoteiro(l.item)}
                        {#if av}
                            {@const travaAviso = !!(projeto?.sectionsLocked || cabecalhoTrancado(projeto, l.item))}
                            <SelectElem id="show" data={{ ...l.item, index: l.index }} {fileOver} borders="edges" trigger="column" draggable={!travaAviso} selectable={!travaAviso}>
                                <button class="item aviso {projetoSoLeitura ? '' : 'context #project_section'}" data-indice={l.index} data-id={l.item.id} data-menu-titulo={av.nome} data-title={av.dica} tabindex="-1" on:click={(e) => abrir(l.item, l.index, e)}>
                                    <span class="tipo marca {av.tipo}">{av.marca}</span>
                                    <span class="nome">{av.nome}</span>
                                </button>
                            </SelectElem>
                        {:else}
                        <SelectElem id="show" dropAbove={false} triggerOnHover data={{ ...l.item, name: nomeDe(l.item, $shows), index: l.index }} {fileOver} borders={l.item.type === "show_placeholder" ? "all" : "edges"} trigger="column" draggable={!trava} selectable={!trava}>
                            <button class="item {projetoSoLeitura ? '' : `context #project_${contextoDe(l.item.type)}`}" data-indice={l.index} data-id={l.item.id} data-show={(l.item.type || "show") === "show" ? l.item.id : undefined} data-menu-titulo={nomeDe(l.item, $shows)} class:sel={$activeShow?.index === l.index && $activeShow?.id === l.item.id} tabindex="-1" on:click={(e) => abrir(l.item, l.index, e)}>
                                <span class="tipo">{tipoDe(l.item, [$shows, musicas])}</span>
                                <span class="nome">{nomeDe(l.item, $shows)}</span>
                                {#if noArDe(l.item)}<span class="noar">NO AR</span>{/if}
                                {#if podeTirar}<span class="x" role="none" />{/if}
                            </button>
                        </SelectElem>
                        {/if}
                        {#each rastrosPorPos.get(l.index + 1) || [] as t (t.chave)}
                            <div class="tirado" role="listitem">
                                <span class="tn">{t.nome}</span><span class="tr">tirado{t.nota ? ` · ${t.nota}` : ""}</span>
                                {#if !t.semBotao}<button class="td" tabindex="-1" on:mousedown|stopPropagation on:click|stopPropagation={() => (t.sintetico ? desfazerTiradoDoSirvo(t.rmId || "") : desfazerTirado(t.chave))}>Desfazer</button>{/if}
                            </div>
                        {/each}
                    {/each}
                {/each}
                {#if !itens.length}<p class="vazio">Roteiro vazio. Use “Adicionar ao roteiro”.</p>{/if}
            </DropArea>
        </Autoscroll>
    </div>
{:else}
    <div class="lista"><p class="vazio">Nenhum culto aberto. Escolha o dia acima.</p></div>
{/if}

<button class="trazer" data-acao="adicionar-ao-roteiro" tabindex="-1" on:mousedown|preventDefault on:click={() => quickSearchActive.set(true)}>＋ Adicionar ao roteiro <span class="atalhoK">· Ctrl+K</span></button>

<style>
    .aoVivo {
        height: 30px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 12px;
        border-radius: 14px 14px 0 0;
        background: var(--luz-vermelho);
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
    }
    .aoVivo .b {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: var(--luz-campo);
    }
    .aoVivo .m {
        font-weight: 400;
        letter-spacing: 0;
        opacity: 0.9;
    }
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
    }
    .avisoLugar {
        position: relative;
        flex-shrink: 0;
        height: 36px;
        margin: 0 8px;
    }
    .avisoLugar :global(.sirvoAviso) {
        position: absolute;
        z-index: 15;
        left: 0;
        right: 0;
        top: 0;
        margin: 0;
        background: var(--luz-pop);
    }
    .lista {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding: 0 8px;
    }
    .lista :global(.autoscroll),
    .lista :global(.scroll) {
        min-height: 0;
    }
    /* roteiro enxuto (26/nov): o bloco e uma faixa de largura toda (fundo um tom acima, maiusculas pequenas, tempo a direita);
       os itens sao linhas de 30 px, recuadas, texto normal. A diferenca vem do fundo e do tamanho, nao de icones */
    .bloco {
        width: 100%;
        height: 24px;
        margin-top: 8px;
        padding: 0 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--luz-texto-80, var(--luz-texto));
        background: var(--luz-campo);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
    }
    .bloco > span:first-child {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .bloco:hover {
        background: var(--luz-hover);
    }
    .tempo {
        flex: none;
        color: var(--luz-mudo);
        font-weight: 400;
        letter-spacing: 0;
        text-transform: none;
    }
    .item {
        width: 100%;
        min-height: 30px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 8px 0 12px;
        border: none;
        border-radius: 6px;
        text-align: left;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
        color: var(--luz-texto);
        background: transparent;
    }
    .item:hover {
        background: var(--luz-campo);
    }
    .item.sel {
        background: var(--luz-hover);
        box-shadow: inset 2px 0 0 var(--luz-texto);
        font-weight: 600;
    }
    .tipo {
        flex: none;
        width: 16px;
        color: var(--luz-mudo);
        font-size: 11px;
        opacity: 0.7;
    }
    .item.aviso .nome {
        color: var(--luz-texto-80, var(--luz-texto));
    }
    .marca {
        opacity: 1;
        color: #ffb066;
    }
    .marca.falta_criar,
    .marca.falta_pc {
        color: #ff8f97;
    }
    .selos {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .selo {
        display: inline-flex;
        align-items: center;
        height: 20px;
        padding: 0 6px;
        border: 0;
        border-radius: 4px;
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        background: transparent;
    }
    .selo.rasc {
        color: #ffb066;
        background: rgb(255 128 0 / 0.14);
        cursor: pointer;
    }
    .selo.rasc:hover {
        background: rgb(255 128 0 / 0.28);
    }
    .selo.falta {
        color: #ff8f97;
        background: rgb(255 80 90 / 0.12);
        cursor: default;
    }
    .nome {
        flex-grow: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .noar {
        font-size: 10px;
        font-weight: 700;
        color: #fff;
        background: var(--luz-vermelho);
        border-radius: 4px;
        padding: 2px 6px;
    }
    .x {
        display: none;
    }
    .tirado {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .tn {
        text-decoration: line-through;
    }
    .td {
        margin-left: auto;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 11px;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .vazio {
        margin: 12px 8px;
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .trazer {
        margin: 8px;
        flex-shrink: 0;
        height: 44px;
        border: 1px dashed var(--luz-borda-forte);
        border-radius: 8px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .atalhoK {
        color: var(--luz-mudo);
    }
</style>
