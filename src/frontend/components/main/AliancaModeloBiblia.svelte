<script lang="ts">
    // cabine-5 (André, 20/nov): o modelo da Biblia. No FreeShow a escolha morava no painel de informacoes da Biblia (ScriptureInfo),
    // que o leiaute v2 nao monta: sem isto nao havia como escolher nem editar o modelo. Fica no cabecalho da biblioteca com a Biblia aberta.
    // Barra uniforme (26/nov): "Modelo: X ▾" + "Editar modelo" viraram UMA etiqueta com menu (Trocar modelo / Editar modelo); o ＋ ao lado
    // adiciona uma Biblia (era a linha "＋ bíblia" da arvore). Os estilos de .ico/.pop/.item vem do cabecalho (AliancaBibliotecaPainel).
    import { activeEdit, activePopup, outputs, popupData, scriptureSettings, styles, templates } from "../../stores"
    import { trocarTela } from "../../utils/aliancaTela"
    import { getAccess } from "../../utils/profile"

    $: modeloId = $scriptureSettings.template || "scripture"
    $: nome = $templates[modeloId]?.name || "Bíblia"
    const somenteLeitura = getAccess("scripture").global === "read"

    // um estilo de saida com "Sobrepor Escritura com modelo" vence o modelo daqui naquela saida: dizer quais
    $: substituidas = Object.values($outputs)
        .filter((o: any) => o?.enabled && !o?.stageOutput && $styles[o?.style || ""]?.templateScripture)
        .map((o: any) => `${o.name} (estilo ${$styles[o.style]?.name || o.style}: ${$templates[$styles[o.style]?.templateScripture || ""]?.name || "?"})`)

    let aberto = false
    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement).closest?.(".modeloRaiz")) aberto = false
    }

    function escolher() {
        aberto = false
        popupData.set({ active: modeloId, id: "biblia_alianca", trigger: (v: string) => scriptureSettings.update((a) => ({ ...a, template: v || "scripture" })) })
        activePopup.set("select_template")
    }

    function editar() {
        aberto = false
        activeEdit.set({ type: "template", id: modeloId, items: [] })
        trocarTela("edit", "botao-de-pagina")
    }
</script>

<svelte:window on:mousedown={fora} />

<button class="ico" data-acao="biblia-adicionar" data-title="Adicionar uma Bíblia" aria-label="Adicionar uma Bíblia" disabled={somenteLeitura} tabindex="-1" on:mousedown|preventDefault on:click={() => activePopup.set("import_scripture")}>
    <svg class="mais" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
</button>
<div class="menuRaiz modeloRaiz">
    <button class="modelo" data-acao="biblia-modelo" data-title="Modelo dos versículos (fonte, posição da referência, fundo)" aria-haspopup="menu" aria-expanded={aberto} tabindex="-1" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>
        <span class="rot">Modelo</span>
        <b>{nome}</b>
        <span class="seta">▾</span>
    </button>
    {#if aberto}
        <div class="pop" role="menu">
            <div class="sec">Modelo dos versículos</div>
            <button class="item" role="menuitem" data-acao="biblia-modelo-trocar" tabindex="-1" on:mousedown|preventDefault on:click={escolher}>Trocar modelo…</button>
            <button class="item" role="menuitem" data-acao="biblia-modelo-editar" tabindex="-1" on:mousedown|preventDefault on:click={editar}>Editar "{nome}"</button>
        </div>
    {/if}
</div>
{#if substituidas.length}
    <!-- cabine 6 (D14): saida com modelo proprio e escolha do Visual, nao problema: etiqueta neutra -->
    <span class="aviso" data-acao="biblia-modelo-aviso" title={substituidas.join("\n")}>{substituidas.length === 1 ? "1 saída usa" : substituidas.length + " saídas usam"} o modelo do Visual</span>
{/if}

<style>
    .modelo {
        height: 28px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        border-radius: 6px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid var(--luz-borda);
        background: transparent;
        color: var(--luz-texto);
        white-space: nowrap;
    }
    .modelo:hover,
    .modelo[aria-expanded="true"] {
        background: var(--luz-hover);
    }
    .rot,
    .seta {
        color: var(--luz-mudo);
    }
    .seta {
        font-size: 10px;
    }
    .modelo b {
        font-weight: 600;
    }
    .aviso {
        font-size: 12px;
        color: var(--luz-mudo);
        white-space: nowrap;
    }
</style>
