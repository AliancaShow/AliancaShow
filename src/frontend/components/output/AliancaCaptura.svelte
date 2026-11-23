<script lang="ts">
    // Cabine 6, passo intermediario do video (fatia A, D3/D28): a imagem AO VIVO da janela de uma saida, por captura da propria janela
    // (getMediaSourceId pedido pelo ID da saida). Substitui o espelho que montava outro <Video> e decodificava o arquivo de novo:
    //   - uso "previa": "No ar" e "Outras telas" na janela principal;
    //   - uso "espelho": item "saida atual" do leiaute de retorno (Stagebox).
    // Saida desligada / sem janela visivel (opcao b do Andre): com o slot `default` (so a janela principal passa, AliancaPreviaDesenhada), a previa
    // DESENHA o slide com o video em miniatura parada; sem slot (espelho do retorno), quadro parado + selo. Minimizada, caida ou sem resposta:
    // ultimo quadro + selo laranja/vermelho. Nunca decodifica o arquivo (regra do dono: sem caminho de reserva calado).
    import { onDestroy, onMount } from "svelte"
    import { allOutputs, livePrepare, outputDisplay, outputs, outputState } from "../../stores"
    import { abrirCaptura, fecharCaptura, pedirFonte } from "../../utils/aliancaCaptura"
    import { CONFERIR_MS, capturaContinua, estadoDaFonte, mostraSelo, proximoDesenho, textoParado, type MotivoParada } from "../../utils/aliancaCapturaLogica"
    import { falhaAlta } from "../../utils/aliancaFalha"

    export let outputId: string
    export let uso: "previa" | "espelho" = "previa"
    /** "largura/altura" da saida, para a caixa ter o formato dela (previa) */
    export let proporcao = ""

    $: saida = $outputs[outputId] || $allOutputs[outputId]
    $: nome = saida?.name || "Saída"

    let video: HTMLVideoElement
    let quadro: HTMLCanvasElement
    let fluxo: MediaStream | null = null
    let fonteAtual: string | null = null
    let motivo: MotivoParada | null = "carregando"
    let destruido = false
    let ocupado = false
    let deNovo = false
    let errosSeguidos = 0

    $: parado = motivo ? textoParado(motivo, nome, !!saida?.invisible) : null

    // camada desenhada (slot): liga na hora em que a saida desliga; desliga so no 1o quadro da captura (sem piscar)
    const podeDesenhar = !!$$slots.default
    let desenhando = podeDesenhar
    $: desenhando = proximoDesenho(desenhando, motivo, podeDesenhar, false)
    function primeiroQuadro() {
        desenhando = proximoDesenho(desenhando, motivo, podeDesenhar, true)
    }

    function congelar() {
        try {
            if (!video || !quadro || !video.videoWidth) return
            quadro.width = video.videoWidth
            quadro.height = video.videoHeight
            quadro.getContext("2d")?.drawImage(video, 0, 0)
        } catch (e) {
            falhaAlta("captura-congelar", e)
        }
    }

    function parar(guardarQuadro: boolean) {
        if (!fluxo) return
        if (guardarQuadro) congelar()
        fecharCaptura(fluxo)
        fluxo = null
        fonteAtual = null
        if (video) video.srcObject = null
    }

    async function conferir() {
        if (destruido) return
        if (ocupado) {
            deNovo = true
            return
        }
        ocupado = true
        try {
            const estado = estadoDaFonte(await pedirFonte(outputId))
            if (destruido) return
            const viva = fluxo?.getVideoTracks()[0]?.readyState === "live"
            if (capturaContinua(fonteAtual, viva, estado)) return
            if (!estado.aoVivo) {
                parar(true)
                motivo = estado.motivo
                return
            }
            parar(false)
            const novo = await abrirCaptura(estado.fonteId, uso)
            if (destruido) return fecharCaptura(novo)
            fluxo = novo
            fonteAtual = estado.fonteId
            const trilha = novo.getVideoTracks()[0]
            if (trilha) trilha.onended = () => conferirLogo()
            video.srcObject = novo
            // AbortError = o srcObject trocou antes do play terminar (a conferencia seguinte resolve); o resto sobe alto
            await video.play().catch((e) => {
                if (e?.name !== "AbortError") falhaAlta("captura-play", e)
            })
            motivo = null
            const v = video as any
            if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(() => fluxo === novo && primeiroQuadro())
            else primeiroQuadro()
            errosSeguidos = 0
        } catch (e) {
            parar(true)
            motivo = "erro"
            errosSeguidos++
            // a captura da janela da saida nao abriu: sobe na faixa de falha (alto), e o selo laranja fica na previa
            if (errosSeguidos === 1 || errosSeguidos % 20 === 0) falhaAlta("captura-saida", e)
        } finally {
            ocupado = false
            if (deNovo && !destruido) {
                deNovo = false
                conferirLogo()
            }
        }
    }

    let logo: ReturnType<typeof setTimeout> | undefined
    function conferirLogo() {
        clearTimeout(logo)
        logo = setTimeout(conferir, 250)
    }

    // ligar/desligar as telas, trocar a saida: confere ja (a janela aparece/some logo depois do clique)
    $: ($outputDisplay, $outputState, outputId, conferirLogo())

    let relogio: ReturnType<typeof setInterval> | undefined
    onMount(() => {
        conferir()
        relogio = setInterval(conferir, CONFERIR_MS)
    })
    onDestroy(() => {
        destruido = true
        clearInterval(relogio)
        clearTimeout(logo)
        parar(false)
    })
