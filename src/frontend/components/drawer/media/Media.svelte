<script lang="ts">
    import { gavetaNaoToca } from "../../../utils/aliancaGavetaToque"
    import { soRetornoLigado } from "../../../utils/aliancaSoRetorno"
    import { get } from "svelte/store"
    import { uid } from "uid"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import type { ClickEvent, FileFolder } from "../../../../types/Main"
    import { requestMain } from "../../../IPC/main"
    import { addProjectItem } from "../../../converters/project"
    import { activeDrawerTab, activeEdit, activeFocus, activeMediaTagFilter, activePopup, activeShow, audioFolders, cloudSyncData, drawerTabsData, focusMode, labelsDisabled, media, mediaFolders, mediaOptions, mediaTags, openedMediaFolders, outLocked, outputs, popupData, providerConnections, selectAllMedia, selected, sorted, special, styles } from "../../../stores"
    import { tela } from "../../../utils/aliancaTela"
    import { teclaIgnorada } from "../../../utils/aliancaModo"
    import { membros, pastaParaConfigurar } from "../../../utils/aliancaPastasMidiaEstado"
    import { PASTA_RAIZ, PASTA_SIRVO, ehAbaDePasta, idDaAba, pastaDaMidia } from "../../../utils/aliancaPastasMidiaLogica"
    import { caminhosDaRaiz } from "../../../utils/aliancaBibliotecaMidiaLogica"
    import { importarSoltos } from "../../../utils/aliancaBibliotecaMidia"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortFilenames } from "../../helpers/array"
    import { splitPath } from "../../helpers/get"
    import { countFolderMediaItems, getExtension, getFileName, getMediaLayerType, getMediaStyle, getMediaType, isMediaExtension, removeExtension } from "../../helpers/media"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import { estiloDock } from "../../../utils/aliancaDock"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import VirtualList from "../VirtualList.svelte"
    import AudioFile from "../audio/AudioFile.svelte"
    import BMDStreams from "../live/BMDStreams.svelte"
    import { tocavelLista } from "../tocavel"
    import Cameras from "../live/Cameras.svelte"
    import NDIStreams from "../live/NDIStreams.svelte"
    import Screens from "../live/Screens.svelte"
    import Windows from "../live/Windows.svelte"
    import PlayerVideos from "../player/PlayerVideos.svelte"
    import CLogo from "./CLogo.svelte"
    import Canva from "./Canva.svelte"
    import ContentLibraryBrowser from "./ContentLibraryBrowser.svelte"
    import AliancaMidiaListaCab from "./AliancaMidiaListaCab.svelte"
    import { compararPorData, infoDeMidia, pedirVarios } from "../../../utils/aliancaMidiaInfo"
    import AliancaPastaCfg from "./AliancaPastaCfg.svelte"
    import Folder from "./Folder.svelte"
    import Media from "./MediaCard.svelte"
    import MediaGrid from "./MediaGrid.svelte"

    export let active: string | null
    export let searchValue = ""
    export let streams: MediaStream[] = []

    // leiaute v2: colunas pela largura (cartao de 150 px no zoom padrao 5, como o `auto-fill, minmax(150px, 1fr)` do prototipo); o zoom do cabecalho muda esse minimo
    let larguraGrade = 1000
    $: colunasAuto = Math.max(1, Math.floor(larguraGrade / (830 / ($mediaOptions.columns || 5))))
    const setView = (v: any) => mediaOptions.update((a) => ({ ...a, view: v }))

    let prevActiveSubTab = active
    $: if (active !== prevActiveSubTab) {
        if (active !== "online") setView("all")
        if (prevActiveSubTab) {
            openedMediaFolders.update((a) => {
                delete a[prevActiveSubTab!]
                return a
            })
        }
        prevActiveSubTab = active
    }

    // type File = { path: string; favourite: boolean; name: string; extension: string; audio: boolean; folder?: boolean; stat?: any }
    // let files: File[] = []

    // AliancaShow F7: as vistas "pasta:*" (a raiz "Midias", cada pasta-etiqueta e "Do Sirvo")
    $: ehPastaView = ehAbaDePasta(active)
    $: ehTodos = active === "all" || active === PASTA_RAIZ
    $: pastaId = idDaAba(active)
    $: tagDaPasta = pastaId ? $mediaTags[pastaId] : null
    // cabine 27/nov: o resumo diz tambem o ajuste na tela (quando a categoria pede um)
    const NOME_DO_AJUSTE: { [k: string]: string } = { contain: "encaixar", cover: "preencher", fill: "esticar", blur: "fundo desfocado" }
    $: resumoDaPasta = tagDaPasta?.aliancaPasta ? (tagDaPasta.aliancaPasta.fim === "repetir" ? "repete" : "para no último quadro") + " · " + (tagDaPasta.aliancaPasta.camada === "frente" ? "frente" : "fundo") + (tagDaPasta.aliancaPasta.ajuste && NOME_DO_AJUSTE[tagDaPasta.aliancaPasta.ajuste] ? " · " + NOME_DO_AJUSTE[tagDaPasta.aliancaPasta.ajuste] : "") : ""
    let audiosDaPasta: { path: string; name: string }[] = []
    let cfgAberta = false
    let cfgDe = ""
    $: if ((pastaId || "") !== cfgDe) {
        cfgDe = pastaId || ""
        cfgAberta = false
    }
    $: if (pastaId && $pastaParaConfigurar === pastaId) {
        cfgAberta = true
        pastaParaConfigurar.set(null)
    }
    const listaFixa = () => ehTodos || active === "favourites" || ehPastaView

    let specialTabs = ["online", "inputs"]
    $: isProviderSection = contentProviders.some((p) => p.providerId === active)
    $: notFolders = ["all", ...specialTabs, ...contentProviders.map((p) => p.providerId)]
    $: isLocalFolder = !!(active && $mediaFolders[active])
    $: rootPath = isLocalFolder ? $mediaFolders[active!]?.path || "" : ""

    let path = ""
    let prevActiveFolder = ""
    $: if (active !== prevActiveFolder || rootPath) {
        prevActiveFolder = active || ""
        if (!isLocalFolder) {
            path = ""
        } else {
            const saved = active ? $openedMediaFolders[active] : ""
            path = saved && rootPath && saved.startsWith(rootPath) ? saved : rootPath
        }
    }

    $: if (isLocalFolder && active) {
        openedMediaFolders.update((a) => {
            if (path && rootPath && path !== rootPath && path.startsWith(rootPath)) a[active!] = path
            else if (a[active!]) delete a[active!]
            return a
        })
    }

    $: folderName = active === "all" || ehPastaView ? "category.all" : active === "favourites" ? "category.favourites" : rootPath === path ? (active !== null ? $mediaFolders[active]?.name || "" : "") : splitPath(path).name

    function setSubSubTab(id: string) {
        if (!active) return

        drawerTabsData.update((a) => {
            if (!a.media) a.media = { enabled: true, activeSubTab: active }
            if (!a.media.openedSubSubTab) a.media.openedSubSubTab = {}
            a.media.openedSubSubTab[active] = id
            return a
        })

        if (active === "inputs") inputsTab = id
        else if (active === "online") onlineTab = id
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

    $: activeProviderId = (isProviderSection && active ? active : null) as ContentProviderId | null

    let inputsTab = $drawerTabsData.media?.openedSubSubTab?.cameras || "cameras"
    let onlineTab = $drawerTabsData.media?.openedSubSubTab?.online || "youtube"

    let prevActive: null | string = null
    let prevTab = ""
    $: if (active || path) updateContent()
    async function updateContent() {
        if (prevActive === "online" && active !== "online") setView("all")
        if (active !== "online") prevTab = ""

        if (active === "online") {
            if (onlineTab !== prevTab) setView("image")
            prevTab = onlineTab

            prevActive = active
        } else if (active === "favourites") {
            prevActive = active

            allRelevantFiles = keysToID($media)
                .filter((a) => a.favourite === true && a.audio !== true)
                .map((a) => {
                    return { isFolder: false, path: a.id, name: getFileName(a.id), stats: {} as any }
                })

            openFolder("favourites")
        } else if (ehPastaView && active !== PASTA_RAIZ) {
            prevActive = active
            carregarPasta()
        } else if (ehTodos) {
            if (active === prevActive) return
            prevActive = active

            // cabine-5 (André, 19/nov): a raiz "Mídia" é a BIBLIOTECA sem categoria — não lê mais as pastas do disco
            carregarRaiz()
        } else if (path?.length) {
            if (path === prevActive) return
            prevActive = path

            requestFiles(path, 0, true)
        } else {
            // screens && cameras
            prevActive = active
        }
    }

    // a pasta-etiqueta: a lista sai do store `media` (independe de onde o arquivo mora); "Do Sirvo" le a pasta do material
    let cargaPasta = 0
    async function carregarPasta() {
        const minha = ++cargaPasta
        let caminhos: string[] = []

        if (active === PASTA_SIRVO) {
            const raizOnline = ((await requestMain(Main.ALIANCA_PASTA_ONLINE, undefined as any)) || "") as string
            if (minha !== cargaPasta) return
            if (raizOnline) {
                const barra = raizOnline.includes("\\") ? "\\" : "/"
                const data = await requestMain(Main.READ_FOLDER, { path: raizOnline + barra + "Sirvo", depth: 3 })
                caminhos = Object.values(data || {})
                    .filter((a: any) => !a.isFolder)
                    .map((a: any) => a.path)
            }
        } else {
            // cabine-5: arquivo que sumiu NAO some da lista: o cartao mostra "arquivo nao encontrado" (offline, C1) — decisao do André
            caminhos = (pastaId ? get(membros)[pastaId] : []) || []
        }
        if (minha !== cargaPasta) return
        listarCaminhos(caminhos)
    }

    // cabine-5: a raiz da biblioteca (na biblioteca e sem categoria); offline aparece como C1, nunca some calado
    function carregarRaiz() {
        ++cargaPasta
        listarCaminhos(caminhosDaRaiz(get(media), get(mediaTags)))
    }

    function listarCaminhos(caminhos: string[]) {
        const arquivos: FileFolder[] = []
        const audios: { path: string; name: string }[] = []
        for (const c of caminhos) {
            const tipo = getMediaType(getExtension(c))
            const nome = getFileName(c)
            if (tipo === "audio") audios.push({ path: c, name: nome })
            else if (tipo === "video" || tipo === "image") arquivos.push({ isFolder: false, path: c, name: nome, stats: {} as any })
        }
        audiosDaPasta = sortFilenames(audios as any) as any
        allRelevantFiles = arquivos
        openFolder("all")
    }

    // alguem entrou ou saiu de uma pasta (mover, desfazer, apagar): refaz so a lista, sem ler o disco de novo
    $: assinaturaPastas = ehPastaView ? JSON.stringify($membros) : ""
    let assinaturaAnterior = ""
    $: if (assinaturaPastas !== assinaturaAnterior) {
        assinaturaAnterior = assinaturaPastas
        if (ehPastaView && prevActive === active) {
            if (active === PASTA_RAIZ) filterFiles()
            else if (active !== PASTA_SIRVO) carregarPasta()
        }
    }

    // cabine-5: importou, tirou ou moveu: a raiz se refaz (sem ler o disco)
    $: assinaturaRaiz = ehTodos ? caminhosDaRaiz($media, $mediaTags).join("|") : ""
    let assinaturaRaizAnterior = ""
    $: if (assinaturaRaiz !== assinaturaRaizAnterior) {
        assinaturaRaizAnterior = assinaturaRaiz
        if (ehTodos && prevActive === active) carregarRaiz()
    }

    // cabine-5: soltar arquivos/pastas do Explorer na grade: entram na categoria aberta, ou na raiz. Pasta vira categoria nova.
    // So "Files" (o arrasto interno de cartoes nao passa por aqui)
    $: podeSoltar = ehTodos || (!!pastaId && active !== PASTA_SIRVO)
    function arrastandoDoComputador(e: DragEvent) {
        if (!podeSoltar || !e.dataTransfer?.types?.includes("Files")) return
        e.preventDefault()
    }
    function soltarDoComputador(e: DragEvent) {
        const soltos = Array.from(e.dataTransfer?.files || [])
        if (!podeSoltar || !soltos.length) return
        e.preventDefault()
        e.stopPropagation()
        const caminhos = soltos.map((f) => (window as any).api.showFilePath(f)).filter(Boolean)
        importarSoltos(caminhos, pastaId)
    }

    let hasAudio = { count: 0, exists: false }
    function openAudioFolder() {
        const tabId = keysToID($audioFolders).find((a) => a.path === path)?.id
        if (!tabId) return

        drawerTabsData.update((a) => {
            if (!a.audio) a.audio = { enabled: true, activeSubTab: tabId }
            else a.audio.activeSubTab = tabId
            return a
        })
        activeDrawerTab.set("audio")
    }
    function createAudioFolder() {
        audioFolders.update((a) => {
            a[uid()] = { name: getFileName(path), icon: "folder", path }
            return a
        })

        openAudioFolder()
    }

    let foldersList: FileFolder[] = []
    let filesList: FileFolder[] = []
    let allRelevantFiles: FileFolder[] = []

    let requesting = 0
    let currentDepth = 0
    async function requestFiles(path: string | string[], depth: number = 0, captureFolderContent: boolean = false) {
        if (!path) return

        currentDepth = depth

        if ($special.optimizedMode || $mediaOptions.mode !== "grid") {
            // depth = 0
            captureFolderContent = false
        }

        requesting++
        let currentRequest = requesting
        const data = await requestMain(Main.READ_FOLDER, { path, depth, captureFolderContent })
        if (!data || requesting !== currentRequest) return

        // check if there's any audio files that the user might want to find
        if (!Array.isArray(path)) {
            const count = countFolderMediaItems(path, Object.values(data))
            const audioFolderExists = !!Object.values($audioFolders).find((a) => a.path === path)
            // only show if existing or more than half are audio files
            if (count.audio && (audioFolderExists || count.audio * 2 > count.video + count.image)) {
                hasAudio = { count: count.audio, exists: audioFolderExists }
            } else {
                hasAudio = { count: 0, exists: false }
            }
        }

        allRelevantFiles = Object.values(data).filter((a) => {
            // remove folders with no content
            if (a.isFolder) return !a.noMedia && a.files.length > 0
            // only image/video files
            return isMediaExtension(getExtension(a.name))
        })

        if ($cloudSyncData.enabled && $special.cloudSyncMediaFolder) {
            const mediaFolderPath = await requestMain(Main.GET_MEDIA_FOLDER_PATH)
            if (path === mediaFolderPath) {
                allRelevantFiles.map((a) => {
                    // remove folderId suffix
                    if (a.name.includes("_")) a.name = a.name.slice(0, a.name.lastIndexOf("_"))
                    return a
                })
            }
        }

        openFolder(ehTodos ? "all" : (path as string))
    }

    function openFolder(path: string) {
        if (path === "all" || path === "favourites") {
            foldersList = []
            filesList = allRelevantFiles.filter((a) => !a.isFolder)

            filterFiles()
            return
        }

        if (searchValue.length > 1) {
            foldersList = allRelevantFiles.filter((a) => a.isFolder)
            filesList = allRelevantFiles.filter((a) => !a.isFolder)

            filterFiles()
            return
        }

        const folder = allRelevantFiles.find((a) => a.isFolder && a.path === path)
        if (!folder) return

        foldersList = allRelevantFiles.filter((a) => a.isFolder && (folder as any).files.includes(a.path))
        filesList = allRelevantFiles.filter((a) => !a.isFolder && (folder as any).files.includes(a.path))

        filterFiles()
    }

    let scrollElem: HTMLElement | undefined

    // arrow selector
    let activeFile: null | number = null
    $: mediaFilesOnly = searchedFiles.filter((a) => !a.isFolder)
    function hightlightActive() {
        if (!Array.isArray(mediaFilesOnly)) return
        const activeShowPath = $activeShow?.type === "image" || $activeShow?.type === "video" ? $activeShow?.id : ""
        const index = mediaFilesOnly.findIndex((a) => a.path === activeShowPath)
        activeFile = index < 0 ? null : index
    }

    $: showUpdate($activeShow)
    function showUpdate(a) {
        if (a?.type !== "video" && a?.type !== "image") activeFile = null
    }

    // filter files
    $: activeView = $mediaOptions.view || "all"
    $: filtroDeTipos = ($drawerTabsData.media?.aliancaFiltro || []) as string[]
    $: filtroChave = (filtroDeTipos || []).join(",")
    $: if (activeView || $activeMediaTagFilter || $sorted || filtroChave !== undefined) filterFiles()
    $: if (searchValue !== undefined) filterSearch()

    let filteredFiles: FileFolder[] = []
    function filterFiles() {
        if (active === "online" || active === "inputs" || isProviderSection) return

        let localFilteredFiles: FileFolder[] = clone(filesList)
        // lido do store na hora (a ordem das declaracoes reativas nao garante `filtroDeTipos` pronto na primeira carga)
        const filtroDeTipos: string[] = get(drawerTabsData).media?.aliancaFiltro || []

        // filter by tag
        if ($activeMediaTagFilter.length) {
            localFilteredFiles = localFilteredFiles.filter((a) => $media[a.path]?.tags?.length && !$activeMediaTagFilter.find((tagId) => !$media[a.path].tags!.includes(tagId)))
        }

        // AliancaShow F7: a raiz "Midias" nao mostra o que ja esta numa pasta
        if (active === PASTA_RAIZ) localFilteredFiles = localFilteredFiles.filter((a) => !pastaDaMidia($media[a.path]?.tags, $mediaTags))

        // AliancaShow F7: filtros Video/Audio/Foto (vazio = tudo)
        if (filtroDeTipos.length) localFilteredFiles = localFilteredFiles.filter((a) => filtroDeTipos.includes(getMediaType(getExtension(a.name))))

        // filter by type
        if (activeView === "folder") {
            localFilteredFiles = clone(foldersList)
        } else if (activeView !== "all") {
            localFilteredFiles = localFilteredFiles.filter((a) => activeView === getMediaType(getExtension(a.name)))
        }

        // reset arrow selector
        hightlightActive()

        // sort
        let sortType = $sorted.media?.type || "name"
        if (sortType === "name") localFilteredFiles = sortFilenames(localFilteredFiles)
        // cabine 26/nov: Z-A de verdade (antes so invertia a ordem em que os arquivos vieram)
        else if (sortType === "name_des") localFilteredFiles = sortFilenames(localFilteredFiles).reverse()
        else if (sortType === "created" || sortType === "created_asc") {
            // cabine 26/nov (coluna "Adicionado" do modo Lista): a biblioteca por categorias nao traz o stat; vem do aliancaMidiaInfo.
            // Faltando data de algum arquivo, pede todas e ordena de novo quando chegarem (uma vez: as que chegaram nao sao pedidas de novo)
            const infos = get(infoDeMidia)
            const semData = localFilteredFiles.filter((a) => !a.isFolder && !a.stats?.birthtimeMs && !(a.path in infos)).map((a) => a.path)
            if (semData.length) pedirVarios(semData).then(() => filterFiles())
            const dataDe = (a: FileFolder) => a.stats?.birthtimeMs || infos[a.path]?.criado || 0
            localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : compararPorData(dataDe(a), dataDe(b), sortType === "created")))
        }
        else if (sortType === "modified") localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : b.stats.mtimeMs - a.stats.mtimeMs))

        // append folders
        if (activeView === "all" && !filtroDeTipos.length) {
            localFilteredFiles = [...sortFilenames(foldersList), ...localFilteredFiles]
        }

        filteredFiles = clone(localFilteredFiles)
        if (searchValue.length < 2) searchedFiles = clone(filteredFiles)
        else filterSearch()

        // scroll to top
        scrollElem?.scrollTo(0, 0)
    }

    // search
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    let searchFilterActive = false
    let searchedFiles: FileFolder[] = []
    async function filterSearch() {
        if (searchFilterActive) return
        searchFilterActive = true

        if (searchValue.length === 1) {
            searchFilterActive = false
            return
        }
        if (searchValue.length < 2) {
            if (!listaFixa()) requestFiles(path, 0, true)
            else searchedFiles = clone(filteredFiles)
            searchFilterActive = false
            return
        }

        if (!listaFixa() && currentDepth < 5) {
            await requestFiles(path, 5)
        }

        searchedFiles = clone(filteredFiles).filter((a) => filter(a.name).includes(filter(searchValue)))

        // scroll to top
        document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)

        searchFilterActive = false
    }

    $: audiosVisiveis = ehPastaView && (!filtroDeTipos.length || filtroDeTipos.includes("audio")) ? audiosDaPasta.filter((a) => searchValue.length < 2 || filter(a.name).includes(filter(searchValue))) : []

    $: fileCount = mediaFilesOnly.length
    const shortcuts = {
        ArrowRight: () => {
            if (activeFile === null || activeFile < fileCount - 1) activeFile = activeFile === null ? 0 : activeFile + 1
        },
        ArrowLeft: () => {
            if (activeFile === null || activeFile > 0) activeFile = activeFile === null ? fileCount - 1 : activeFile - 1
        },
        Backspace: () => {
            if (rootPath === path) return
            goBack()
        },
        // macOS workaround as it mostly ignores the M4/M5 mouse buttons
        // special programs can be used to map these buttons to the following keyboard keys
        "[": () => goBack(),
        "]": () => goForward()
    }

    $: if (activeFile !== null) selectMedia()
    function selectMedia() {
        if (activeFile === null) return

        let path = mediaFilesOnly[activeFile]?.path || ""
        if (!path) return

        activeEdit.set({ id: path, type: "media", items: [] })
        let name = removeExtension(getFileName(path))
        let type = getMediaType(getExtension(path))

        if ($focusMode) activeFocus.set({ id: path, type })
        else activeShow.set({ id: path, name, type })
    }

    function keydown(e: KeyboardEvent) {
        if (!fileCount) return

        if (e.key === "Enter" && searchValue.length > 1 && e.target?.closest(".search")) {
            // let file = mediaFilesOnly[0] // not updating
            let file = searchedFiles.filter((a) => !a.isFolder)[0]
            if (!file) return

            // play
            if (e.ctrlKey || e.metaKey) {
                if (teclaIgnorada()) return
                const currentOutput = getFirstActiveOutput()
                const outputStyle = $styles[currentOutput?.style || ""]
                const mediaStyle = getMediaStyle($media[file.path], outputStyle)

                const videoType = getMediaLayerType(file.path, mediaStyle)

                // clear slide text
                if (videoType === "foreground" && !soRetornoLigado()) clearSlide()

                const type = getMediaType(getExtension(file.path))
                setOutput("background", { path: file.path, ...mediaStyle, type, loop: false, muted: false })
                return
            }

            // add to project
            const data = { id: file.path, name: file.name, type: getMediaType(getExtension(file.name)) }
            addProjectItem(data)

            activeFile = searchedFiles.findIndex((a) => a.path === file.path)
            if (activeFile < 0) activeFile = null
            return
        }

        if (e.target?.closest?.("input") || e.target?.closest?.(".edit") || $activeEdit.items.length) return

        if ((e.ctrlKey || e.metaKey) && shortcuts[e.key]) {
            // e.preventDefault()
            shortcuts[e.key]()
        }
    }

    function mousepress(e: MouseEvent) {
        if (e.button === 3) goBack()
        else if (e.button === 4) goForward()
    }

    let lastPaths: string[] = []
    function goForward() {
        if (lastPaths.length) {
            path = lastPaths.pop() || rootPath
            lastPaths = lastPaths.filter((a) => a.includes(path))
        }
    }

    function goBack(e?: ClickEvent) {
        if (e?.detail.ctrl) {
            lastPaths.push(path)
            path = rootPath
            return
        }

        const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
        const folder = path.slice(0, lastSlash)

        lastPaths.push(path)

        path = folder.length > rootPath.length ? folder || rootPath : rootPath
    }

    // const nextActiveView = { all: "image", folder: "image", image: "video", video: "all" } // all: "folder"
    $: if ((notFolders.includes(active || "") || ehPastaView) && activeView === "folder") setView("image")

    $: currentOutput = getFirstActiveOutput($outputs)

    // select all
    $: if ($selectAllMedia) selectAll()
    function selectAll() {
        let data = searchedFiles
            .filter((a) => !a.isFolder)
            .map((file) => {
                let type = getMediaType(getExtension(file.name))
                return { name: file.name, path: file.path, type, contentProvider: false }
            })

        selected.set({ id: "media", data })
        selectAllMedia.set(false)
    }

    $: pathString = path.replace(rootPath, "").replace(folderName, "").replaceAll("\\", "/").split("/").filter(Boolean).join("/")
