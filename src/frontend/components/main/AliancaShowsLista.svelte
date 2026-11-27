<script lang="ts">
    // Leiaute v2, biblioteca: a lista da pasta Shows (musicas e apresentacoes), em colunas de 300 px, linha de 30 px ("＋ roteiro" e ▶ ao passar o mouse).
    // A logica de listar/filtrar/buscar e a de AliancaBiblioteca (Preparar): `listarBiblioteca` + `showSearch`. Clicar na linha ABRE o show no
    // centro (nao vai ao ar); "＋ roteiro" poe no fim do culto (uma entrada de historico). Chips e busca moram no cabecalho do painel.
    import { onDestroy } from "svelte"
    import { activeProfile, activeProject, drawerTabsData, outLocked, activeShow, categories, editingProjectTemplate, projects, shows, showsCache, textCache } from "../../stores"
    import { aplicarRecorte, recorteDeShows } from "../../utils/aliancaArvoreLogica"
    import { motivoSemCulto } from "../../utils/aliancaGaveta"
    import { porShowNoFim } from "../../utils/aliancaBiblioteca"
    import { buscaDaBiblioteca, soSemLetraNaBiblioteca } from "../../utils/aliancaBibliotecaEstado"
    import { idsNoCulto, listarBiblioteca, textoVazio, type LinhaDaBiblioteca } from "../../utils/aliancaBibliotecaLogica"
    import { categoriasDeMusica, ehSemLetra } from "../../utils/aliancaSemLetraLogica"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { formatSearch, showSearch } from "../../utils/search"
    import { openShow } from "../helpers/show"
    import { tela } from "../../utils/aliancaTela"
    import { MOTIVO_TRAVADA, tocarShowNoAr } from "../../utils/aliancaTocarNoAr"
    import { activePopup, popupData, quickTextCache } from "../../stores"
    import { artistaDoShow, criadoEm, ordenarShows, proximaOrdem, quandoFoi, usadoEm, type ColunaDosShows, type OrdemDosShows } from "../../utils/aliancaShowsInfo"

    export let firstMatch: null | { id: string } = null

    $: acesso = ($activeProfile ? getAccess("shows") : {}) as { [categoria: string]: string | undefined }
    $: musicasCat = categoriasDeMusica($categories as Parameters<typeof categoriasDeMusica>[0])
    $: ehSemLetraDe = (id: string) => {
        const s = $shows[id]
        return !!s && ehSemLetra({ ehMusica: musicasCat.has(s.category || ""), carregado: $showsCache[id], textoDoCache: $textCache[id] })
    }
    // C6: a arvore tambem recorta a lista: o filtro "Sem categoria" e cada categoria valem nos DOIS tipos (a raiz Shows = "tudo", o que os chips dizem)
    $: recorte = recorteDeShows($drawerTabsData.shows?.activeSubTab, $categories)
    // 26/nov (cabine): sem o "Musicas / Apresentacoes" do funil (repetia as categorias da arvore). "Todos" = os dois tipos; a categoria recorta;
    // "Sem letra" e "Sem categoria" sao os filtros. Antes, com uma categoria aberta, o tipo do funil era ignorado e a lista parecia sem filtro.
    $: base = aplicarRecorte(
        [...listarBiblioteca({ shows: $shows, categorias: $categories, acesso, tipo: "musicas", soSemLetra: $soSemLetraNaBiblioteca, ehSemLetraDe }), ...listarBiblioteca({ shows: $shows, categorias: $categories, acesso, tipo: "apresentacoes", soSemLetra: $soSemLetraNaBiblioteca, ehSemLetraDe })].sort((a, b) => a.nome.localeCompare(b.nome, "pt", { sensitivity: "base" }) || a.id.localeCompare(b.id)),
        recorte,
        $categories
    )
    $: noCulto = idsNoCulto($projects, $activeProject, !!$editingProjectTemplate)

    let lista: LinhaDaBiblioteca[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    $: filtrando = $buscaDaBiblioteca.trim().length > 1 || $soSemLetraNaBiblioteca || recorte.tipo !== "chips"
    $: atualizar(base, $buscaDaBiblioteca)
    function atualizar(linhas: LinhaDaBiblioteca[], q: string) {
        clearTimeout(timer)
        if (q.trim().length < 2) {
            lista = linhas
            return
        }
        const executar = () => {
            const porId = new Map(linhas.map((l) => [l.id, l]))
            const achados = showSearch(
                formatSearch(q),
                linhas.map((l) => ({ ...$shows[l.id], id: l.id }))
            )
            lista = achados.map((a) => porId.get(a.id)).filter((l): l is LinhaDaBiblioteca => !!l)
        }
        if (linhas.length > 300) timer = setTimeout(executar, 100)
        else executar()
    }
    // cabine 27/nov: o cantor discreto ao lado do nome (distingue musicas de mesmo nome) e o modo "Lista com detalhes" (AliancaShowsControles)
    $: cantorDe = (id: string) => artistaDoShow($shows[id] as any, $showsCache[id] as any)
    $: modoLista = ($drawerTabsData.shows as any)?.aliancaExibicao === "lista"
    $: ordem = (($drawerTabsData.shows as any)?.aliancaOrdem || "nome") as OrdemDosShows
    function ordenarPor(coluna: ColunaDosShows) {
        const nova = proximaOrdem(ordem, coluna)
        drawerTabsData.update((a) => {
            a.shows = { ...(a.shows || { enabled: true, activeSubTab: "all" }), aliancaOrdem: nova } as any
            return a
        })
    }
    $: detalhadas = modoLista ? lista.map((l) => ({ ...l, cantor: cantorDe(l.id), usado: usadoEm($shows[l.id] as any, $showsCache[l.id] as any), criado: criadoEm($shows[l.id] as any, $showsCache[l.id] as any) })) : []
    // buscando, a ordem por nome cede a vez a relevancia da busca; as outras ordens valem sempre
    $: ordenadas = modoLista ? ($buscaDaBiblioteca.trim().length > 1 && ordem === "nome" ? detalhadas : ordenarShows(detalhadas, ordem)) : []
    $: seta = (col: ColunaDosShows) => {
        const m: { [k in OrdemDosShows]: [ColunaDosShows, string] } = { nome: ["nome", "▲"], nome_des: ["nome", "▼"], cantor: ["cantor", "▲"], cantor_des: ["cantor", "▼"], usado: ["usado", "▼"], usado_asc: ["usado", "▲"], criado: ["criado", "▼"], criado_asc: ["criado", "▲"] }
        return m[ordem]?.[0] === col ? m[ordem][1] : ""
    }
    $: firstMatch = modoLista ? (ordenadas[0] ? { id: ordenadas[0].id } : null) : lista[0] ? { id: lista[0].id } : null
    onDestroy(() => clearTimeout(timer))

    const calcularMotivo = (..._deps: unknown[]) => motivoSemCulto()
    $: motivo = calcularMotivo($activeProject, $projects, $editingProjectTemplate, $activeProfile)

    $: aberto = $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined) ? $activeShow.id : ""
    const nomeDaCategoria = (id: string | null): string => (id && $categories[id]?.name ? translateText($categories[id].name) : "sem categoria")
    function mais(id: string) {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        if (motivo) return
        porShowNoFim(id)
    }
    // cabine 26/nov: a busca sempre oferece procurar a letra na internet (achando ou nao na biblioteca)
    $: termoWeb = $buscaDaBiblioteca.trim()
    function procurarNaInternet() {
        quickTextCache.set({ name: termoWeb, text: "" })
        popupData.set({ buscarWeb: true })
        activePopup.set("show")
    }
    // ▶: entra no roteiro E o primeiro slide vai ao ar (so em Mostrar; em Editar a biblioteca nunca toca o telao)
    function tocar(id: string) {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        void tocarShowNoAr(id)
    }
