<script lang="ts">
    // Leiaute v2, biblioteca: a arvore unica, uma pasta aberta por vez. Le/escreve `activeDrawerTab`; as sub-abas de cada pasta sao as de
    // `drawerTabsData[*].activeSubTab` (a lista delas e a de components/drawer/Navigation.svelte, com marcacao de hoje: declarado).
    // Aba sem no: na carga e saneada sem faixa; em uso (escrita depois da carga) chama falhaAlta("arvore-sem-no") e a arvore volta.
    import { onMount } from "svelte"
    import { activeDrawerTab } from "../../stores"
    import { decidirEscrita, NOS, sanearNaCarga } from "../../utils/aliancaArvoreLogica"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { getAccess } from "../../utils/profile"
    import Navigation from "../drawer/Navigation.svelte"
    import type { DrawerTabIds } from "../../../types/Tabs"

    let ultimoValido: DrawerTabIds = "shows"
    let carregado = false
    onMount(() => {
        const saneada = sanearNaCarga($activeDrawerTab)
        ultimoValido = saneada
        if (saneada !== $activeDrawerTab) activeDrawerTab.set(saneada)
        carregado = true
    })
    $: if (carregado) {
        const d = decidirEscrita($activeDrawerTab, ultimoValido)
        if (d.ok) ultimoValido = d.aba
        else {
            falhaAlta("arvore-sem-no", d.nome)
            activeDrawerTab.set(d.voltarPara)
        }
    }

    $: nos = NOS.filter((n) => getAccess(n.id).global !== "none")
    function abrir(id: DrawerTabIds) {
        activeDrawerTab.set(id)
    }
</script>

<nav class="arvore" aria-label="Biblioteca" data-acao="arvore">
    {#each nos as n (n.id)}
        {@const aberto = $activeDrawerTab === n.id}
        <button class="no" class:on={aberto} data-no={n.id} aria-expanded={aberto} tabindex="-1" on:mousedown|preventDefault on:click={() => abrir(n.id)}>
            <span class="seta">{aberto ? "▾" : "▸"}</span>
            <span class="nome">{n.nome}</span>
        </button>
        {#if aberto}
            <div class="filhos">
                <Navigation id={n.id} />
            </div>
        {/if}
    {/each}
</nav>

<style>
    .arvore {
        padding: 6px;
        box-sizing: border-box;
        overflow: auto;
        height: 100%;
    }
    .no {
        width: 100%;
        height: 28px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 6px;
        border: none;
        border-radius: 6px;
        text-align: left;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        color: var(--luz-texto);
        background: transparent;
    }
    .no.on {
        background: var(--luz-hover);
    }
    .seta {
        width: 14px;
        color: var(--luz-mudo);
        font-size: 11px;
    }
    .nome {
        flex-grow: 1;
    }
    .filhos {
        margin: 0 0 4px 13px;
        padding-left: 6px;
        border-left: 1px solid var(--luz-linha);
        animation: luz-descer 140ms ease-out;
    }
    .filhos :global(.main),
    .filhos :global(.categories) {
        overflow: visible;
    }
</style>
