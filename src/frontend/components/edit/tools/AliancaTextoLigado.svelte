<script lang="ts">
    // "Texto ligado" da caixa de texto ("Sim, assim", 24/nov): o "Linked Text" do ProPresenter usando os valores dinamicos que o FreeShow ja tem.
    // A lista e em portugues; a caixa recebe o mesmo codigo do botao direito › Valores dinamicos. Grava pelo history (Ctrl+Z desfaz).
    // Logica (lista, leitura, escrita, avisos): utils/aliancaTextoLigadoLogica.ts. Fora do fecho.
    import { onDestroy } from "svelte"
    import type { Item } from "../../../../types/Show"
    import { activeEdit, activeShow, refreshEditSlide, templates, timers } from "../../../stores"
    import { NENHUM, avisoDoModelo, gruposLigados, lerLigacao, linhasLigadas, todasAsOpcoes } from "../../../utils/aliancaTextoLigadoLogica"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { replaceDynamicValues } from "../../helpers/showActions"

    export let allSlideItems: Item[] = []

    $: indice = $activeEdit.items.length === 1 ? $activeEdit.items[0] : -1
    $: caixa = indice > -1 ? allSlideItems[indice] : null
    $: ehTexto = !!caixa && (caixa.type || "text") === "text"

    $: emModelo = $activeEdit.type === "template"
    $: modelo = emModelo ? $templates[$activeEdit.id || ""] : null
    $: modoBiblia = !!modelo && (modelo.settings?.mode === "scripture" || modelo.category === "scripture")
    $: grupos = gruposLigados({ emModelo, cronometros: Object.values($timers || {}).map((t: any) => t?.name) })
    $: opcoes = todasAsOpcoes(grupos)
    $: atual = lerLigacao(caixa as any, opcoes)
    $: valorAtual = atual.tipo === "opcao" ? atual.opcao.id : atual.tipo
    $: aviso = avisoDoModelo({ emModelo, itens: allSlideItems as any, indice, modoBiblia })

    // previa ao vivo (relogio anda); Bíblia usa o exemplo em portugues (o FreeShow so tem "Genesis" de exemplo)
    let tique = 0
    const relogio = setInterval(() => tique++, 1000)
    onDestroy(() => clearInterval(relogio))
    $: previa = calcularPrevia(atual, tique)
    function calcularPrevia(a: typeof atual, _t: number) {
        if (a.tipo !== "opcao") return ""
        if (a.opcao.exemplo) return a.opcao.exemplo
        try {
            const ref = { showId: $activeShow?.id, slideIndex: $activeEdit.slide, type: $activeEdit.type || "show", id: $activeEdit.id }
            const txt = replaceDynamicValues(a.opcao.partes.join(""), ref as any, _t, true)
            return String(txt || "").replace(/<[^>]*>/g, "")
        } catch {
            return ""
        }
    }

    function escolher(e: Event) {
        const id = (e.currentTarget as HTMLSelectElement).value
        const opcao = id === NENHUM.id ? NENHUM : opcoes.find((o) => o.id === id)
        if (!opcao || !caixa || indice < 0) return
        const linhas = linhasLigadas(caixa as any, opcao)

        if ($activeEdit.id && ($activeEdit.type === "template" || $activeEdit.type === "overlay")) {
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", subkey: "lines", data: [linhas], indexes: [indice] },
                location: { page: "edit", id: $activeEdit.type + "_items", override: true }
            })
        } else {
            const slide = getLayoutRef()[$activeEdit.slide ?? -1]?.id
            if (!slide || !$activeShow) return
            history({ id: "setItems", newData: { style: { key: "lines", values: [linhas] } }, location: { page: "edit", show: $activeShow, slide, items: [indice] } })
        }
        refreshEditSlide.set(true)
    }
</script>

{#if ehTexto}
    <div class="ligado" data-acao="texto-ligado">
        <label class="campo">
            <span>Texto ligado</span>
            <select value={valorAtual} on:change={escolher} data-acao="texto-ligado-escolher">
                {#if atual.tipo === "misto"}<option value="misto" disabled>Texto com valores (feito pelo botão direito)</option>{/if}
                <option value={NENHUM.id}>{NENHUM.rotulo}</option>
                {#each grupos as g}
                    <optgroup label={g.rotulo}>
                        {#each g.opcoes as o}<option value={o.id}>{o.rotulo}</option>{/each}
                    </optgroup>
                {/each}
            </select>
        </label>
        {#if atual.tipo === "opcao"}
            <p class="previa">No telão: <b>{previa || "—"}</b></p>
        {:else if atual.tipo === "misto"}
            <p class="previa">Esta caixa mistura texto e valores: <code>{atual.texto.slice(0, 60)}</code>. Escolher uma opção troca a caixa inteira.</p>
        {/if}
        {#if aviso}<p class="aviso" class:alerta={aviso.nivel === "alerta"}>{aviso.texto}</p>{/if}
    </div>
{/if}

<style>
    .ligado {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px 4px;
        font-size: 13px;
        color: var(--luz-texto);
    }
    .campo {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .campo > span {
        flex-shrink: 0;
        color: var(--luz-texto-80);
    }
    select {
        flex: 1;
        min-width: 0;
        height: 30px;
        padding: 0 6px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-campo);
        background: var(--luz-pop-opaco);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12.5px;
        cursor: pointer;
    }
    .previa,
    .aviso {
        margin: 0;
        font-size: 11.5px;
        color: var(--luz-mudo);
        line-height: 1.35;
    }
    .previa b {
        color: var(--luz-texto);
        font-weight: 600;
    }
    .aviso.alerta {
        color: var(--luz-laranja);
    }
    code {
        font-size: 11px;
    }
</style>
