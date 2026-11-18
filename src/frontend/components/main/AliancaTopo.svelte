<script lang="ts">
    // Leiaute v2: o topo (56 px). Marca com menu do app, pilula Sirvo, segmentado Mostrar | Editar, relogio e pilula do telao.
    // O segmentado e o unico gesto (com o "Editar" do botao direito) que troca Mostrar <-> Editar. Sem atalho de teclado, de proposito.
    // Mostrar e Editar passam pela porta `trocarTela` (chegar em Mostrar arma o anteparo antes de escrever).
    // Fatia 4: sem titulo nativo nem barra de menus. O topo e a area de arrastar a janela (o que e botao nao arrasta) e, no Windows, deixa
    // livre o canto direito onde o Electron desenha minimizar, maximizar e fechar (titleBarOverlay, 56 px de altura, o mesmo do topo).
    import { os } from "../../stores"
    import { tela, trocarTela } from "../../utils/aliancaTela"
    import { marcadoDoSegmentado } from "../../utils/aliancaSegmentadoLogica"
    import StatusIndicator from "./StatusIndicator.svelte"
    import Clock from "../system/Clock.svelte"
    import AliancaMenuApp from "./AliancaMenuApp.svelte"
    import AliancaSirvoPilula from "./AliancaSirvoPilula.svelte"
    import AliancaTelaoPilula from "./AliancaTelaoPilula.svelte"

    export let semTelaFisica = false

    // a aba acesa e a da `tela` (a mesma regra que o teclado obedece)
    $: marcado = marcadoDoSegmentado($tela)

    function irMostrar() {
        trocarTela("show", "segmentado")
    }
    function irEditar() {
        trocarTela("edit", "segmentado")
    }
</script>

<div class="topo" class:comControles={$os.platform === "win32"} data-regiao="topo">
    <AliancaMenuApp />
    <AliancaSirvoPilula />
    <!-- indicador de salvando/salvo: largura zero, ao lado da pilula Sirvo (no vazio do centro), nunca sobre o logo -->
    <div class="estado"><StatusIndicator /></div>

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
    .topo.comControles {
        /* a medida real dos botoes nativos (varia com a versao do Windows e a escala): o que sobra do titlebar-area a direita. Sem env(): 140 px */
        padding-right: calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, calc(100vw - 140px)));
    }
    .topo {
        -webkit-app-region: drag;
    }
    .topo > :global(*) {
        -webkit-app-region: no-drag;
    }
    .estado {
        position: relative;
        width: 0;
        height: 0;
        align-self: center;
    }
    .centro {
        flex-grow: 1;
        display: flex;
        justify-content: center;
        -webkit-app-region: drag !important;
    }
    .seg {
        -webkit-app-region: no-drag;
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
