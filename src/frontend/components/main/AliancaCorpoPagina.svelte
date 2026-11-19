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
    import { onDestroy, onMount } from "svelte"
    import { activeStage, statusIndicator } from "../../stores"
    import { alteracoesNaoSalvas, descartarAlteracoes, iniciarRascunho, pararRascunho, tirarFoto } from "../../utils/aliancaConfigRascunho"
    import { textoDeAlteracoes } from "../../utils/aliancaConfigRascunhoLogica"
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
    // so Configuracoes: "N alteracoes nao salvas" e Descartar. A foto e tirada ao abrir e a cada Salvar confirmado (Salvar daqui ou Ctrl+S)
    $: if (pagina === "settings" && $statusIndicator === "saved") tirarFoto()
    onMount(() => {
        if (pagina === "settings") iniciarRascunho()
    })
    function descartar() {
        const n = descartarAlteracoes()
        dizer(n ? "Alterações descartadas" : "Nada a descartar")
    }
    onDestroy(() => {
        pararRascunho()
        if (tEspera) clearTimeout(tEspera)
        if (tAviso) clearTimeout(tAviso)
    })
</script>

<div class="corpoPagina luz-pele" data-pagina={pagina}>
    <header class="cab" data-acao="pagina-cabecalho">
        <h1>{TITULOS[pagina]}</h1>
        <div class="acoes">
            <span class="aviso" data-acao="pagina-aviso" role="status" aria-live="polite">{aviso}</span>
            {#if pagina === "settings"}
                {#if !aviso && $alteracoesNaoSalvas}<span class="pendentes" data-acao="pagina-pendentes">{textoDeAlteracoes($alteracoesNaoSalvas)}</span>{/if}
                <button class="descartar" data-acao="pagina-descartar" data-title="Desfaz o que mudou desde a última vez que salvou" tabindex="-1" disabled={!$alteracoesNaoSalvas} on:mousedown|preventDefault on:click={descartar}>Descartar</button>
            {/if}
            <button class="salvar" data-acao="pagina-salvar" data-title="Salvar (Ctrl+S)" tabindex="-1" on:mousedown|preventDefault on:click={salvar}>Salvar</button>
            <button class="fechar" data-acao="pagina-fechar" data-title={origem === "edit" ? "Voltar a Editar" : "Voltar a Mostrar"} tabindex="-1" on:mousedown|preventDefault on:click={fechar}>Fechar</button>
        </div>
    </header>
    {#if pagina === "settings"}
        <!-- C4: um painel so (lista a esquerda, pagina a direita); as ferramentas de cada pagina descem para o pe da propria pagina -->
        <div class="painelCfg" data-acao="config-painel">
            <nav class="listaCfg" data-acao="config-lista"><SettingsTabs /></nav>
            <div class="paginaCfg">
                <Settings />
                <div class="ferrCfg"><SettingsTools /></div>
            </div>
        </div>
    {:else}
        <div class="cols">
            <div class="col" style="width: {esq}px">
                {#if pagina === "stage"}<StageLayouts />{:else}<DrawTabs />{/if}
            </div>
            <div class="meio">
                {#if pagina === "stage"}<StageLayout />{:else}<DrawSlide />{/if}
            </div>
            {#if pagina !== "stage" || $activeStage.id}
                <div class="col" style="width: {dir}px">
                    {#if pagina === "stage"}<StageTools />{:else}<DrawSettings />{/if}
                </div>
            {/if}
        </div>
    {/if}
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
        font-size: 17px;
        font-weight: 700;
        font-variation-settings: "wdth" 118;
        letter-spacing: -0.01em;
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
    .fechar,
    .descartar {
        height: var(--luz-botao-h);
        padding: 0 14px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-acao);
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .fechar:hover {
        background: var(--luz-hover);
        border-color: var(--luz-borda-forte);
    }
    /* um so primario por tela: Salvar */
    .salvar {
        border-color: var(--luz-texto);
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .salvar:hover {
        background: var(--luz-branco-suave);
    }
    .descartar {
        border-color: transparent;
        background: transparent;
        color: var(--luz-mudo);
    }
    .descartar:hover:not(:disabled) {
        background: var(--luz-hover);
        color: var(--luz-texto);
    }
    .descartar:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .pendentes {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-laranja);
        margin-right: 4px;
    }
    /* Configuracoes: o painel unico do desenho C4 (lista de 236 px + pagina) */
    .painelCfg {
        flex: 1;
        min-height: 0;
        display: flex;
        border-radius: var(--luz-raio);
        background: var(--luz-painel-opaco);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        overflow: hidden;
    }
    .listaCfg {
        width: 236px;
        flex-shrink: 0;
        min-height: 0;
        overflow: auto;
        border-right: 1px solid var(--luz-linha);
    }
    .ferrCfg {
        flex-shrink: 0;
    }
    .paginaCfg {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
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
