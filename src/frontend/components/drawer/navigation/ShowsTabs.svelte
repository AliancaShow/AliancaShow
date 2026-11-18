<script lang="ts">
    import type { TrimmedShow } from "../../../../types/Show"
    import { activeProfile, categories, drawerTabsData, shows } from "../../../stores"
    import { hasNewerUpdate } from "../../../utils/common"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import AliancaLinhaAdd from "./AliancaLinhaAdd.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    $: profile = $activeProfile ? getAccess("shows") : {}
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.shows?.activeSubTab || ""

    $: categoriesList = keysToID($categories)
    $: unarchivedCategoriesList = categoriesList.filter((a) => !a.isArchive && profile[a.id] !== "none")
    $: archivedCategoriesList = categoriesList.filter((a) => a.isArchive)

    let currentShows: TrimmedShow[] = []
    $: if ($shows) updateShows()
    async function updateShows() {
        if (await hasNewerUpdate("SHOWS_TABS", 200)) return
        currentShows = Object.values($shows)
    }

    $: allVisibleShows = currentShows.filter((a) => a && !a.private && profile[a.category || ""] !== "none")
    $: unarchivedShows = allVisibleShows.filter((a) => a.category === null || !$categories[a.category]?.isArchive)
    // $: archivedShows = currentShows.filter((a) => a.category !== null && $categories[a.category]?.isArchive)
    $: uncategorizedShowsLength = unarchivedShows.filter((a) => a.category === null || !$categories[a.category]).length
    // $: lockedShowsLength = allVisibleShows.filter((a) => a.locked).length
    // $: songNumberShowsLength = allVisibleShows.filter((a) => a.quickAccess?.number).length

    // C6 (cabine 18/nov): sem "Tudo" (clicar na raiz Shows e o tudo), sem "Sem etiqueta" (virou o filtro "Sem categoria" do cabecalho da lista) e sem o rotulo "Categorias":
    // as categorias vem direto embaixo da raiz, e "＋ categoria" e uma linha quieta no fim
    let sections: any[] = []
    $: sections = [[...convertToButton(unarchivedCategoriesList), ...(archivedCategoriesList.length ? [{ id: "SEPARATOR", label: "actions.archive_title" }, ...convertToButton(archivedCategoriesList)] : [])]]

    function convertToButton(categories: any[]) {
        return sortObject(categories, "name").map((a: any) => {
            const action = a.action
            const template = a.template
            const metadata = a.metadata?.display
            const count = allVisibleShows.reduce((count, show) => count + (show.category === a.id ? 1 : 0), 0)
            const readOnly = profile.global === "read" || profile[a.id] === "read"
            return { id: a.id, label: a.name, icon: a.icon, action, template, metadata, count, readOnly, customIcon: true, boxedIcon: true }
        })
    }

    function newCategory() {
        history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
    }

    function updateName(e: any) {
        const { id, value } = e.detail
        categories.update((a) => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} extra={["all", "unlabeled"]} on:rename={updateName}>
    <div slot="section_0">
        <AliancaLinhaAdd rotulo="categoria" titulo="Nova categoria" desligada={readOnly} on:click={newCategory} />
    </div>
</NavigationSections>
