<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../IPC/main"
    import { drawerTabsData, labelsDisabled, media, mediaFolders, mediaTags, modoAlianca, providerConnections, special } from "../../../stores"
    import { criarPasta } from "../../../utils/aliancaPastasMidia"
    import { membros, pastas } from "../../../utils/aliancaPastasMidiaEstado"
    import { PASTA_RAIZ, PASTA_SIRVO, abaDaPasta, pastaDaMidia } from "../../../utils/aliancaPastasMidiaLogica"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { addDrawerFolder } from "../../helpers/dropActions"
    import Icon from "../../helpers/Icon.svelte"
    import { countFolderMediaItems, getExtension, isMediaExtension } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("media")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.media?.activeSubTab || ""

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

    // AliancaShow F7: a raiz "Midias" e as pastas (etiquetas). A raiz e o 1o nivel das pastas do sistema menos o que ja esta numa pasta
    $: raizCount = arquivosDaRaiz.filter((p) => !pastaDaMidia($media[p]?.tags, $mediaTags)).length
    $: secaoPastas = [{ id: "TITLE", label: "Pastas" }, { id: PASTA_RAIZ, label: "Mídias", icon: "media", count: raizCount }, ...$pastas.map((p) => ({ id: abaDaPasta(p.id), label: p.tag.name || "Pasta", icon: "folder", count: ($membros[p.id] || []).length, boxedIcon: true })), { id: PASTA_SIRVO, label: "Do Sirvo", icon: "web" }]

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
        [
            { id: "all", label: "category.all", icon: "all", count: allCount },
            { id: "favourites", label: "category.favourites", icon: "star", count: favoritesListLength, hidden: !favoritesListLength && activeSubTab !== "favourites" }
        ],
        ...(curriculumProviders.length ? [[{ id: "TITLE", label: "Curriculum" }, ...curriculumProviders.map((a) => ({ id: a.providerId, label: a.displayName, icon: "web" }))]] : []),
        [{ id: "inputs", label: "emitters.inputs", icon: "input" }, "SEPARATOR", { id: "online", label: "media.online", icon: "web" }].filter(Boolean),
        [{ id: "TITLE", label: "media.folders" }, ...convertToButton(foldersList, folderLengths)]
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

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_0" style="padding: 8px;">
        {#if $modoAlianca === "preparar"}
            <MaterialButton style="width: 100%;" title="Nova pasta de mídia" variant="outlined" disabled={readOnly} on:click={novaPasta} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}Nova pasta{/if}
            </MaterialButton>
        {/if}
    </div>
    <div slot="section_3" style="{!curriculumProviders.length ? 'padding: 8px;' : ''}{foldersList.length && !curriculumProviders.length ? 'padding-top: 12px;' : ''}">
        {#if !curriculumProviders.length}
            <MaterialButton style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
            </MaterialButton>
        {/if}
    </div>
    <div slot="section_4" style="padding: 8px;{foldersList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
            <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
