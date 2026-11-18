<script lang="ts">
    // Leiaute v2, biblioteca: a arvore unica, UMA raiz aberta por vez. Rodada da cabine 18/nov (C6): 4 raizes (Shows, Midia, Biblia, Ferramentas); clicar na raiz mostra
    // TUDO dela e os filhos vem direto embaixo, sem intermediario. Le/escreve `activeDrawerTab`; as sub-abas de cada pasta sao as de `drawerTabsData[*].activeSubTab`
    // (a lista delas e a de components/drawer/Navigation.svelte). Audio mora em Midia (com Entradas e Online), Modelos/Funcoes/Calendario/Sobreposicoes em Ferramentas.
    // Aba sem no: na carga e saneada sem faixa; em uso (escrita depois da carga) chama falhaAlta("arvore-sem-no") e a arvore volta.
    import { onMount } from "svelte"
    import { activeDrawerTab, drawerTabsData, shows } from "../../stores"
    import { decidirEscrita, FILHOS_FERRAMENTAS, RAIZES, raizDaAba, raizMostraTudo, sanearNaCarga, sanearSubAba, type Raiz } from "../../utils/aliancaArvoreLogica"
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
        // sub-aba salva de antes da C6 ("Midias" da pasta-raiz, "Efeitos" de Sobreposicoes): vira "all"
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

<nav class="arvore" aria-label="Biblioteca" data-acao="arvore">
    {#each raizes as r (r.id)}
        {@const aberta = raizAberta === r.id}
        {@const tudo = aberta && raizMostraTudo(r.id, aba, subAba)}
        <button class="no" class:on={tudo} data-no={r.id} aria-expanded={aberta} tabindex="-1" on:mousedown|preventDefault on:click={() => abrirRaiz(r)}>
            <span class="seta">{aberta ? "▾" : "▸"}</span>
            <span class="nome">{r.nome}</span>
            {#if r.id === "shows"}<span class="ct">{totalShows}</span>{/if}
        </button>
        {#if aberta}
            <div class="filhos">
                {#if r.id === "ferramentas"}
                    {#each filhosFerramentas as f (f.id)}
                        <button class="fil" class:on={aba === f.id} data-no={f.id} tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho(f.id)}>{f.nome}</button>
                        <!-- Funcoes (acoes, variaveis, temporizadores) e Sobreposicoes (efeitos, categorias) guardam sub-abas de verdade: abertas, mostram as delas embaixo -->
                        {#if aba === f.id && (f.id === "functions" || f.id === "overlays")}<div class="neto"><Navigation id={f.id} /></div>{/if}
                    {/each}
                {:else}
                    <Navigation id={r.id} />
                    {#if r.id === "media"}
                        <div class="fio"></div>
                        <button class="fil" class:on={aba === "audio"} data-no="audio" tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho("audio")}><Icon id="audio" size={0.8} white />Áudio</button>
                        {#if aba === "audio"}<div class="neto"><Navigation id="audio" /></div>{/if}
                        <button class="fil" class:on={ehSub("media", "inputs")} data-no="inputs" tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho("media", "inputs")}><Icon id="input" size={0.8} white />Entradas</button>
                        <button class="fil" class:on={ehSub("media", "online")} data-no="online" tabindex="-1" on:mousedown|preventDefault on:click={() => abrirFilho("media", "online")}><Icon id="web" size={0.8} white />Online</button>
                    {/if}
                {/if}
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
    /* raiz SELECIONADA (mostrando tudo) = fundo claro na propria raiz; filho selecionado = so a raiz aberta */
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
    .ct {
        font-size: 11px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--luz-mudo);
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
