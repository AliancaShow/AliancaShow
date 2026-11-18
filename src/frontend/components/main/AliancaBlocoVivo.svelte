<script lang="ts">
    // Leiaute v2, roteiro: a linha do BLOCO AO VIVO (bolinha, nome, regressivo, botao do relogio) e o popover do tempo do bloco:
    // -5 / -1 / +1 / +5 minutos, "Segure pra encerrar o bloco" (inerte 3 s, gesto continuo) e o Desfazer de 30 s depois de encerrar.
    // As regras sao as de SirvoConduzir / SirvoBlocoConduzir (o Show pede, o Sirvo decide, o resultado chega pelo roteiro). Sem chave que
    // conduz, so o nome e o regressivo aparecem (o botao some). Texto do Sirvo so por interpolacao {...}, nunca {@html}.
    import { onDestroy } from "svelte"
    import { escFechou } from "../../utils/aliancaToque"
    import { newToast } from "../../utils/common"
    import { pedirAoSirvo, porQueNaoConduz, sirvo, sirvoAgora, sirvoRoteiro, type FuncaoDeEscrita } from "../../utils/aliancaSirvo"
    import SirvoSegurar from "../show/SirvoSegurar.svelte"
    import { ultimoEncerrado } from "../show/SirvoConduzir.svelte"

    export let blocoId: string
    export let nome = ""

    const DESFAZER_MS = 30_000
    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 500)
    onDestroy(() => clearInterval(relogio))

    $: r = $sirvoRoteiro
    $: motivo = porQueNaoConduz($sirvo)
    $: bloco = r?.blocos.find((b) => b.id === blocoId) || null
    $: restante = (() => {
        void agoraMs
        if (!bloco) return ""
        const fim = new Date(bloco.fim_previsto).getTime()
        if (isNaN(fim)) return ""
        const s = Math.trunc((fim - sirvoAgora()) / 1000)
        const a = Math.abs(s)
        const txt = `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`
        return s < 0 ? `+${txt}` : txt
    })()
    $: estourou = restante.startsWith("+")
    $: desfazer = $ultimoEncerrado && $ultimoEncerrado.ate > agoraMs && r?.blocos.some((b) => b.id === $ultimoEncerrado!.blocoId && b.concluido_em) ? $ultimoEncerrado : null
    $: pode = !!r && !!bloco && !motivo && $sirvo.podeConduzir

    let aberto = false
    let botao: HTMLElement
    let pos = { x: 0, y: 0 }
    function alternar(e: MouseEvent) {
        e.stopPropagation()
        if (!aberto) {
            const rect = botao.getBoundingClientRect()
            pos = { x: Math.max(8, Math.min(rect.left - 8, window.innerWidth - 300)), y: rect.bottom + 6 }
        }
        aberto = !aberto
    }
    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement).closest?.("[data-bloco-pop], [data-acao='tempo-bloco']")) aberto = false
    }
    function tecla(e: KeyboardEvent) {
        if (aberto && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            escFechou()
            aberto = false
        }
    }
    if (typeof window !== "undefined") window.addEventListener("keydown", tecla, true)
    onDestroy(() => typeof window !== "undefined" && window.removeEventListener("keydown", tecla, true))

    async function pedir(funcao: FuncaoDeEscrita, args: { [key: string]: any }) {
        const res = await pedirAoSirvo(funcao, args)
        if (!res.ok) newToast(res.mensagem)
        return res
    }
    function ajustar(delta: number) {
        if (!pode || !bloco) return
        const base = bloco.duracao_min
        const novo = Math.max(0, Math.min(600, base + delta))
        if (novo === base) return
        pedir("show_ajustar_duracao", { p_bloco: blocoId, p_base: base, p_novo: novo })
    }
    async function encerrar() {
        if (!pode || !r || !bloco) return
        const res = await pedir("show_avancar", { p_event: r.event_id, p_ao_vivo_esperado: bloco.id })
        if (!res.ok) return
        if (res.dados?.ja_estava) {
            newToast(`${bloco.titulo} já estava encerrado.`)
            return
        }
        ultimoEncerrado.set({ blocoId: bloco.id, titulo: bloco.titulo, ate: Date.now() + DESFAZER_MS })
        aberto = false
    }
    async function desfazerUltimo() {
        const d = desfazer
        if (!d || !r || motivo) return
        const feito = r.blocos.find((b) => b.id === d.blocoId)?.concluido_em
        ultimoEncerrado.set(null)
        if (!feito) return
        await pedir("show_desfazer_bloco", { p_bloco: d.blocoId, p_done_at: feito })
    }
