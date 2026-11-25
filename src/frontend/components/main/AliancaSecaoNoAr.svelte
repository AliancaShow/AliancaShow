<script lang="ts">
    // Coluna No ar (Andre, 25/nov: desenho coluna_no_ar_secoes_recolhiveis_v1): a secao recolhivel com titulo, setinha e contagem.
    // O aberto/recolhido fica no armazenamento dos blocos (sobrevive a fechar o app). `manterMontado`: recolhida, o corpo fica montado e
    // escondido (Recados: o texto digitado, a chamada escolhida e o vigia do NO AR continuam vivos); sem ele o corpo sai (Outras telas: a
    // captura ao vivo para). O slot "direita" fica na linha do titulo mesmo recolhida (as pilulas do que esta no ar).
    import { blocos, definirBloco } from "../../utils/aliancaBlocosEstado"
    import { blocoAberto } from "../../utils/aliancaBlocosLogica"

    export let titulo: string
    export let chave: string
    export let padrao = false
    export let conta: number | null = null
    export let manterMontado = false
    export let acao = ""

    $: aberto = blocoAberto($blocos, chave, padrao)
    const alternar = () => definirBloco(chave, !aberto)
</script>

<section class="secao" data-acao={acao || null} data-aberta={aberto}>
    <div class="cabeca">
        <button type="button" class="alternar" aria-expanded={aberto} tabindex="-1" data-acao="alternar-secao" title={aberto ? "Recolher" : "Mostrar"} on:mousedown|preventDefault on:click={alternar}>
            <span class="chev" class:aberta={aberto} aria-hidden="true">▸</span>
            <span class="titulo">{titulo}</span>
            {#if conta !== null}<span class="conta">({conta})</span>{/if}
        </button>
        <div class="direita"><slot name="direita" /></div>
    </div>
    {#if manterMontado}
        <div class="corpo" class:fechado={!aberto}><slot {aberto} /></div>
    {:else if aberto}
        <div class="corpo"><slot {aberto} /></div>
    {/if}
</section>

<style>
    .secao {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-top: 1px solid var(--luz-linha);
        padding-top: 8px;
    }
    .cabeca {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 24px;
    }
    .alternar {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 24px;
        padding: 0 6px 0 0;
        border: none;
        background: transparent;
        font: inherit;
        cursor: pointer;
        color: var(--luz-mudo);
    }
    .alternar:hover .titulo {
        color: var(--luz-texto);
    }
    .chev {
        display: inline-block;
        width: 14px;
        font-size: 13px;
        transition: transform 160ms ease;
    }
    .chev.aberta {
        transform: rotate(90deg);
    }
    .titulo {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--luz-mudo);
    }
    .conta {
        font-size: 11px;
        color: var(--luz-fraco);
    }
    .direita {
        flex: 1;
        min-width: 0;
        display: flex;
        justify-content: flex-end;
        gap: 4px;
    }
    .corpo {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .corpo.fechado {
        display: none;
    }
</style>
