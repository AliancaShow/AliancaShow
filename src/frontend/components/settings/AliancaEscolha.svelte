<script lang="ts">
    // Seletor leve da pagina Visual (desenho v4, "fechou" 24/nov): campo cinza com a etiqueta dentro e um menu proprio.
    // O menu vai para o <body> (position: fixed) para nunca ficar cortado pela rolagem da pagina; abre para cima quando nao cabe embaixo.
    import { createEventDispatcher, onDestroy, tick } from "svelte"

    export let rotulo: string
    export let valor: string
    export let opcoes: { id: string; nome: string }[] = []
    /** a 1a opcao "neutra" (Sem modelo / Nao muda): fica no topo, separada, e aparece em cinza italico quando escolhida */
    export let neutra: { id: string; nome: string }
    export let problema = ""
    export let acao = ""

    const dispatch = createEventDispatcher<{ escolher: string }>()

    $: atual = valor === neutra.id ? neutra : opcoes.find((o) => o.id === valor) || { id: valor, nome: "modelo não existe mais" }
    $: ehNeutra = atual.id === neutra.id
    $: sumiu = !ehNeutra && !opcoes.some((o) => o.id === valor)

    let botao: HTMLButtonElement
    let menu: HTMLDivElement
    let aberto = false
    let pos = ""

    function portal(no: HTMLElement) {
        document.body.appendChild(no)
        return { destroy: () => no.remove() }
    }

    async function abrir() {
        if (aberto) return fechar()
        aberto = true
        await tick()
        posicionar()
        window.addEventListener("mousedown", fora, true)
        window.addEventListener("resize", fechar)
        window.addEventListener("scroll", rolou, true)
        window.addEventListener("keydown", tecla, true)
    }
    function posicionar() {
        if (!botao || !menu) return
        const r = botao.getBoundingClientRect()
        const alto = Math.min(menu.scrollHeight, 320)
        const embaixo = window.innerHeight - r.bottom - 8
        const emCima = r.top - 8
        const paraCima = embaixo < alto && emCima > embaixo
        const altura = Math.max(120, Math.min(alto, paraCima ? emCima : embaixo))
        const largura = Math.max(r.width, 200)
        const esquerda = Math.min(r.left, window.innerWidth - largura - 8)
        pos = `left:${esquerda}px;width:${largura}px;max-height:${altura}px;` + (paraCima ? `bottom:${window.innerHeight - r.top + 4}px;` : `top:${r.bottom + 4}px;`)
    }
    function fechar() {
        aberto = false
        window.removeEventListener("mousedown", fora, true)
        window.removeEventListener("resize", fechar)
        window.removeEventListener("scroll", rolou, true)
        window.removeEventListener("keydown", tecla, true)
    }
    function fora(e: MouseEvent) {
        const alvo = e.target as Node
        if (menu?.contains(alvo) || botao?.contains(alvo)) return
        fechar()
    }
    function tecla(e: KeyboardEvent) {
        if (e.key !== "Escape") return
        e.stopPropagation()
        fechar()
    }
    function escolher(id: string) {
        fechar()
        if (id !== valor) dispatch("escolher", id)
    }
    // rolar a pagina fecha (o menu nao acompanharia); rolar o proprio menu, nao
    function rolou(e: Event) {
        if (menu?.contains(e.target as Node)) return
        fechar()
    }
    onDestroy(fechar)
</script>

<button type="button" class="esc" class:aberto class:prob={!!problema || sumiu} title={problema || `${rotulo}: ${atual.nome}`} data-acao={acao || null} tabindex="-1" bind:this={botao} on:click={abrir}>
    <i>{rotulo}</i>
    <span class:neutra={ehNeutra}>{atual.nome}</span>
</button>

{#if aberto}
    <div class="menuEsc" style={pos} bind:this={menu} use:portal role="listbox">
        <button type="button" class="op" class:sel={ehNeutra} on:click={() => escolher(neutra.id)}>{neutra.nome}</button>
        {#if opcoes.length || sumiu}<hr />{/if}
        {#if sumiu}<button type="button" class="op sel" disabled>{atual.nome}</button>{/if}
        {#each opcoes as o (o.id)}
            <button type="button" class="op" class:sel={o.id === valor} on:click={() => escolher(o.id)}>{o.nome}</button>
        {/each}
    </div>
{/if}

<style>
    .esc {
        position: relative;
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        min-width: 0;
        height: 28px;
        padding: 0 26px 0 9px;
        border: 0;
        border-radius: var(--luz-raio-campo);
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: background 0.12s;
    }
    .esc:hover,
    .esc.aberto {
        background: var(--luz-hover);
    }
    .esc.prob {
        box-shadow: inset 0 0 0 1px var(--luz-laranja);
    }
    .esc::after {
        content: "";
        position: absolute;
        right: 10px;
        top: 50%;
        width: 5px;
        height: 5px;
        border-right: 1.5px solid var(--luz-mudo);
        border-bottom: 1.5px solid var(--luz-mudo);
        transform: translateY(-70%) rotate(45deg);
    }
    i {
        flex: none;
        font-style: normal;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--luz-mudo);
    }
    span {
        min-width: 0;
        font-size: 12.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    span.neutra {
        color: var(--luz-mudo);
        font-style: italic;
    }
    .menuEsc {
        position: fixed;
        z-index: 9000;
        overflow-y: auto;
        padding: 4px;
        border-radius: var(--luz-raio-menu);
        background: var(--luz-pop-opaco);
        box-shadow:
            var(--luz-sombra-pop),
            inset 0 0 0 1px var(--luz-borda);
        display: flex;
        flex-direction: column;
    }
    .op {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 26px;
        padding: 0 8px 0 22px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 12.5px;
        text-align: left;
        cursor: pointer;
        position: relative;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .op:hover {
        background: var(--luz-hover);
    }
    .op.sel::before {
        content: "✓";
        position: absolute;
        left: 7px;
        font-size: 10px;
    }
    .op:disabled {
        color: var(--luz-laranja);
        cursor: default;
    }
    hr {
        border: 0;
        border-top: 1px solid var(--luz-linha);
        margin: 3px 2px;
    }
</style>