</script>

<svelte:window on:mousedown={fora} />

<div class="vivo" data-acao="bloco-vivo">
    <span class="ponto" />
    <span class="nome">{nome}</span>
    <span class="restante" class:estourou>{restante}</span>
    {#if $sirvo.podeConduzir}
        <button bind:this={botao} class="relogio" class:on={aberto} data-acao="tempo-bloco" aria-label="Tempo do bloco: mais, menos ou encerrar" data-title="Tempo do bloco" tabindex="-1" on:mousedown|preventDefault on:click={alternar}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8.5" r="5.5" /><path d="M8 5.5v3l2 1.5" /><path d="M6.5 1.5h3" /></svg>
        </button>
    {/if}
</div>

{#if aberto && bloco}
    <div class="pop" data-bloco-pop style="left: {pos.x}px; top: {pos.y}px" role="dialog" aria-label="Tempo do bloco">
        <div class="tit">{nome}</div>
        <div class="linha">
            {#each [-5, -1, 1, 5] as d (d)}
                <button class="passo" disabled={!pode} tabindex="-1" on:mousedown|preventDefault on:click={() => ajustar(d)}>{d > 0 ? "+" : "−"}{Math.abs(d)}</button>
            {/each}
        </div>
        <div class="dur">{bloco.duracao_min} min no plano</div>
        <SirvoSegurar rotulo="Segure pra encerrar o bloco" dica="Encerrar {nome} no Sirvo: o bloco seguinte entra no ar" desabilitado={!pode} perigo on:feito={encerrar} />
    </div>
{/if}

{#if desfazer}
    <div class="desfazer">
        <span>{desfazer.titulo} encerrado.</span>
        <button class="refaz" tabindex="-1" on:mousedown|preventDefault on:click={desfazerUltimo}>Desfazer</button>
    </div>
{/if}

<style>
    .vivo {
        margin-top: 4px;
        height: 32px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 0 0 8px;
    }
    .ponto {
        width: 6px;
        height: 6px;
        border-radius: 3px;
        background: var(--luz-vermelho);
        flex-shrink: 0;
    }
    .nome {
        font-size: 12px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .restante {
        margin-left: auto;
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--luz-vermelho);
    }
    .restante.estourou {
        color: var(--luz-vermelho-claro);
    }
    .relogio {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 1px solid var(--luz-linha);
        border-radius: 6px;
        background: var(--luz-campo);
        cursor: pointer;
        color: rgba(248, 248, 240, 0.7);
    }
    .relogio.on {
        border-color: var(--luz-vermelho);
        background: var(--luz-vermelho-lavagem);
        color: var(--luz-vermelho-claro);
    }
    .pop {
        position: fixed;
        z-index: 50;
        width: 280px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        box-sizing: border-box;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: 12px;
        box-shadow: inset 0 0 0 1px var(--luz-borda), var(--luz-sombra-pop);
        transform-origin: top left;
        animation: luz-surgir 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .tit {
        font-size: 13px;
        font-weight: 600;
    }
    .linha {
        display: flex;
        gap: 6px;
    }
    .passo {
        flex: 1;
        height: 36px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .passo:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .dur {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .desfazer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .refaz {
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 12px;
        color: var(--luz-texto);
        cursor: pointer;
    }
</style>
