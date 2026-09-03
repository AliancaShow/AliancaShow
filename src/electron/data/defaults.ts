import type { SaveListSettings, SaveListSyncedSettings } from "../../types/Save"

export const defaultConfig = { loaded: false, maximized: true, bounds: { width: 800, height: 600, x: 0, y: 0 }, dataPath: null, disableHardwareAcceleration: null }

export const defaultGroups = {
    break: { name: "break", default: true, color: "#f5255e" },
    bridge: { name: "bridge", default: true, color: "#f52598", shortcut: "B" },
    chorus: { name: "chorus", default: true, color: "#f525d2", shortcut: "C" },
    intro: { name: "intro", default: true, color: "#d525f5" },
    outro: { name: "outro", default: true, color: "#a525f5" },
    pre_chorus: { name: "pre_chorus", default: true, color: "#8825f5" },
    tag: { name: "tag", default: true, color: "#7525f5" },
    verse: { name: "verse", default: true, color: "#5825f5", shortcut: "V" }
}

export const defaultSettings: { [key in SaveListSettings]: any } = {
    initialized: false,
    outLocked: false,
    outputs: {
        default: {
            enabled: true,
            active: true,
            name: "Primary",
            color: "#F21A27",
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            screen: null,
            style: "default",
            show: {}
        }
    },
    sorted: {},
    openedFolders: ["default"],
    activeProject: null,
    alertUpdates: true,
    autoOutput: false,
    autosave: "15min",
    timeFormat: "24",
    remotePassword: "",
    ports: { remote: 5510, stage: 5511 },
    disabledServers: {},
    serverData: {},
    maxConnections: 10,
    mediaFolders: {},
    audioFolders: {},
    resized: {
        leftPanel: 290,
        rightPanel: 290,
        leftPanelDrawer: 290,
        rightPanelDrawer: 290
    },
    slidesOptions: { columns: 4, mode: "grid" },
    mediaOptions: { columns: 5, mode: "grid" },
    drawerTabsData: {},
    drawer: { height: 300, stored: null },
    language: null,
    labelsDisabled: false,
    groupNumbers: true,
    fullColors: false,
    formatNewShow: false,
    showsPath: null, // DEPRECATED
    dataPath: "", // DEPRECATED
    lockedOverlays: [],
    splitLines: 0,
    theme: "default",
    transitionData: {
        text: { type: "fade", duration: 500, easing: "sine" },
        media: { type: "fade", duration: 800, easing: "sine" }
    },
    audioChannelsData: {},
    cloudSyncData: {},
    driveData: { mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false },
    calendarAddShow: "",
    metronome: {},
    audioEffects: {},
    eqPresets: {},
    effectsLibrary: [],
    special: {},
    timeline: {},
    timecode: {},
    contentProviderData: {
        planningcenter: {
            localAlways: false
        },
        churchApps: {
            syncCategories: ["song"]
        }
    },
    obsData: {}
}

export const defaultSyncedSettings: { [key in SaveListSyncedSettings]: any } = {
    categories: {
        song: { name: "category.song", icon: "song", default: true },
        presentation: { name: "category.presentation", icon: "presentation", default: true },
        // AliancaShow: categoria fixa com as 12 musicas base do Impulso
        impulso: { name: "category.impulso", icon: "song", default: true },
        propresenter: { name: "category.propresenter", icon: "song", default: true }
    },
    drawSettings: {},
    overlayCategories: {
        offers: { name: "category.offers", icon: "cash", default: true },
        notice: { name: "category.notice", icon: "info", default: true },
        visuals: { name: "category.visuals", icon: "star", default: true }
    },
    templateCategories: {
        song: { name: "category.song", icon: "song", default: true },
        presentation: { name: "category.presentation", icon: "presentation", default: true },
        scripture: { name: "category.scripture", icon: "scripture", default: true }
    },
    styles: {},
    profiles: {},
    timers: {
        default: { name: "05:00", type: "counter", start: 300, end: 0 }
    },
    variables: {
        default: { name: "Counter", type: "number" }
    },
    interactions: {},
    audioStreams: {},
    audioPlaylists: {},
    // AliancaShow Teste: apenas a NVI. As 5 traducoes de API do FreeShow
    // (KJV, ASV, WEB, WMB, BSB) foram removidas — todas em ingles e todas
    // dependentes da chave de API do projeto original.
    // "name" tem que casar com o arquivo Bibles/<name>.fsb (loadScripture
    // monta o caminho a partir dele). Sem "api: true" = Biblia local.
    scriptures: {
        nvi: { name: "NVI", id: "nvi", copyright: "Nova Versão Internacional © Biblica, Inc." }
    },
    scriptureSettings: {
        template: "scripture",
        versesPerSlide: 3,
        verseNumbers: true,
        showVersion: false,
        showVerse: true,
        referenceDivider: ":"
    },
    groups: defaultGroups,
    midiIn: {},
    emitters: {},
    playerVideos: {
        chosen: { name: "The Chosen Trailer", type: "youtube", id: "X-AJdKty74M" },
        story: { name: "The Jesus Story", type: "youtube", id: "2Yvs-Pz8KK0" },
        legacy: { name: "The Legacy of Adam", type: "youtube", id: "aPgbA6rVhWs" },
        gospel: { name: "The Gospel Film", type: "youtube", id: "mIeRU12STNw" },
        jesus: { name: "Jesus, Only Jesus", type: "vimeo", id: "426363743" },
        messiah: { name: "Messiah", type: "vimeo", id: "144160599" }
    },
    videoMarkers: {},
    calendars: {},
    mediaTags: {},
    playerTags: {},
    actionTags: {},
    variableTags: {},
    timerTags: {},
    customizedIcons: { disabled: [], svg: [] },
    companion: {},
    globalTags: {},
    globalRegexes: {},
    customMetadata: { disabled: [], custom: [] },
    effects: {},
    audioRouting: {},
    deletedDefaults: {}
}
