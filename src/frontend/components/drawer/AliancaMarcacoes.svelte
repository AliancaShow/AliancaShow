<script lang="ts">
    // AliançaShow · Preparar, fatia 6: o contador das marcações da gaveta, dentro da faixa `.top`
    // (a altura da gaveta fechada não muda: o código depende do `<= 40`). `✓ N · Pôr em <culto> ▾ · Juntar N fotos · Limpar`.
    import { activeProject, activePage, editingProjectTemplate, modoAlianca, projects, shows } from "../../stores"
    import { desmarcar, ausentes, juntarFotos, limparMarcacoes, motivoSemCulto, nomeDoCultoAberto, porNoCulto } from "../../utils/aliancaGaveta"
    import { listaAberta, marcados } from "../../utils/aliancaGavetaEstado"
    import { chaveDe, contagem } from "../../utils/aliancaGavetaLogica"
    import { getReferenceText } from "./bible/scripture"
    import { removeExtension } from "../helpers/media"
    import type { Marcado } from "../../utils/aliancaGavetaLogica"

    $: visivel = $modoAlianca === "preparar" && $marcados.length > 0
    $: noEditor = $activePage === "edit"
    $: cont = contagem($marcados)

    // por que não dá para pôr (some dependência só para o Svelte recalcular quando o projeto aberto muda)
    const reler = (..._dependencias: unknown[]) => ({ motivo: motivoSemCulto(), nome: nomeDoCultoAberto() })
    $: aberto = reler($activeProject, $projects, $editingProjectTemplate)
    $: motivo = aberto.motivo
    $: nomeDoCulto = aberto.nome
    $: idsNoCulto = new Set(($activeProject ? $projects[$activeProject]?.shows || [] : []).map((s) => s.id))

    let menuAberto = false
    let sumidos = new Set<string>()

    // ao abrir a lista, confere o que não existe mais (show apagado, arquivo ausente)
    $: if ($listaAberta) conferir($marcados)
    async function conferir(lista: Marcado[]) {
        sumidos = await ausentes(lista)
    }
    $: if (!visivel && $listaAberta) listaAberta.set(false)

    function nomeDe(m: Marcado, _shows: any): string {
        if (m.tipo === "show") return _shows?.[m.chave]?.name || "show"
        if (m.tipo === "scripture") {
            try {
                return getReferenceText(m.dado) || "versículo"
            } catch {
                return "versículo"
            }
        }
        return removeExtension(m.dado?.name || m.chave)
    }

    const rotuloDoTipo = { show: "show", media: "mídia", audio: "áudio", scripture: "Bíblia" }

    async function pôr(onde: "depois" | "fim") {
        menuAberto = false
        const r = await porNoCulto(onde)
        if (r.motivo) return
        if (!$marcados.length) listaAberta.set(false)
    }
</script>

