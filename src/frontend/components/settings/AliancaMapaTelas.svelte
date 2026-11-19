<script lang="ts">
    // Configuracoes > Telas e saidas (C4): "Onde esta cada tela" (mapa) e "Todas as saidas" (lista). A tela vermelha e a que a saida
    // ESCOLHIDA ocupa; clicar em outra tela move a saida (a mesma troca do popup "Tela de saida": bounds + screen + UPDATE_BOUNDS).
    import { onMount } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { currentOutputSettings, outputDisplay, outputs, stageShows } from "../../stores"
    import { ocupaATela, ordenarTelas, resumoDaSaida, rotuloDaTela, type TelaDoSistema } from "../../utils/aliancaSaidasLogica"
    import { send } from "../../utils/request"
    import { keysToID, sortByName, sortObject } from "../helpers/array"
    import { toggleOutputs } from "../helpers/output"

    let telas: TelaDoSistema[] = []
    onMount(async () => {
        telas = ordenarTelas(((await requestMain(Main.GET_DISPLAYS)) || []) as TelaDoSistema[])
    })

    $: escolhida = $currentOutputSettings || ""
    $: lista = sortObject(sortByName(keysToID($outputs)), "stageOutput")

    // largura/altura do mapa: cada tela proporcional ao tamanho real, a maior cabe em 112 x 63 (a "1080p" do desenho)
    const BASE = 112
    $: maior = Math.max(1, ...telas.map((t) => t.bounds.width))
    const tamanho = (t: TelaDoSistema) => ({ w: Math.round((t.bounds.width / maior) * BASE), h: Math.round((t.bounds.height / maior) * BASE) })

    function mover(t: TelaDoSistema) {
        const id = escolhida
        if (!id || !$outputs[id] || ocupaATela($outputs[id], t)) return
        outputs.update((a: any) => {
            if (!a[id]) return a
            a[id].bounds = { x: t.bounds.x, y: t.bounds.y, width: t.bounds.width, height: t.bounds.height }
            a[id].screen = t.id.toString()
            return a
        })
        setTimeout(() => {
            toggleOutputs([id], { state: true })
            send(OUTPUT, ["UPDATE_BOUNDS"], { id, ...$outputs[id] })
        }, 100)
    }

    const estado = (o: any, noAr: boolean) => (o.enabled === false ? "" : noAr && !o.stageOutput ? "ar" : "ligada")
</script>

<aside class="lado" data-acao="saidas-mapa">
    <div class="rot">ONDE ESTÁ CADA TELA</div>
    <div class="mapa" data-acao="saidas-mapa-telas">
        {#each telas as t, i (t.id)}
            {@const r = rotuloDaTela(t, $outputs, escolhida)}
            {@const m = tamanho(t)}
            <button type="button" class="tela" class:minha={r.ocupadaPelaEscolhida} style="width: {m.w}px; height: {m.h}px;" data-tela={t.id} data-numero={i + 1} tabindex="-1" disabled={!escolhida} on:click={() => mover(t)}>
                <b>{i + 1}</b>
                {r.nome}
            </button>
        {/each}
        {#if !telas.length}<span class="cota">Procurando as telas…</span>{/if}
    </div>
    <p class="cota">A tela clara é a que esta saída ocupa agora. Clique em outra para mover a saída.</p>

    <div class="rot todas">TODAS AS SAÍDAS</div>
    <div class="lista" data-acao="saidas-todas">
        {#each lista as o (o.id)}
            <button type="button" class="linha" class:a={o.id === escolhida} data-saida={o.id} tabindex="-1" on:click={() => currentOutputSettings.set(o.id)}>
                {#if estado(o, $outputDisplay) !== ""}<i class="pt {estado(o, $outputDisplay)}"></i>{:else}<i class="pt"></i>{/if}
                <b>{o.name || "Sem nome"}</b>
                <span class="res">{resumoDaSaida(o, telas, o.stageOutput ? $stageShows[o.stageOutput]?.name || "" : "")}</span>
            </button>
        {/each}
    </div>
</aside>

<style>
    .lado {
        flex: 1;
        min-width: 0;
        padding-top: 22px;
    }
    .rot {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--luz-mudo);
        margin-bottom: 8px;
    }
    .rot.todas {
        margin-top: 26px;
    }
    .mapa {
        min-height: 150px;
        border-radius: 10px;
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        box-sizing: border-box;
    }
    .tela {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
        padding: 0;
        border-radius: 5px;
        border: 1px solid var(--luz-borda-forte);
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
    }
    .tela:hover:not(:disabled) {
        background: var(--luz-hover);
    }
    .tela b {
        font-size: 17px;
        color: var(--luz-texto);
    }
    .tela.minha {
        background: var(--luz-vermelho);
        border-color: var(--luz-vermelho);
        color: var(--luz-branco);
        cursor: default;
    }
    .tela.minha b {
        color: var(--luz-branco);
    }
    .cota {
        margin: 10px 0 0;
        font-size: 12px;
        line-height: 1.4;
        color: var(--luz-mudo);
    }
    .lista {
        border-radius: 10px;
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        overflow: hidden;
        font-size: 13px;
    }
    .linha {
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 12px;
        border: 0;
        border-top: 1px solid var(--luz-linha);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .linha:first-child {
        border-top: 0;
    }
    .linha.a {
        background: var(--luz-hover);
    }
    .linha b {
        font-weight: 600;
    }
    .res {
        margin-left: auto;
        color: var(--luz-mudo);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .pt {
        width: 7px;
        height: 7px;
        border-radius: 4px;
        background: var(--luz-fraco);
        flex-shrink: 0;
    }
    .pt.ar {
        background: var(--luz-vermelho);
    }
    .pt.ligada {
        background: var(--luz-verde);
    }
</style>
