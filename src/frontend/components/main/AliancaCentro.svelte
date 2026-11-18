<script lang="ts">
    // Leiaute v2: o centro. Em Mostrar: cabecalho + a grade de slides de `Show.svelte` em colunas automaticas
    // (`colunasDaGrade`: repeat(auto-fill, minmax(180px, 1fr)) do prototipo). Em Editar (commit 9): o editor de hoje, sem acabamento (D1).
    import { onMount } from "svelte"
    import { colunasDaGrade } from "../../utils/aliancaTelaLogica"
    import Show from "../show/Show.svelte"
    import AliancaCentroCabecalho from "./AliancaCentroCabecalho.svelte"

    let largura = 1274
    $: colunas = colunasDaGrade(largura)
    let corpo: HTMLElement
    onMount(() => {
        const ro = new ResizeObserver(() => (largura = corpo?.clientWidth || largura))
        ro.observe(corpo)
        return () => ro.disconnect()
    })
</script>

<AliancaCentroCabecalho />
<div class="corpo" bind:this={corpo} data-acao="grade-slides">
    <Show {colunas} />
</div>

<style>
    .corpo {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: auto;
        scroll-behavior: smooth;
    }
</style>
