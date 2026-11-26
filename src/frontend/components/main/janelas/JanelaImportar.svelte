<script lang="ts">
    // AliancaShow (26/nov, "janelas nossas"): Importar em lista com faixas (AliancaShow / Midia / Letras e outros programas), linhas de
    // 32 px com logo pequeno e extensoes em cinza, no lugar dos azulejos de 60 px. Mesmas chamadas do Import do FreeShow (Main.IMPORT por
    // formato, tutorial em aviso, PowerPoint com opcoes, colar da area de transferencia); o Import original segue intacto no fecho.
    import { tick } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { importFromClipboard } from "../../../converters/importHelpers"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { presentationExtensions } from "../../../values/extensions"
    import Icon from "../../helpers/Icon.svelte"

    const modo = $popupData.mode
    popupData.set({})

    type Formato = { name: string; extensions: string[]; id: string; icon?: string; logo?: boolean; tutorial?: string; popup?: any; title?: string }

    const DA_CASA: Formato[] = [
        { name: "formats.show", title: "AliançaShow Song/Presentation File", icon: "slide", extensions: ["show", "json"], id: "freeshow" },
        { name: "formats.project", title: "AliançaShow Project File", icon: "project", extensions: ["project", "shows", "json", "zip"], id: "freeshow_project" }
    ]
    const DA_CASA_MAIS: Formato[] = [
        { name: "formats.template", title: "AliançaShow Template File", icon: "templates", extensions: ["fstemplate", "fst", "template", "json", "zip"], id: "freeshow_template" },
        { name: "formats.action", title: "AliançaShow Action File", icon: "actions", extensions: ["fsaction", "action", "json"], id: "freeshow_action" },
        { name: "stage.stage_layout", title: "AliançaShow Stage Layout File", icon: "stage", extensions: ["fsstage", "stage", "json"], id: "freeshow_stage" },
        { name: "formats.theme", title: "AliançaShow Theme File", icon: "theme", extensions: ["fstheme", "theme", "json"], id: "freeshow_theme" }
    ]
    const MIDIA: Formato[] = [
        { name: "PDF", extensions: ["pdf"], id: "pdf", logo: true },
        { name: "PowerPoint", extensions: ["pptx", "ppt"], id: "powerpoint", logo: true },
        { name: "Lessons.church", extensions: ["json", "olp", "olf"], id: "lessons", logo: true }
    ]
    const LETRAS: Formato[] = [
        { name: "formats.text", extensions: ["txt"], id: "txt", logo: true },
        { name: "ChordPro", extensions: ["cho", "crd", "chopro", "chordpro", "chord", "pro", "txt", "onsong"], id: "chordpro", logo: true },
        { name: "CSV", extensions: ["csv"], id: "csv", logo: true },
        { name: "Word", extensions: ["doc", "docx"], id: "word", logo: true },
        { name: "ProPresenter", extensions: ["pro4", "pro5", "pro6", "pro", "json", "proBundle"], id: "propresenter", logo: true },
        {
            name: "EasyWorship",
            extensions: ["db"],
            id: "easyworship",
            logo: true,
            tutorial: "Import the <b>SongsWords.db/SongWords.db</b> file from the Data folder!<br>Optionally select <b>Songs.db</b> at the same time to also import title/metadata.<br><br>Often located in the Documents folder:<br><i>Documents/Softouch/EasyWorship/Default/v6.1/Databases/Data/</i>"
        },
        { name: "VideoPsalm", extensions: ["json", "vpc"], id: "videopsalm", logo: true, tutorial: "Find the .vpc or .json file(s) often located in Documents\\VideoPsalm\\Songbooks" },
        { name: "OpenLP/OpenLyrics", extensions: ["xml", "sqlite"], id: "openlp", logo: true },
        { name: "OpenSong", extensions: [], id: "opensong", logo: true },
        { name: "MediaShout", extensions: ["ssc", "xml", "mdb"], id: "mediashout", logo: true },
        { name: "Quelea", extensions: ["xml", "qsp"], id: "quelea", logo: true },
        { name: "SoftProjector", extensions: ["sps"], id: "softprojector", logo: true },
        { name: "Songbeamer", extensions: [], id: "songbeamer", logo: true, popup: "songbeamer_import" },
        { name: "Easyslides", extensions: ["xml"], id: "easyslides", logo: true },
        { name: "VerseVIEW", extensions: ["xml"], id: "verseview", logo: true }
    ]

    const nome = (f: Formato) => translateText(f.name)
    const exts = (f: Formato) =>
        [...new Set(f.extensions)]
            .slice(0, 3)
            .map((e) => "." + e)
            .join(" ")

    function tutorial(f: Formato) {
        if (!f.tutorial) return activePopup.set(null)
        alertMessage.set(f.tutorial)
        activePopup.set("alert")
    }
    function importar(f: Formato) {
        if (f.popup) return tick().then(() => activePopup.set(f.popup))
        if (f.id === "powerpoint") return pptTexto()
        if (f.id === "pdf" || f.id === "lessons") sendMain(Main.IMPORT, { channel: f.id, format: f })
        else sendMain(Main.IMPORT, { channel: f.id, format: { ...f, name: nome(f) } })
        tutorial(f)
    }
    function colar() {
        importFromClipboard()
        activePopup.set(null)
    }

    // PowerPoint
    function pptTexto() {
        sendMain(Main.IMPORT, { channel: "powerpoint", format: { name: "PowerPoint", extensions: ["ppt", "pptx"] } })
        activePopup.set(null)
    }
    const PPT = [
        { nome: "Slides com texto", det: "A formatação pode não vir perfeita", logo: "txt", click: pptTexto },
        { nome: "PDF", det: "Precisa do LibreOffice instalado", logo: "pdf", click: () => sendMain(Main.LIBREOFFICE_CONVERT, { type: "powerpoint" }) },
        {
            nome: "PDF pela internet",
            det: "Converte num site e depois importa o PDF",
            logo: "pdf",
            click: () => {
                sendMain(Main.URL, "https://www.ilovepdf.com/powerpoint_to_pdf")
                activePopup.set(null)
            }
        },
        { nome: "Controlar o PowerPoint", det: "Antigo: precisa do PowerPoint ou Keynote aberto", logo: "powerkey", click: () => sendMain(Main.IMPORT, { channel: "powerkey", format: { name: "PowerPoint/Keynote", extensions: presentationExtensions } }) }
    ]

    let pagina: "" | "ppt" = ""
    let maisDaCasa = false

    $: midia = modo === "project" ? MIDIA.filter((f) => f.id !== "lessons") : MIDIA
    $: letras = modo === "project" ? LETRAS.filter((f) => ["txt", "chordpro"].includes(f.id)) : LETRAS
