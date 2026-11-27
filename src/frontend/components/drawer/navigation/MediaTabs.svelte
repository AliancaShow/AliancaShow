<script lang="ts">
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activeDrawerTab, activePage, drawerTabsData, media, providerConnections, special } from "../../../stores"
    import { tela } from "../../../utils/aliancaTela"
    import { criarPasta } from "../../../utils/aliancaPastasMidia"
    import { membros, pastas } from "../../../utils/aliancaPastasMidiaEstado"
    import { PASTA_SIRVO, abaDaPasta, idDaAba } from "../../../utils/aliancaPastasMidiaLogica"
    import { importarSoltos, migrarPastasDoDisco } from "../../../utils/aliancaBibliotecaMidia"
    import { getAccess } from "../../../utils/profile"
    import AliancaLinhaAdd from "./AliancaLinhaAdd.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("media")
    $: readOnly = profile.global === "read"

    // C6: com Audio (filho de Midia) aberto, nenhuma pasta fica marcada nem a 1a e escolhida sozinha
    $: activeSubTab = $activeDrawerTab === "media" ? $drawerTabsData.media?.activeSubTab || "" : "__fora__"

    $: favoritesListLength = Object.values($media).filter((a) => !a.audio && a.favourite).length

    // cabine-5 (André, 19/nov): as pastas do computador (mediaFolders) saem da árvore; cada uma vira categoria UMA vez, ao abrir a Mídia
    // Nunca com Configuracoes aberta: o rascunho de Configuracoes contaria a migracao como "alteracao nao salva" e o Descartar a desfaria pela metade
    $: if ($activePage !== "settings") migrarPastasDoDisco()

    // AliancaShow F7: as pastas (etiquetas). C6: sem o rotulo "Pastas de midia" e sem a linha "Midias" (clicar na raiz Midia e "todas as midias")
    $: secaoPastas = [...$pastas.map((p) => ({ id: abaDaPasta(p.id), label: p.tag.name || "Pasta", icon: "folder", count: ($membros[p.id] || []).length, boxedIcon: true })), { id: PASTA_SIRVO, label: "Do Sirvo", icon: "web" }]

    function novaPasta() {
        const id = criarPasta()
        drawerTabsData.update((a) => {
            if (!a.media) a.media = { enabled: true, activeSubTab: abaDaPasta(id) }
            a.media.activeSubTab = abaDaPasta(id)
            return a
        })
    }

    // Content providers with libraries, and are currently connected
    let contentProviders: { providerId: ContentProviderId; displayName: string; hasContentLibrary: boolean }[] = []
    $: if ($providerConnections) {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            if (!allProviders) return
            contentProviders = allProviders.filter((p) => p.hasContentLibrary && $providerConnections[p.providerId])
        })
    }

    $: curriculumProviders = contentProviders.filter((a) => (a.providerId !== "churchApps" || $special.churchAppsCloudOnly !== true) && a.providerId !== "canva")

    let sections: any[] = []
    $: sections = [secaoPastas, [{ id: "favourites", label: "category.favourites", icon: "star", count: favoritesListLength, hidden: !favoritesListLength && activeSubTab !== "favourites" }], ...(curriculumProviders.length ? [[{ id: "TITLE", label: "Curriculum" }, ...curriculumProviders.map((a) => ({ id: a.providerId, label: a.displayName, icon: "web" }))]] : [])]

    // cabine-5: arquivo/pasta solto do Explorer na árvore: na categoria sob o cursor, ou na raiz. Pasta vira categoria.
    // Pára aqui (o DropArea "navigation" criaria uma pasta do disco escondida)
    function arrastando(e: DragEvent) {
        if (!e.dataTransfer?.types?.includes("Files")) return
        e.preventDefault()
    }
    function soltar(e: DragEvent) {
        const arquivos = Array.from(e.dataTransfer?.files || [])
        if (!arquivos.length) return
        e.preventDefault()
        e.stopPropagation()
        if (readOnly) return
        const caminhos = arquivos.map((f) => (window as any).api.showFilePath(f)).filter(Boolean)
        const aba = (e.target instanceof Element ? (e.target.closest("[data-aba]") as HTMLElement | null) : null)?.dataset.aba || ""
        const categoria = aba === PASTA_SIRVO ? null : idDaAba(aba)
        importarSoltos(caminhos, categoria)
    }
</script>

<div class="bib" on:dragover={arrastando} on:drop={soltar}>
    <NavigationSections {sections} active={activeSubTab} extra={["all", "__fora__", "inputs", "online", "pasta:raiz"]} padrao="all">
        <div slot="section_0">
            {#if $tela !== "mostrar"}
                <AliancaLinhaAdd rotulo="categoria" titulo="Nova categoria de mídia" desligada={readOnly} on:click={novaPasta} />
            {/if}
        </div>
    </NavigationSections>
    <!-- barra uniforme (26/nov): "importar mídia" saiu daqui para o ＋ do cabecalho (AliancaMidiaBarra) -->
</div>
