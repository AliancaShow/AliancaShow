<script lang="ts">
    // cabine-5 (André, 20/nov): o modelo da Biblia. No FreeShow a escolha morava no painel de informacoes da Biblia (ScriptureInfo),
    // que o leiaute v2 nao monta: sem isto nao havia como escolher nem editar o modelo. Fica no cabecalho da biblioteca com a Biblia aberta.
    import { activeEdit, activePopup, outputs, popupData, scriptureSettings, styles, templates } from "../../stores"
    import { trocarTela } from "../../utils/aliancaTela"

    $: modeloId = $scriptureSettings.template || "scripture"
    $: nome = $templates[modeloId]?.name || "Bíblia"

    // um estilo de saida com "Sobrepor Escritura com modelo" vence o modelo daqui naquela saida: dizer quais
    $: substituidas = Object.values($outputs)
        .filter((o: any) => o?.enabled && !o?.stageOutput && $styles[o?.style || ""]?.templateScripture)
        .map((o: any) => `${o.name} (estilo ${$styles[o.style]?.name || o.style}: ${$templates[$styles[o.style]?.templateScripture || ""]?.name || "?"})`)

    function escolher() {
        popupData.set({ active: modeloId, id: "biblia_alianca", trigger: (v: string) => scriptureSettings.update((a) => ({ ...a, template: v || "scripture" })) })
        activePopup.set("select_template")
    }

    function editar() {
        activeEdit.set({ type: "template", id: modeloId, items: [] })
        trocarTela("edit", "botao-de-pagina")
    }
</script>

<button class="chip" tabindex="-1" data-acao="biblia-modelo" title="Modelo dos versículos (fonte, posição da referência, fundo)" on:mousedown|preventDefault on:click={escolher}>Modelo: <b>{nome}</b> ▾</button>
<button class="chip" tabindex="-1" data-acao="biblia-modelo-editar" title="Abrir o modelo no Editar" on:mousedown|preventDefault on:click={editar}>Editar modelo</button>
{#if substituidas.length}
    <span class="aviso" data-acao="biblia-modelo-aviso" title={substituidas.join("\n")}>⚠ {substituidas.length === 1 ? "1 saída usa" : substituidas.length + " saídas usam"} outro modelo (estilo)</span>
{/if}

<style>
    .chip {
        height: 28px;
        padding: 0 10px;
        border-radius: 14px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid var(--luz-borda);
        background: var(--luz-campo);
        color: var(--luz-texto);
        white-space: nowrap;
    }
    .chip b {
        font-weight: 600;
    }
    .aviso {
        font-size: 12px;
        color: var(--luz-laranja);
        white-space: nowrap;
    }
</style>