</script>

{#if lista.length && modoLista}
    <div class="tabela" data-acao="shows-lista-detalhes">
        <div class="cabT">
            <button type="button" class="c c-nome" class:ativa={!!seta("nome")} data-acao="shows-ordenar-nome" tabindex="-1" on:mousedown|preventDefault on:click={() => ordenarPor("nome")}>Nome <i>{seta("nome")}</i></button>
            <button type="button" class="c c-cantor" class:ativa={!!seta("cantor")} data-acao="shows-ordenar-cantor" tabindex="-1" on:mousedown|preventDefault on:click={() => ordenarPor("cantor")}>Cantor <i>{seta("cantor")}</i></button>
            <span class="c c-cat">Categoria</span>
            <button type="button" class="c c-usado" class:ativa={!!seta("usado")} data-acao="shows-ordenar-usado" title="Última vez que foi ao ar" tabindex="-1" on:mousedown|preventDefault on:click={() => ordenarPor("usado")}>Último uso <i>{seta("usado")}</i></button>
            <button type="button" class="c c-criado" class:ativa={!!seta("criado")} data-acao="shows-ordenar-criado" tabindex="-1" on:mousedown|preventDefault on:click={() => ordenarPor("criado")}>Criada <i>{seta("criado")}</i></button>
            <span class="c c-acoes" />
        </div>
        {#each ordenadas as linha (linha.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="linha lin context #show_drawer" class:on={aberto === linha.id} role="button" tabindex="-1" data-show={linha.id} data-menu-titulo={linha.nome} data-title="Botão direito: editar, mostrar agora…" on:click={() => openShow(linha.id)}>
                <span class="c c-nome"><span class="t">{linha.nome}</span>{#if linha.semLetra}<span class="selo aviso">sem letra</span>{/if}{#if noCulto.has(linha.id)}<span class="selo">no roteiro</span>{/if}</span>
                <span class="c c-cantor" data-acao="shows-col-cantor">{linha.cantor}</span>
                <span class="c c-cat">{nomeDaCategoria(linha.categoria)}</span>
                <span class="c c-usado" data-acao="shows-col-usado" title={linha.usado ? new Date(linha.usado).toLocaleString("pt-BR") : "Nunca foi ao ar"}>{quandoFoi(linha.usado) || "—"}</span>
                <span class="c c-criado" title={linha.criado ? new Date(linha.criado).toLocaleString("pt-BR") : ""}>{quandoFoi(linha.criado)}</span>
                <span class="c c-acoes">
                    <button class="mais" aria-disabled={!!motivo} aria-label="Adicionar ao roteiro" data-title={motivo || "Adicionar ao fim do roteiro"} tabindex="-1" on:mousedown|preventDefault on:click|stopPropagation={() => mais(linha.id)}>＋ roteiro</button>
                    {#if $tela === "mostrar"}
                        <button class="tocar" class:travada={$outLocked} aria-disabled={$outLocked} aria-label="Adicionar ao roteiro e mandar ao ar" data-acao="biblioteca-tocar" data-title={$outLocked ? MOTIVO_TRAVADA : "Adicionar ao roteiro e mandar o primeiro slide ao ar"} tabindex="-1" on:mousedown|preventDefault on:click|stopPropagation={() => tocar(linha.id)}>▶</button>
                    {/if}
                </span>
            </div>
        {/each}
    </div>
{:else if lista.length}
    <div class="grade">
        {#each lista as linha (linha.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="linha context #show_drawer" class:on={aberto === linha.id} role="button" tabindex="-1" data-show={linha.id} data-menu-titulo={linha.nome} data-title="Botão direito: editar, mostrar agora…" on:click={() => openShow(linha.id)}>
                <!-- 26/nov: sem a categoria repetida embaixo de cada nome (a arvore ja diz qual e); passar o mouse mostra -->
                <div class="nome" title={nomeDaCategoria(linha.categoria)}>
                    <span class="t">{linha.nome}</span>
                    {#if cantorDe(linha.id)}<span class="cantor" data-acao="biblioteca-cantor">{cantorDe(linha.id)}</span>{/if}
                </div>
                {#if linha.semLetra}<span class="selo aviso">sem letra</span>{/if}
                {#if noCulto.has(linha.id)}<span class="selo">no roteiro</span>{/if}
                <button class="mais" aria-disabled={!!motivo} aria-label="Adicionar ao roteiro" data-title={motivo || "Adicionar ao fim do roteiro"} tabindex="-1" on:mousedown|preventDefault on:click|stopPropagation={() => mais(linha.id)}>＋ roteiro</button>
                {#if $tela === "mostrar"}
                    <button class="tocar" class:travada={$outLocked} aria-disabled={$outLocked} aria-label="Adicionar ao roteiro e mandar ao ar" data-acao="biblioteca-tocar" data-title={$outLocked ? MOTIVO_TRAVADA : "Adicionar ao roteiro e mandar o primeiro slide ao ar"} tabindex="-1" on:mousedown|preventDefault on:click|stopPropagation={() => tocar(linha.id)}>▶</button>
                {/if}
            </div>
        {/each}
    </div>
{:else}
    <p class="vazio" data-acao="biblioteca-vazia">{textoVazio({ tipo: "musicas", filtrando })}</p>
{/if}
{#if termoWeb.length > 1}
    <button class="web" data-acao="biblioteca-procurar-web" on:mousedown|preventDefault on:click={procurarNaInternet}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zM8 8H5.1a8 8 0 0 1 4.3-3.6C8.8 5.5 8.3 6.7 8 8zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4z" /></svg>
        Procurar a letra de "{termoWeb}" na internet
    </button>
{/if}

<style>
    /* 26/nov: linhas de 30 px; "＋ roteiro" e ▶ so aparecem ao passar o mouse e na musica aberta (o resto da lista fica so com nomes) */
    .grade {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        column-gap: 16px;
        padding: 4px 0;
    }
    .linha {
        min-height: 30px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 4px 0 8px;
        border-radius: 5px;
        cursor: pointer;
        content-visibility: auto;
        contain-intrinsic-size: 30px;
    }
    .linha .mais,
    .linha .tocar {
        visibility: hidden;
    }
    .linha:hover .mais,
    .linha:hover .tocar,
    .linha.on .mais,
    .linha.on .tocar {
        visibility: visible;
    }
    .linha:hover,
    .linha.on {
        background: var(--luz-campo);
    }
    .nome {
        flex-grow: 1;
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: 6px;
    }
    /* o nome tem prioridade: so encolhe (com reticencias) quando sozinho ja nao cabe; o cantor some antes */
    .nome .t {
        flex: 0 0 auto;
        max-width: 100%;
    }
    /* cabine 27/nov: o cantor ao lado, discreto (menor e apagado); quando falta espaco, ele encolhe antes do nome */
    .cantor {
        flex: 0 100 auto;
        min-width: 0;
        font-size: var(--luz-fs-selo);
        color: var(--luz-mudo);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    /* modo "Lista com detalhes" */
    .tabela {
        display: flex;
        flex-direction: column;
        padding: 0 0 4px;
    }
    .cabT {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 26px;
        padding: 0 4px 0 8px;
        background: var(--luz-fundo, var(--primary-darkest));
        border-bottom: 1px solid var(--luz-linha);
        font-size: var(--luz-fs-selo);
        color: var(--luz-mudo);
    }
    .cabT button.c {
        border: none;
        background: transparent;
        padding: 0;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
    }
    .cabT button.c:hover,
    .cabT .ativa {
        color: var(--luz-texto);
    }
    .cabT i {
        font-style: normal;
        font-size: var(--luz-fs-micro);
    }
    .lin {
        gap: 8px;
    }
    .c {
        flex: none;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .lin .c {
        font-size: var(--luz-fs-nome);
        color: var(--luz-mudo);
    }
    .c-nome {
        flex: 3 1 0;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .lin .c-nome {
        color: var(--luz-texto);
    }
    .c-nome .t {
        min-width: 0;
    }
    .c-cantor {
        flex: 2 1 0;
    }
    .c-cat {
        flex: 1.4 1 0;
    }
    .c-usado,
    .c-criado {
        width: 92px;
    }
    .c-acoes {
        width: 118px;
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        overflow: visible;
    }
    .t {
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .selo {
        flex-shrink: 0;
        white-space: nowrap;
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--luz-trilho);
        color: var(--luz-mudo);
    }
    .selo.aviso {
        color: var(--luz-laranja);
    }
    .mais {
        height: 24px;
        padding: 0 8px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        color: var(--luz-texto);
    }
    .tocar {
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        color: var(--luz-texto);
    }
    .tocar:hover {
        background: var(--luz-hover);
        border-color: var(--luz-borda-forte);
    }
    .tocar.travada {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .mais[aria-disabled="true"] {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .web {
        align-self: flex-start;
        width: auto;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 30px;
        margin: 8px;
        padding: 0 12px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .web:hover {
        background: var(--luz-hover);
    }
    .web svg {
        width: 15px;
        height: 15px;
        fill: var(--luz-texto);
        opacity: 0.8;
    }
    .vazio {
        margin: 12px 8px;
        font-size: 12px;
        color: var(--luz-mudo);
    }
</style>
