<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../IPC/main"
    import { activeDrawerTab, drawerTabsData, media, mediaFolders, mediaTags, providerConnections, special } from "../../../stores"
    import { tela } from "../../../utils/aliancaTela"
    import { criarPasta } from "../../../utils/aliancaPastasMidia"
    import { membros, pastas } from "../../../utils/aliancaPastasMidiaEstado"
    import { PASTA_SIRVO, abaDaPasta, pastaDaMidia } from "../../../utils/aliancaPastasMidiaLogica"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { addDrawerFolder } from "../../helpers/dropActions"
    import { countFolderMediaItems, getExtension, isMediaExtension } from "../../helpers/media"
    import AliancaLinhaAdd from "./AliancaLinhaAdd.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("media")
    $: readOnly = profile.global === "read"

    // C6: com Audio (filho de Midia) aberto, nenhuma pasta fica marcada nem a 1a e escolhida sozinha
    $: activeSubTab = $activeDrawerTab === "media" ? $drawerTabsData.media?.activeSubTab || "" : "__fora__"

    $: foldersList = keysToID($mediaFolders)
    $: favoritesListLength = Object.values($media).filter((a) => !a.audio && a.favourite).length

    let allCount = 0
    let arquivosDaRaiz: string[] = []
    let folderLengths: { [key: string]: number } = {}
    $: if (foldersList.length) getCounts()
    async function getCounts() {
        const folderPaths = foldersList.map((a) => a.path || "")
        const data = keysToID((await requestMain(Main.READ_FOLDER, { path: folderPaths })) || {})
        const newFolderLengths: { [key: string]: number } = {}
        allCount = 0

        folderPaths.forEach((folderPath) => {
            const count = countFolderMediaItems(folderPath, data)
            newFolderLengths[folderPath] = count.folder + count.video + count.image
            allCount += count.video + count.image
        })

        folderLengths = newFolderLengths
        arquivosDaRaiz = Object.values(data)
            .filter((a: any) => !a.isFolder && isMediaExtension(getExtension(a.name)))
            .map((a: any) => a.path)
    }

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
    $: if ($providerConnections) getProviders()
    function getProviders() {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            if (!allProviders) return
            contentProviders = allProviders.filter((p) => p.hasContentLibrary && $providerConnections[p.providerId])
        })
    }

    $: if ($providerConnections) {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            if (!allProviders) return
            contentProviders = allProviders.filter((p) => p.hasContentLibrary && $providerConnections[p.providerId])
        })
    }

    $: curriculumProviders = contentProviders.filter((a) => (a.providerId !== "churchApps" || $special.churchAppsCloudOnly !== true) && a.providerId !== "canva")

    let sections: any[] = []
    $: sections = [
        secaoPastas,
        [{ id: "favourites", label: "category.favourites", icon: "star", count: favoritesListLength, hidden: !favoritesListLength && activeSubTab !== "favourites" }],
        ...(curriculumProviders.length ? [[{ id: "TITLE", label: "Curriculum" }, ...curriculumProviders.map((a) => ({ id: a.providerId, label: a.displayName, icon: "web" }))]] : []),
        convertToButton(foldersList, folderLengths)
    ]

    function convertToButton(categories: any[], lengths: { [key: string]: number }) {
        return sortObject(categories, "name").map((a) => {
            const type = a.mediaType
            const option = type ? { title: `clock.type: <b>preview.${type}</b>`, icon: `type_${type}`, style: "opacity: 0.6;" } : null
            return { id: a.id, label: a.name, icon: a.icon || "folder", option, count: lengths[a.path], boxedIcon: true }
        })
    }

    const PICK_ID = uid()
    function addFolder() {
        sendMain(Main.OPEN_FOLDER, { channel: PICK_ID })
    }
    let listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
        if (data.channel !== PICK_ID || !data.path) return
        addDrawerFolder(data, "media")
    })
    onDestroy(() => destroyMain(listenerId))

    function updateName(e: any) {
        const { id, value } = e.detail
        mediaFolders.update((a) => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} extra={["all", "__fora__", "inputs", "online", "pasta:raiz"]} on:rename={updateName}>
    <div slot="section_0">
        {#if $tela !== "mostrar"}
            <AliancaLinhaAdd rotulo="pasta de mídia" titulo="Nova pasta de mídia" desligada={readOnly} on:click={novaPasta} />
        {/if}
    </div>
</NavigationSections>
<!-- C6: "＋ pasta" (pasta do sistema) e uma linha quieta no fim das pastas -->
<AliancaLinhaAdd rotulo="pasta" titulo="Adicionar uma pasta do computador" desligada={readOnly} on:click={addFolder} />