{#if visivel}
    <div class="marcacoes" role="group" aria-label="Itens marcados para o culto">
        <button class="n" tabindex="-1" title="Ver os itens marcados" aria-expanded={$listaAberta} on:click|stopPropagation={() => ((menuAberto = false), listaAberta.update((a) => !a))}>
            ✓ {cont.total}
        </button>

        {#if !noEditor}
            <div class="split">
                <button class="por" tabindex="-1" disabled={!!motivo} title={motivo || `Põe os ${cont.total} marcados depois do item selecionado no culto`} on:click|stopPropagation={() => pôr("depois")}>
                    Pôr em <b>{nomeDoCulto || "—"}</b>
                </button>
                <button class="caret" tabindex="-1" disabled={!!motivo} title="Onde entra" aria-label="Onde entra" aria-expanded={menuAberto} on:click|stopPropagation={() => (menuAberto = !menuAberto)}>▾</button>
                {#if menuAberto}
                    <div class="menu">
                        <button tabindex="-1" on:click|stopPropagation={() => pôr("depois")}>Depois do item selecionado</button>
                        <button tabindex="-1" on:click|stopPropagation={() => pôr("fim")}>No fim do culto</button>
                    </div>
                {/if}
            </div>

            {#if cont.fotos >= 2}
                <button class="juntar" tabindex="-1" title="Cria uma apresentação com as fotos (você passa uma a uma) e põe no culto" on:click|stopPropagation={() => juntarFotos()}>Juntar {cont.fotos} fotos</button>
            {/if}
        {/if}

        <button class="limpar" tabindex="-1" title="Desmarcar tudo" on:click|stopPropagation={() => limparMarcacoes()}>Limpar</button>

        {#if $listaAberta}
            <div class="lista" role="list">
                {#each $marcados as m (chaveDe(m))}
                    {@const ch = chaveDe(m)}
                    <div class="item" role="listitem" class:sumiu={sumidos.has(ch)}>
                        <span class="tipo">{rotuloDoTipo[m.tipo]}</span>
                        <span class="nome" title={nomeDe(m, $shows)}>{nomeDe(m, $shows)}</span>
                        {#if sumidos.has(ch)}<span class="selo aviso">não existe mais</span>{:else if idsNoCulto.has(m.tipo === "scripture" ? "" : m.tipo === "show" ? m.chave : m.chave)}<span class="selo">já no culto</span>{/if}
                        <button class="x" tabindex="-1" title="Desmarcar" aria-label="Desmarcar" on:click|stopPropagation={() => desmarcar(ch)}>×</button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/if}

<style>
    .marcacoes {
        position: relative;
        display: flex;
        flex: 0 0 auto;
        align-items: stretch;
        gap: 6px;
        padding: 0 8px;
        font-size: 0.9em;
    }

    button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 10px;
        border: none;
        border-radius: 4px;
        font: inherit;
        color: var(--text);
        background: rgb(255 255 255 / 0.08);
        cursor: pointer;
        white-space: nowrap;
    }
    button:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.16);
    }
    button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .n {
        font-weight: 700;
        color: #fff;
        background: var(--secondary);
    }
    .n:hover:not(:disabled) {
        background: var(--secondary);
        filter: brightness(1.1);
    }

    .split {
        position: relative;
        display: flex;
        gap: 1px;
    }
    .por {
        max-width: 240px;
        overflow: hidden;
        border-start-end-radius: 0;
        border-end-end-radius: 0;
    }
    .por b {
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 150px;
    }
    .caret {
        padding: 0 7px;
        border-start-start-radius: 0;
        border-end-start-radius: 0;
    }
    .menu {
        position: absolute;
        inset-inline-start: 0;
        bottom: calc(100% + 6px);
        z-index: 30;
        display: flex;
        flex-direction: column;
        min-width: 100%;
        padding: 4px;
        border-radius: 6px;
        background: var(--primary-darker);
        box-shadow: 0 4px 14px rgb(0 0 0 / 0.45);
    }
    .menu button {
        padding: 8px 12px;
        background: transparent;
        justify-content: flex-start;
    }
    .menu button:hover {
        background: rgb(255 255 255 / 0.1);
    }

    .lista {
        position: absolute;
        inset-inline-start: 8px;
        bottom: calc(100% + 6px);
        z-index: 30;
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 340px;
        max-width: 80vw;
        max-height: 50vh;
        overflow-y: auto;
        padding: 4px;
        border-radius: 6px;
        background: var(--primary-darker);
        box-shadow: 0 4px 14px rgb(0 0 0 / 0.45);
    }
    .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 6px;
        border-radius: 4px;
    }
    .item:hover {
        background: rgb(255 255 255 / 0.06);
    }
    .item.sumiu .nome {
        text-decoration: line-through;
        opacity: 0.6;
    }
    .tipo {
        flex: none;
        width: 46px;
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.6;
    }
    .nome {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .selo {
        flex: none;
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        background: rgb(255 255 255 / 0.18);
    }
    .selo.aviso {
        color: #1c1400;
        background: #e0a030;
    }
    .x {
        flex: none;
        padding: 0 8px;
        font-size: 1.2em;
        line-height: 1.4;
        background: transparent;
    }
    .x:hover {
        color: #fff;
        background: rgb(242 26 39 / 0.8) !important;
    }
</style>
