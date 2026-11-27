<script lang="ts">
    // Cabecalho do modo Lista da Midia (cabine 26/nov): os nomes das colunas que o MediaCard desenha em cada linha. Nome e Adicionado
    // ordenam (o mesmo `sorted.media.type` do FreeShow: name / name_des / created / created_asc); clicar de novo inverte.
    import { sorted } from "../../../stores"

    $: tipo = ($sorted.media?.type || "name") as string
    function ordenar(por: "nome" | "data") {
        const novo = por === "nome" ? (tipo === "name" ? "name_des" : "name") : tipo === "created" ? "created_asc" : "created"
        sorted.update((a: any) => ({ ...a, media: { ...(a.media || {}), type: novo } }))
    }
    $: setaNome = tipo === "name" ? "▲" : tipo === "name_des" ? "▼" : ""
    $: setaData = tipo === "created" ? "▼" : tipo === "created_asc" ? "▲" : ""
</script>

<div class="cabLista" data-acao="midia-lista-cabecalho">
    <button type="button" class="col nome" class:ativa={!!setaNome} data-acao="midia-ordenar-nome" title="Ordenar por nome" tabindex="-1" on:mousedown|preventDefault on:click={() => ordenar("nome")}>Nome <span class="seta">{setaNome}</span></button>
    <span class="col dur">Duração</span>
    <span class="col res">Resolução</span>
    <span class="col tam">Tamanho</span>
    <button type="button" class="col data" class:ativa={!!setaData} data-acao="midia-ordenar-data" title="Ordenar pela data em que o arquivo chegou ao computador (mais novos primeiro)" tabindex="-1" on:mousedown|preventDefault on:click={() => ordenar("data")}>Adicionado <span class="seta">{setaData}</span></button>
</div>

<style>
    .cabLista {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        height: 26px;
        /* a lista virtual tem a barra de rolagem (~18 px) dentro dela: a direita sobra isso + o respiro da linha (8 px) */
        width: 100%;
        flex: 0 0 100%;
        grid-column: 1 / -1;
        box-sizing: border-box;
        padding: 0 26px 0 0;
        background: var(--luz-fundo, var(--primary-darkest));
        border-bottom: 1px solid var(--luz-linha);
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .col {
        flex: none;
        text-align: right;
        font: inherit;
        color: inherit;
        white-space: nowrap;
    }
    button.col {
        border: none;
        background: transparent;
        padding: 0;
        cursor: pointer;
    }
    button.col:hover,
    .ativa {
        color: var(--luz-texto);
    }
    .nome {
        flex: 1;
        min-width: 0;
        text-align: left;
        padding-left: 78px !important;
    }
    .dur {
        width: 64px;
    }
    .res {
        width: 92px;
    }
    .tam {
        width: 76px;
    }
    .data {
        width: 100px;
    }
    .seta {
        font-size: 9px;
    }
</style>
