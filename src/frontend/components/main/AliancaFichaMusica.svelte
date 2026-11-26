<script lang="ts">
    // AliancaShow (26/nov, cabine: "senti falta de renomear, escolher a categoria, aplicar modelo; o que faco quando termino?"):
    // a ficha da musica no topo da coluna de slides do Editar: categoria, modelo de todos os slides e, so em rascunho
    // do Sirvo, a faixa com "Revisada": a musica sai de Novas do Sirvo para a categoria de musica (a montagem do Sirvo troca o aviso do
    // roteiro pela musica). O titulo se edita no cabecalho do centro (AliancaEditarCentro). Tudo pelo historico (Ctrl+Z desfaz): SHOWS para nome/categoria (o mesmo do ShowButton e do arrastar para a
    // categoria), TEMPLATE para o modelo (o mesmo do "Aplicar" de AliancaModeloCabecalho).
    import { activeEdit, activeProject, activeShow, categories, projects, refreshEditSlide, shows, showsCache, templates } from "../../stores"
    import { destinoDaRevisao, ehRascunhoDoSirvo, opcoesDeCategoria, trocarAvisoPelaMusica } from "../../utils/aliancaFichaLogica"
    import { categoriaDeMusicaNova } from "../../utils/aliancaVarias"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { newToast } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { keysToID, sortByName } from "../helpers/array"
    import { history, historyAwait } from "../helpers/history"
    import { _show } from "../helpers/shows"
    import AliancaEscolha from "../settings/AliancaEscolha.svelte"

    export let showId: string
    export let travado = false

    $: info = $shows[showId]
    $: categoria = info?.category || ""
    $: rascunho = ehRascunhoDoSirvo(categoria)
    $: cats = opcoesDeCategoria($categories as any, categoria, (k) => translateText(k))
    $: nomeDaCat = (id: string | null) => cats.find((c) => c.id === id)?.nome || ""
    $: destino = destinoDaRevisao(categoriaDeMusicaNova(), $categories as any)
    $: modelos = sortByName(keysToID($templates as any).filter((t: any) => t?.settings?.mode !== "text")).map((t: any) => ({ id: t.id, nome: t.name || "Sem nome" }))
    $: modeloAtual = (($showsCache[showId]?.settings as any)?.template as string) || ""

    // ----- categoria -----
    function mudarCategoria(nova: string, aviso = "") {
        if (travado || !info || nova === categoria) return
        historyAwait([showId], { id: "SHOWS", newData: { data: [{ id: showId, show: { category: nova || null } }], replace: true }, location: { page: "drawer" } })
        if (aviso) newToast(aviso)
    }
    function revisada() {
        if (!destino) return newToast("Crie uma categoria de música antes (biblioteca, ＋ categoria)")
        mudarCategoria(destino, `Revisada: "${info?.name || "música"}" foi para ${nomeDaCat(destino) || "a biblioteca"}`)
        // o aviso do roteiro aberto vira a musica ja (a montagem do Sirvo so roda conectada; quando rodar, encontra o mesmo item)
        const pid = $activeProject
        const nova = pid ? trocarAvisoPelaMusica(($projects[pid]?.shows || []) as any[], showId) : null
        if (pid && nova) history({ id: "UPDATE", newData: { key: "shows", data: nova }, oldData: { id: pid }, location: { page: "show", id: "project_key" } })
    }

    // ----- modelo (todos os slides) -----
    function aplicarModelo(id: string) {
        if (travado || id === modeloAtual) return
        try {
            // o TEMPLATE do FreeShow le a musica do activeShow na hora
            if ($activeShow?.id !== showId) activeShow.set({ ...($activeShow || {}), id: showId, type: "show" } as any)
            if (id) {
                history({ id: "TEMPLATE", newData: { id, data: { createItems: true } }, location: { page: "none", override: "show#" + showId } })
                _show(showId).set({ key: "settings.aliancaModeloColado", value: id })
            } else {
                _show(showId).set({ key: "settings.template", value: null })
                _show(showId).set({ key: "settings.aliancaModeloColado", value: "" })
            }
            activeEdit.set({ ...($activeEdit as any), type: "show", showId, items: [] } as any)
            refreshEditSlide.set(true)
        } catch (erro) {
            falhaAlta("ficha-modelo", erro)
        }
    }
</script>

{#if info}
    <div class="ficha" data-acao="ficha-musica">
        {#if rascunho}
            <div class="rascunho" data-title="A letra veio do Sirvo. Confira os slides e marque como revisada: ela sai de Novas do Sirvo e entra no roteiro.">
                <span class="marca">✎</span>
                <span class="txt">Rascunho do Sirvo</span>
                <button type="button" class="revisada" disabled={travado} data-acao="ficha-revisada" data-title={destino ? `Passa para ${nomeDaCat(destino)}` : "Sem categoria de música"} on:click={revisada}>✓ Revisada</button>
            </div>
        {/if}
        <div class="linha">
            <div class="esc" data-acao="ficha-categoria">
                <AliancaEscolha rotulo="Categoria" valor={categoria} opcoes={cats} neutra={{ id: "", nome: "Sem categoria" }} on:escolher={(e) => mudarCategoria(e.detail)} />
            </div>
            <div class="esc" data-acao="ficha-modelo">
                <AliancaEscolha rotulo="Modelo" valor={modeloAtual} opcoes={modelos} neutra={{ id: "", nome: "Sem modelo" }} on:escolher={(e) => aplicarModelo(e.detail)} />
            </div>
        </div>
    </div>
{/if}

<style>
    .ficha {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 0 12px 8px;
    }
    .rascunho {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 6px 6px 10px;
        border: 1px solid var(--luz-laranja-borda);
        border-radius: 6px;
        background: var(--luz-laranja-lavagem);
        font-size: 12px;
    }
    .marca {
        color: var(--luz-laranja);
    }
    .txt {
        flex: 1;
    }
    .revisada {
        height: 26px;
        padding: 0 10px;
        border: 0;
        border-radius: 6px;
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
    }
    .revisada:hover {
        background: #fff;
    }
    .revisada:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .linha {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .esc {
        min-width: 0;
    }
</style>
