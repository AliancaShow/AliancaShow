<script lang="ts">
    // Cabine 6 (Andre, 23/nov): a LINHA DE AVISOS do pe da tela. Ocupa o proprio lugar no leiaute (AliancaTela, depois do corpo): nunca flutua por
    // cima do No ar nem da grade. Uma linha, alinhada a esquerda, na escala do app; o texto inteiro aparece no title (hover) e na lista dos ultimos.
    // Cor pelo nivel (so tokens): info neutro e some em 5 s; aviso (laranja) e erro (vermelho) ficam ate resolver ou ate o x.
    // A fila e a conta: utils/aliancaAvisos.ts e aliancaAvisosLogica.ts. "Ultimos avisos" abre a lista NO LUGAR (empurra o corpo, nao cobre),
    // com uma divisoria em cima (AliancaDivisoria, como as da tela) que muda a altura dela; a altura fica gravada.
    // Aviso `fixo` (a saida esta FORA DO AR, aliancaQuedaAvisos.ts) nao tem x: so sai quando resolve.
    import { alturaDaListaDeAvisos, avisos, dispensarAviso, gravarAlturaDaLista, historicoDeAvisos } from "../../utils/aliancaAvisos"
    import { alturaDaLista, arrastarLista, principal } from "../../utils/aliancaAvisosLogica"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import AliancaDivisoria from "./AliancaDivisoria.svelte"

    $: atual = principal($avisos)
    $: aviso = atual.aviso
    let aberto = false
    $: rotuloHist = $historicoDeAvisos.length ? `Últimos avisos · ${$historicoDeAvisos.length}` : "Últimos avisos"
    $: if (!$historicoDeAvisos.length) aberto = false

    const hora = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    const rotulo = { info: "info", aviso: "aviso", erro: "erro" }

    // ----- a divisoria da lista -----
    let telaH = typeof window !== "undefined" ? window.innerHeight : 1080
    $: altura = alturaDaLista($alturaDaListaDeAvisos, telaH)
    let arrasto: { y: number; inicio: number } | null = null
    function pegar(e: CustomEvent<{ x: number; y: number }>) {
        arrasto = { y: e.detail.y, inicio: altura }
    }
    function mover(e: MouseEvent) {
        if (!arrasto) return
        alturaDaListaDeAvisos.set(arrastarLista(arrasto.inicio, e.clientY - arrasto.y, telaH))
    }
    function soltar() {
        if (!arrasto) return
        arrasto = null
        const erro = gravarAlturaDaLista(altura)
        if (erro) falhaAlta("avisos-altura-lista", erro)
    }
</script>

<svelte:window bind:innerHeight={telaH} on:mousemove={mover} on:mouseup={soltar} />

<!-- <footer>, nao <div>: AliancaTela esconde o `.corpo` que nao e o ultimo div (fade de saida do Svelte 3) -->
<footer class="avisos" data-regiao="avisos">
    {#if aberto}
        <AliancaDivisoria eixo="h" rotulo="Arraste para mudar a altura dos últimos avisos" on:pegar={pegar} />
        <ol class="lista" class:arrastando={!!arrasto} style="height: {altura}px" aria-label="Últimos avisos" data-acao="avisos-lista">
            {#each $historicoDeAvisos as h (h.id)}
                <li class="item {h.nivel}" title={h.texto}><span class="quando">{hora(h.em)}</span><span class="nivel">{rotulo[h.nivel]}</span><span class="txt">{h.texto}</span></li>
            {/each}
        </ol>
    {/if}
    <div class="linha {aviso ? aviso.nivel : 'vazio'}" role="status" aria-live="polite" data-acao="aviso-linha" data-nivel={aviso ? aviso.nivel : ""} data-fixo={aviso?.fixo ? "sim" : ""}>
        {#if aviso}
            <span class="ponto" aria-hidden="true" />
            <span class="texto" title={aviso.texto} data-acao="aviso-texto"
                >{aviso.texto}{#if aviso.vezes > 1}<span class="vezes">{` (${aviso.vezes}×)`}</span>{/if}</span
            >
            {#if atual.outros > 0}<span class="mais" title="mais avisos abertos: veja em Últimos avisos">+{atual.outros}</span>{/if}
            {#if aviso.nivel !== "info" && !aviso.fixo}
                <button type="button" class="fechar" aria-label="Dispensar este aviso" title="Dispensar este aviso" data-acao="aviso-dispensar" on:mousedown|preventDefault on:click={() => aviso && dispensarAviso(aviso.id)}>×</button>
            {/if}
        {:else}
            <span class="texto vazio" />
        {/if}
        <button type="button" class="hist" aria-expanded={aberto} disabled={!$historicoDeAvisos.length} title="Os últimos avisos desta sessão" data-acao="avisos-historico" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}
>{rotuloHist}</button>
    </div>
</footer>

<style>
    .avisos {
        position: relative;
        z-index: 1;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        margin-top: 6px;
    }
    .linha {
        height: 24px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 4px 0 10px;
        border-radius: var(--luz-raio-botao);
        font-size: var(--luz-fs-nome);
        color: var(--luz-texto-80);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        background: var(--luz-painel);
        min-width: 0;
    }
    .linha.aviso {
        background: var(--luz-laranja-lavagem);
        box-shadow: inset 0 0 0 1px var(--luz-laranja-borda);
        color: var(--luz-laranja);
    }
    .linha.erro {
        background: var(--luz-vermelho-lavagem);
        box-shadow: inset 0 0 0 1px var(--luz-vermelho);
        color: var(--luz-vermelho-claro);
    }
    .ponto {
        flex-shrink: 0;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--luz-mudo);
    }
    .aviso .ponto {
        background: var(--luz-laranja);
    }
    .erro .ponto {
        background: var(--luz-vermelho);
    }
    .texto {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 600;
    }
    .info .texto {
        font-weight: 500;
    }
    .vezes,
    .mais {
        font-weight: 500;
        color: var(--luz-mudo);
    }
    .aviso .vezes,
    .erro .vezes {
        color: inherit;
    }
    .mais {
        flex-shrink: 0;
    }
    button {
        flex-shrink: 0;
        height: 20px;
        border: none;
        border-radius: var(--luz-raio-selo);
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--luz-hover);
    }
    button:focus-visible {
        outline: 2px solid var(--luz-anel);
        outline-offset: 1px;
    }
    .fechar {
        width: 22px;
        font-size: var(--luz-fs-mais);
        line-height: 1;
    }
    .hist {
        padding: 0 8px;
        color: var(--luz-mudo);
        font-size: var(--luz-fs-selo);
    }
    .hist:disabled {
        cursor: default;
    }
    .lista {
        list-style: none;
        margin: 0 0 4px;
        padding: 4px 0;
        box-sizing: border-box;
        overflow-y: auto;
        border-radius: var(--luz-raio-botao);
        background: var(--luz-painel);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        font-size: var(--luz-fs-nome);
    }
    .lista.arrastando {
        user-select: none;
    }
    .item {
        display: flex;
        gap: 10px;
        padding: 2px 10px;
        color: var(--luz-texto-80);
        min-width: 0;
    }
    .item.aviso {
        color: var(--luz-laranja);
    }
    .item.erro {
        color: var(--luz-vermelho-claro);
    }
    .quando,
    .nivel {
        flex-shrink: 0;
        color: var(--luz-mudo);
        font-variant-numeric: tabular-nums;
    }
    .nivel {
        width: 34px;
    }
    .txt {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
