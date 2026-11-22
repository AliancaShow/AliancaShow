<script lang="ts">
    // Cabine 18/nov, C2: o cartao de transporte de UM video no ar (o fundo de uma saida). Um cartao por ARQUIVO: a pilha (AliancaTransporte) cria um destes
    // por saida com video diferente. A logica e a que a faixa de 36 px tinha para a saida principal (videoSync, arrasto, volume); so mudou onde mora.
    import { onDestroy } from "svelte"
    import type { Unsubscriber } from "svelte/store"
    import { fadeinAllPlayingAudio, fadeoutAllPlayingAudio } from "../../audio/audioFading"
    import { media, outLocked, playerVideos, special } from "../../stores"
    import { arrastoVale, criarLimitador, prenderBusca, prenderVolume, type ArrastoMidia } from "../../utils/aliancaTransporteLogica"
    import { chaveVideo, pararVideo, pausarVideoSuave, pausasSuaves, tocarVideo } from "../../utils/aliancaPausaSuave"
    import { splitPath } from "../helpers/get"
    import { getExtension, getMediaType, removeExtension } from "../helpers/media"
    import { VideoPlayer } from "../media/video/videoPlayer"
    import { videoSync } from "../media/video/videoSync"
    import AliancaTransporteLinha from "./AliancaTransporteLinha.svelte"

    export let fundo: any
    export let idSaida: string
    export let etiqueta = ""
    export let noTelao = false

    const COR_VIDEO = "#8cc7a6"

    $: caminho = (fundo?.path || fundo?.id || "") as string
    $: tipoFundo = (fundo?.type || (caminho ? getMediaType(getExtension(caminho)) : "image")) as string
    $: nomeVideo = fundo?.type === "player" ? $playerVideos[fundo?.id || ""]?.name || "" : caminho.includes(".") && !caminho.includes("base64") ? removeExtension(splitPath(caminho).name) : fundo?.name || ""

    let dadosVideo = { duracao: 0, pausado: true, repetir: false, mudo: false }
    let tempoVideo = 0
    let arrastandoVideo = false
    let pausadoAntes = true
    let escutaVideo: Unsubscriber | null = null
    let ultimoCaminho = ""
    $: if (caminho !== ultimoCaminho) {
        ultimoCaminho = caminho
        tempoVideo = 0
        dadosVideo = { duracao: 0, pausado: true, repetir: false, mudo: false }
    }
    // a escuta e refeita quando muda o arquivo ou a saida
    $: ligarVideo(caminho, idSaida)
    function ligarVideo(c: string, saida: string) {
        if (escutaVideo) escutaVideo()
        escutaVideo = null
        if (!c || !saida) return
        escutaVideo = videoSync(c, saida, (d) => {
            if (!arrastandoVideo) tempoVideo = d.currentTime || 0
            if (d.duration) dadosVideo.duracao = d.duration
            dadosVideo.pausado = d.paused
            dadosVideo.repetir = !!d.loop
            dadosVideo.mudo = !!d.muted
            dadosVideo = dadosVideo
        })
    }
    onDestroy(() => {
        // desmontou com o botao apertado: o video que tocava antes do arrasto volta a tocar (a barra pausou ao comecar)
        if (arrastoVideo && !pausadoAntes) VideoPlayer.play(arrastoVideo.caminho, arrastoVideo.saida)
        arrastoVideo = null
        if (escutaVideo) escutaVideo()
    })

    // D25: Pausar desacelera em 0,7 s (aliancaPausaSuave); enquanto a curva corre o botao ja mostra "tocar", e clicar nele cancela (o video segue)
    $: pausando = $pausasSuaves.has(chaveVideo(caminho))
    $: pausadoNaTela = dadosVideo.pausado || pausando
    function alternarVideo() {
        if ($outLocked || !caminho) return
        if (pausadoNaTela) {
            dadosVideo.pausado = false
            dadosVideo = dadosVideo
            tocarVideo(caminho, idSaida)
        } else pausarVideoSuave(caminho, idSaida)
    }
    // D27: Parar = tira do ar (o F1, so para este arquivo)
    function pararEsteVideo() {
        if ($outLocked || !caminho) return
        pararVideo(caminho)
    }
    function alternarRepetir() {
        if (!caminho) return
        dadosVideo.repetir = !dadosVideo.repetir
        dadosVideo = dadosVideo
        VideoPlayer.toggleLoop(caminho, idSaida)
    }
    function alternarMudo() {
        if ($outLocked || !caminho) return
        dadosVideo.mudo = !dadosVideo.mudo
        dadosVideo = dadosVideo
        VideoPlayer.toggleMute(caminho, idSaida)
    }
    // arrastar a barra: pausa enquanto arrasta (como o VideoSlider), busca em passos de 150 ms e volta a tocar ao soltar.
    // O arrasto guarda o arquivo e a saida em que comecou: se o fundo trocar no meio (outro video entra, Esc limpa), ele e abandonado
    // em vez de buscar no video novo; e a flag nunca fica presa (o tempo para de seguir o player enquanto ela esta ligada).
    let passoBusca: ReturnType<typeof setTimeout> | null = null
    let ultimoArrasto = 0
    let arrastoVideo: ArrastoMidia | null = null
    $: if (arrastoVideo && !arrastoVale(arrastoVideo, caminho, idSaida)) abandonarVideo()
    function abandonarVideo() {
        if (passoBusca) clearTimeout(passoBusca)
        passoBusca = null
        arrastoVideo = null
        arrastandoVideo = false
    }
    function comecarVideo() {
        if (!caminho) return
        arrastoVideo = { caminho, saida: idSaida }
        arrastandoVideo = true
        pausadoAntes = dadosVideo.pausado
        dadosVideo.pausado = true
        dadosVideo = dadosVideo
        VideoPlayer.pause(caminho, idSaida)
    }
    function moverVideo(e: CustomEvent<number>) {
        if (!arrastoVideo) return
        ultimoArrasto = e.detail
        tempoVideo = e.detail
        if (passoBusca) return
        passoBusca = setTimeout(() => {
            passoBusca = null
            if (arrastoVideo && arrastoVale(arrastoVideo, caminho, idSaida)) VideoPlayer.seekTo(arrastoVideo.caminho, arrastoVideo.saida, prenderBusca(ultimoArrasto, dadosVideo.duracao, $media[arrastoVideo.caminho]?.toTime))
        }, 150)
    }
    function soltarVideo(e: CustomEvent<number>) {
        if (passoBusca) clearTimeout(passoBusca)
        passoBusca = null
        const a = arrastoVideo
        arrastoVideo = null
        arrastandoVideo = false
        if (!a) return
        // o fundo mudou no meio do arrasto: nada a buscar nem a retomar (o video novo nao e o que o operador estava procurando)
        if (!arrastoVale(a, caminho, idSaida)) return
        const alvo = prenderBusca(e.detail, dadosVideo.duracao, $media[a.caminho]?.toTime)
        tempoVideo = alvo
        VideoPlayer.seekTo(a.caminho, a.saida, alvo)
        dadosVideo.pausado = pausadoAntes
        dadosVideo = dadosVideo
        if (!pausadoAntes) VideoPlayer.play(a.caminho, a.saida)
    }
    // o volume e o do arquivo (`media[caminho].volume`, o mesmo que o painel de informacoes da midia escreve)
    $: volumeVideo = $media[caminho]?.volume ?? 1
    // arrastar o volume escreve o `media` inteiro e o manda por IPC a todas as saidas: no maximo 10 escritas por segundo, e soltar grava o final.
    // O teto e 125 % (o que o ajuste da midia aceita): um volume salvo acima de 100 % aparece como e, e nao e reduzido calado.
    const gravarVolumeVideo = ({ c, v }: { c: string; v: number }) => {
        media.update((a) => ({ ...a, [c]: { ...(a[c] || {}), volume: v } }))
        VideoPlayer.updateVolume(c)
    }
    const limiteVolumeVideo = criarLimitador(gravarVolumeVideo, 100)
    function volumeDoVideo(e: CustomEvent<number>) {
        if (caminho) limiteVolumeVideo.empurrar({ c: caminho, v: prenderVolume(e.detail) })
    }
    function volumeFimDoVideo(e: CustomEvent<number>) {
        if (!caminho) return
        limiteVolumeVideo.fechar({ c: caminho, v: prenderVolume(e.detail) })
        // "silenciar audio quando o video toca": o caminho do painel Info reavaliava isso a cada mudanca de volume (updateProperties)
        if ($special.muteAudioWhenVideoPlays) {
            if (VideoPlayer.hasAudibleVideo()) fadeoutAllPlayingAudio()
            else fadeinAllPlayingAudio()
        }
    }
</script>

<AliancaTransporteLinha
    tipo="video"
    cor={COR_VIDEO}
    nome={nomeVideo}
    saida={etiqueta}
    {noTelao}
    pausado={pausadoNaTela}
    {pausando}
    atual={tempoVideo}
    duracao={dadosVideo.duracao}
    repetir={dadosVideo.repetir}
    mudo={dadosVideo.mudo}
    volume={tipoFundo === "player" ? null : volumeVideo}
    travada={$outLocked}
    on:alternar={alternarVideo}
    on:parar={pararEsteVideo}
    on:repetir={alternarRepetir}
    on:mudo={alternarMudo}
    on:comecar={comecarVideo}
    on:mover={moverVideo}
    on:soltar={soltarVideo}
    on:volume={volumeDoVideo}
    on:volumefim={volumeFimDoVideo}
/>