</script>

<div class="captura {uso}" data-acao="captura-saida" data-saida={outputId} data-estado={motivo || "ao-vivo"} style={proporcao ? `aspect-ratio: ${proporcao};` : ""}>
    <canvas class="quadro" class:visivel={!!motivo} bind:this={quadro} aria-hidden="true" />
    <!-- svelte-ignore a11y-media-has-caption -->
    <video class="vivo" class:visivel={!motivo} bind:this={video} muted autoplay playsinline />

    {#if desenhando}
        <div class="desenho"><slot /></div>
    {/if}

    {#if parado && mostraSelo(parado.tom, desenhando)}
        <div class="selo {parado.tom}" role={parado.tom === "neutro" ? "status" : "alert"}>{parado.texto}</div>
    {/if}

    {#if uso === "previa" && !desenhando && $livePrepare[outputId]}
        <div class="preparo" aria-hidden="true" />
    {/if}
</div>

<style>
    .captura {
        position: relative;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        background: #000;
        overflow: hidden;
        pointer-events: none;
    }
    .desenho {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .selo,
    .preparo {
        z-index: 2;
    }
    .vivo,
    .quadro {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        visibility: hidden;
    }
    .vivo.visivel {
        visibility: visible;
    }
    .quadro.visivel {
        visibility: visible;
        opacity: 0.45;
    }
    .selo {
        position: absolute;
        left: 6px;
        right: 6px;
        bottom: 6px;
        padding: 2px 6px;
        border-radius: var(--luz-raio-selo, 4px);
        font-size: 11px;
        font-weight: 600;
        line-height: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: var(--luz-tinta, #000);
        color: var(--luz-texto, #fff);
        width: fit-content;
        max-width: calc(100% - 12px);
    }
    .selo.alerta {
        background: var(--luz-laranja, #e07a00);
        color: var(--luz-tinta, #000);
    }
    .selo.queda {
        background: var(--luz-vermelho, #c62828);
        color: var(--luz-branco, #fff);
    }
    /* na previa o selo fica no alto: o pe e do rotulo da aba (AliancaOutrasTelas) */
    .previa .selo {
        top: 6px;
        bottom: auto;
    }
    /* no retorno o selo e maior (tela vista de longe) */
    .espelho .selo {
        font-size: 28px;
        line-height: 40px;
        padding: 4px 14px;
        left: 50%;
        right: auto;
        transform: translateX(-50%);
        bottom: 12px;
    }
    .preparo {
        position: absolute;
        inset: 0;
        background: #000;
        opacity: 0.3;
    }
</style>
