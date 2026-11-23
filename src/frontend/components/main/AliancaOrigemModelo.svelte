<script lang="ts">
    // Cabine 6, fatia V1 (board P2/P4, D14): a linha de origem de Mostrar, embaixo do cabecalho do centro. Responde "de onde vem a cara que
    // esta indo para cada tela": por saida, o modelo que vale (do Visual) ou "Sem modelo"; por retorno, o leiaute.
    // Le o que a saida usa DE FATO (campos do estilo). Etiqueta neutra; laranja so para problema (modelo apagado, divergencia).
    // Sem aviso de "proximo slide" aqui (pedido do Andre, 23/nov): a regra do D15 continua, so nao se anuncia na tela principal.
    // Muda sozinha conforme o item: num versiculo mostra a coluna Biblia; no resto, Musica e avisos. Clicar num modelo abre-o no Editar.
    import { activeEdit, activeShow, outputs, shows, special, stageShows, styles, templates } from "../../stores"
    import { trocarTela } from "../../utils/aliancaTela"
    import { visualPendente } from "../../utils/aliancaVisualAplicador"
    import { estiloDaSaida, linhaDeOrigem, visualAtivo, COLUNAS, type Coluna } from "../../utils/aliancaVisualLogica"

    $: ativo = visualAtivo($special)
    $: aberto = $activeShow?.id && ($activeShow.type || "show") === "show" ? ($shows as any)[$activeShow.id] : null
    $: coluna = (aberto?.reference?.type === "scripture" ? "biblia" : "musica") as Coluna
    $: etiquetas = linhaDeOrigem(ativo, coluna, { outputs: $outputs, estilos: $styles, templates: $templates, leiautes: $stageShows, pendentes: $visualPendente.chaves })
    $: campo = COLUNAS.find((c) => c.id === coluna)!.campo

    function modeloDe(saida: string): string {
        const est = estiloDaSaida(($outputs as any)[saida], $styles)
        const id = est ? ($styles as any)[est]?.[campo] : ""
        return id && ($templates as any)[id] ? id : ""
    }
    function abrir(saida: string) {
        const id = modeloDe(saida)
        if (!id) return
        activeEdit.set({ type: "template", id, items: [] })
        trocarTela("edit", "botao-de-pagina")
    }
</script>

{#if ativo && $activeShow?.id}
    <div class="origem" data-acao="origem-modelo" data-coluna={coluna}>
        <span class="og vis">Visual: <b>{ativo.nome}</b></span>
        {#each etiquetas as e (e.saida)}
            {@const modelo = modeloDe(e.saida)}
            <button type="button" class="og" class:prob={!!e.problema} class:clicavel={!!modelo} data-saida={e.saida} title={e.problema || (modelo ? "Abrir este modelo no Editar" : "")} tabindex="-1" on:mousedown|preventDefault on:click={() => abrir(e.saida)}>
                {e.nome}: <b>{e.texto}</b>
                {#if modelo && !e.problema}<em>MODELO DA SAÍDA</em>{/if}
                {#if e.problema}<em>{e.problema}</em>{/if}
            </button>
        {/each}
    </div>
{:else if !ativo && $activeShow?.id && Array.isArray($special?.aliancaVisuais)}
    <div class="origem" data-acao="origem-modelo"><span class="og prob">Nenhum Visual valendo: escolha um no botão do telão</span></div>
{/if}

<style>
    .origem {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 14px 8px 16px;
        border-bottom: 1px solid var(--luz-linha);
        min-width: 0;
    }
    .og {
        height: 22px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0 8px;
        border: 0;
        border-radius: var(--luz-raio-selo);
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        color: var(--luz-texto-80);
        font: inherit;
        font-size: 11.5px;
        white-space: nowrap;
        cursor: default;
    }
    .og b {
        font-weight: 600;
        color: var(--luz-texto);
    }
    .og em {
        font-style: normal;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--luz-mudo);
        margin-left: 2px;
    }
    .og.clicavel {
        cursor: pointer;
    }
    .og.clicavel:hover {
        background: var(--luz-hover);
    }
    .og.prob {
        background: var(--luz-laranja-lavagem);
        box-shadow: inset 0 0 0 1px var(--luz-laranja-borda);
    }
    .og.prob em {
        color: var(--luz-laranja);
        letter-spacing: 0;
        font-weight: 600;
    }
</style>
