<script context="module" lang="ts">
    import { writable } from "svelte/store"
    // o último bloco que ESTE Show encerrou: o "Desfazer" vive 30 s, mesmo se o
    // operador trocar de projeto e voltar
    const ultimoEncerrado = writable<{ blocoId: string; titulo: string; ate: number } | null>(null)
    /** o avanço sugerido da faixa também oferece o Desfazer (quando encerra um bloco só) */
    export function marcarEncerrado(blocoId: string, titulo: string) {
        ultimoEncerrado.set({ blocoId, titulo, ate: Date.now() + 30_000 })
    }
</script>

<script lang="ts">
    // Linha de conduzir o culto na faixa do Sirvo (F2, SHOW-DESIGN.md §13.4).
    //
    // Só aparece quando a chave CONDUZ e o projeto é o do culto seguido.
    // - "Encerrar <bloco>" fica sempre à esquerda; o tempo do bloco ao lado.
    //   Parado de "enviando" até o roteiro voltar, e todo rótulo novo nasce
    //   inerte 3 s: senão "Encerrar Louvor" vira "Encerrar Palavra" no mesmo
    //   pixel e o segundo toque é o 09/ago.
    // - "Desfazer" (30 s) fica na PONTA DIREITA, nunca no pixel do encerrar.
    // - Iniciar, encerrar e reabrir o CULTO: só segurando (SirvoSegurar).
    // - O Show pede; o Sirvo decide; o resultado chega pelo roteiro. Nada aqui
    //   muda o estado antes da resposta.
    // Texto do Sirvo só por interpolação {…}, nunca {@html}.
    import { onDestroy } from "svelte"
    import { dicaSegura } from "../../utils/aliancaDica"
    import { newToast } from "../../utils/common"
    import { pedirAoSirvo, porQueNaoConduz, sirvo, sirvoAgora, sirvoRoteiro, type FuncaoDeEscrita } from "../../utils/aliancaSirvo"
    import SirvoSegurar from "./SirvoSegurar.svelte"

    const INERTE_MS = 3000
    const DESFAZER_MS = 30_000

    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 500)
    onDestroy(() => clearInterval(relogio))

    $: r = $sirvoRoteiro
    $: motivo = porQueNaoConduz($sirvo)
    $: semConexao = $sirvo.status !== "conectado"
    $: fase = !r ? "nada" : r.encerrado_em ? "encerrado" : !r.iniciado_em ? "antes" : r.bloco_no_ar ? "bloco" : "todos"
    $: idNoAr = r?.bloco_no_ar || null
    $: blocoNoAr = (idNoAr && r?.blocos.find((b) => b.id === idNoAr)) || null

    // carência: o rótulo do encerrar mudou -> inerte por 3 s
    let inerteAte = Date.now() + INERTE_MS
    let blocoVisto: string | null = null
    $: if ((blocoNoAr?.id || null) !== blocoVisto) {
        blocoVisto = blocoNoAr?.id || null
        inerteAte = Date.now() + INERTE_MS
    }
    $: inerte = agoraMs < inerteAte

    function restante(fimIso: string, _t: number): string {
        const fim = new Date(fimIso).getTime()
        if (isNaN(fim)) return ""
        const s = Math.trunc((fim - sirvoAgora()) / 1000)
        const a = Math.abs(s)
        const txt = `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`
        return s < 0 ? `+${txt}` : txt
    }
    $: tempo = blocoNoAr ? restante(blocoNoAr.fim_previsto, agoraMs) : ""
    $: estourou = tempo.startsWith("+")

    $: desfazer = $ultimoEncerrado && $ultimoEncerrado.ate > agoraMs && r?.blocos.some((b) => b.id === $ultimoEncerrado!.blocoId && b.concluido_em) ? $ultimoEncerrado : null

    async function pedir(funcao: FuncaoDeEscrita, args: { [key: string]: any }) {
        const res = await pedirAoSirvo(funcao, args)
        if (!res.ok) newToast(res.mensagem)
        return res
    }

    async function encerrarBloco() {
        if (!r || !blocoNoAr || inerte || motivo) return
        const bloco = blocoNoAr
        inerteAte = Date.now() + INERTE_MS
        const res = await pedir("show_avancar", { p_event: r.event_id, p_ao_vivo_esperado: bloco.id })
        if (!res.ok) return
        if (res.dados?.ja_estava) {
            newToast(`${bloco.titulo} já estava encerrado.`)
            return
        }
        ultimoEncerrado.set({ blocoId: bloco.id, titulo: bloco.titulo, ate: Date.now() + DESFAZER_MS })
    }

    async function desfazerUltimo() {
        const d = desfazer
        if (!d || !r || motivo) return
        const feito = r.blocos.find((b) => b.id === d.blocoId)?.concluido_em
        ultimoEncerrado.set(null)
        if (!feito) return
        await pedir("show_desfazer_bloco", { p_bloco: d.blocoId, p_done_at: feito })
    }

    const culto = (funcao: "show_iniciar" | "show_encerrar" | "show_reabrir") => () => {
        if (!r || motivo) return
        if (funcao !== "show_reabrir") ultimoEncerrado.set(null)
        pedir(funcao, { p_event: r.event_id })
    }
