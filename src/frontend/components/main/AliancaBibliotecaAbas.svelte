<script lang="ts">
    // AliancaShow (26/nov, biblioteca): as 4 raizes da arvore viram abas fixas na barra da biblioteca (nivel 1). Antes as categorias de Shows
    // empurravam Midia e Biblia para fora da tela. Mesma regra da raiz da arvore (AliancaArvore.abrirRaiz): Shows e Midia abrem em "tudo",
    // Biblia mantem a versao, Ferramentas abre o 1o filho.
    import { activeDrawerTab, drawerTabsData } from "../../stores"
    import { FILHOS_FERRAMENTAS, RAIZES, raizDaAba, type Raiz } from "../../utils/aliancaArvoreLogica"
    import { getAccess } from "../../utils/profile"
    import Icon from "../helpers/Icon.svelte"
    import type { DrawerTabIds } from "../../../types/Tabs"

    const ICONE: { [id: string]: string } = { shows: "music", media: "image", scripture: "scripture", ferramentas: "settings" }

    $: aberta = raizDaAba($activeDrawerTab)
    $: filhosFerramentas = FILHOS_FERRAMENTAS.filter((f) => getAccess(f.id).global !== "none")
    $: raizes = RAIZES.filter((r) => (r.id === "ferramentas" ? filhosFerramentas.length > 0 : getAccess(r.abre).global !== "none"))

    function abrir(r: Raiz) {
        if (r.id === aberta) return
        if (r.id === "ferramentas") return activeDrawerTab.set((filhosFerramentas[0]?.id || "templates") as DrawerTabIds)
        activeDrawerTab.set(r.abre)
        if (r.id === "shows" || r.id === "media")
            drawerTabsData.update((a) => {
                a[r.abre] = { ...a[r.abre], activeSubTab: "all", enabled: a[r.abre]?.enabled !== false }
                return a
            })
    }
</script>

<div class="abas" role="tablist" aria-label="Biblioteca" data-acao="biblioteca-abas">
    {#each raizes as r (r.id)}
        <button type="button" role="tab" class="aba" class:on={aberta === r.id} aria-selected={aberta === r.id} data-aba={r.id} tabindex="-1" on:mousedown|preventDefault on:click={() => abrir(r)}>
            <Icon id={ICONE[r.id]} size={0.85} white={aberta !== r.id} />
            <span>{r.nome}</span>
        </button>
    {/each}
</div>

<style>
    .abas {
        display: flex;
        gap: 2px;
        padding: 3px;
        border-radius: 8px;
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        flex-shrink: 0;
    }
    .aba {
        height: 26px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .aba:hover {
        color: var(--luz-texto);
    }
    .aba.on {
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font-weight: 600;
    }
    .aba.on :global(svg) {
        fill: var(--luz-tinta);
    }
</style>
