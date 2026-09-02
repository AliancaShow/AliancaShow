<script lang="ts">
    import { customActionActivation } from "./components/actions/actions"
    import DrawTabs from "./components/draw/DrawTabs.svelte"
    import LibraryTabs from "./components/drawer/LibraryTabs.svelte"
    import Navigation from "./components/edit/Navigation.svelte"
    import LazyLoad from "./components/helpers/LazyLoad.svelte"
    import ProfileChangerMenu from "./components/main/ProfileChangerMenu.svelte"
    import Tipbar from "./components/main/Tipbar.svelte"
    import Top from "./components/main/Top.svelte"
    import Preview from "./components/output/preview/Preview.svelte"
    import SettingsTabs from "./components/settings/SettingsTabs.svelte"
    import Projects from "./components/show/Projects.svelte"
    import Show from "./components/show/Show.svelte"
    import ShowTools from "./components/show/ShowTools.svelte"
    import StageLayouts from "./components/stage/StageLayouts.svelte"
    import Clock from "./components/system/Clock.svelte"
    import DateDisplay from "./components/system/Date.svelte"
    import Resizeable from "./components/system/Resizeable.svelte"
    import Timeline from "./components/timeline/Timeline.svelte"
    import { activeEdit, activePage, activeProfile, activeProject, activeShow, activeStage, currentWindow, editMode, focusMode, loaded, os, projectView, resized, showChangeProfileMenu, showsCache, special } from "./stores"
    import { DEFAULT_WIDTH } from "./utils/common"

    $: page = $activePage
    $: isWindows = !$currentWindow && $os.platform === "win32"

    let previousId = ""
    $: if ($activeShow?.id !== previousId) showOpened()
    function showOpened() {
        if (!$activeShow?.id || $activeShow?.type !== "show") return

        // allow show to actually open before triggering
        setTimeout(() => customActionActivation("show_opened"), 50)
        previousId = $activeShow?.id
    }
</script>

