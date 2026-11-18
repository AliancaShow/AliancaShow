<script lang="ts">
    // Leiaute v2, topo: marca + menu do app. Fatia 4: o menu herda tudo o que a barra de menus do Windows (Arquivo, Editar, Visualizar,
    // Ajuda) oferecia e que continua existindo. Paginas (Configuracoes, Telas e monitor de retorno, Ferramentas da saida) escrevem a pagina;
    // Importar, Exportar, Historico, Atalhos e Sobre abrem popup; Tela cheia alterna a janela; Recarregar e Ferramentas de desenvolvedor
    // so aparecem em dev (`isDev`). Aberto por clique, fecha ao escolher, ao clicar fora e com Esc (o Esc e SO do menu enquanto aberto:
    // capturado antes de chegar aos atalhos do telao).
    import { onDestroy } from "svelte"
    import { activePopup, activeProfile, isDev, profiles } from "../../stores"
    import { alternarFerramentasDeDev, alternarTelaCheia, desfazerAgora, recarregarJanela, refazerAgora, salvarAgora } from "../../utils/aliancaJanela"
    import { trocarTela } from "../../utils/aliancaTela"
    import { desenhoBloqueado } from "../../utils/aliancaDesenho"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { escFechou } from "../../utils/aliancaToque"
    import AliancaCortina from "./AliancaCortina.svelte"

    let aberto = false
    let raiz: HTMLElement
    $: profile = $profiles[$activeProfile || ""]
    $: settingsDisabled = Object.keys(profile?.access.settings || {}).length > 7

    // perfis de acesso: o seletor e o perfil moram em Configurações (aba Perfis); aqui só o nome do perfil ativo, quando há mais de um
    $: perfilAtivo = $activeProfile && Object.keys($profiles).filter((a) => a !== "admin").length > 1 ? $profiles[$activeProfile]?.name || "" : ""

    type Item = { id: string; nome: string; agir: () => void; mudo?: boolean; atalho?: string }
    type Grupo = Item[]
    $: grupos = [
        [...(settingsDisabled ? [] : [{ id: "settings", nome: "Configurações…", agir: () => ir("settings") }]), { id: "stage", nome: "Telas e monitor de retorno…", agir: () => ir("stage") }, { id: "draw", nome: "Ferramentas da saída (desenhar, zoom)", agir: () => ir("draw") }],
        [
            { id: "save", nome: "Salvar", agir: salvarAgora, atalho: "Ctrl+S" },
            { id: "undo", nome: "Desfazer", agir: desfazerAgora, atalho: "Ctrl+Z" },
            { id: "redo", nome: "Refazer", agir: refazerAgora, atalho: "Ctrl+Y" }
        ],
        [
            { id: "import", nome: "Importar…", agir: () => activePopup.set("import"), atalho: "Ctrl+I" },
            { id: "export", nome: "Exportar…", agir: () => activePopup.set("export"), atalho: "Ctrl+E" },
            { id: "history", nome: "Histórico…", agir: () => activePopup.set("history"), atalho: "Ctrl+H" }
        ],
        [
            { id: "fullscreen", nome: "Tela cheia", agir: alternarTelaCheia, atalho: "F11" },
            { id: "shortcuts", nome: "Atalhos e ajuda…", agir: () => activePopup.set("shortcuts"), mudo: true },
            { id: "about", nome: "Sobre o AliançaShow…", agir: () => activePopup.set("about"), mudo: true }
        ],
        ...($isDev
            ? [
                  [
                      { id: "reload", nome: "Recarregar (só em dev)", agir: recarregarJanela, mudo: true },
                      { id: "devtools", nome: "Ferramentas de desenvolvedor (só em dev)", agir: alternarFerramentasDeDev, mudo: true }
                  ]
              ]
            : [])
    ] as Grupo[]

    // a pagina chega por argumento (a guarda de escritores nao aceita o literal "draw"): a lista nomeada de dinamicos conhece `p`
    function ir(p: "settings" | "stage" | "draw") {
        // Ferramentas da saida em Editar: os botoes seriam inertes e calados; a entrada recusa em voz alta (faixa de falha) e fica onde esta
        if (p === "draw" && desenhoBloqueado()) return
        trocarTela(p, "menu-app")
    }
    function escolher(i: Item) {
        aberto = false
        try {
            i.agir()
        } catch (e) {
            falhaAlta("menu-app", e)
        }
    }
    function fora(e: MouseEvent) {
        if (aberto && !raiz?.contains(e.target as Node)) aberto = false
    }
    function tecla(e: KeyboardEvent) {
        if (!aberto) return
        if (e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            escFechou()
            aberto = false
        }
    }
    // captura: o menu aberto consome o Esc antes de `previewShortcuts`
    if (typeof window !== "undefined") window.addEventListener("keydown", tecla, true)
    onDestroy(() => typeof window !== "undefined" && window.removeEventListener("keydown", tecla, true))
