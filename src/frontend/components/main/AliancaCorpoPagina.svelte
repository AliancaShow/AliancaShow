<script lang="ts">
    // Leiaute v2, fatia 1, commit 4: as paginas do menu (Configuracoes, Telas e monitor de retorno, Ferramentas da saida) ocupam o corpo
    // inteiro, com as pecas de hoje em tres colunas. Fatia 4: ganham a forma final, um cabecalho com o nome da pagina e o botao "Fechar"
    // (volta a Mostrar, pela mesma porta do segmentado) e as colunas viram paineis no tema Luz. O topo fica; Mostrar e Editar tambem voltam.
    // Qualquer outra pagina nunca chega aqui: AliancaTela a recusa com falhaAlta.
    import DrawSettings from "../draw/DrawSettings.svelte"
    import DrawTabs from "../draw/DrawTabs.svelte"
    import DrawSlide from "../draw/Slide.svelte"
    import Settings from "../settings/Settings.svelte"
    import SettingsTabs from "../settings/SettingsTabs.svelte"
    import SettingsTools from "../settings/SettingsTools.svelte"
    import StageLayout from "../stage/StageLayout.svelte"
    import StageLayouts from "../stage/StageLayouts.svelte"
    import StageTools from "../stage/StageTools.svelte"
    import { activeStage } from "../../stores"
    import { trocarTela } from "../../utils/aliancaTela"

    export let pagina: "settings" | "stage" | "draw"
    export let esq = 280
    export let dir = 330

    const TITULOS = { settings: "Configurações", stage: "Telas e monitor de retorno", draw: "Ferramentas da saída" }
    function fechar() {
        trocarTela("show", "voltar-de-pagina")
    }
</script>

<div class="corpoPagina" data-pagina={pagina}>
    <header class="cab" data-acao="pagina-cabecalho">
        <h1>{TITULOS[pagina]}</h1>
        <button class="fechar" data-acao="pagina-fechar" tabindex="-1" on:mousedown|preventDefault on:click={fechar}>Fechar</button>
    </header>
    <div class="cols">
        <div class="col" style="width: {esq}px">
            {#if pagina === "settings"}<SettingsTabs />{:else if pagina === "stage"}<StageLayouts />{:else}<DrawTabs />{/if}
        </div>
        <div class="meio">
            {#if pagina === "settings"}<Settings />{:else if pagina === "stage"}<StageLayout />{:else}<DrawSlide />{/if}
        </div>
        {#if pagina !== "stage" || $activeStage.id}
            <div class="col" style="width: {dir}px">
                {#if pagina === "settings"}<SettingsTools />{:else if pagina === "stage"}<StageTools />{:else}<DrawSettings />{/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .corpoPagina {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        box-sizing: border-box;
        border-radius: var(--luz-raio);
        overflow: hidden;
    }
    .cab {
        flex-shrink: 0;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 4px 0 8px;
        color: var(--luz-texto);
        font-family: var(--luz-fonte);
    }
    .cab h1 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--luz-texto);
    }
    .fechar {
        height: 32px;
        padding: 0 16px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .fechar:hover {
        background: var(--luz-hover);
    }
    .cols {
        flex: 1;
        min-height: 0;
        display: flex;
        gap: 8px;
    }
    .col,
    .meio {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: auto;
        border-radius: 10px;
        background: var(--primary, #131315);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
    }
    .col {
        flex-shrink: 0;
    }
    .meio {
        flex: 1;
        min-width: 0;
        position: relative;
    }
</style>
