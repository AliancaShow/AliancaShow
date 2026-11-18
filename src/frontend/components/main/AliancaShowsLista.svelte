<script lang="ts">
    // Leiaute v2, biblioteca: a lista da pasta Shows (musicas e apresentacoes), em colunas de 320 px, linha de 44 px com "＋ roteiro".
    // A logica de listar/filtrar/buscar e a de AliancaBiblioteca (Preparar): `listarBiblioteca` + `showSearch`. Clicar na linha ABRE o show no
    // centro (nao vai ao ar); "＋ roteiro" poe no fim do culto (uma entrada de historico). Chips e busca moram no cabecalho do painel.
    import { onDestroy } from "svelte"
    import { activeProfile, activeProject, outLocked, activeShow, categories, editingProjectTemplate, projects, shows, showsCache, textCache } from "../../stores"
    import { motivoSemCulto } from "../../utils/aliancaGaveta"
    import { porShowNoFim } from "../../utils/aliancaBiblioteca"
    import { buscaDaBiblioteca, soSemLetraNaBiblioteca, tipoDaBiblioteca } from "../../utils/aliancaBibliotecaEstado"
    import { idsNoCulto, listarBiblioteca, textoVazio, type LinhaDaBiblioteca } from "../../utils/aliancaBibliotecaLogica"
    import { categoriasDeMusica, ehSemLetra } from "../../utils/aliancaSemLetraLogica"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { formatSearch, showSearch } from "../../utils/search"
    import { openShow } from "../helpers/show"
    import { tela } from "../../utils/aliancaTela"
    import { MOTIVO_TRAVADA, tocarShowNoAr } from "../../utils/aliancaTocarNoAr"

    export let firstMatch: null | { id: string } = null

    $: acesso = ($activeProfile ? getAccess("shows") : {}) as { [categoria: string]: string | undefined }
    $: musicasCat = categoriasDeMusica($categories as Parameters<typeof categoriasDeMusica>[0])
    $: ehSemLetraDe = (id: string) => {
        const s = $shows[id]
        return !!s && ehSemLetra({ ehMusica: musicasCat.has(s.category || ""), carregado: $showsCache[id], textoDoCache: $textCache[id] })
    }
    $: base = listarBiblioteca({ shows: $shows, categorias: $categories, acesso, tipo: $tipoDaBiblioteca, soSemLetra: $soSemLetraNaBiblioteca, ehSemLetraDe })
    $: noCulto = idsNoCulto($projects, $activeProject, !!$editingProjectTemplate)

    let lista: LinhaDaBiblioteca[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    $: filtrando = $buscaDaBiblioteca.trim().length > 1 || $soSemLetraNaBiblioteca
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
    $: firstMatch = lista[0] ? { id: lista[0].id } : null
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
    // ▶: entra no roteiro E o primeiro slide vai ao ar (so em Mostrar; em Editar a biblioteca nunca toca o telao)
    function tocar(id: string) {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        void tocarShowNoAr(id)
    }
</script>

{#if lista.length}
    <div class="grade">
        {#each lista as linha (linha.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="linha context #show_drawer" class:on={aberto === linha.id} role="button" tabindex="-1" data-show={linha.id} data-menu-titulo={linha.nome} data-title="Botão direito: editar, mostrar agora…" on:click={() => openShow(linha.id)}>
                <div class="nome">
                    <span class="t">{linha.nome}</span>
                    <span class="s">{nomeDaCategoria(linha.categoria)}</span>
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
    <p class="vazio">{textoVazio({ tipo: $tipoDaBiblioteca, filtrando })}</p>
{/if}

<style>
    .grade {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        column-gap: 16px;
    }
    .linha {
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 8px;
        border-bottom: 1px solid var(--luz-linha);
        cursor: pointer;
        content-visibility: auto;
        contain-intrinsic-size: 44px;
    }
    .linha:hover,
    .linha.on {
        background: var(--luz-campo);
    }
    .nome {
        flex-grow: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }
    .t {
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .s {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .selo {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--luz-trilho);
        color: var(--luz-mudo);
    }
    .selo.aviso {
        color: var(--luz-laranja);
    }
    .mais {
        height: 32px;
        padding: 0 10px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        color: var(--luz-texto);
    }
    .tocar {
        width: 32px;
        height: 32px;
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
    .vazio {
        margin: 12px 8px;
        font-size: 12px;
        color: var(--luz-mudo);
    }
</style>
