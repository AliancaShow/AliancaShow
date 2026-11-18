<script lang="ts">
    // Leiaute v2, fatia 1, commit 4: as paginas do menu (Configuracoes, Telas e monitor de retorno, Ferramentas da saida) ocupam o corpo
    // inteiro, com as pecas de hoje em tres colunas e sem acabamento (diferenca declarada D3; acabamento e da fatia 4). O topo fica; volta-se
    // clicando em Mostrar ou Editar. Qualquer outra pagina nunca chega aqui: AliancaTela a recusa com falhaAlta.
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

    export let pagina: "settings" | "stage" | "draw"
    export let esq = 280
    export let dir = 330
</script>

<div class="corpoPagina" data-pagina={pagina}>
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

<style>
    .corpoPagina {
        flex: 1;
        min-height: 0;
        display: flex;
        gap: 8px;
        padding: 8px;
        box-sizing: border-box;
        border-radius: var(--luz-raio);
        overflow: hidden;
    }
    .col,
    .meio {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: auto;
        border-radius: 10px;
        background: var(--primary, #131315);
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
