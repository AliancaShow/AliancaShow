<script lang="ts">
    // Leiaute v2, biblioteca: a arvore unica, UMA raiz aberta por vez. Rodada da cabine 18/nov (C6): 4 raizes (Shows, Midia, Biblia, Ferramentas); clicar na raiz mostra
    // TUDO dela e os filhos vem direto embaixo, sem intermediario. Le/escreve `activeDrawerTab`; as sub-abas de cada pasta sao as de `drawerTabsData[*].activeSubTab`
    // (a lista delas e a de components/drawer/Navigation.svelte). Audio mora em Midia (com Entradas e Online), Modelos/Funcoes/Calendario/Sobreposicoes em Ferramentas.
    // Aba sem no: na carga e saneada sem faixa; em uso (escrita depois da carga) chama falhaAlta("arvore-sem-no") e a arvore volta.
    import { onMount } from "svelte"
    import { activeDrawerTab, drawerTabsData, shows } from "../../stores"
    import { decidirEscrita, FILHOS_FERRAMENTAS, RAIZES, SUBABAS_NA_ARVORE, raizDaAba, raizMostraTudo, sanearNaCarga, sanearSubAba, type Raiz } from "../../utils/aliancaArvoreLogica"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { getAccess } from "../../utils/profile"
    import Navigation from "../drawer/Navigation.svelte"
    import Icon from "../helpers/Icon.svelte"
    import type { DrawerTabIds } from "../../../types/Tabs"

    let ultimoValido: DrawerTabIds = "shows"
    let carregado = false
    onMount(() => {
        const saneada = sanearNaCarga($activeDrawerTab)
        ultimoValido = saneada
        if (saneada !== $activeDrawerTab) activeDrawerTab.set(saneada)
        // sub-aba salva de antes da C6 ("Midias" da pasta-raiz) vira "all"; Modelos/Calendario/Funcoes/Sobreposicoes mostram as sub-abas delas quando abertos (nada fica preso)
        drawerTabsData.update((a) => {
            for (const aba of Object.keys(a)) {
                const sub = a[aba as DrawerTabIds]?.activeSubTab
                const nova = sanearSubAba(aba, sub)
                if (sub !== undefined && nova !== sub) a[aba as DrawerTabIds] = { ...a[aba as DrawerTabIds], activeSubTab: nova }
            }
            return a
        })
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

    $: aba = $activeDrawerTab
    $: raizAberta = raizDaAba(aba)
    $: subAba = $drawerTabsData[aba as DrawerTabIds]?.activeSubTab || ""
    $: raizes = RAIZES.filter((r) => (r.id === "ferramentas" ? FILHOS_FERRAMENTAS.some((f) => getAccess(f.id).global !== "none") : getAccess(r.abre).global !== "none"))
    $: filhosFerramentas = FILHOS_FERRAMENTAS.filter((f) => getAccess(f.id).global !== "none")
    $: raiz = raizes.find((r) => r.id === raizAberta) || null
    $: totalShows = Object.values($shows).filter((s: any) => s && !s.private).length

    function definirSub(destino: DrawerTabIds, sub: string) {
        drawerTabsData.update((a) => {
            a[destino] = { ...a[destino], activeSubTab: sub, enabled: a[destino]?.enabled !== false }
            return a
        })
    }
    /** clicar na raiz: abre e mostra TUDO dela (Shows e Midia: sub-aba "all"; Biblia mantem a versao; Ferramentas abre o 1o filho) */
    function abrirRaiz(r: Raiz) {
        if (r.id === "ferramentas") {
            if (raizAberta !== "ferramentas") activeDrawerTab.set(filhosFerramentas[0]?.id || "templates")
            return
        }
        activeDrawerTab.set(r.abre)
        if (r.id === "shows" || r.id === "media") definirSub(r.abre, "all")
    }
    function abrirFilho(destino: DrawerTabIds, sub = "") {
        activeDrawerTab.set(destino)
        if (sub) definirSub(destino, sub)
    }
    const ehSub = (destino: DrawerTabIds, sub: string) => aba === destino && subAba === sub
</script>

<!-- 26/nov: as raizes viraram abas fixas na barra (AliancaBibliotecaAbas); a arvore mostra so o que mora na aba aberta -->
<nav class="arvore" aria-label="Pastas" data-acao="arvore">
    {#if raiz}
        <div class="filhos" data-raiz={raiz.id}>
            {#if raiz.id === "shows" || raiz.id === "media"}
                <button class="fil" class:on={raizMostraTudo(raiz.id, aba, subAba)} data-no={raiz.id} tabindex="-1" on:mousedown|preventDefault on:click={() => abrirRaiz(raiz)}>
                    <span class="nome">Todos</span>
                    {#if raiz.id === "shows"}<span class="ct">{totalShows}</span>{/if}
                </button>
            {/if}
            {#if raiz.id === "ferramentas"}
                {#each filhosFerramentas as f (f.id)}
                    <button class="fil" class:on={aba === f.id} data-no={f.id} tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho(f.id)}>{f.nome}</button>
                    <!-- Funcoes, Sobreposicoes, Modelos (categorias, "Nova categoria") e Calendario ("Importar calendario") guardam sub-abas/acoes de verdade: abertos, mostram os delas embaixo (revisao do PR #40, achado 6) -->
                    {#if aba === f.id && SUBABAS_NA_ARVORE.includes(f.id)}<div class="neto"><Navigation id={f.id} /></div>{/if}
                {/each}
            {:else}
                <Navigation id={raiz.id} />
                {#if raiz.id === "media"}
                    <div class="fio"></div>
                    <button class="fil" class:on={aba === "audio"} data-no="audio" tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho("audio")}><Icon id="audio" size={0.8} white />Áudio</button>
                    {#if aba === "audio"}<div class="neto"><Navigation id="audio" /></div>{/if}
                    <button class="fil" class:on={ehSub("media", "inputs")} data-no="inputs" tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho("media", "inputs")}><Icon id="input" size={0.8} white />Entradas</button>
                    <button class="fil" class:on={ehSub("media", "online")} data-no="online" tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho("media", "online")}><Icon id="web" size={0.8} white />Online</button>
                {/if}
            {/if}
        </div>
    {/if}
</nav>

<style>
    .arvore {
        padding: 6px;
        box-sizing: border-box;
        overflow: auto;
        height: 100%;
    }
    .nome {
        flex-grow: 1;
    }
    .ct {
        font-size: 11px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--luz-mudo);
    }
    .filhos {
        animation: luz-descer 140ms ease-out;
    }
    .filhos :global(.main),
    .filhos :global(.categories) {
        overflow: visible;
    }
    /* filhos que sao outra aba (Ferramentas) e as linhas de Midia que nao sao pasta (Audio, Entradas, Online: levam icone) */
    .fil {
        width: 100%;
        height: 26px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 8px;
        border: none;
        border-radius: 6px;
        text-align: left;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        color: var(--luz-texto-80);
        background: transparent;
        cursor: pointer;
    }
    .fil:hover {
        background: var(--luz-hover);
    }
    .fil.on {
        background: var(--luz-hover);
        color: var(--luz-texto);
        font-weight: 600;
    }
    .fio {
        height: 1px;
        margin: 5px 8px;
        background: var(--luz-linha);
    }
    .neto {
        margin-left: 10px;
    }
</style>