</script>

{#if $sirvo.podeConduzir && r && fase !== "nada"}
    <div class="linha conduzir" class:fora={semConexao}>
        {#if fase === "bloco" && blocoNoAr}
            <button class="principal" tabindex="-1" disabled={!!motivo || inerte} data-title={motivo || dicaSegura(`Encerrar ${blocoNoAr.titulo} no Sirvo: o bloco seguinte entra no ar`)} on:mousedown|preventDefault on:click={encerrarBloco}>
                Encerrar <span class="nome">{blocoNoAr.titulo}</span>
            </button>
            <span class="tempo" class:estourou>{tempo}</span>
        {:else if fase === "todos"}
            <span class="texto">Todos os blocos encerrados</span>
        {:else if fase === "antes"}
            <span class="texto">O culto ainda não começou</span>
        {:else}
            <span class="texto">Culto encerrado</span>
        {/if}

        <span class="espaco" />

        {#if semConexao}
            <span class="texto fraco" data-title={motivo}>Sem Sirvo: conduza pela régia</span>
        {:else if desfazer}
            <button class="fraco" tabindex="-1" disabled={!!motivo} data-title={dicaSegura(`Volta ${desfazer.titulo} para o ar`)} on:mousedown|preventDefault on:click={desfazerUltimo}>
                Desfazer · {Math.max(0, Math.ceil((desfazer.ate - agoraMs) / 1000))}s
            </button>
        {:else if fase === "antes"}
            <SirvoSegurar rotulo="Iniciar culto" dica="Segure para iniciar o culto no Sirvo. O relógio do primeiro bloco começa a contar." desabilitado={!!motivo} on:feito={culto("show_iniciar")} />
        {:else if fase === "encerrado"}
            <SirvoSegurar rotulo="Reabrir culto" dica="Segure para reabrir o culto no Sirvo." desabilitado={!!motivo} on:feito={culto("show_reabrir")} />
        {:else}
            <SirvoSegurar rotulo="Encerrar culto" dica="Segure para encerrar o culto no Sirvo. Dá para reabrir." perigo desabilitado={!!motivo} on:feito={culto("show_encerrar")} />
        {/if}
    </div>
{/if}

<style>
    .linha {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 26px;
        min-width: 0;
        padding-inline-start: 15px;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }
    .fora {
        opacity: 0.6;
    }
    .espaco {
        flex: 1;
    }
    .texto {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.7;
    }
    .tempo {
        flex: none;
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
    }
    .tempo.estourou {
        color: #ff8f97;
        opacity: 1;
    }

    button {
        flex: none;
        max-width: 60%;
        padding: 3px 10px;
        border: 0;
        border-radius: 14px;
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .principal {
        background: rgb(255 128 0 / 0.18);
        color: #ffb066;
        font-weight: 600;
    }
    .principal:hover:not(:disabled) {
        background: rgb(255 128 0 / 0.3);
    }
    .fraco {
        background: rgb(255 255 255 / 0.06);
        color: var(--text);
    }
    .fraco:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.12);
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
