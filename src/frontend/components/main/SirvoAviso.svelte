<script lang="ts">
    // "O roteiro mudou" — alguém mexeu no culto pelo Sirvo enquanto ele roda.
    //
    // Mora no RODAPÉ da coluna da direita (acima do relógio): crescer ali só
    // encolhe as ferramentas por baixo, nada acima se mexe debaixo do mouse.
    //  - Sem som: a saída de áudio deste computador costuma ir para a mesa.
    //  - Não some sozinha (sem som, sumir = ninguém ver). Fica até "Ok, vi";
    //    depois de 1 minuto encolhe para uma linha, que expande no clique.
    //  - Não pega foco: o operador passa slide pelo teclado.
    // Texto do Sirvo só por interpolação {…}, nunca {@html}.
    import { onDestroy } from "svelte"
    import { dispensarAvisosSirvo, sirvoAvisos } from "../../utils/aliancaSirvo"

    const ENCOLHE_EM_MS = 60_000
    const MAX_LINHAS = 4

    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 5_000)
    onDestroy(() => clearInterval(relogio))

    let aberta = false
    let desdeVisto = 0
    // aviso novo chegou: volta a aparecer inteiro
    $: if ($sirvoAvisos.desde !== desdeVisto) {
        desdeVisto = $sirvoAvisos.desde
        aberta = false
    }

    $: tem = $sirvoAvisos.linhas.length > 0 || $sirvoAvisos.anteriores
    $: encolhida = !aberta && agoraMs - $sirvoAvisos.desde > ENCOLHE_EM_MS
    $: visiveis = $sirvoAvisos.linhas.slice(-MAX_LINHAS)
    $: resto = $sirvoAvisos.linhas.length - visiveis.length
    $: total = $sirvoAvisos.linhas.length
</script>

{#if tem}
    <div class="sirvoAviso" role="status" aria-live="polite">
        {#if encolhida}
            <button class="pilula" tabindex="-1" on:click={() => (aberta = true)}>
                <span class="ponto" />
                Roteiro mudou{total ? ` · ${total}` : ""}
            </button>
        {:else}
            <div class="cabeca">
                <span class="ponto" />
                <span class="titulo">O roteiro mudou</span>
                <button class="ok" tabindex="-1" on:click={dispensarAvisosSirvo}>Ok, vi</button>
            </div>
            <ul>
                {#each visiveis as l (l.chave)}
                    <li data-title={l.texto}>{l.texto}</li>
                {/each}
                {#if resto > 0}
                    <li class="fraco">e mais {resto}…</li>
                {/if}
                {#if $sirvoAvisos.anteriores}
                    <li class="fraco">e mudanças anteriores — confira o roteiro no Sirvo</li>
                {/if}
            </ul>
        {/if}
    </div>
{/if}

<style>
    .sirvoAviso {
        flex: none;
        margin: 8px 8px 0;
        margin-top: auto;
        max-height: 160px;
        overflow: hidden;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgb(255 128 0 / 0.4);
        background: rgb(255 128 0 / 0.08);
        font-size: 12px;
        user-select: none;
    }

    .cabeca {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .ponto {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff8000;
    }
    .titulo {
        flex: 1;
        font-weight: 600;
        color: #ffb066;
    }
    .ok {
        flex: none;
        padding: 4px 10px;
        border: 0;
        border-radius: 14px;
        background: rgb(255 128 0 / 0.18);
        color: #ffb066;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }
    .ok:hover {
        background: rgb(255 128 0 / 0.3);
    }

    ul {
        margin: 6px 0 0;
        padding: 0;
        list-style: none;
    }
    li {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.5;
        color: var(--text);
    }
    li.fraco {
        opacity: 0.6;
    }

    .pilula {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 0;
        border: 0;
        background: none;
        color: #ffb066;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        text-align: start;
        cursor: pointer;
    }
</style>
