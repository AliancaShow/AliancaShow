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
    import { alteracoesNaoSalvas, descartarAlteracoes, fotoParaSalvar, iniciarRascunho, pararRascunho, tirarFoto } from "../../utils/aliancaConfigRascunho"
    import { textoDeAlteracoes } from "../../utils/aliancaConfigRascunhoLogica"
    import { trocarTela } from "../../utils/aliancaTela"
    import { abrirModelosDeSlides } from "../../utils/aliancaModelosRetorno"
    import { cancelarPendenciasDoVisual } from "../../utils/aliancaVisualAplicador"
    import { save } from "../../utils/save"

    export let pagina: "settings" | "stage" | "draw"
    /** a tela de onde a pagina foi aberta (Mostrar ou Editar): o Fechar volta para la */
    export let origem: "show" | "edit" = "show"
    export let esq = 280
    export let dir = 330

    // 25/nov ("aprovo papeis-saida"): a pagina "stage" e o editor dos MODELOS DE RETORNO; abre pela aba Retorno de Editar > Modelos
    const TITULOS = { settings: "Configurações", stage: "Modelos de retorno", draw: "Ferramentas da saída" }
    function fechar() {
        if (origem === "edit") trocarTela("edit", "voltar-de-pagina")
        else trocarTela("show", "voltar-de-pagina")
    }

    // Fechar Configuracoes com alteracoes pendentes: confirmacao inline (nunca o dialogo do navegador). As mudancas ja valem ao vivo; o que se arrisca e o disco.
    let confirmando = false
    function pedirFechar() {
        if (pagina === "settings" && $alteracoesNaoSalvas > 0) confirmando = true
        else fechar()
    }
    let fecharDepois = false

    // Salvar: o mesmo `save()` do Ctrl+S. Confirma em texto discreto; se o aviso de "salvo" nao vier, diz isso (nunca fica mudo).
    let aviso = ""
    let esperando = false
    let fotoDoSalvar: ReturnType<typeof fotoParaSalvar> | null = null
    let tEspera: ReturnType<typeof setTimeout> | null = null
    let tAviso: ReturnType<typeof setTimeout> | null = null
    function dizer(texto: string, ms = 3000) {
        aviso = texto
        if (tAviso) clearTimeout(tAviso)
        tAviso = setTimeout(() => (aviso = ""), ms)
    }
    function salvar(_e?: unknown, depoisFechar = false) {
        esperando = true
        fecharDepois = depoisFechar
        aviso = "Salvando…"
        // a foto e a do momento do clique: o que mudar enquanto o disco confirma continua pendente
        if (pagina === "settings") fotoDoSalvar = fotoParaSalvar()
        if (tEspera) clearTimeout(tEspera)
        tEspera = setTimeout(() => {
            if (esperando) {
                esperando = false
                fecharDepois = false
                confirmando = false
                dizer("Não consegui confirmar que salvou", 6000)
            }
        }, 5000)
        save()
    }
    $: if (esperando && $statusIndicator === "saved") {
        esperando = false
        if (tEspera) clearTimeout(tEspera)
        // so o botao Salvar renova a foto: o autosave ou outra pagina interna nao zeram o que ainda esta pendente
        if (pagina === "settings" && fotoDoSalvar) tirarFoto(fotoDoSalvar)
        fotoDoSalvar = null
        dizer("Salvo ✓")
        if (fecharDepois) {
            fecharDepois = false
            confirmando = false
            fechar()
        }
    }
    onMount(() => {
        if (pagina === "settings") iniciarRascunho()
    })
    function descartar(_e?: unknown, depoisFechar = false) {
        // cabine 6 (adendo da revisao, item 1): o que o Visual deixou esperando o proximo slide nao entra mais
        cancelarPendenciasDoVisual()
        const { desfeitas, restantes } = descartarAlteracoes()
        if (restantes) {
            dizer(`${restantes} alteraç${restantes === 1 ? "ão não pôde" : "ões não puderam"} ser desfeita${restantes === 1 ? "" : "s"}`, 6000)
            confirmando = false
            return
        }
        dizer(desfeitas ? "Alterações descartadas" : "Nada a descartar")
        confirmando = false
        if (depoisFechar) fechar()
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
        {#if pagina === "stage"}
            <div class="tiposModelo" role="tablist" data-acao="modelos-tipo">
                <button type="button" role="tab" aria-selected="false" tabindex="-1" data-tipo="slides" on:mousedown|preventDefault on:click={abrirModelosDeSlides}>Slides</button>
                <button type="button" role="tab" aria-selected="true" class="on" tabindex="-1" data-tipo="retorno">Retorno</button>
            </div>
        {/if}
        <div class="acoes">
            <span class="aviso" data-acao="pagina-aviso" role="status" aria-live="polite">{aviso}</span>
            {#if pagina === "settings"}
                {#if !aviso && $alteracoesNaoSalvas}<span class="pendentes" data-acao="pagina-pendentes">{textoDeAlteracoes($alteracoesNaoSalvas)}</span>{/if}
                <button class="descartar" data-acao="pagina-descartar" data-title="Desfaz as opções mudadas desde a última vez que salvou. Não desfaz o que vale na hora (criar saída, ligar e desligar, mover de tela)" tabindex="-1" disabled={!$alteracoesNaoSalvas} on:mousedown|preventDefault on:click={descartar}>Descartar</button>
            {/if}
            <button class="salvar" data-acao="pagina-salvar" data-title="Salvar (Ctrl+S)" tabindex="-1" on:mousedown|preventDefault on:click={salvar}>Salvar</button>
            <button class="fechar" data-acao="pagina-fechar" data-title={origem === "edit" ? "Voltar a Editar" : "Voltar a Mostrar"} tabindex="-1" on:mousedown|preventDefault on:click={pedirFechar}>Fechar</button>
        </div>
    </header>
    {#if confirmando}
        <div class="confirma" data-acao="fechar-confirma" role="alertdialog" aria-label="Alterações não salvas">
            <span>{textoDeAlteracoes($alteracoesNaoSalvas)}. Salvar antes de fechar?</span>
            <button class="salvar" data-acao="fechar-salvar" tabindex="-1" on:mousedown|preventDefault on:click={() => salvar(undefined, true)}>Salvar</button>
            <button class="fechar" data-acao="fechar-descartar" tabindex="-1" on:mousedown|preventDefault on:click={() => descartar(undefined, true)}>Descartar</button>
            <button class="fechar" data-acao="fechar-continuar" tabindex="-1" on:mousedown|preventDefault on:click={() => (confirmando = false)}>Continuar editando</button>
        </div>
    {/if}
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
    .tiposModelo {
        display: flex;
        gap: 2px;
        margin: 0 auto 0 16px;
        padding: 2px;
        border-radius: 7px;
        background: var(--luz-trilho);
    }
    .tiposModelo button {
        height: 26px;
        padding: 0 14px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }
    .tiposModelo button.on {
        background: var(--luz-texto);
        color: var(--luz-tinta);
        cursor: default;
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
    .confirma {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: var(--luz-raio-campo);
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-laranja);
        font-family: var(--luz-fonte);
        font-size: 13px;
        color: var(--luz-texto);
    }
    .confirma span {
        margin-right: auto;
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
