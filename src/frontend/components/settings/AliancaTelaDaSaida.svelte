<script lang="ts">
    // "aprovo tela-visual" (23/nov): o bloco "Tela" de cada saida, o Screens do ProPresenter. O que e FISICO e nao muda de culto para culto:
    // proporcao, posicao quando sobra espaco, tamanho da fonte, linhas maximas e como a midia preenche. Grava outputs[id].aliancaTelaFisica e o
    // compositor (aliancaVisualAplicador.ts) escreve no estilo da saida na hora. Substitui o "Estilo ativo" desta pagina e a aba Estilos.
    import { outputs } from "../../stores"
    import { mudarTelaFisica } from "../../utils/aliancaVisualAplicador"
    import { telaFisicaDe } from "../../utils/aliancaVisualLogica"

    export let outputId: string

    $: saida = ($outputs as any)[outputId]
    $: tela = telaFisicaDe(saida) || {}
    $: ar = tela.aspectRatio || null
    $: largura = Math.round(saida?.bounds?.width || 1920)
    $: altura = Math.round(saida?.bounds?.height || 1080)

    const PRONTAS = [
        { id: "16:9", w: 16, h: 9 },
        { id: "4:3", w: 4, h: 3 },
        { id: "21:9", w: 21, h: 9 },
        { id: "1:1", w: 1, h: 1 }
    ]
    $: proporcao = !ar ? "16:9" : ar.outputResolutionAsRatio ? "saida" : PRONTAS.find((p) => p.w === ar.width && p.h === ar.height)?.id || "outra"

    function escolherProporcao(e: Event) {
        const v = (e.currentTarget as HTMLSelectElement).value
        const resto: any = { ...(ar || {}) }
        if (v === "saida") return mudarTelaFisica(outputId, { aspectRatio: { ...resto, width: resto.width || 16, height: resto.height || 9, outputResolutionAsRatio: true } })
        delete resto.outputResolutionAsRatio
        const p = PRONTAS.find((x) => x.id === v)
        if (p) return mudarTelaFisica(outputId, { aspectRatio: { ...resto, width: p.w, height: p.h } })
        mudarTelaFisica(outputId, { aspectRatio: { ...resto, width: resto.width || 16, height: resto.height || 9 } })
    }
    function mudarAr(campo: string, valor: any) {
        mudarTelaFisica(outputId, { aspectRatio: { width: 16, height: 9, ...(ar || {}), [campo]: valor } })
    }
    const numero = (e: Event, min: number, max: number) => Math.min(max, Math.max(min, Number((e.currentTarget as HTMLInputElement).value) || min))

    // nomes pedidos pelo Andre (23/nov): o FreeShow chama de contain/cover/fill/blur
    const PREENCHER = [
        { id: "contain", rotulo: "Encaixar", dica: "mostra a imagem inteira; sobra barra nos lados" },
        { id: "cover", rotulo: "Preencher", dica: "aumenta até ocupar a tela toda; corta o que passar" },
        { id: "fill", rotulo: "Esticar", dica: "deforma a imagem para caber exatamente" },
        { id: "blur", rotulo: "Encaixar com fundo desfocado", dica: "imagem inteira, com ela mesma desfocada atrás" }
    ]
    $: preencher = tela.fit || "contain"
</script>

<div class="tela" data-acao="saida-tela">
    <div class="rot">Configura uma vez. O que muda de culto para culto fica no Visual.</div>

    <label class="campo">
        <span>Proporção</span>
        <select value={proporcao} data-acao="tela-proporcao" on:change={escolherProporcao}>
            <option value="saida">Preenche a saída ({largura}×{altura})</option>
            {#each PRONTAS as p}<option value={p.id}>{p.id}{p.id === "16:9" ? " (padrão)" : ""}</option>{/each}
            <option value="outra">Outra…</option>
        </select>
    </label>
    {#if proporcao === "outra"}
        <div class="campo">
            <span>Largura × altura</span>
            <input type="number" min="1" max="100" value={ar?.width || 16} on:change={(e) => mudarAr("width", numero(e, 1, 100))} />
            <input type="number" min="1" max="100" value={ar?.height || 9} on:change={(e) => mudarAr("height", numero(e, 1, 100))} />
        </div>
    {/if}
    {#if proporcao !== "saida"}
        <label class="campo">
            <span>Posição quando sobra espaço</span>
            <select value={ar?.alignPosition || "center"} on:change={(e) => mudarAr("alignPosition", e.currentTarget.value)}>
                <option value="center">No centro</option>
                <option value="start">Em cima / à esquerda</option>
                <option value="end">Embaixo / à direita</option>
            </select>
        </label>
    {/if}
    <label class="campo">
        <span>Tamanho da fonte</span>
        <input type="number" min="10" max="500" step="10" value={ar?.fontSizeRatio ?? 100} on:change={(e) => mudarAr("fontSizeRatio", numero(e, 10, 500))} /> %
    </label>
    <label class="campo">
        <span>Linhas por vez</span>
        <input type="number" min="0" max="20" value={tela.lines || 0} on:change={(e) => mudarTelaFisica(outputId, { lines: numero(e, 0, 20) || undefined })} />
        <small>0 = todas</small>
    </label>
    <label class="campo">
        <span>Vídeos e imagens</span>
        <select value={preencher} data-acao="tela-preencher" on:change={(e) => mudarTelaFisica(outputId, { fit: e.currentTarget.value })}>
            {#each PREENCHER as p}<option value={p.id}>{p.rotulo}</option>{/each}
        </select>
        <small>{PREENCHER.find((p) => p.id === preencher)?.dica || ""}</small>
    </label>
</div>

<style>
    .tela {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 8px 0;
        padding: 10px 12px;
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        color: var(--luz-texto);
        font-size: 13px;
    }
    .rot {
        font-size: 11.5px;
        color: var(--luz-mudo);
    }
    .campo {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    .campo > span {
        width: 190px;
        color: var(--luz-texto-80);
    }
    .campo small {
        color: var(--luz-mudo);
        font-size: 11.5px;
    }
    select,
    input {
        height: 28px;
        padding: 0 6px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-campo);
        background: var(--luz-pop-opaco);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
    }
    select {
        min-width: 220px;
        cursor: pointer;
    }
    input[type="number"] {
        width: 70px;
    }
</style>