</script>

<svelte:window on:keydown={keydown} on:mouseup={mousepress} />

<!-- TABS -->

{#if active === "inputs"}
    <div class="tabs">
        <MaterialButton style="flex: 1;" isActive={inputsTab === "cameras"} on:click={() => setSubSubTab("cameras")}>
            <Icon size={1.2} id="camera" white />
            <p><T id="live.cameras" /></p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={inputsTab === "screens"} on:click={() => setSubSubTab("screens")}>
            <Icon size={1.2} id="screen" white />
            <p><T id="live.screens" /></p>
        </MaterialButton>
        <!-- <MaterialButton style="flex: 1;" isActive={inputsTab === "windows"} on:click={() => setSubSubTab("windows")}>
            <Icon size={1.2} id="window" white />
            <p><T id="live.windows" /></p>
        </MaterialButton> -->
        <MaterialButton style="flex: 1;" isActive={inputsTab === "ndi"} on:click={() => setSubSubTab("ndi")}>
            <Icon size={1.1} id="ndi" white />
            <p>NDI</p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={inputsTab === "blackmagic"} on:click={() => setSubSubTab("blackmagic")}>
            <Icon size={1.2} id="blackmagic" white />
            <p>Blackmagic</p>
        </MaterialButton>
    </div>
{:else if active === "online"}
    <div class="tabs">
        <MaterialButton style="flex: 1;" isActive={onlineTab === "youtube"} on:click={() => setSubSubTab("youtube")}>
            <Icon style={onlineTab === "youtube" ? "fill: #ff0000" : ""} size={1.2} id="youtube" white />
            <p>YouTube</p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={onlineTab === "vimeo"} on:click={() => setSubSubTab("vimeo")}>
            <Icon style={onlineTab === "vimeo" ? "fill: #17d5ff" : ""} size={1.2} id="vimeo" white />
            <p>Vimeo</p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={onlineTab === "canva"} on:click={() => setSubSubTab("canva")}>
            {#if onlineTab === "canva"}
                <CLogo />
            {:else}
                <Icon size={1.2} id="canva" white />
            {/if}
            <p>Canva</p>
        </MaterialButton>
    </div>
{/if}

<!-- AliancaShow F7: a pasta aberta (nome, o que ela faz, ⚙ so no Preparar) -->
{#if ehPastaView && active !== PASTA_RAIZ}
    <div class="pastaTopo" data-pasta-topo>
        <span class="pastaNome">{active === PASTA_SIRVO ? "Do Sirvo" : tagDaPasta?.name || "Pasta"}</span>
        {#if $tela !== "mostrar" && pastaId && tagDaPasta}
            <!-- cabine 27/nov: clicar no resumo abre as propriedades (o mesmo do ⚙) -->
            <button type="button" class="pastaResumo clicavel" data-acao="pasta-resumo" title="Propriedades da categoria" on:click={() => (cfgAberta = !cfgAberta)}>{resumoDaPasta}</button>
        {:else}
            <span class="pastaResumo" title={active === PASTA_SIRVO ? "" : "As propriedades da categoria mudam no Editar"}>{active === PASTA_SIRVO ? "só para ver" : resumoDaPasta}</span>
        {/if}
        {#if $tela !== "mostrar" && pastaId && tagDaPasta}
            <button type="button" class="pastaGear" class:ligado={cfgAberta} data-pasta-gear title="Comportamento da pasta" on:click={() => (cfgAberta = !cfgAberta)}>
                <Icon id="settings" size={1.1} white />
            </button>
        {/if}
    </div>
{/if}

<!-- MAIN -->

<div class="scroll" style="flex: 1;overflow-y: auto;" bind:this={scrollElem} on:dragover={arrastandoDoComputador} on:drop={soltarDoComputador}>
    <!-- o painel da pasta rola junto com a grade: numa gaveta baixa o rodape dele nao fica escondido atras do zoom -->
    {#if ehPastaView && cfgAberta && $tela !== "mostrar" && pastaId && tagDaPasta}
        <AliancaPastaCfg {pastaId} />
    {/if}
    <div class="grid" class:list={$mediaOptions.mode === "list"} style="height: 100%;" bind:clientWidth={larguraGrade}>
        <!-- AliancaShow F7: os audios da pasta ficam em cima (a grade de video/foto ocupa a altura toda e empurraria a lista para fora da tela) -->
        {#if audiosVisiveis.length}
            <div class="audiosDaPasta" data-audios-da-pasta>
                {#each audiosVisiveis as a, i (a.path)}
                    <AudioFile path={a.path} name={a.name} {active} index={i} />
                {/each}
            </div>
        {/if}
        {#if isProviderSection && activeProviderId}
            <ContentLibraryBrowser providerId={activeProviderId} columns={$mediaOptions.columns} {searchValue} />
        {:else if active === "online" && (onlineTab === "youtube" || onlineTab === "vimeo")}
            <div class="gridgap context #player">
                <PlayerVideos active={onlineTab} {searchValue} />
            </div>
        {:else if active === "online" && onlineTab === "canva"}
            <Canva {searchValue} />
        {:else if active === "inputs"}
            <div class="gridgap">
                {#if inputsTab === "cameras"}
                    <!-- o ▶ de cada camera entra por tocavelLista: Cameras/Cam estao no fecho da janela de saida e nao mudam -->
                    <div style="display: contents;" use:tocavelLista={"Mandar a camera ao ar"}>
                        <Cameras
                            on:click={({ detail }) => {
                                let e = detail.event
                                let cam = detail.cam

                                if (gavetaNaoToca() || $outLocked || e.ctrlKey || e.metaKey) return
                                if (currentOutput?.out?.background?.id === cam.id) clearBackground()
                                else setOutput("background", { name: cam.name, id: cam.id, cameraGroup: cam.group || cam.cameraGroup, type: "camera" })
                            }}
                        />
                    </div>
                {:else if inputsTab === "screens"}
                    <Screens bind:streams />
                    <div style="width: 100%;height: 10px;" />
                    <Windows bind:streams {searchValue} />
                {:else if inputsTab === "ndi"}
                    <NDIStreams />
                {:else if inputsTab === "blackmagic"}
                    <BMDStreams />
                {/if}
            </div>
        {:else if searchedFiles.length}
            <div class="context #media" style="display: contents;">
                {#key searchedFiles}
                    {#if $mediaOptions.mode === "grid"}
                        <MediaGrid items={searchedFiles} columns={colunasAuto} let:item>
                            {#if item.isFolder}
                                <Folder
                                    name={item.name}
                                    path={item.path}
                                    mode={$mediaOptions.mode}
                                    previewPaths={item.files
                                        .map((path) => allRelevantFiles.find((a) => a.path === path)?.thumbnailPath)
                                        .filter(Boolean)
                                        .slice(0, 4)}
                                    folderFilesCount={countFolderMediaItems(item.path, allRelevantFiles)}
                                    on:open={(e) => (path = e.detail)}
                                />
                            {:else}
                                <Media credits={item.credits || {}} name={item.name || ""} path={item.path} thumbnailPath={item.previewUrl || item.thumbnailPath} loadFullImage={$mediaOptions.columns < 3} type={getMediaType(item.extension || getExtension(item.name))} shiftRange={mediaFilesOnly.map((a) => ({ ...a, type: getMediaType(getExtension(a.name)), name: removeExtension(a.name) }))} {active} />
                            {/if}
                        </MediaGrid>
                    {:else}
                        <AliancaMidiaListaCab />
                        <VirtualList items={searchedFiles} let:item={file}>
                            {#if file.isFolder}
                                <Folder name={file.name} path={file.path} mode={$mediaOptions.mode} on:open={(e) => (path = e.detail)} />
                            {:else}
                                <Media credits={file.credits || {}} thumbnail={$mediaOptions.mode !== "list"} name={file.name || ""} path={file.path} loadFullImage={$mediaOptions.columns < 3} type={getMediaType(file.extension || getExtension(file.name))} shiftRange={mediaFilesOnly.map((a) => ({ ...a, type: getMediaType(getExtension(a.name)), name: removeExtension(a.name) }))} {active} />
                            {/if}
                        </VirtualList>
                    {/if}
                {/key}
            </div>
        {:else if !audiosVisiveis.length}
            <div class={specialTabs.includes(active || "") ? "" : "context #media"} style="display: contents;">
                <Center style="opacity: 0.2;">
                    {#if ehPastaView && active !== PASTA_RAIZ}
                        <p style="text-align: center;">Nenhuma mídia desta pasta neste computador</p>
                    {:else}
                        <Icon id="noImage" size={5} white />
                        <p style="text-align: center;font-size: 0.8em;margin-top: 8px;">Nenhuma mídia aqui ainda</p>
                    {/if}
                </Center>
            </div>
        {/if}
    </div>
</div>

<!-- NAV -->

{#if isProviderSection}
    <!-- leiaute v2: zoom e modo (grade/lista) moraram nos botoes flutuantes; agora ficam no cabecalho da biblioteca (AliancaMidiaControles). So a roda do mouse segue aqui. -->
    <MaterialZoom hidden columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />
{:else if active === "online"}
    {#if onlineTab === "youtube" || onlineTab === "vimeo"}
        <FloatingInputs onlyOne style={estiloDock("right")}>
            <MaterialButton
                title="groups.toggle_global_group"
                on:click={() => {
                    popupData.set({ active: onlineTab })
                    activePopup.set("player")
                }}
            >
                <Icon id="add" />
                {#if !$labelsDisabled}<T id="settings.add" />{/if}
            </MaterialButton>
        </FloatingInputs>
    {/if}

    <MaterialZoom hidden columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />
{:else if active === "inputs"}
    <!-- nothing -->

    <MaterialZoom hidden columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />
{:else}
    {#if active !== "all" && active !== "favourites"}
        {#if rootPath !== path}
            <FloatingInputs side="left" style={estiloDock("left")}>
                <MaterialButton disabled={rootPath === path} title="actions.back" on:click={goBack}>
                    <Icon id="back" white />
                </MaterialButton>

                <div class="divider"></div>

                <p style="opacity: 0.8;display: flex;align-items: center;padding: 0 15px;">
                    <span style="opacity: 0.3;font-size: 0.9em;max-width: 500px;overflow: hidden;direction: rtl;">{pathString ? "/" : ""}{pathString}</span>
                    {folderName}

                    {#if fileCount && rootPath !== path}
                        <span style="opacity: 0.5;font-size: 0.9em;margin-inline-start: 10px;">{fileCount}</span>
                    {/if}
                </p>
            </FloatingInputs>
        {:else if hasAudio.count}
            <FloatingInputs side="left" onlyOne style={estiloDock("left")}>
                <MaterialButton icon="autofill" on:click={hasAudio.exists ? openAudioFolder : createAudioFolder}>
                    <p>
                        <T id="audio.{hasAudio.exists ? 'open_audio_folder' : 'create_audio_folder'}" />
                        <span style="opacity: 0.5;font-size: 0.8em;margin-left: 5px;">{hasAudio.count}</span>
                    </p>
                </MaterialButton>
            </FloatingInputs>
        {:else}
            <!-- altura reservada da barra: entrar/sair de subpasta nao faz a grade saltar -->
            <div style="flex: none;height: 42px;" aria-hidden="true"></div>
        {/if}
    {/if}

    <MaterialZoom hidden columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />
{/if}

<style>
    .tabs {
        display: flex;
        position: relative;
        background-color: var(--primary-darkest);
        align-items: stretch;
    }

    .tabs :global(button) {
        border-radius: 0;
        border: none !important;
        padding: 8px;
        border-radius: 8px;
        transition:
            background-color 120ms ease,
            color 120ms ease;
    }
    /* Sem regua de 1px entre as linhas: a separacao e por fundo. A aba ativa
       usa wash de marca em vez de um risco vermelho embaixo. */
    .tabs :global(button.isActive) {
        background: var(--sel-wash, rgb(242 26 39 / 0.16)) !important;
        box-shadow: inset 0 0 0 1px var(--sel-line, rgb(242 26 39 / 0.3));
    }

    .pastaTopo {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
        background-color: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }
    .pastaNome {
        font-weight: 500;
    }
    .pastaResumo {
        opacity: 0.6;
        font-size: 0.85em;
    }
    .pastaResumo.clicavel {
        border: none;
        background: transparent;
        padding: 0;
        font-family: inherit;
        color: inherit;
        cursor: pointer;
        text-decoration: underline dotted;
        text-underline-offset: 3px;
    }
    .pastaResumo.clicavel:hover {
        opacity: 1;
    }
    .pastaGear {
        margin-inline-start: auto;
        padding: 4px 6px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
    }
    .pastaGear.ligado {
        background: var(--secondary-opacity);
        border-color: var(--secondary);
    }
    .audiosDaPasta :global(.selectElem),
    .audiosDaPasta :global(.selectElem > button) {
        width: 100%;
        display: flex;
        justify-content: space-between;
    }
    .audiosDaPasta {
        width: 100%;
        padding: 5px;
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        place-content: flex-start;
    }

    .grid :global(.selectElem) {
        outline-offset: -3px;
    }
    .grid :global(.isSelected) {
        border-radius: 0 !important;
    }
    /* .grid :global(#media.isSelected .main) {
        z-index: -1;
    } */

    .grid :global(svelte-virtual-list-viewport) {
        width: 100%;
        padding: 5px;
    }

    .gridgap {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;

        width: 100%;
        height: 100%;

        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
