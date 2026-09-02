<script lang="ts">
    // AliancaShow: pagina da Biblia em tela cheia (aba ao lado de Palco).
    //
    // NAO reaproveita o Scripture.svelte da gaveta: aquele layout assume ~300px de
    // largura e, esticado, virava uma grade de abreviacoes coloridas com dois grids
    // de numeros e nenhum texto de versiculo. Aqui o layout e proprio — tres colunas
    // de verdade — e o que se reaproveita e a LOGICA: loadJsonBible para carregar,
    // formatBibleText para formatar, playScripture e createScriptureShow para enviar.
    import { onMount } from "svelte"
    import type { Bible } from "../../../types/Bible"
    import { activeScripture, drawerTabsData, outLocked, scriptures, scripturesCache } from "../../stores"
    import { createScriptureShow, formatBibleText, loadJsonBible, playScripture } from "../drawer/bible/scripture"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"

    // ----- versao ativa (mesma fonte de verdade da gaveta) -----

    $: versionIds = Object.keys($scriptures)
    $: activeId = $drawerTabsData.scripture?.activeSubTab && $scriptures[$drawerTabsData.scripture.activeSubTab] ? $drawerTabsData.scripture.activeSubTab : versionIds[0] || ""

    function setVersion(id: string) {
        drawerTabsData.update((a) => {
            if (!a.scripture) a.scripture = { enabled: true, activeSubTab: id }
            else a.scripture.activeSubTab = id
            return a
        })
    }

    // ----- carregamento -----

    let loading = false
    let loadError = ""
    let loadedId = ""

    $: if (activeId && activeId !== loadedId) load(activeId)

    async function load(id: string) {
        loading = true
        loadError = ""
        try {
            const instance = await loadJsonBible(id)
            if (!instance) loadError = "load"
        } catch (_) {
            loadError = "load"
        }
        loadedId = id
        loading = false
        // reseta a navegacao ao trocar de versao
        bookNumber = null
        chapterNumber = null
        selection = []
    }

    // o cache guarda o objeto Bible cru (types/Bible.ts): books[].chapters[].verses[]
    $: bible = ($scripturesCache[activeId] as Bible | undefined) || null
    $: books = bible?.books || []

    // ----- navegacao -----

    let bookNumber: number | null = null
    let chapterNumber: number | null = null
    let selection: number[] = []
    let lastClicked: number | null = null

    $: book = bookNumber === null ? null : books.find((b) => Number(b.number) === bookNumber) || null
    $: chapters = book?.chapters || []
    $: chapter = chapterNumber === null ? null : chapters.find((c) => Number(c.number) === chapterNumber) || null
    $: verses = chapter?.verses || []

    function pickBook(n: number) {
        bookNumber = n
        chapterNumber = null
        selection = []
        lastClicked = null
        // capitulo 1 direto: um clique a menos no culto
        const b = books.find((x) => Number(x.number) === n)
        if (b?.chapters?.length) pickChapter(Number(b.chapters[0].number))
    }

    function pickChapter(n: number) {
        chapterNumber = n
        selection = []
        lastClicked = null
    }

    function pickVerse(n: number, e: MouseEvent) {
        if (e.shiftKey && lastClicked !== null) {
            const [from, to] = lastClicked < n ? [lastClicked, n] : [n, lastClicked]
            selection = verses.map((v) => Number(v.number)).filter((x) => x >= from && x <= to)
        } else if (e.ctrlKey || e.metaKey) {
            selection = selection.includes(n) ? selection.filter((x) => x !== n) : [...selection, n].sort((a, b) => a - b)
            lastClicked = n
        } else {
            selection = [n]
            lastClicked = n
        }
    }

    function selectWholeChapter() {
        selection = verses.map((v) => Number(v.number))
        lastClicked = null
    }

    // ----- seleção -> store que playScripture/createScriptureShow consomem -----

    $: if (bookNumber !== null && chapterNumber !== null && selection.length) {
        activeScripture.set({ id: activeId, reference: { book: bookNumber, chapters: [chapterNumber], verses: [selection] } })
    }

    $: reference = book && chapterNumber !== null && selection.length ? `${book.name} ${chapterNumber}:${selection.length === 1 ? selection[0] : `${selection[0]}-${selection[selection.length - 1]}`}` : ""

    // ----- busca: referencia ("João 3:16") ou nome de livro -----

    let query = ""

    $: filteredBooks = (() => {
        const q = query.trim().toLowerCase()
        if (!q) return books
        const namePart = q.replace(/\s*\d+.*$/, "").trim()
        if (!namePart) return books
        return books.filter((b) => b.name.toLowerCase().includes(namePart) || (b.abbreviation || "").toLowerCase().includes(namePart))
    })()

    function submitQuery() {
        const q = query.trim()
        if (!q) return
        // "João 3:16" | "João 3" | "1 Samuel 2:3"
        const m = q.match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
        const namePart = (m ? m[1] : q).toLowerCase()
        const target = books.find((b) => b.name.toLowerCase() === namePart) || books.find((b) => b.name.toLowerCase().startsWith(namePart)) || books.find((b) => (b.abbreviation || "").toLowerCase() === namePart)
        if (!target) return

        pickBook(Number(target.number))
        if (!m) return

        const ch = Number(m[2])
        if (target.chapters?.some((c) => Number(c.number) === ch)) pickChapter(ch)
        if (m[3]) {
            const v = Number(m[3])
            selection = [v]
            lastClicked = v
        }
    }

    // ----- acoes -----

    function sendToOutput() {
        if (!selection.length || $outLocked) return
        playScripture()
    }

    onMount(() => {
        if (activeId) load(activeId)
    })