</script>

<svelte:window on:mousedown={fora} />

<div class="raiz" bind:this={raiz}>
    <button class="marca" data-acao="menu-app" aria-label="Menu do AliançaShow" aria-haspopup="menu" aria-expanded={aberto} tabindex="-1" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>
        <svg width="17" height="20" viewBox="0 0 32.296 38.868" aria-hidden="true"
            ><path
                fill="#F21A27"
                d="M16.982 0L16.982 2.802C25.57 3.588 32.296 10.808 32.296 19.606L32.296 23.041C29.245 16.618 22.796 12.124 15.295 11.911C16.222 15.138 15.769 18.803 13.397 20.807C10.225 23.489 8.164 27.017 8.151 31.178C8.142 33.996 8.943 36.656 10.528 38.867L2.208 38.867C0.988 38.867 0 37.879 0 36.661L0 16.782C0 7.515 7.512 0 16.78 0L16.982 0Z M28.732 38.868L18.318 38.868C17.64 37.953 17.238 36.824 17.208 35.634C17.163 33.865 17.958 32.463 19.242 31.327L20.722 30.014C21.964 28.913 23.25 27.94 22.991 26.223C25.891 27.69 26.954 31.065 25.567 34.003C26.806 33.405 27.683 32.32 28.315 30.943C29.105 31.701 29.438 32.72 29.603 33.804C29.87 35.562 29.538 37.328 28.732 38.868Z"
            /></svg
        >
        <span>aliança <span class="show">show</span></span>
        <span class="seta">▾</span>
    </button>
    {#if aberto}
        <AliancaCortina on:fechar={() => (aberto = false)} />
        <div class="menu" role="menu">
            {#if perfilAtivo}<div class="perfil" data-acao="menu-perfil">Perfil: {perfilAtivo}</div>{/if}
            {#each grupos as g, n}
                {#if n > 0}<div class="sep" role="separator" />{/if}
                {#each g as i (i.id)}
                    <button class="item" class:mudo={i.mudo} role="menuitem" data-item={i.id} tabindex="-1" on:mousedown|preventDefault on:click={() => escolher(i)}
                        ><span>{i.nome}</span>{#if i.atalho}<span class="atalho">{i.atalho}</span>{/if}</button
                    >
                {/each}
            {/each}
        </div>
    {/if}
</div>

<style>
    .raiz {
        position: relative;
    }
    .marca {
        height: 40px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 0 10px 0 6px;
        border: none;
        border-radius: 10px;
        background: transparent;
        font: inherit;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: -0.01em;
        font-variation-settings: "wdth" 118;
        cursor: pointer;
        color: var(--luz-texto);
    }
    .marca:hover {
        background: var(--luz-campo);
    }
    .show {
        color: rgba(248, 248, 240, 0.42);
        font-weight: 500;
    }
    .seta {
        color: rgba(248, 248, 240, 0.42);
        font-weight: 400;
        font-size: 12px;
    }
    .menu {
        position: absolute;
        z-index: 40;
        top: 46px;
        left: 0;
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: 10px;
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            var(--luz-sombra-pop);
        transform-origin: top left;
        animation: luz-surgir 120ms ease-out;
    }
    .atalho {
        margin-left: auto;
        padding-left: 16px;
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .item {
        min-height: 40px;
        display: flex;
        align-items: center;
        padding: 6px 10px;
        border: none;
        border-radius: 8px;
        background: transparent;
        font: inherit;
        font-size: 13px;
        text-align: left;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .item:hover {
        background: var(--luz-hover);
    }
    .item.mudo {
        color: var(--luz-mudo);
    }
    .item.mudo:hover {
        color: var(--luz-texto);
    }
    .sep {
        height: 1px;
        margin: 4px 0;
        background: var(--luz-linha);
    }
    .perfil {
        padding: 6px 10px 4px;
        font-size: 11px;
        font-weight: 600;
        color: var(--luz-mudo);
    }
</style>
