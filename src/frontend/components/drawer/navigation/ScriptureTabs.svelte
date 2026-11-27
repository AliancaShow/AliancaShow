<script lang="ts">
    import { activeScripture, drawerTabsData, openScripture, scriptures } from "../../../stores"
    import { gavetaNaoToca } from "../../../utils/aliancaGavetaToque"
    import { keysToID } from "../../helpers/array"
    import NavigationSections from "./NavigationSections.svelte"

    $: activeSubTab = $drawerTabsData.scripture?.activeSubTab || ""

    $: scripturesList = keysToID($scriptures)

    // cabine-5 (Andre, 19/nov): sem o nivel "Colecoes" — as Biblias ficam direto embaixo de "Biblia".
    // Colecoes que ja existem continuam guardadas em $scriptures (e um show que aponte para uma continua abrindo); so nao aparecem na arvore.
    $: apiBibles = scripturesList.filter((a) => a.api && !a.collection)
    $: localBibles = scripturesList.filter((a) => !a.collection && !a.api)
    $: favoritesList = scripturesList.filter((a) => a.favorite && !a.collection)

    let sections: any[] = []
    $: sections = [...(favoritesList.length ? [[{ id: "TITLE", label: "category.favourites" }, ...convertToButton(favoritesList)]] : []), [...convertToButton(localBibles), ...(localBibles.length && apiBibles.length ? [{ id: "SEPARATOR", label: "API" }] : []), ...convertToButton(apiBibles)]]

    function convertToButton(categories: any[]) {
        return categories
            .sort((a, b) => (b.customName || b.name).localeCompare(a.customName || a.name))
            .reverse()
            .map((a: any) => {
                const icon = a.api ? "scripture_alt" : "scripture"
                return { id: a.id, label: a.customName || a.name, icon, onDoubleClick: () => startScripture(), boxedIcon: true }
            })
    }

    function startScripture() {
        openScripture.set({ play: !gavetaNaoToca(), book: Number($activeScripture.reference?.book || 1), chapter: $activeScripture.reference?.chapters[0], verses: $activeScripture.reference?.verses })
    }

    function updateName(e: any) {
        const { id, value } = e.detail
        scriptures.update((a) => {
            a[id].customName = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName} />
<!-- barra uniforme (26/nov): "＋ bíblia" saiu daqui para o ＋ do cabecalho (AliancaModeloBiblia) -->
