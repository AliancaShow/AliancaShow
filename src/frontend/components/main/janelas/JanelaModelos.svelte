<script lang="ts">
    // AliancaShow (26/nov, "janelas nossas"): escolher modelo sem a parede de slides enormes. Lista de 36 px (miniatura pequena + nome),
    // em faixas Modelos / Biblia, e uma previa grande do modelo sob o mouse. Mesma logica do SelectTemplate do FreeShow (busca, tipos da
    // Biblia 1-4, "Nenhum"/"Padrao", trigger, doubleClick, revert); o SelectTemplate original segue intacto no fecho.
    import { activePopup, activeStyle, drawerTabsData, outputs, popupData, scriptures, special, styles, templates } from "../../../stores"
    import { saidaDoEditor } from "../../../utils/aliancaSaidaDoEditorLogica"
    import { getResolution } from "../../helpers/output"
    import { formatSearch } from "../../../utils/search"
    import TemplateSlide from "../../drawer/pages/TemplateSlide.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"

    // a proporcao e a da saida que o editor usa (a mesma do TemplateSlide): no painel de LED 4:3 a previa nao pode ser 16:9
    $: res = getResolution(null, { $outputs, $styles }, false, saidaDoEditor($outputs, $special?.aliancaSaidaPrincipal))
    $: proporcao = `${res?.width || 16} / ${res?.height || 9}`

    const revert = $popupData.revert
    const permiteVazio = !!$popupData.allowEmpty
    const id: string = $popupData.id || ""
    const ocultos: string[] = $popupData.hideIds || []

    $: todos = sortByName(keysToID($templates).filter((a: any) => !ocultos.includes(a.id) && a?.settings?.mode !== "text"))

    // versoes da Biblia (1 a 4 traducoes lado a lado)
    let tipos: { value: string; label: string }[] = []
    let valores: string[] = []
    if (id === "scripture" && Object.values($scriptures).find((a: any) => a.collection)) {
        tipos = [
            { value: "", label: "1" },
            { value: "_2", label: "2" },
            { value: "_3", label: "3" },
            { value: "_4", label: "4" }
        ]
        const estilo = $styles[$activeStyle]
        valores = tipos.map((a) => estilo?.["templateScripture" + a.value] || "")
    }
    let tipo = tipos[0]?.value || ""
    $: variosTipos = tipos.length > 1
    $: valor = variosTipos ? valores[tipos.findIndex((a) => a.value === tipo)] || "" : $popupData.active || ""

    let busca = ""
    $: termo = formatSearch(busca || "")
    $: achados = termo.length < 2 ? todos : todos.filter((a: any) => formatSearch(a.name || "").includes(termo))

    function cortarBiblia(lista: any[], _t: string) {
        let conta = ""
        if (id === "scripture") conta = tipo
        else if (id === "scripture_drawer") {
            const atual = $scriptures[$drawerTabsData.scripture?.activeSubTab || ""] as any
            if (!atual) return lista
            const n = atual.collection?.versions?.length || 1
            conta = n > 1 ? "_" + n : ""
        }
        const manter = ["scripture" + conta, "scriptureLT" + conta]
        const tirar = ["scripture", "scripture_2", "scripture_3", "scripture_4", "scriptureLT", "scriptureLT_2"].filter((a) => !manter.includes(a))
        return lista.filter((a) => !tirar.includes(a.id))
    }
    $: normais = achados.filter((a: any) => a.category !== "scripture")
    $: biblia = cortarBiblia(
        achados.filter((a: any) => a.category === "scripture"),
        tipo
    )
    $: grupos = (
        id.includes("scripture")
            ? [
                  ["Bíblia", biblia],
                  ["Modelos", normais]
              ]
            : [
                  ["Modelos", normais],
                  ["Bíblia", biblia]
              ]
    ).filter(([, l]) => (l as any[]).length) as [string, any[]][]
    $: primeiro = grupos[0]?.[1]?.[0]

    let sob: any = null
    $: emFoco = sob || todos.find((a: any) => a.id === valor) || primeiro || null

    function escolher(modelo: any, teclado = false) {
        const anterior = valor
        const novo = modelo?.id || ""
        valor = novo
        setTimeout(() => {
            if ($popupData.trigger) {
                if (tipo) $popupData.trigger({ value: novo, type: tipo })
                else $popupData.trigger(novo)
            }
            if ($popupData.doubleClick && !teclado && anterior !== novo) return
            if (!revert) setTimeout(() => popupData.set({}), 500)
            activePopup.set(revert || null)
        })
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" && termo.length && primeiro) escolher(primeiro, true)
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="modelos" data-janela="modelos" style="--proporcao: {proporcao}">
    <div class="barra">
        {#if revert}
            <button class="mini" data-title="Voltar" on:click={() => activePopup.set(revert)}><Icon id="back" size={0.9} white /></button>
        {/if}
        <label class="busca">
            <Icon id="search" size={0.85} white />
            <!-- svelte-ignore a11y-autofocus -->
            <input bind:value={busca} placeholder="Buscar modelo" spellcheck="false" autofocus />
        </label>
        {#if variosTipos}
            <div class="tipos" data-title="Quantas traduções aparecem juntas">
                <Icon id="scripture" size={0.85} white />
                {#each tipos as t}
                    <button class:ativo={tipo === t.value} on:click={() => (tipo = t.value)}>{t.label}</button>
                {/each}
            </div>
        {/if}
    </div>

    <div class="corpo">
        <div class="lista">
            {#if permiteVazio || (variosTipos && tipo !== tipos[0]?.value)}
                <button class="linha" class:ativo={!valor} on:mouseenter={() => (sob = null)} on:click={() => escolher(null)}>
                    <span class="mini-thumb vazio"><Icon id="close" size={0.8} white /></span>
                    <span class="nome">{permiteVazio ? "Nenhum" : "Padrão"}</span>
                </button>
            {/if}
            {#each grupos as [titulo, lista] (titulo)}
                {#if grupos.length > 1}<div class="faixa">{titulo}</div>{/if}
                {#each lista as m (m.id)}
                    <button class="linha" class:ativo={valor === m.id} data-modelo={m.id} on:mouseenter={() => (sob = m)} on:click={() => escolher(m)}>
                        <span class="mini-thumb"><TemplateSlide templateId={m.id} template={m} preview /></span>
                        <span class="nome">{m.name || "Sem nome"}</span>
                        {#if valor === m.id}<Icon id="check" size={0.8} white />{/if}
                    </button>
                {/each}
            {:else}
                <p class="nada">{todos.length ? "Nenhum modelo com esse nome" : "Nenhum modelo criado"}</p>
            {/each}
        </div>

        <div class="previa">
            {#if emFoco}
                {#key emFoco.id}
                    <div class="tela"><TemplateSlide templateId={emFoco.id} template={emFoco} preview /></div>
                {/key}
                <div class="legenda">{emFoco.name || "Sem nome"}</div>
            {/if}
        </div>
    </div>
</div>

<style>
    .modelos {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .barra {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .busca {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 30px;
        padding: 0 10px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
    }
    .busca:focus-within {
        border-color: var(--luz-borda-forte);
    }
    .busca :global(svg) {
        opacity: 0.5;
    }
    .busca input {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: 0;
        outline: none;
        color: var(--luz-texto);
        font-family: inherit;
        font-size: 13px;
    }
    .busca input::placeholder {
        color: var(--luz-fraco);
    }
    .tipos {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 30px;
        padding: 0 4px 0 8px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
    }
    .tipos :global(svg) {
        opacity: 0.5;
        margin-inline-end: 4px;
    }
    .tipos button,
    .mini {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 22px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--luz-mudo);
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .mini {
        height: 30px;
        width: 30px;
    }
    .tipos button:hover,
    .mini:hover {
        background: var(--luz-hover);
    }
    .tipos button.ativo {
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .corpo {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 16px;
        height: min(460px, calc(100vh - 200px));
    }
    .lista {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding-inline-end: 4px;
    }
    .faixa {
        flex-shrink: 0;
        height: 24px;
        display: flex;
        align-items: center;
        padding: 0 8px;
        margin: 8px 0 4px;
        border-radius: 4px;
        background: var(--luz-campo);
        color: var(--luz-mudo);
        font-size: 11px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }
    .faixa:first-child {
        margin-top: 0;
    }
    .linha {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        height: 36px;
        padding: 0 8px 0 4px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font-family: inherit;
        font-size: 13px;
        text-align: start;
        cursor: pointer;
    }
    .linha:hover {
        background: var(--luz-hover);
    }
    .linha.ativo {
        background: var(--luz-campo);
        font-weight: 600;
    }
    .mini-thumb {
        flex-shrink: 0;
        width: 40px;
        aspect-ratio: var(--proporcao);
        overflow: hidden;
        border-radius: 3px;
        background: #000;
        outline: 1px solid var(--luz-linha);
        pointer-events: none;
    }
    .mini-thumb.vazio {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--luz-campo);
    }
    .mini-thumb.vazio :global(svg) {
        opacity: 0.5;
    }
    .nome {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .nada {
        margin: 16px 8px;
        color: var(--luz-mudo);
        font-size: 12px;
    }
    .previa {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .tela {
        width: 100%;
        aspect-ratio: var(--proporcao);
        overflow: hidden;
        border-radius: 6px;
        background: #000;
        outline: 1px solid var(--luz-borda);
        pointer-events: none;
    }
    /* sem o xadrez do FreeShow atras do modelo: fundo preto, como sai na tela */
    .tela :global(.slide.checkered),
    .mini-thumb :global(.slide.checkered) {
        background-image: none !important;
        background-color: #000 !important;
    }
    .legenda {
        color: var(--luz-mudo);
        font-size: 12px;
    }
</style>
