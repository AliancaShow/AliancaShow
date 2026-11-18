<script lang="ts">
    // Leiaute v2, fatia 1, commit 4: as paginas do menu (Configuracoes, Telas e monitor de retorno, Ferramentas da saida) ocupam o corpo
    // inteiro, com as pecas de hoje em tres colunas. Fatia 4: ganham a forma final, um cabecalho com o nome da pagina e o botao "Fechar"
    // (volta a Mostrar ou Editar, de onde veio, pela porta `trocarTela`) e "Salvar" e as colunas viram paineis no tema Luz. O topo fica; Mostrar e Editar tambem voltam.
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
    import { onDestroy } from "svelte"
    import { activeStage, statusIndicator } from "../../stores"
    import { trocarTela } from "../../utils/aliancaTela"
    import { save } from "../../utils/save"

    export let pagina: "settings" | "stage" | "draw"
    /** a tela de onde a pagina foi aberta (Mostrar ou Editar): o Fechar volta para la */
    export let origem: "show" | "edit" = "show"
    export let esq = 280
    export let dir = 330

    const TITULOS = { settings: "Configurações", stage: "Telas e monitor de retorno", draw: "Ferramentas da saída" }
    function fechar() {
        if (origem === "edit") trocarTela("edit", "voltar-de-pagina")
        else trocarTela("show", "voltar-de-pagina")
    }

    // Salvar: o mesmo `save()` do Ctrl+S. Confirma em texto discreto; se o aviso de "salvo" nao vier, diz isso (nunca fica mudo).
    let aviso = ""
    let esperando = false
    let tEspera: ReturnType<typeof setTimeout> | null = null
    let tAviso: ReturnType<typeof setTimeout> | null = null
    function dizer(texto: string, ms = 3000) {
        aviso = texto
        if (tAviso) clearTimeout(tAviso)
        tAviso = setTimeout(() => (aviso = ""), ms)
    }
    function salvar() {
        esperando = true
        aviso = "Salvando…"
        if (tEspera) clearTimeout(tEspera)
        tEspera = setTimeout(() => {
            if (esperando) {
                esperando = false
                dizer("Não consegui confirmar que salvou", 6000)
            }
        }, 5000)
        save()
    }
    $: if (esperando && $statusIndicator === "saved") {
        esperando = false
        if (tEspera) clearTimeout(tEspera)
        dizer("Salvo ✓")
    }
    onDestroy(() => {
        if (tEspera) clearTimeout(tEspera)
        if (tAviso) clearTimeout(tAviso)
    })
</script>

<div class="corpoPagina" data-pagina={pagina}>
    <header class="cab" data-acao="pagina-cabecalho">
        <h1>{TITULOS[pagina]}</h1>
        <div class="acoes">
            <span class="aviso" data-acao="pagina-aviso" role="status" aria-live="polite">{aviso}</span>
            <button class="salvar" data-acao="pagina-salvar" data-title="Salvar (Ctrl+S)" tabindex="-1" on:mousedown|preventDefault on:click={salvar}>Salvar</button>
            <button class="fechar" data-acao="pagina-fechar" data-title={origem === "edit" ? "Voltar a Editar" : "Voltar a Mostrar"} tabindex="-1" on:mousedown|preventDefault on:click={fechar}>Fechar</button>
        </div>
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
    .acoes {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .aviso {
        font-size: 12px;
        color: var(--luz-mudo);
        margin-right: 4px;
    }
    .salvar,
    .fechar {
        height: 32px;
        padding: 0 18px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .salvar:hover {
        background: var(--luz-hover);
        border-color: var(--luz-borda-forte);
    }
    .fechar {
        font-weight: 600;
        border-color: var(--luz-texto);
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .fechar:hover {
        background: rgba(248, 248, 240, 0.85);
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
