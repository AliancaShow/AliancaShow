<script lang="ts">
    import type { SettingsTabs } from "../../../types/Tabs"
    import { activeProfile, focusMode, profiles, settingsTab } from "../../stores"
    import { trocarTela } from "../../utils/aliancaTela"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { configSecao, ROTULOS_CONFIG, type SecaoDeConexao } from "../../utils/aliancaConfigSecao"
    import { sirvo } from "../../utils/aliancaSirvo"

    const tabs: SettingsTabs[] = ["general", "display_settings", "styles", "audio", "connection", "files", "profiles", "other"]

    let activeTabs: SettingsTabs[] = []
    $: profile = $profiles[$activeProfile || ""]
    $: if (profile) activeTabs = clone(tabs).filter((tabId) => profile.access.settings?.[tabId] !== "none")
    else activeTabs = clone(tabs)

    function abrir(tab: SettingsTabs, secao: SecaoDeConexao = "") {
        configSecao.set(secao)
        settingsTab.set(tab)
    }

    function keydown(e: KeyboardEvent) {
        if (e.target?.closest?.(".edit") || e.ctrlKey || e.metaKey) return

        let nextTab = -1
        let currentTabIndex = activeTabs.findIndex((tab) => tab === $settingsTab)

        if (e.key === "ArrowDown") {
            e.preventDefault()

            nextTab = Math.min(activeTabs.length - 1, currentTabIndex + 1)

            if ((currentTabIndex + 1 >= activeTabs.length || $settingsTab === "profiles") && !activeTabs.includes("profiles")) {
                settingsTab.set("profiles")
                return
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault()

            nextTab = Math.max(0, currentTabIndex - 1)
        }

        if (nextTab < 0) return
        configSecao.set("")
        settingsTab.set(activeTabs[nextTab] || "profiles")
    }
</script>

<svelte:window on:keydown={keydown} />

{#if $focusMode}
    <Button on:click={() => trocarTela("show", "voltar-de-pagina")} center dark>
        <Icon id="back" right />
        <T id="actions.back" />
    </Button>
{/if}

<!-- C4: lista lateral do desenho (item de 36 px, ativo = fundo hover com barra creme); Sirvo e Controle remoto sao itens proprios -->
<div class="main" data-acao="config-itens">
    {#each activeTabs as tab}
        <button type="button" class="it" class:a={$settingsTab === tab && $configSecao === ""} data-aba={tab} tabindex="-1" on:click={() => abrir(tab)}>
            <Icon id={tab} white />
            <span>{ROTULOS_CONFIG[tab] || tab}</span>
        </button>
        {#if tab === "display_settings" && activeTabs.includes("styles")}
            <!-- cabine 6 (V1, P2): o Visual (qual modelo cada saida usa em cada tipo de conteudo); mora na aba `styles` -->
            <button type="button" class="it" class:a={$settingsTab === "styles" && $configSecao === "visual"} data-aba="visual" tabindex="-1" on:click={() => abrir("styles", "visual")}>
                <Icon id="templates" white />
                <span>{ROTULOS_CONFIG.visual}</span>
            </button>
        {/if}
    {/each}
    <hr />
    <button type="button" class="it" class:a={$settingsTab === "connection" && $configSecao === "sirvo"} data-aba="sirvo" tabindex="-1" on:click={() => abrir("connection", "sirvo")}>
        <span class="ponto" class:ligado={$sirvo.status === "conectado"}></span>
        <span>{ROTULOS_CONFIG.sirvo}</span>
    </button>
    <button type="button" class="it" class:a={$settingsTab === "connection" && $configSecao === "remote"} data-aba="remote" tabindex="-1" on:click={() => abrir("connection", "remote")}>
        <Icon id="broadcast" white />
        <span>{ROTULOS_CONFIG.remote}</span>
    </button>
    <hr />
    <!-- 1b, D7 (regra B da fatia 2: sempre): o Monitor de retorno (as telas do palco) mora aqui; a moldura de `stage` volta para Configuracoes -->
    <button type="button" class="it" data-aba="stage" tabindex="-1" on:click={() => trocarTela("stage", "botao-de-pagina")}>
        <Icon id="stage" white />
        <span>Monitor de retorno</span>
        <Icon id="launch" size={0.8} white style="margin-left: auto; opacity: 0.5;" />
    </button>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px 8px;
        height: 100%;
        box-sizing: border-box;
        overflow: auto;
    }
    hr {
        border: 0;
        border-top: 1px solid var(--luz-linha);
        margin: 8px 10px;
        width: auto;
    }
    .it {
        position: relative;
        height: 36px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 10px;
        border: 0;
        border-radius: var(--luz-raio-acao);
        background: transparent;
        color: var(--luz-texto-80);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
    }
    .it:hover {
        background: var(--luz-hover);
    }
    .it.a {
        background: var(--luz-hover);
        color: var(--luz-texto);
        font-weight: 600;
    }
    .it.a::before {
        content: "";
        position: absolute;
        left: -8px;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: var(--luz-texto);
    }
    .ponto {
        width: 7px;
        height: 7px;
        margin: 0 4.5px;
        border-radius: 4px;
        background: var(--luz-fraco);
        flex-shrink: 0;
    }
    .ponto.ligado {
        background: var(--luz-verde);
        box-shadow: 0 0 0 3px var(--luz-verde-lavagem);
    }
</style>