<div class="column">
    {#if !$focusMode}
        <Top {isWindows} />
    {/if}
    <div class="row">
        <Resizeable id="leftPanel">
            <div class="left">
                {#if page === "show"}
                    <!-- Layout D: Projetos em cima, biblioteca (8 abas) na parte de baixo -->
                    <div class="projectsWrap">
                        {#key $activeProfile}
                            <Projects />
                        {/key}
                    </div>
                    <LibraryTabs />
                {:else if page === "scripture"}
                    <!-- modo Biblia: Projetos a esquerda, para jogar o versiculo direto no culto -->
                    {#key $activeProfile}
                        <Projects />
                    {/key}
                {:else if page === "edit"}
                    <Navigation />
                {:else if page === "stage"}
                    <StageLayouts />
                {:else if page === "draw"}
                    <DrawTabs />
                {:else if page === "settings"}
                    <SettingsTabs />
                {/if}
            </div>
        </Resizeable>

        <div class="center">
            <div class="pageContent">
            {#if page === "show"}
                {#if $focusMode}
                    <LazyLoad component={() => import("./components/show/focus/FocusMode.svelte")} show={$focusMode} />
                {:else}
                    <Show />
                {/if}
            {:else if page === "edit"}
                <LazyLoad component={() => import("./components/edit/Editor.svelte")} show={page === "edit"} />
            {:else if page === "draw"}
                <LazyLoad component={() => import("./components/draw/Slide.svelte")} show={page === "draw"} />
            {:else if page === "settings"}
                <LazyLoad component={() => import("./components/settings/Settings.svelte")} show={page === "settings"} />
            {:else if page === "stage"}
                <LazyLoad component={() => import("./components/stage/StageLayout.svelte")} show={page === "stage"} />
            {:else if page === "scripture"}
                <LazyLoad component={() => import("./components/bible/BiblePage.svelte")} show={page === "scripture"} />
            {/if}
            </div>

            <!-- Layout D: o conteudo da aba ativa abre aqui, logo abaixo da grade de slides -->
            {#if $loaded && (page === "show" || page === "edit")}
                <LazyLoad component={() => import("./components/drawer/Drawer.svelte")} show={$loaded && (page === "show" || page === "edit")} />
            {/if}
        </div>

        <Resizeable id="rightPanel" let:width side="right">
            <div class="right" class:row={width > DEFAULT_WIDTH * 1.8}>
                <Preview />
                {#if page === "show"}
                    {#if $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined) && !$focusMode}
                        <ShowTools />
                    {/if}
                {:else if page === "edit"}
                    {#if $activeEdit.type === "media" || $activeEdit.type === "camera"}
                        <LazyLoad component={() => import("./components/edit/MediaTools.svelte")} show={$activeEdit.type === "media" || $activeEdit.type === "camera"} />
                    {:else if $activeEdit.type === "audio"}
                        <LazyLoad component={() => import("./components/edit/AudioTools.svelte")} show={$activeEdit.type === "audio"} />
                    {:else if $activeEdit.type === "effect"}
                        <LazyLoad component={() => import("./components/edit/EffectTools.svelte")} show={$activeEdit.type === "effect"} />
                    {:else if $activeEdit.type === "overlay" || $activeEdit.type === "template" || $showsCache[$activeShow?.id || ""]}
                        {#if $focusMode || (($activeEdit.type || "show") === "show" && $editMode !== "default")}
                            <!-- show nothing -->
                        {:else}
                            <LazyLoad component={() => import("./components/edit/EditTools.svelte")} show={!$focusMode} />
                        {/if}
                    {/if}
                {:else if page === "draw"}
                    <LazyLoad component={() => import("./components/draw/DrawSettings.svelte")} show={page === "draw"} />
                {:else if page === "stage" && $activeStage.id}
                    <LazyLoad component={() => import("./components/stage/StageTools.svelte")} show={page === "stage" && !!$activeStage.id} />
                {:else if page === "settings"}
                    <LazyLoad component={() => import("./components/settings/SettingsTools.svelte")} show={page === "settings"} />
                {/if}

                <!-- Layout D: relogio fixo no rodape da coluna direita. Saiu do painel
                     Info do drawer, que gastava ~365px de largura so para mostrar a hora. -->
                {#if !$focusMode}
                    <div class="clockArea">
                        <Clock />
                        <DateDisplay />
                    </div>
                {/if}
            </div>
        </Resizeable>
    </div>

    {#if page === "show" && $special.projectTimelineActive && $activeProject && !$projectView}
        <Resizeable id="project_timeline" side="bottom" maxWidth={DEFAULT_WIDTH} minWidth={40}>
            {#key $activeProject}
                <Timeline type="project" isClosed={$resized.project_timeline <= 40} />
            {/key}
        </Resizeable>
    {/if}

    <!-- Layout D: o Drawer saiu daqui (rodape de largura total) e foi para dentro do .center -->

    {#if $showChangeProfileMenu && $activeProfile !== null}
        <ProfileChangerMenu />
    {/if}

    <Tipbar />
</div>

<style>
    .column,
    .row {
        display: flex;
        justify-content: space-between;
        /* background: var(--primary-darker); */
    }

    .column {
        flex-direction: column;
        height: 100%;
    }

    .row {
        flex: 1;
        overflow: hidden;
    }

    /* Layout D: o centro passa a ser uma coluna — conteudo da pagina em cima,
       painel da aba ativa (Drawer) embaixo. O scroll saiu de .center para
       .pageContent para o Drawer nao rolar junto com a grade de slides. */
    .center {
        position: relative;

        display: flex;
        flex: 1;
        flex-direction: column;
        background-color: var(--primary-darker);
        overflow: hidden;
    }

    .pageContent {
        position: relative;

        flex: 1;
        min-height: 0;
        overflow: auto;

        scroll-behavior: smooth;
    }

    /* margin-top: auto empurra para o rodape em qualquer direcao de flex */
    .clockArea {
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        align-items: center;
        margin-top: auto;
        padding: 10px 8px 14px;

        border-top: 1px solid var(--primary-darkest);
    }

    /* Layout D: divisao explicita 50/50 — Projetos na metade de cima,
       biblioteca na metade de baixo. Sem isto o "space-between" do .left
       dava mais espaco a Projetos e cortava metade das abas. */
    .projectsWrap {
        display: flex;
        flex: 1 1 0;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }

    .left,
    .right {
        position: relative;

        display: flex;
        flex-direction: column;
        flex: 1;
        justify-content: space-between;
        overflow: hidden;
    }
    .right.row {
        flex-direction: row-reverse;
    }

    .right :global(.border) {
        border-top: 2px solid var(--primary-lighter);
    }
    .right.row :global(.border) {
        border: none;
        border-inline-end: 2px solid var(--primary-lighter);
        min-width: 50%;
    }

    .right.row :global(.textfield .picker) {
        left: unset !important;
        right: 0;
    }
</style>
