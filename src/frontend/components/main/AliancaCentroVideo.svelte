<script lang="ts">
    // Cabine 6 (D26): o video no centro e um CARTAO, nunca o video. Antes o VideoShow abria o arquivo inteiro num <video> parado num quadro (uma
    // decodificacao a mais, so para o operador ver uma foto). Agora: a miniatura que a biblioteca ja gera (loadThumbnail, feita no processo principal),
    // o nome, a duracao (so os metadados, aliancaMidiaDuracao) e o transporte: Tocar (manda ao ar, a mesma acao de antes), Pausar (D25, suave) e
    // Parar (D27, tira do ar). Quem toca e sempre a saida; o estado (tocando/pausado/falta) vem do relogio dela (videoSync), sem abrir o arquivo.
    import { createEventDispatcher, onDestroy } from "svelte"
    import type { Unsubscriber } from "svelte/store"
    import { outLocked, outputs } from "../../stores"
    import { formatarDuracao } from "../../utils/aliancaMidiaCartaoLogica"
    import { duracaoDeMidia } from "../../utils/aliancaMidiaDuracao"
    import { chaveVideo, pararVideo, pausarVideoSuave, pausasSuaves, tocarVideo } from "../../utils/aliancaPausaSuave"
    import { saidasComOVideo } from "../../utils/aliancaPausaSuaveLogica"
    import { restante, tempoCurto } from "../../utils/aliancaTransporteLogica"
    import { encodeFilePath, loadThumbnail, mediaSize } from "../helpers/media"
    import { videoSync } from "../media/video/videoSync"

    export let mediaPath: string
    export let nome = ""
    /** a duracao lida dos metadados (o VideoShow usa na barra de escolher o ponto de partida) */
    export let duracao = 0

    /** `noPonto`: Ctrl+clique manda ao ar a partir do ponto escolhido na barra do VideoShow (como o clique na previa fazia) */
    const dispatch = createEventDispatcher<{ tocar: { noPonto: boolean } }>()

    // miniatura: a mesma maquina da biblioteca, num tamanho maior
    let miniatura = ""
    let falhou = false
    $: carregarMiniatura(mediaPath)
    async function carregarMiniatura(p: string) {
        miniatura = ""
        falhou = false
        if (!p) return
        const m = await loadThumbnail(p, mediaSize.big)
        if (p !== mediaPath) return
        miniatura = m || ""
        falhou = !m
    }

    $: lerDuracao(mediaPath)
    async function lerDuracao(p: string) {
        duracao = 0
        if (!p) return
        const d = await duracaoDeMidia.pedir(p)
        if (p === mediaPath) duracao = d || 0
    }

    // no ar: as saidas com ESTE arquivo no fundo; a primeira comanda (como o cartao da pilha)
    $: saidas = saidasComOVideo($outputs as any, mediaPath)
    $: saida = saidas[0] || ""
    $: noAr = !!saida
    let estado = { atual: 0, duracao: 0, pausado: true }
    let escuta: Unsubscriber | null = null
    $: ligar(mediaPath, saida)
    function ligar(p: string, s: string) {
        if (escuta) escuta()
        escuta = null
        estado = { atual: 0, duracao: 0, pausado: true }
        if (!p || !s) return
        escuta = videoSync(p, s, (d) => {
            estado = { atual: d.currentTime || 0, duracao: d.duration || estado.duracao, pausado: !!d.paused }
        })
    }
    onDestroy(() => escuta?.())

    $: pausando = $pausasSuaves.has(chaveVideo(mediaPath))
    $: tocando = noAr && !estado.pausado && !pausando
    $: total = estado.duracao || duracao
    $: textoTempo = noAr ? "−" + tempoCurto(restante(total, estado.atual)) : formatarDuracao(duracao)
    $: situacao = !noAr ? "Fora do ar" : pausando ? "No ar · pausando" : tocando ? "No ar · tocando" : "No ar · pausado"

    function tocar(e: MouseEvent) {
        if ($outLocked) return
        if (!noAr) dispatch("tocar", { noPonto: e.ctrlKey || e.metaKey })
        else tocarVideo(mediaPath, saida)
    }
    function pausar() {
        if ($outLocked || !tocando) return
        pausarVideoSuave(mediaPath, saida)
    }
    function parar() {
        if ($outLocked || !noAr) return
        pararVideo(mediaPath)
    }
