<script lang="ts">
    // Valores dinamicos em portugues (fila de 24/nov). Aparece no lugar do popup do FreeShow (utils/aliancaValoresDinamicos.ts).
    // Grupos do "Texto ligado" + as Variaveis criadas, nome claro e previa ao vivo; clique poe no cursor da caixa; Ctrl + clique poe e continua.
    // "Todos os codigos (avancado)" abre o popup original do FreeShow. Teclado: o campo de busca e `.edit` (nada vaza para os atalhos);
    // Enter poe o primeiro da busca; Esc fecha.
    import { onDestroy, onMount, tick } from "svelte"
    import { activeEdit, activePage, activeShow, templates, timers, variables } from "../../stores"
    import { abrirCodigosDoFreeShow, inserirValor, valoresAbertos } from "../../utils/aliancaValoresDinamicos"
    import { gruposLigados, type GrupoLigado, type OpcaoLigada } from "../../utils/aliancaTextoLigadoLogica"
    import { getVariableNameId, replaceDynamicValues } from "../helpers/showActions"
    import { _show } from "../helpers/shows"

    const modelo: any = $activeEdit.type === "template" ? ($templates as any)[$activeEdit.id || ""] : null
    const modo: null | "scripture" = $activePage === "edit" && modelo && (modelo.settings?.mode === "scripture" || modelo.category === "scripture") ? "scripture" : null
    const ref = { showId: $activeShow?.id, layoutId: _show().get("settings.activeLayout"), slideIndex: $activeEdit.slide, type: $activePage === "stage" ? "stage" : $activeEdit.type || "show", id: $activeEdit.id, mode: modo }

    let busca = ""
    let campo: HTMLInputElement | undefined
    let aviso = ""
    const semAcento = (s: string) =>
        String(s || "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()

    function montar(b: string, _t: any, _v: any): GrupoLigado[] {
        const grupos = gruposLigados({ emModelo: modo === "scripture", cronometros: Object.values(($timers as any) || {}).map((x: any) => x?.name) })
        const vars = Object.values(($variables as any) || {}).filter((x: any) => x?.name && x.type !== "text_set")
        if (vars.length) grupos.push({ id: "variaveis", rotulo: "Variáveis", opcoes: vars.map((x: any) => ({ id: "var:" + x.name, rotulo: x.name, partes: [`{$${getVariableNameId(x.name)}}`] })) })
        const q = semAcento(b).trim()
        if (q.length < 2) return grupos
        return grupos.map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => semAcento(o.rotulo + " " + g.rotulo).includes(q)) })).filter((g) => g.opcoes.length)
    }
    $: grupos = montar(busca, $timers, $variables)
    const textoDa = (o: OpcaoLigada) => o.partes.join(o.emLinhas ? " " : "")

    // previa ao vivo (hora, video...) a cada segundo
    let tique = 0
    const relogio = setInterval(() => tique++, 1000)
    onDestroy(() => clearInterval(relogio))
    const previaDe = (o: OpcaoLigada, _t: number) => {
        try {
            return replaceDynamicValues(o.partes.join(o.emLinhas ? " · " : ""), ref, _t, true)
        } catch {
            return ""
        }
    }

    onMount(async () => {
        await tick()
        campo?.focus()
    })

    function por(o: OpcaoLigada, manter: boolean) {
        const ok = inserirValor(textoDa(o), manter)
        if (!ok) aviso = "Não deu para pôr o valor: clique com o botão direito dentro da caixa de texto e tente de novo."
        else if (manter) aviso = `“${o.rotulo}” posto. Ctrl + clique põe mais um.`
        if (manter) campo?.focus()
    }
    function fechar() {
        valoresAbertos.set(null)
    }
    function teclar(e: KeyboardEvent) {
        e.stopPropagation()
        if (e.key === "Escape") {
            e.preventDefault()
            fechar()
            return
        }
        if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault()
            const primeira = grupos[0]?.opcoes[0]
            if (primeira) por(primeira, e.ctrlKey)
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="fundo" data-acao="valores-dinamicos" on:mousedown|self={fechar} on:keydown|stopPropagation>
    <div class="janela" role="dialog" aria-label="Valores dinâmicos">
        <div class="topo">
            <span class="titulo">Valores dinâmicos</span>
            <input bind:this={campo} class="edit busca" type="search" placeholder="Buscar (ex.: hora, próximo, referência)" bind:value={busca} on:keydown={teclar} data-acao="valores-busca" />
            <button type="button" class="link" data-acao="valores-codigos" on:click={abrirCodigosDoFreeShow}>Todos os códigos (avançado)</button>
            <button type="button" class="x" title="Fechar (Esc)" data-acao="valores-fechar" on:click={fechar}>×</button>
        </div>
        <div class="corpo">
            {#each grupos as g (g.id)}
                <p class="grupo">{g.rotulo}</p>
                <div class="grade">
                    {#each g.opcoes as o (o.id)}
                        {@const previa = previaDe(o, tique)}
                        <button type="button" class="cartao" data-acao="valor-pt" data-valor={o.id} title="Clique: põe na caixa, no lugar do cursor. Ctrl + clique: põe e continua aqui." on:mousedown|preventDefault on:click={(e) => por(o, e.ctrlKey || e.metaKey)}>
                            <span class="rotulo">{o.rotulo}</span>
                            <span class="previa">
                                {#if previa && previa.trim()}{@html previa}{:else if o.exemplo}<i>ex.: {o.exemplo}</i>{:else}<i>— sem valor agora</i>{/if}
                            </span>
                        </button>
                    {/each}
                </div>
            {:else}
                <p class="vazio">Nada com esse nome. Em “Todos os códigos” estão todos os do FreeShow.</p>
            {/each}
        </div>
        <p class="pe">{aviso || "Para ligar a caixa inteira a um valor, use “Texto ligado” no painel da direita do Editar."}</p>
    </div>
</div>

<style>
    .fundo {
        position: fixed;
        inset: 0;
        z-index: 5000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.45);
    }
    .janela {
        width: min(960px, calc(100vw - 40px));
        height: min(640px, calc(100vh - 60px));
        display: flex;
        flex-direction: column;
        border-radius: var(--luz-raio-menu, 10px);
        background: var(--luz-pop-opaco, #222);
        box-shadow:
            var(--luz-sombra-pop, 0 10px 40px rgba(0, 0, 0, 0.5)),
            inset 0 0 0 1px var(--luz-borda, #444);
        color: var(--luz-texto, #fff);
        overflow: hidden;
    }
    .topo {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--luz-linha, #333);
    }
    .titulo {
        font-size: 15px;
        font-weight: 650;
        white-space: nowrap;
    }
    .busca {
        flex: 1;
        min-width: 0;
        height: 32px;
        padding: 0 10px;
        border: 1px solid var(--luz-borda, #444);
        border-radius: 8px;
        background: var(--luz-campo, transparent);
        color: var(--luz-texto, #fff);
        font: inherit;
        font-size: 13px;
    }
    .busca:focus {
        outline: none;
        border-color: var(--luz-texto, #fff);
    }
    .link {
        border: 0;
        background: none;
        color: var(--luz-mudo, #aaa);
        font: inherit;
        font-size: 12px;
        text-decoration: underline;
        cursor: pointer;
        white-space: nowrap;
    }
    .x {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto, #fff);
        font-size: 20px;
        cursor: pointer;
    }
    .x:hover,
    .cartao:hover {
        background: var(--luz-hover, rgba(255, 255, 255, 0.08));
    }
    .corpo {
        display: block;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 4px 14px 12px;
    }
    .grupo {
        display: block;
        margin: 12px 0 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--luz-mudo, #aaa);
    }
    .grade {
        display: grid;
        align-items: start;
        grid-auto-rows: min-content;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 6px;
    }
    .cartao {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 3px;
        padding: 8px 10px;
        border: 1px solid var(--luz-linha, #333);
        border-radius: 8px;
        background: var(--luz-campo, transparent);
        color: var(--luz-texto, #fff);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .rotulo {
        font-size: 12.5px;
        font-weight: 600;
    }
    .previa :global(*) {
        background: none !important;
        color: inherit !important;
        font-size: inherit !important;
        padding: 0 !important;
    }
    .previa,
    .rotulo {
        background: none !important;
    }
    .previa {
        display: block;
        font-size: 12px;
        color: var(--luz-mudo, #bbb);
        max-height: 34px;
        overflow: hidden;
        word-break: break-word;
    }
    .vazio,
    .pe {
        font-size: 12px;
        color: var(--luz-mudo, #aaa);
    }
    .pe {
        margin: 0;
        padding: 8px 14px;
        border-top: 1px solid var(--luz-linha, #333);
    }
</style>