</script>

<div class="importar" data-janela="importar">
    {#if pagina === "ppt"}
        <button class="jb fantasma voltar" on:click={() => (pagina = "")}><Icon id="back" size={0.85} white /> PowerPoint</button>
        <div class="lista">
            {#each PPT as o}
                <button class="linha alta" on:click={o.click}>
                    <img src="./import-logos/{o.logo}.webp" alt="" draggable={false} />
                    <span class="nome">{o.nome}</span>
                    <span class="ext">{o.det}</span>
                </button>
            {/each}
        </div>
        <p class="dica">O melhor costuma ser pedir a apresentação já em PDF.</p>
    {:else}
        {#if modo !== "project"}
            <div class="faixa">AliançaShow</div>
            <div class="lista">
                {#each maisDaCasa ? [...DA_CASA, ...DA_CASA_MAIS] : DA_CASA as f (f.id)}
                    <button class="linha" data-title={f.title} on:click={() => importar(f)}>
                        <span class="ic"><Icon id={f.icon || "slide"} size={0.9} white /></span>
                        <span class="nome">{nome(f)}</span>
                        <span class="ext">{exts(f)}</span>
                    </button>
                {/each}
                {#if !maisDaCasa}
                    <button class="linha fraca" on:click={() => (maisDaCasa = true)}>
                        <span class="ic"><Icon id="add" size={0.85} white /></span>
                        <span class="nome">Modelo, ação, palco, tema</span>
                    </button>
                {/if}
            </div>
        {/if}

        <div class="faixa">Mídia</div>
        <div class="lista">
            {#each midia as f (f.id)}
                <button class="linha" on:click={() => importar(f)}>
                    <img src="./import-logos/{f.id}.webp" alt="" draggable={false} />
                    <span class="nome">{nome(f)}</span>
                    <span class="ext">{exts(f)}</span>
                    {#if f.id === "powerpoint"}
                        <span class="mais" role="button" tabindex="-1" data-title="Outras formas de importar PowerPoint" on:click|stopPropagation={() => (pagina = "ppt")} on:keydown={() => {}}><Icon id="next" size={0.8} white /></span>
                    {/if}
                </button>
            {/each}
        </div>

        <div class="faixa">{modo === "project" ? "Letras" : "Letras e outros programas"}</div>
        <div class="lista duas">
            {#each letras as f (f.id)}
                <button class="linha" on:click={() => importar(f)}>
                    <img src="./import-logos/{f.id}.webp" alt="" draggable={false} />
                    <span class="nome">{nome(f)}</span>
                    <span class="ext">{exts(f)}</span>
                </button>
            {/each}
        </div>

        <div class="faixa">Área de transferência</div>
        <div class="lista">
            <button class="linha" data-title="[Ctrl+Alt+I]" on:click={colar}>
                <span class="ic"><Icon id="paste" size={0.9} white /></span>
                <span class="nome">Colar o que foi copiado</span>
                <span class="ext">Ctrl Alt I</span>
            </button>
        </div>
    {/if}
</div>

<style>
    .importar {
        display: flex;
        flex-direction: column;
    }
    .faixa {
        height: 24px;
        display: flex;
        align-items: center;
        padding: 0 8px;
        margin: 12px 0 4px;
        border-radius: 4px;
        background: var(--luz-campo);
        color: var(--luz-mudo);
        font-size: 11px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }
    .faixa:first-child {
        margin-top: 0;
    }
    .lista {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    .lista.duas {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        column-gap: 8px;
    }
    .linha {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 32px;
        padding: 0 8px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font-family: inherit;
        font-size: 13px;
        text-align: start;
        cursor: pointer;
    }
    .linha.alta {
        height: 40px;
    }
    .linha:hover {
        background: var(--luz-hover);
    }
    .linha.fraca {
        color: var(--luz-mudo);
    }
    .linha img {
        width: 20px;
        height: 20px;
        object-fit: contain;
        flex-shrink: 0;
    }
    .ic {
        display: flex;
        width: 20px;
        justify-content: center;
        opacity: 0.7;
        flex-shrink: 0;
    }
    .nome {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .ext {
        margin-inline-start: auto;
        color: var(--luz-fraco);
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .mais {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        opacity: 0.6;
    }
    .mais:hover {
        background: var(--luz-hover);
        opacity: 1;
    }
    .voltar {
        align-self: flex-start;
        gap: 6px;
        margin-bottom: 8px;
    }
    .dica {
        margin: 12px 0 0;
        color: var(--luz-mudo);
        font-size: 12px;
    }
</style>
