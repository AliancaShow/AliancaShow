<script lang="ts">
    // Leiaute v2: o topo (56 px). Marca com menu do app, pilula Sirvo, segmentado Mostrar | Editar, relogio e pilula do telao.
    // O segmentado e o unico gesto (com o "Editar" do botao direito) que troca Mostrar <-> Editar. Sem atalho de teclado, de proposito.
    // Mostrar escreve: anteparo, pagina `show`, modo `culto` (a ordem de irAoCulto). Editar escreve pagina `edit` e modo `preparar`.
    import { activePage, modoAlianca } from "../../stores"
    import { armarAnteparo, irAoCulto } from "../../utils/aliancaPilula"
    import Clock from "../system/Clock.svelte"
    import AliancaMenuApp from "./AliancaMenuApp.svelte"
    import AliancaSirvoPilula from "./AliancaSirvoPilula.svelte"
    import AliancaTelaoPilula from "./AliancaTelaoPilula.svelte"

    export let semTelaFisica = false

    $: marcado = $activePage === "show" ? "mostrar" : $activePage === "edit" ? "editar" : null

    function irMostrar() {
        irAoCulto()
    }
    function irEditar() {
        armarAnteparo()
        activePage.set("edit")
        modoAlianca.set("preparar")
    }
</script>

<div class="topo" data-regiao="topo">
    <AliancaMenuApp />
    <AliancaSirvoPilula />

    <div class="centro">
        <div class="seg" role="tablist" aria-label="O que o centro mostra" data-acao="segmentado">
            <button role="tab" class="aba" class:on={marcado === "mostrar"} aria-selected={marcado === "mostrar"} data-aba="mostrar" tabindex="-1" on:mousedown|preventDefault on:click={irMostrar}>Mostrar</button>
            <button role="tab" class="aba" class:on={marcado === "editar"} aria-selected={marcado === "editar"} data-aba="editar" tabindex="-1" on:mousedown|preventDefault on:click={irEditar}>Editar</button>
        </div>
    </div>

    <div class="relogio"><Clock style={false} seconds={false} /></div>
    <AliancaTelaoPilula {semTelaFisica} />
</div>

<style>
    .topo {
        position: relative;
        z-index: 3;
        height: 56px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 4px;
    }
    .centro {
        flex-grow: 1;
        display: flex;
        justify-content: center;
    }
    .seg {
        display: flex;
        gap: 2px;
        padding: 3px;
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        border-radius: 10px;
    }
    .aba {
        height: 36px;
        padding: 0 22px;
        border: none;
        border-radius: 7px;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        background: transparent;
        color: var(--luz-mudo);
    }
    .aba.on {
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .relogio {
        font-size: 15px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--luz-texto);
        display: flex;
    }
    .relogio :global(.clock),
    .relogio :global(*) {
        font-size: inherit;
    }
</style>
