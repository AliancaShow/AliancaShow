<script lang="ts">
    // Barra uniforme (André, 26/nov): na Midia, o mesmo funil e o mesmo ＋ de Shows. O funil guarda os chips Video/Foto/Audio que ficavam soltos
    // no cabecalho (mesmo `drawerTabsData.media.aliancaFiltro`: nenhum ligado = tudo); o ＋ cria conteudo (importar mídia, que era a linha
    // "importar mídia" da arvore, e nova categoria). Os estilos de .ico/.pop/.item vem do cabecalho (AliancaBibliotecaPainel, :global sob .cab).
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, sendMain } from "../../IPC/main"
    import { drawerTabsData } from "../../stores"
    import { importarCaminhos } from "../../utils/aliancaBibliotecaMidia"
    import { criarPasta } from "../../utils/aliancaPastasMidia"
    import { abaDaPasta, idDaAba } from "../../utils/aliancaPastasMidiaLogica"
    import { newToast } from "../../utils/common"
    import { getAccess } from "../../utils/profile"
    import { mediaExtensions } from "../../values/extensions"
    import Icon from "../helpers/Icon.svelte"

    type Tipo = "video" | "image" | "audio"
    const TIPOS: { id: Tipo; rotulo: string }[] = [
        { id: "video", rotulo: "Vídeo" },
        { id: "image", rotulo: "Foto" },
        { id: "audio", rotulo: "Áudio" }
    ]
    $: ligados = ($drawerTabsData.media?.aliancaFiltro || []) as Tipo[]
    function alternar(id: Tipo) {
        drawerTabsData.update((a) => {
            if (!a.media) a.media = { enabled: true, activeSubTab: null }
            const atual = a.media.aliancaFiltro || []
            a.media.aliancaFiltro = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
            return a
        })
    }
    function mostrarTudo() {
        drawerTabsData.update((a) => {
            if (a.media) a.media.aliancaFiltro = []
            return a
        })
    }

    $: somenteLeitura = getAccess("media").global === "read"
    // a categoria aberta recebe o que for importado (na raiz, no Sirvo ou em "Todos": a raiz)
    $: categoriaAberta = idDaAba($drawerTabsData.media?.activeSubTab)

    const PICK_ID = uid()
    let destino: string | null = null
    function importar() {
        aberto = null
        destino = categoriaAberta
        sendMain(Main.OPEN_FILE, { channel: "ALIANCA_BIB", id: PICK_ID, title: "Importar mídia", filter: { name: "Vídeos e imagens", extensions: mediaExtensions }, multiple: true })
    }
    const ouvinte = receiveToMain(ToMain.OPEN_FILE2, (data) => {
        if (data.channel !== "ALIANCA_BIB" || data.id !== PICK_ID || !data.files?.length) return
        const n = importarCaminhos(data.files, destino)
        newToast(n ? `${n} ${n === 1 ? "mídia importada" : "mídias importadas"} (os arquivos ficam onde estão)` : "nenhum vídeo ou imagem escolhido")
    })
    onDestroy(() => destroyMain(ouvinte))

    function novaCategoria() {
        aberto = null
        const id = criarPasta()
        drawerTabsData.update((a) => {
            if (!a.media) a.media = { enabled: true, activeSubTab: abaDaPasta(id) }
            a.media.activeSubTab = abaDaPasta(id)
            return a
        })
    }

    let aberto: "filtro" | "novo" | null = null
    const alternarMenu = (m: "filtro" | "novo") => (aberto = aberto === m ? null : m)
    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement).closest?.(".midiaRaiz")) aberto = null
    }
</script>

<svelte:window on:mousedown={fora} />

<div class="menuRaiz midiaRaiz">
    <button
        class="ico"
        class:ligado={ligados.length > 0}
        data-acao="midia-filtro"
        data-title={ligados.length
            ? `Mostrando só: ${TIPOS.filter((t) => ligados.includes(t.id))
                  .map((t) => t.rotulo)
                  .join(", ")}`
            : "Filtrar por tipo"}
        aria-label="Filtrar por tipo"
        aria-haspopup="menu"
        aria-expanded={aberto === "filtro"}
        tabindex="-1"
        on:mousedown|preventDefault
        on:click={() => alternarMenu("filtro")}
    >
        <svg class="funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A1 1 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z" /></svg>
        {#if ligados.length}<span class="bolinha">{ligados.length}</span>{/if}
    </button>
    {#if aberto === "filtro"}
        <div class="pop" role="menu">
            <div class="sec">Mostrar só</div>
            {#each TIPOS as t (t.id)}
                <button class="item" role="menuitemcheckbox" aria-checked={ligados.includes(t.id)} data-filtro={t.id} tabindex="-1" on:mousedown|preventDefault on:click={() => alternar(t.id)}><span class="ck">{ligados.includes(t.id) ? "✓" : ""}</span>{t.rotulo}</button>
            {/each}
            {#if ligados.length}
                <button class="item" role="menuitem" data-acao="midia-mostrar-tudo" tabindex="-1" on:mousedown|preventDefault on:click={mostrarTudo}><span class="ck" />Mostrar tudo</button>
            {/if}
        </div>
    {/if}
</div>
<div class="menuRaiz midiaRaiz">
    <button class="ico" data-acao="midia-novo" data-title="Adicionar mídia" aria-label="Adicionar mídia" aria-haspopup="menu" aria-expanded={aberto === "novo"} disabled={somenteLeitura} tabindex="-1" on:mousedown|preventDefault on:click={() => alternarMenu("novo")}>
        <svg class="mais" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
    </button>
    {#if aberto === "novo"}
        <div class="pop" role="menu">
            <button class="item" role="menuitem" data-acao="midia-importar" data-title="Escolher vídeos e imagens (ficam onde estão; o app só registra)" tabindex="-1" on:mousedown|preventDefault on:click={importar}><span class="ck"><Icon id="import" size={0.8} white /></span>Importar vídeos e imagens</button>
            <button class="item" role="menuitem" data-acao="midia-nova-categoria" tabindex="-1" on:mousedown|preventDefault on:click={novaCategoria}><span class="ck"><Icon id="folder" size={0.8} white /></span>Nova categoria</button>
        </div>
    {/if}
</div>