</script>

<div class="cv" data-acao="centro-video" data-no-ar={noAr || null} data-sem-trava>
    <div class="mini" class:vazia={!miniatura}>
        {#if miniatura}
            <img src={encodeFilePath(miniatura)} alt={nome} draggable="false" on:error={() => ((miniatura = ""), (falhou = true))} />
        {:else}
            <span class="sem">{falhou ? "sem miniatura" : ""}</span>
        {/if}
        {#if noAr}<span class="selo" data-title="Este vídeo está no ar"><i class="pt"></i>{situacao}</span>{/if}
    </div>
    <div class="info">
        <div class="tx">
            <span class="nome" data-title={nome}>{nome || "—"}</span>
            <span class="sub">{noAr ? situacao : situacao + (duracao ? " · " + formatarDuracao(duracao) : "")}</span>
        </div>
        <span class="tempo" data-centro-tempo>{textoTempo}</span>
    </div>
    <div class="ctl">
        <button type="button" class="b p" tabindex="-1" disabled={$outLocked || tocando} aria-label={noAr ? "Tocar" : "Tocar no ar"} data-title={pausando ? "Continuar tocando" : noAr ? "Tocar" : "Mandar ao ar"} data-acao="centro-tocar" on:mousedown|preventDefault on:click={tocar}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
            <span>{noAr ? "Tocar" : "Mandar ao ar"}</span>
        </button>
        <button type="button" class="b" tabindex="-1" disabled={$outLocked || !tocando} aria-label="Pausar" data-title="Pausar (desacelera até parar)" data-acao="centro-pausar" on:mousedown|preventDefault on:click={pausar}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10 M11 3v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
            <span>Pausar</span>
        </button>
        <button type="button" class="b" tabindex="-1" disabled={$outLocked || !noAr} aria-label="Parar" data-title="Parar: tira o vídeo do ar" data-acao="centro-parar" on:mousedown|preventDefault on:click={parar}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4h8v8H4z" fill="currentColor" /></svg>
            <span>Parar</span>
        </button>
    </div>
</div>

<style>
    .cv {
        width: min(640px, 100%);
        margin: auto;
        box-sizing: border-box;
        padding: 12px;
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-trilho);
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .mini {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: var(--luz-raio-thumb);
        background: var(--luz-thumb);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .mini img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
    }
    .sem {
        font-size: 12px;
        color: var(--luz-fraco);
    }
    .selo {
        position: absolute;
        left: 8px;
        top: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border-radius: var(--luz-raio-selo);
        background: var(--luz-vidro);
        font-size: 11px;
        font-weight: 600;
        color: var(--luz-texto-85);
    }
    .pt {
        width: 6px;
        height: 6px;
        border-radius: 3px;
        background: var(--luz-vermelho);
    }
    .info {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
    }
    .tx {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .nome {
        font-size: 15px;
        font-weight: 600;
        color: var(--luz-texto);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .sub {
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .tempo {
        flex-shrink: 0;
        font-size: 15px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--luz-texto-85);
    }
    .ctl {
        display: flex;
        gap: 8px;
    }
    .b {
        height: 36px;
        padding: 0 14px;
        border: 0;
        border-radius: var(--luz-raio-botao);
        background: transparent;
        color: var(--luz-texto-80);
        display: flex;
        align-items: center;
        gap: 8px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: inset 0 0 0 1px var(--luz-borda);
    }
    .b:hover:not(:disabled) {
        background: var(--luz-hover);
        color: var(--luz-texto);
    }
    .b:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .b.p:not(:disabled) {
        color: var(--luz-texto);
        box-shadow: inset 0 0 0 1px var(--luz-borda-forte);
    }
</style>
