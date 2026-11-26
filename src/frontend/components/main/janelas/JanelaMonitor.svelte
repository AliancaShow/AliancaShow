<script lang="ts">
    // AliancaShow (26/nov, "janelas nossas"): escolher o monitor de uma saida em cartoes "2 · DELL U2415 · 1920×1080 · Painel LED ✓",
    // no lugar do mapa de retangulos do FreeShow (settings/Screens.svelte, fecho). Mesma logica: GET_DISPLAYS, trocar bounds/screen,
    // ligar a saida, UPDATE_BOUNDS, travar, identificar. Recorte e mesclagem ficam no "Avancado", que desenha o miolo antigo.
    import { onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activePopup, alertMessage, currentOutputSettings, outputs, popupData } from "../../../stores"
    import { send } from "../../../utils/request"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { toggleOutputs } from "../../helpers/output"
    import Screens from "../../settings/Screens.svelte"

    const erro = $alertMessage === "error.display"
    const ativar = !!$popupData.activateOutput
    alertMessage.set("")
    popupData.set({})

    $: lista = sortByName(keysToID($outputs))
    $: if (lista.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(lista[0].id)
    $: saidaId = $currentOutputSettings || ""
    $: saida = ($outputs[saidaId] || {}) as any
    $: travada = !!saida.boundsLocked || !!saida.forcedResolution

    type Monitor = { id: number; label?: string; internal?: boolean; bounds: { x: number; y: number; width: number; height: number } }
    let monitores: Monitor[] = []
    let carregando = true
    onMount(async () => {
        const d: Monitor[] = (await requestMain(Main.GET_DISPLAYS)) || []
        monitores = d.sort((a, b) => a.bounds.x - b.bounds.x).sort((a, b) => Number(!!b.internal) - Number(!!a.internal))
        carregando = false
    })

    const mesmo = (a: any, b: any) => !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
    // saida sem "screen" gravado: acha pelo retangulo (igual ao Screens)
    $: if (saidaId && !saida.screen && monitores.length) {
        const m = monitores.find((a) => mesmo(a.bounds, saida.bounds))
        if (m) outputs.update((a: any) => ((a[saidaId].screen = m.id.toString()), a))
    }
    $: escolhido = saida.screen ? String(saida.screen) : monitores.find((a) => mesmo(a.bounds, saida.bounds))?.id?.toString() || ""

    // quem mais usa cada monitor (as outras saidas ligadas)
    function usadoPor(m: Monitor, _o: any): string[] {
        return lista.filter((o: any) => o.id !== saidaId && o.enabled && !o.stageOutput && !o.ndi && (String(o.screen || "") === m.id.toString() || mesmo(o.bounds, m.bounds))).map((o: any) => o.name)
    }

    function escolher(m: Monitor) {
        if (travada || !saidaId) return
        const jaEra = escolhido === m.id.toString()
        const b = m.bounds
        outputs.update((a: any) => {
            if (!a[saidaId]) return a
            a[saidaId].bounds = { x: b.x, y: b.y, width: b.width, height: b.height }
            a[saidaId].screen = m.id.toString()
            return a
        })
        setTimeout(() => {
            toggleOutputs([saidaId], { state: true })
            send(OUTPUT, ["UPDATE_BOUNDS"], { id: saidaId, ...$outputs[saidaId] })
        }, 100)
        if (ativar || jaEra) activePopup.set(null)
    }

    function travar() {
        if (!saidaId) return
        outputs.update((a: any) => {
            if (a[saidaId]) a[saidaId].boundsLocked = !a[saidaId].boundsLocked
            return a
        })
    }
    const identificar = () => send(OUTPUT, ["IDENTIFY_SCREENS"], monitores)

    let avancado = false
</script>

{#if avancado}
    <div class="avancado">
        <button class="jb fantasma voltar" on:click={() => (avancado = false)}><Icon id="back" size={0.85} white /> Voltar</button>
        <Screens activateOutput={ativar} />
    </div>
{:else}
    <div class="pergunta" data-janela="monitor">
        <h3>Em qual monitor fica {saida.name ? `a saída "${saida.name}"` : "esta saída"}?</h3>
        {#if erro}
            <p class="erro">O monitor desta saída não foi encontrado. Escolha outro.</p>
        {:else if saida.boundsLocked}
            <p>A posição está travada. Destrave para trocar de monitor.</p>
        {/if}

        <div class="cartoes">
            {#if carregando}
                <p class="nada">Procurando monitores…</p>
            {:else}
                {#each monitores as m, i (m.id)}
                    {@const outros = usadoPor(m, $outputs)}
                    <button class="cartao" class:escolhido={escolhido === m.id.toString()} disabled={travada} data-acao="monitor-{i + 1}" on:click={() => escolher(m)}>
                        <span class="num">{i + 1}</span>
                        <span class="nome">{m.label || (m.internal ? "Tela do PC" : "Monitor")}{m.internal ? " · este PC" : ""}</span>
                        <span class="det">{m.bounds.width}×{m.bounds.height}{outros.length ? ` · ${outros.join(", ")}` : ""}</span>
                        {#if escolhido === m.id.toString()}<Icon id="check" size={0.85} white />{/if}
                    </button>
                {/each}
            {/if}
        </div>

        <div class="rodape">
            <button class="jb fantasma" data-title="Mostra o número de cada monitor nas próprias telas" on:click={identificar}><Icon id="search" size={0.8} white /> Identificar</button>
            {#if !ativar}
                <button class="jb fantasma" disabled={!!saida.boundsLocked} data-title="Posição e tamanho em pixels" on:click={() => activePopup.set("change_output_values")}>Valores manuais</button>
                <button class="jb fantasma" data-title="Recorte e mesclagem de bordas" on:click={() => (avancado = true)}>Avançado</button>
            {/if}
            <span class="vao" />
            {#if !ativar}
                <button class="jb fantasma trava" class:ligada={saida.boundsLocked} data-title={saida.boundsLocked ? "Destravar a posição" : "Travar a posição desta saída"} on:click={travar}>
                    <Icon id={saida.boundsLocked ? "locked" : "unlocked"} size={0.85} white />
                </button>
            {/if}
        </div>
    </div>
{/if}

<style>
    .erro {
        color: var(--luz-laranja) !important;
    }
    .cartoes {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
    }
    .cartao {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 40px;
        padding: 0 12px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font-family: inherit;
        font-size: 13px;
        text-align: start;
        cursor: pointer;
    }
    .cartao:hover:not(:disabled) {
        background: var(--luz-hover);
    }
    .cartao.escolhido {
        border-color: var(--luz-texto);
        background: var(--luz-campo);
    }
    .cartao:disabled {
        cursor: default;
        opacity: 0.55;
    }
    .num {
        width: 14px;
        font-weight: 600;
    }
    .nome {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .det {
        margin-inline-start: auto;
        color: var(--luz-mudo);
        font-size: 12px;
        white-space: nowrap;
    }
    .nada {
        color: var(--luz-mudo);
        font-size: 12px;
    }
    .rodape {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 14px;
    }
    .rodape :global(.jb) {
        height: 28px;
        padding: 0 10px;
        gap: 6px;
        font-size: 12px;
    }
    .rodape :global(.jb:disabled) {
        opacity: 0.4;
        cursor: default;
    }
    .vao {
        flex: 1;
    }
    .trava.ligada {
        color: var(--luz-vermelho-claro);
    }
    .avancado {
        display: flex;
        flex-direction: column;
    }
    .voltar {
        align-self: flex-start;
        gap: 6px;
        margin-bottom: 8px;
    }
</style>
