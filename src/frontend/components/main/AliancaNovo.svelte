<script lang="ts">
    // Preparar (FV-B): o menu "+ Novo" da barra Culto | Biblioteca. Botão e popover.
    // Botão no padrão do AliancaModo (sem foco por Tab, mousedown sem roubar foco); itens são `div role="menuitem"`, não BUTTON:
    // o keydown global tira o foco de qualquer BUTTON a cada tecla (shortcuts.ts). O teclado do menu fica contido (stopPropagation).
    import { tick } from "svelte"
    import { executarComandoNovo } from "../../utils/aliancaBiblioteca"
    import { itensDoMenuNovo, type ComandoNovo } from "../../utils/aliancaBibliotecaLogica"

    /** painel estreito: o rótulo vira só "+" (o título explica) */
    export let compacto = false

    const itens = itensDoMenuNovo()
    const comandos = itens.filter((i): i is { id: ComandoNovo; rotulo: string } => i !== "separador")

    let aberto = false
    let ativo = 0
    let raiz: HTMLElement
    let botao: HTMLElement
    let menu: HTMLElement | undefined

    async function abrir() {
        aberto = true
        ativo = 0
        await tick()
        menu?.focus()
    }

    function fechar(devolverFoco = false) {
        aberto = false
        if (devolverFoco) botao?.focus()
    }

    function escolher(i: number) {
        const c = comandos[i]
        if (!c) return
        fechar()
        executarComandoNovo(c.id)
    }

    function tecla(e: KeyboardEvent) {
        // o menu é como um diálogo: nada do que se digita aqui chega aos atalhos do app
        e.stopPropagation()
        if (e.key === "ArrowDown") {
            e.preventDefault()
            ativo = (ativo + 1) % comandos.length
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            ativo = (ativo - 1 + comandos.length) % comandos.length
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            escolher(ativo)
        } else if (e.key === "Escape") {
            e.preventDefault()
            fechar(true)
        } else if (e.key === "Tab") {
            e.preventDefault()
            fechar(true)
        }
    }

    function fora(e: MouseEvent) {
        if (aberto && !raiz?.contains(e.target as Node)) fechar()
    }

    function perdeuOFoco(e: FocusEvent) {
        if (!aberto) return
        const para = e.relatedTarget as Node | null
        if (!para || !raiz?.contains(para)) fechar()
    }

    // índice do comando de cada linha do menu (o separador não tem)
    let n = 0
    const linhas = itens.map((i) => (i === "separador" ? { separador: true as const } : { separador: false as const, indice: n++, rotulo: i.rotulo }))
</script>

<svelte:window on:mousedown={fora} />

<div class="alianca-novo" bind:this={raiz}>
    <button class="botao" bind:this={botao} class:aberto tabindex="-1" aria-haspopup="menu" aria-expanded={aberto} title="Novo: música, apresentação em branco, importar" on:mousedown|preventDefault on:click={() => (aberto ? fechar() : abrir())}>
        {compacto ? "+" : "+ Novo"}
    </button>

    {#if aberto}
        <div class="menu" bind:this={menu} role="menu" tabindex="-1" on:keydown={tecla} on:focusout={perdeuOFoco}>
            {#each linhas as l}
                {#if l.separador}
                    <div class="sep" role="separator"></div>
                {:else}
                    <div class="item" class:ativo={ativo === l.indice} role="menuitem" tabindex="-1" on:mousedown|preventDefault on:mouseenter={() => (ativo = l.indice)} on:click={() => escolher(l.indice)} on:keydown={() => {}}>{l.rotulo}</div>
                {/if}
            {/each}
        </div>
    {/if}
</div>

<style>
    .alianca-novo {
        position: relative;
        flex: none;
        -webkit-app-region: no-drag;
    }

    .botao {
        border: 0;
        border-radius: 6px;
        padding: 3px 10px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--sobre-acento, #1a1200);
        background: var(--modo-prep, #e0a030);
        cursor: pointer;
        white-space: nowrap;
    }
    .botao:hover,
    .botao.aberto {
        filter: brightness(1.08);
    }

    /* acima dos botões flutuantes da lista do culto (z-index 199/200) */
    .menu {
        position: absolute;
        z-index: 201;
        top: calc(100% + 4px);
        right: 0;
        min-width: 176px;
        padding: 4px;

        border: 1px solid var(--glass-line, rgb(255 255 255 / 0.07));
        border-radius: 8px;
        background: var(--primary-darkest);
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
        outline: none;
    }

    .item {
        padding: 7px 10px;
        border-radius: 6px;
        font-size: 12.5px;
        color: var(--text);
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
    }
    .item.ativo {
        background: var(--sel-wash, rgb(242 26 39 / 0.16));
        box-shadow: inset 0 0 0 1px var(--sel-line, rgb(242 26 39 / 0.3));
    }

    .sep {
        height: 1px;
        margin: 4px 6px;
        background: var(--glass-line, rgb(255 255 255 / 0.07));
    }
</style>