</script>

<div class="page">
    <!-- ================= CABECALHO ================= -->
    <div class="header">
        <span class="brand">
            <Icon id="scripture" size={1.3} white />
            <T id="tabs.scripture" />
        </span>

        {#if versionIds.length > 1}
            <select class="version" value={activeId} on:change={(e) => setVersion(e.currentTarget.value)}>
                {#each versionIds as id}
                    <option value={id}>{$scriptures[id]?.customName || $scriptures[id]?.name || id}</option>
                {/each}
            </select>
        {:else if activeId}
            <span class="versionTag">{$scriptures[activeId]?.customName || $scriptures[activeId]?.name || activeId}</span>
        {/if}

        <form class="search" on:submit|preventDefault={submitQuery}>
            <Icon id="search" size={1.1} white />
            <input type="text" placeholder="João 3:16" bind:value={query} />
            {#if query.length}
                <button type="button" class="iconBtn" on:click={() => (query = "")}><Icon id="clear" white /></button>
            {/if}
        </form>

        <span class="spacer"></span>
    </div>

    <!-- ================= CORPO ================= -->
    {#if loading && !bible}
        <div class="empty"><T id="remote.loading" /></div>
    {:else if loadError || !bible}
        <div class="empty"><T id="error.bible" /></div>
    {:else}
        <div class="columns">
            <!-- LIVROS -->
            <div class="col books">
                <div class="colHead"><T id="scripture.book" /></div>
                <div class="colBody">
                    {#each filteredBooks as b (b.number)}
                        {#if Number(b.number) === 40 && !query}<div class="divider"><T id="scripture.new_testament" /></div>{/if}
                        <button class="row book" class:active={bookNumber === Number(b.number)} on:click={() => pickBook(Number(b.number))}>
                            <span class="name">{b.name}</span>
                            <span class="count">{b.chapters?.length || 0}</span>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- CAPITULOS -->
            <div class="col chapters">
                <div class="colHead"><T id="scripture.chapter" /></div>
                <div class="colBody grid">
                    {#each chapters as c (c.number)}
                        <button class="num" class:active={chapterNumber === Number(c.number)} on:click={() => pickChapter(Number(c.number))}>{c.number}</button>
                    {/each}
                </div>
            </div>

            <!-- VERSICULOS -->
            <div class="col verses">
                <div class="colHead">
                    <T id="scripture.verse" />
                    {#if verses.length}
                        <button class="linkBtn" on:click={selectWholeChapter}><T id="scripture.select_all" /></button>
                    {/if}
                </div>
                <div class="colBody">
                    {#if !chapter}
                        <div class="empty small"><T id="scripture.select_book" /></div>
                    {:else}
                        {#each verses as v (v.number)}
                            <button class="row verse" class:active={selection.includes(Number(v.number))} on:click={(e) => pickVerse(Number(v.number), e)}>
                                <span class="vnum">{v.number}</span>
                                <span class="vtext">{@html formatBibleText(v.text, true)}</span>
                            </button>
                        {/each}
                    {/if}
                </div>
                {#if verses.length}
                    <!-- acoes no rodape da coluna: e onde a selecao acontece e onde ha
                         largura. No cabecalho elas ficavam fora da tela. -->
                    <div class="actionBar">
                        {#if selection.length}
                            <span class="reference">{reference}</span>
                            <span class="count">{selection.length}</span>
                        {:else}
                            <span class="tip"><T id="scripture.multiselect_tip" /></span>
                        {/if}

                        <span class="spacer"></span>

                        <button class="btn ghost" disabled={!selection.length} on:click={createScriptureShow}>
                            <Icon id="slide" size={1.1} white />
                            <T id="scripture.convert_to_show" />
                        </button>
                        <button class="btn primary" disabled={!selection.length || $outLocked} on:click={sendToOutput}>
                            <Icon id="play" size={1.1} white />
                            <T id="scripture.display" />
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .page {
        display: flex;
        flex: 1;
        flex-direction: column;
        height: 100%;
        min-height: 0;

        background-color: var(--primary-darker);
    }

    /* ---------- cabecalho ---------- */

    .header {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 14px;
        height: 52px;
        padding: 0 16px;

        background-color: var(--primary);
        border-bottom: 2px solid var(--secondary);
    }

    .brand {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 9px;

        font-size: 1.1em;
        font-weight: 700;
    }

    .version,
    .versionTag {
        flex: 0 1 auto;
        min-width: 90px;
        max-width: 190px;
        padding: 6px 10px;

        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-family: inherit;
        font-size: 0.9em;
    }

    .versionTag {
        border-color: var(--secondary);
        background-color: var(--secondary);
        color: var(--secondary-text);
        font-weight: 700;
        letter-spacing: 0.5px;
    }

    .search {
        display: flex;
        flex: 1 1 220px;
        align-items: center;
        gap: 8px;
        min-width: 140px;
        max-width: 340px;
        padding: 0 10px;

        border-radius: 4px;
        border-inline-start: 3px solid var(--secondary);
        background-color: rgb(0 0 0 / 0.25);
    }

    .search input {
        flex: 1;
        padding: 8px 0;

        border: none;
        background-color: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 1em;
    }

    .search input:focus {
        outline: none;
    }

    .iconBtn {
        display: flex;
        padding: 0;

        border: none;
        background: transparent;

        cursor: pointer;
    }

    .spacer {
        flex: 1;
    }

    .reference {
        padding: 5px 11px;

        border-radius: 4px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-size: 0.9em;
        font-weight: 600;
    }

    .btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;

        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        background-color: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 0.9em;

        cursor: pointer;
    }

    .btn:disabled {
        cursor: default;
        opacity: 0.35;
    }

    .btn.ghost:hover:not(:disabled) {
        background-color: var(--hover);
    }

    .btn.primary {
        border-color: var(--secondary);
        background-color: var(--secondary);
        color: var(--secondary-text);
        font-weight: 700;
    }

    .btn.primary:hover:not(:disabled) {
        filter: brightness(1.12);
    }

    /* ---------- colunas ---------- */

    .columns {
        display: flex;
        flex: 1;
        min-height: 0;
    }

    .col {
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .books {
        flex: 0 0 auto;
        width: 250px;

        border-inline-end: 1px solid var(--primary-darkest);
    }

    .chapters {
        flex: 0 0 auto;
        width: 132px;

        border-inline-end: 1px solid var(--primary-darkest);
    }

    .verses {
        flex: 1;
        min-width: 0;
    }

    .colHead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        height: 30px;
        padding: 0 12px;

        background-color: var(--primary-darkest);
        color: var(--text);
        font-size: 0.7em;
        letter-spacing: 1.1px;
        text-transform: uppercase;
        opacity: 0.6;
    }

    .colBody {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;

        overflow-y: auto;
    }

    .colBody.grid {
        display: grid;
        align-content: start;
        gap: 4px;
        padding: 8px;

        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .divider {
        padding: 10px 12px 4px;

        color: var(--secondary);
        font-size: 0.68em;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
    }

    /* ---------- linhas ---------- */

    .row {
        display: flex;
        flex: 0 0 auto;
        align-items: baseline;
        gap: 10px;
        padding: 0.5em 12px;

        border: none;
        border-inline-start: 3px solid transparent;
        background-color: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 1em;
        text-align: start;

        cursor: pointer;
    }

    .row:hover {
        background-color: var(--hover);
    }

    .row.active {
        border-inline-start: 3px solid var(--secondary);
        background-color: var(--primary);
    }

    .book .name {
        flex: 1;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .book.active .name {
        font-weight: 700;
    }

    .book .count {
        font-size: 0.8em;
        opacity: 0.4;
    }

    .num {
        padding: 0.5em 0;

        border: none;
        border-radius: 3px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
        font-size: 0.95em;
        text-align: center;

        cursor: pointer;
    }

    .num:hover {
        background-color: var(--hover);
    }

    .num.active {
        background-color: var(--secondary);
        color: var(--secondary-text);
        font-weight: 700;
    }

    /* ---------- versiculos ---------- */

    .verse {
        line-height: 1.6;
    }

    .verse .vnum {
        flex: 0 0 auto;
        width: 2.2em;

        color: var(--secondary);
        font-size: 0.85em;
        font-weight: 700;
        text-align: end;
    }

    .verse.active .vnum {
        color: var(--secondary-text);
    }

    .verse .vtext {
        flex: 1;

        white-space: normal;
    }

    /* ---------- estados ---------- */

    .empty {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;

        color: var(--text);
        opacity: 0.4;
    }

    .empty.small {
        font-size: 0.9em;
    }

    .actionBar {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;

        background-color: var(--primary-darkest);
        border-top: 1px solid var(--primary);
    }

    .actionBar .tip {
        color: var(--text);
        font-size: 0.8em;
        opacity: 0.45;
    }

    .actionBar .count {
        padding: 2px 8px;

        border-radius: 10px;
        background-color: var(--secondary);
        color: var(--secondary-text);
        font-size: 0.75em;
        font-weight: 700;
    }

    .linkBtn {
        padding: 0;

        border: none;
        background: transparent;
        color: var(--secondary);
        font-family: inherit;
        font-size: 1em;
        letter-spacing: 0.6px;
        text-transform: uppercase;

        cursor: pointer;
    }
</style>
