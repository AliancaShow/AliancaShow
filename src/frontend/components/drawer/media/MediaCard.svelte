<script lang="ts">
    import { derived, get } from "svelte/store"
    import { soRetornoLigado } from "../../../utils/aliancaSoRetorno"
    import type { ContentFile, ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import type { MediaStyle } from "../../../../types/Main"
    import type { ShowType } from "../../../../types/Show"
    import { addProjectItem } from "../../../converters/project"
    import { activeProject, activeShow, customMessageCredits, media, mediaOptions, mediaTags, outLocked, outputs, photoApiCredits, projects, styles } from "../../../stores"
    import { tela } from "../../../utils/aliancaTela"
    import { chavesMarcadas, cliqueDeMarcar, duploCliqueDeMarcar, marcadoDeArquivo } from "../../../utils/aliancaGaveta"
    import { autorizarAr, gavetaNaoToca, podeMarcar } from "../../../utils/aliancaGavetaToque"
    import { chaveDe } from "../../../utils/aliancaGavetaLogica"
    import { camadaNaHora, ehAbaDePasta, pastaDaMidia, resolverFim, tagsSemPasta } from "../../../utils/aliancaPastasMidiaLogica"
    import { BIB } from "../../../utils/aliancaBibliotecaMidiaLogica"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaLayerType, getMediaStyle, getMediaType, loadThumbnail } from "../../helpers/media"
    import { VideoPlayer } from "../../media/video/videoPlayer"
    import { acaoDoClique, estadoDoCartao, formatarDuracao, resolucaoAcimaDoRecomendado, TRAVA_CARTAO_MS } from "../../../utils/aliancaMidiaCartaoLogica"
    import { registrarTentativa } from "../../../utils/aliancaTentativa"
    import { duracaoDeMidia, resolucoesDeMidia } from "../../../utils/aliancaMidiaDuracao"
    import { findMatchingOut, getAllActiveOutputs, getFirstActiveOutput, setOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import { clearSlide } from "../../output/clear"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import { motivoSemCulto } from "../../../utils/aliancaGaveta"
    import { newToast } from "../../../utils/common"
    import { avisarOffline, conferirNaBiblioteca, decidirAntesDoAr, midiasOffline } from "../../../utils/aliancaMidiaSumida"
    import { formatarData, formatarTamanho, infoDeMidia, pedirInfo } from "../../../utils/aliancaMidiaInfo"
    import MediaLoader from "./MediaLoader.svelte"

    export let name: string
    export let path: string
    export let credits: any = {}
    export let type: ShowType
    export let active: string | null
    export let shiftRange: any[] = []
    export let thumbnailPath = ""
    export let thumbnail = true
    export let loadFullImage = false
    export let contentProvider: ContentProviderId | false = false
    export let contentFileData: ContentFile | null = null

    let failed = false
    $: if (thumbnail && !thumbnailPath && !loadFullImage) getThumbnail()
    async function getThumbnail() {
        failed = false
        thumbnailPath = await loadThumbnail(path)
        if (!thumbnailPath) failed = true
    }

    // C1 (cabine 18/nov): arquivo local que sumiu quebra ALTO (cartao laranja com X, sem ir ao ar).
    // Cabine 6 (Andre, 23/nov): a miniatura em cache escondia o arquivo sumido. Agora a biblioteca pergunta ao disco uma vez por arquivo em cada
    // pasta aberta (trocar de pasta pergunta de novo) e o clique pergunta outra vez, na hora (aliancaMidiaSumida.ts).
    $: if (path && !contentProvider) conferirNaBiblioteca(path, active)
    $: falta = !contentProvider && $midiasOffline.has(path)

    // C1: duracao no canto do thumb, lida uma vez por arquivo (cache da sessao); imagem nao tem selo
    let duracaoLida = 0
    $: if (type === "video" && (thumbnail || lista) && path && !contentProvider) lerDuracao(path)
    async function lerDuracao(p: string) {
        const d = await duracaoDeMidia.pedir(p)
        if (p === path) duracaoLida = d
    }
    $: duracaoTxt = formatarDuracao(duration || duracaoLida)
    // 24/nov: aviso (nao bloqueia) de video acima de 1080p, que trava o telao na RX 580
    $: alta = type === "video" && $resolucoesDeMidia[path] ? resolucaoAcimaDoRecomendado($resolucoesDeMidia[path].largura, $resolucoesDeMidia[path].altura) : null
    $: noAr = findMatchingOut(path, $outputs) !== null
    let trava = false
    let travaTimer: ReturnType<typeof setTimeout> | undefined
    function armarTrava() {
        trava = true
        clearTimeout(travaTimer)
        travaTimer = setTimeout(() => (trava = false), TRAVA_CARTAO_MS)
    }
    $: gridCartao = $mediaOptions.mode === "grid" && thumbnail
    // modo Lista (cabine 26/nov): colunas Duracao / Resolucao / Tamanho / Adicionado
    $: lista = $mediaOptions.mode === "list" && !contentProvider
    $: if (lista && path) pedirInfo(path)
    $: info = lista ? $infoDeMidia[path] : null
    $: resolucaoTxt = $resolucoesDeMidia[path] ? `${$resolucoesDeMidia[path].largura}×${$resolucoesDeMidia[path].altura}` : ""
    // C1: "ja esta no roteiro" (a mesma midia no roteiro aberto): o ＋ vira ✓ verde; clicar de novo adiciona outra vez
    $: jaNoRoteiro = !!($projects[$activeProject || ""]?.shows || []).some((s: any) => s?.id === path)

    // C1: a engrenagem abre o MESMO menu do botao direito do cartao (ajustes da midia: fim, camada, filtros), ancorado nela
    function abrirAjustes(e: MouseEvent) {
        e.stopPropagation()
        const alvo = (e.currentTarget as HTMLElement).closest(".selectElem") as HTMLElement | null
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const fake = new MouseEvent("contextmenu", { clientX: r.left, clientY: r.bottom + 2, bubbles: true, cancelable: true })
        ;(alvo || (e.currentTarget as HTMLElement)).dispatchEvent(fake)
    }
    $: estado = estadoDoCartao({ falta, noAr, trava })

    // Store ContentFile object and display name for later use (license check, convert to show, etc.)
    $: if (contentFileData && contentProvider && path) {
        media.update((m) => {
            if (!m[path]) m[path] = {}
            m[path].contentFile = { ...contentFileData, providerId: contentProvider }
            m[path].name = name
            return m
        })
    }

    // Memoized name computation
    let displayName = ""
    $: {
        const dotIndex = name.lastIndexOf(".")
        const newName = dotIndex > 0 ? name.slice(0, dotIndex) : name
        if (displayName !== newName) {
            displayName = newName
        }
    }

    let loaded = true
    let videoElem: HTMLVideoElement | undefined
    let hover = false
    let duration = 0

    const steps = 10
    function move(e: any) {
        if (!loaded || !videoElem) {
            // if (hover) clearTimeout(enterTimeout)
            hover = false
            return
        }

        let percentage: number = e.offsetX / e.target.offsetWidth

        let time = Math.floor(duration * ((Math.floor(percentage * steps) * steps + steps) / 100))
        if (time && videoElem.currentTime === time) return
        if (!isFinite(time)) return

        if (Number(time) === time) videoElem.currentTime = time
    }

    function mousedown(e: any) {
        if (e.ctrlKey || e.metaKey) return

        if (credits) {
            photoApiCredits.set(credits)
        }
    }

    // let enterTimeout = null
    function mouseenter(e: any) {
        const mediaGrid = document.querySelector(".grid")?.querySelector(".grid")
        if (!mediaGrid) return

        // don't load if clicked (probably selecting)
        // WIP return if scrolling & don't load if quickly dragging the mouse across..
        if (e.buttons > 0) return
        hover = true

        // don't load all the videos if scrolling, or selecting
        // const scrollTop = mediaGrid.scrollTop
        // if (enterTimeout) clearTimeout(enterTimeout)
        // enterTimeout = setTimeout(() => {
        //     enterTimeout = null
        //     // return if scrolling or selected
        //     if (scrollTop !== mediaGrid.scrollTop || $selected.data.find((a) => a.path === path)) return
        //     hover = true
        // }, 200)
    }

    // AliançaShow (Preparar F6): na gaveta do Preparar o clique MARCA o item para levar ao culto; nunca vai para o ar
    $: marcadoDaGaveta = marcadoDeArquivo({ path, name, type, contentProvider })
    $: marcavel = $tela !== "mostrar" && !!marcadoDaGaveta
    $: estaMarcado = !!marcadoDaGaveta && $chavesMarcadas.has(chaveDe(marcadoDaGaveta))

    let wait = false
    function click(e: any) {
        // C1: arquivo que sumiu nunca vai ao ar nem marca (o cartao laranja ja diz por que)
        if (falta) {
            // cabine-5/6: offline fala alto e FICA na linha de avisos ate o arquivo voltar ou o x; "Tirar da biblioteca" no botao direito
            avisarOffline(path, displayName || name)
            return
        }
        // modo LISTA (revisao do PR #40, achado 10): a mesma zona segura do cartao em grade - so o thumb (.card) manda ao ar; o nome da linha so seleciona e arrasta
        const foraDoThumb = !gridCartao && e?.target instanceof Element && !e.target.closest(".card")
        if (gavetaNaoToca()) {
            if (e.ctrlKey || e.metaKey || e.shiftKey || iconClicked) return
            // cabine 18/nov (B1): em Mostrar o clique simples numa MIDIA (video ou imagem) vai ao ar, como no ProPresenter. So la: em Editar o clique MARCA
            // para levar ao culto e nunca vai ao ar. A trava de clique repetido (700 ms, aliancaToque) e o `wait` abaixo seguem valendo: nunca dispara 2x.
            if (!podeMarcar()) {
                if (type !== "video" && type !== "image") return
                if (foraDoThumb) return
                if ($outLocked) return newToast("o telão está congelado: descongele para mandar ao ar")
                autorizarAr(() => click({}))
                return
            }
            const m = marcadoDeArquivo({ path, name, type, contentProvider })
            if (m) cliqueDeMarcar(m)
            return
        }
        if (e.ctrlKey || e.metaKey || e.shiftKey || $outLocked || wait || iconClicked || foraDoThumb) return

        // don't hide again when double clicking
        wait = true
        setTimeout(() => {
            wait = false
        }, TRAVA_CARTAO_MS)

        const activeOutputs = getAllActiveOutputs()

        const isActive = !soRetornoLigado() && activeOutputs.some((a) => (a.out?.background?.path || a.out?.background?.id) === path)
        // C1 (decisao do dono, 18/nov): clicar no que JA esta no ar REINICIA o video (nunca limpa: limpar com um clique e o acidente de 09/ago do Sirvo)
        const acao = acaoDoClique({ noAr: isActive, falta, tipo: type })
        if (acao === "nada") return
        armarTrava()
        if (acao === "reiniciar") {
            activeOutputs.forEach((output) => {
                if ((output.out?.background?.path || output.out?.background?.id) !== path) return
                VideoPlayer.seekTo(path, output.id, 0)
                VideoPlayer.play(path, output.id)
            })
            return
        }
        // cabine 6: o disco e perguntado AGORA (a biblioteca pode ter olhado antes do arquivo sumir). Offline: nada sai, o cartao ganha o X
        if (!contentProvider) aoArSeExistir(activeOutputs)
        else mandarAoAr(activeOutputs)
    }

    async function aoArSeExistir(activeOutputs: ReturnType<typeof getAllActiveOutputs>) {
        if ((await decidirAntesDoAr(path, displayName || name)) === "offline") return
        mandarAoAr(activeOutputs)
    }

    function mandarAoAr(activeOutputs: ReturnType<typeof getAllActiveOutputs>) {
        // C3 + achado 1 (PR #40): a tarja do so retorno diz o NOME do que nao foi ao ar (grava logo antes do setOutput; a recusa e sincrona)
        registrarTentativa(displayName || name)
        let videoType = getMediaLayerType(path, mediaStyle)
        let loop = contentProvider || videoType === "foreground" ? false : true
        let muted = videoType === "background" ? true : false
        if (videoType === "foreground" && !soRetornoLigado()) clearSlide()

        // get style per output
        activeOutputs.forEach((output) => {
            const currentOutputStyle = $styles[output.style || ""]
            const currentMediaStyle = getMediaStyle($media[path], currentOutputStyle)
            setOutput("background", { path, type, loop, muted, startAt: 0, ...currentMediaStyle, ignoreLayer: videoType === "foreground" }, false, output.id)
        })

        customMessageCredits.set("")
    }

    // leiaute v2: o "＋" do cartao poe a midia no fim do roteiro (o mesmo `addProjectItem` do duplo clique); 500 ms contra toque duplo
    let ultimoMais = 0
    function maisNoRoteiro(e: MouseEvent) {
        e.stopPropagation()
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        const agora = Date.now()
        if (agora - ultimoMais < 500) return
        ultimoMais = agora
        const motivo = motivoSemCulto()
        if (motivo) return newToast(motivo)
        addProjectItem({ id: path, name, type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)) })
        newToast(`"${displayName || name}" entrou no fim do roteiro`)
    }

    function dblclick(e: any) {
        if (e.ctrlKey || e.metaKey || iconClicked) return

        if (gavetaNaoToca()) {
            if (!podeMarcar()) return
            const m = marcadoDeArquivo({ path, name, type, contentProvider })
            if (m) duploCliqueDeMarcar(m)
            return
        }

        // add to project
        const data = { id: path, name, type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)) }
        addProjectItem(data)
    }

    // Memoized output and style computation
    const currentOutput = derived(outputs, ($outputs) => getFirstActiveOutput($outputs))
    const currentStyle = derived([currentOutput, styles], ([$currentOutput, $styles]) => $styles[$currentOutput?.style || ""] || {})

    // Memoized media style computation
    let mediaStyle: MediaStyle = {}
    $: if (path && JSON.stringify($media[path]) !== JSON.stringify(mediaStyle)) {
        mediaStyle = getMediaStyle($media[path], $currentStyle)
    }

    // fixed resolution
    let resolution = { width: 16, height: 9 }
    // $: resolution = getResolution(null, { $outputs, $styles })

    // Memoized computed properties
    let isFavourite = false
    let icon = "image"
    let tags: string[] = []

    $: {
        const mediaData = $media[path]
        isFavourite = mediaData?.favourite === true
        icon = type === "video" ? "movie" : "image"
        // AliancaShow F7: o selo de etiquetas nao mostra a pasta (ela tem o proprio chip)
        tags = tagsSemPasta(mediaData?.tags, $mediaTags).filter((t) => t !== BIB)
    }

    // chips da pasta (so nas vistas "pasta:*"): o que o video faz ao terminar e em qual camada; borda = ajuste proprio da midia
    $: pastaId = pastaDaMidia($media[path]?.tags, $mediaTags)
    $: mostraChips = !lista && !!pastaId && ehAbaDePasta(active) && type === "video"
    $: fimEf = resolverFim({ midia: $media[path], mediaTags: $mediaTags })
    $: camadaEf = camadaNaHora($media[path], $mediaTags)
    // C1: video em repeticao ganha o ↻ ao lado da duracao (o mesmo criterio do clique: fundo e sem fim de pasta que pare)
    $: repete = type === "video" && !contentProvider && camadaEf !== "foreground" && fimEf.loop !== false

    let iconClicked: NodeJS.Timeout | null = null
    function removeStyle(key: string) {
        iconClicked = setTimeout(() => (iconClicked = null), 50)

        media.update((a) => {
            if (!a[path]) return a

            if (key === "filters") {
                delete a[path].fit
                delete a[path].flipped
                delete a[path].flippedY
                delete a[path].blend
                delete a[path].filter
                delete a[path].cropping
            } else if (key === "tags") {
                // a pasta (F7) nao e uma etiqueta comum: "remover etiquetas" a preserva
                // cabine-5: nem a marca da biblioteca (BIB): "remover etiquetas" nao tira a midia da biblioteca
                const pasta = pastaDaMidia(a[path].tags, get(mediaTags))
                const naBib = (a[path].tags || []).includes(BIB)
                a[path].tags = [...(pasta ? [pasta] : []), ...(naBib ? [BIB] : [])]
            } else {
                delete a[path][key]
            }

            return a
        })
    }
</script>

<SelectElem id="media" class="context #media_card" data={{ name, path, type, contentProvider }} {shiftRange} draggable fill>
    <div class="mc" class:lista class:cartao={gridCartao} class:ar={gridCartao && estado === "ar"} class:falta={gridCartao && estado === "falta"} class:trava={gridCartao && estado === "trava"} data-acao="midia-cartao" data-estado={gridCartao ? estado : ""}>
    <Card
        resolution={{ width: 16, height: 9 }}
        loaded={(loaded && ($mediaOptions.mode === "grid" ? thumbnailPath !== "" || loadFullImage : true)) || failed}
        style={thumbnail ? `width: ${$mediaOptions.mode === "grid" ? 100 : 100 / $mediaOptions.columns}%;` : ""}
        mode={$mediaOptions.mode}
        width={100}
        preview={!gridCartao && $activeShow?.id === path}
        outlineColor={gridCartao ? null : findMatchingOut(path, $outputs)}
        active={!gridCartao && noAr}
        label={displayName}
        semRotulo={$mediaOptions.mode === "grid" && thumbnail}
        title={contentProvider ? "" : path}
        icon={thumbnail ? icon : null}
        white={type === "image"}
        showPlayOnHover={false}
        {marcavel}
        marcado={estaMarcado}
        checkered={$mediaOptions.mode === "grid" && mediaStyle.fit !== "blur" && !failed}
        on:mousedown={mousedown}
        on:click={click}
        on:dblclick={dblclick}
        on:mouseenter={mouseenter}
        on:mouseleave={() => (hover = false)}
        on:mousemove={move}
    >
        <!-- icons -->
        <div class="icons">
            {#if isFavourite && active !== "favourites"}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("favourite")}>
                            <Icon id="star" size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if mediaStyle.videoType}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("videoType")}>
                            <Icon id={`type_${mediaStyle.videoType}`} size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if !!mediaStyle.filter?.length || $media[path]?.fit || mediaStyle.flipped || mediaStyle.flippedY || (mediaStyle.blend && mediaStyle.blend !== "normal") || Object.keys(mediaStyle.cropping || {}).length}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("filters")}>
                            <Icon id="filter" size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if tags.length}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("tags")}>
                            <Icon id="tag" size={0.9} white />
                        </Button>
                    </div>
                    <span style="max-width: 100%;">
                        <p>{tags.length === 1 ? $mediaTags[tags[0]]?.name || "—" : tags.length}</p>
                    </span>
                </div>
            {/if}
        </div>

        {#if mostraChips}
            <div class="chips">
                <span class:proprio={fimEf.origem === "proprio"} data-title={fimEf.origem === "proprio" ? "Ajuste próprio desta mídia" : "Segue a pasta"}>{fimEf.loop === false ? "para" : "repete"}</span>
                <span class:proprio={!!$media[path]?.videoType} data-title={$media[path]?.videoType ? "Ajuste próprio desta mídia" : "Segue a pasta"}>{camadaEf === "foreground" ? "frente" : "fundo"}</span>
            </div>
        {/if}

        {#if gridCartao}
            {#if duracaoTxt || alta}<span class="dur" data-acao="midia-duracao">{#if alta}<b class="alta" data-acao="midia-alta" data-title={alta.dica} title={alta.dica}>{alta.rotulo}</b>{/if}{duracaoTxt}{#if repete}<i class="rep" data-acao="midia-repete" title="Em repetição">↻</i>{/if}</span>{/if}
            {#if estado === "ar"}<span class="selo">NO AR</span>{/if}
            {#if estado === "repouso"}<span class="dica"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>AO AR</span>{/if}
            <button type="button" class="mais" class:ok={jaNoRoteiro} data-acao="midia-mais" aria-label="Adicionar ao roteiro" title={jaNoRoteiro ? "Já está no roteiro — adicionar de novo" : "Adicionar ao fim do roteiro"} tabindex="-1" on:mousedown|preventDefault|stopPropagation on:click={maisNoRoteiro}>
                <span class="mais-i">{jaNoRoteiro ? "✓" : "＋"}</span>
            </button>
        {/if}
        {#if estado === "falta" && gridCartao}
            <div class="sumiu" data-acao="midia-sumiu">
                <Icon size={2.2} id="close" white />
                <span>OFFLINE · arquivo não encontrado</span>
            </div>
        {:else if failed}
            <div class="icon">
                <Icon size={2.5} id="close" style="color: var(--disconnected);" white />
            </div>
        {:else if thumbnail}
            {#if thumbnailPath || loadFullImage}
                <MediaLoader bind:loaded bind:hover bind:duration bind:videoElem {resolution} {type} {path} {thumbnailPath} {name} {mediaStyle} {loadFullImage} />
            {/if}
        {:else}
            <div class="icon">
                <Icon size={2.5} id={icon} white={type === "image"} />
            </div>
        {/if}
    </Card>
    {#if gridCartao}
        <!-- faixa do nome: zona segura (so seleciona e arrasta; ir ao ar e so o thumb) -->
        <div class="pe" data-acao="midia-rodape">
            <span class="nm" data-title={path}>{displayName}</span>
            <button type="button" class="eng" data-acao="midia-ajustes" aria-label="Ajustes desta mídia" title="Ajustes desta mídia" tabindex="-1" on:mousedown|preventDefault|stopPropagation on:click={abrirAjustes}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></svg>
            </button>
        </div>
    {/if}
    {#if lista}
        <!-- modo Lista (cabine 26/nov): colunas que ajudam a achar/distinguir; os titulos ficam no AliancaMidiaListaCab -->
        <span class="lc lc-dur" data-acao="midia-col-duracao">{duracaoTxt || (type === "image" ? "—" : "")}</span>
        <span class="lc lc-res" class:acima={!!alta} title={alta?.dica || ""}>{resolucaoTxt}</span>
        <span class="lc lc-tam">{info ? formatarTamanho(info.tamanho) : ""}</span>
        <span class="lc lc-data" data-acao="midia-col-data" title={info?.criado ? "Chegou a este computador em " + new Date(info.criado).toLocaleString("pt-BR") : ""}>{info ? formatarData(info.criado) : ""}</span>
    {/if}
    </div>
</SelectElem>

<style>
    /* ---- C1 (cabine 18/nov): o cartao de midia. Thumb = unico gatilho de "ao ar"; faixa do nome = zona segura (seleciona e arrasta). Medidas do board. ---- */
    .mc:not(.cartao):not(.lista) {
        display: contents;
    }
    /* modo Lista: a linha do Card estica e as colunas ficam a direita, com as larguras do AliancaMidiaListaCab */
    .mc.lista {
        display: flex;
        align-items: center;
        min-width: 0;
        padding-right: 8px;
    }
    .mc.lista :global(.main) {
        flex: 1;
        min-width: 0;
        width: auto !important;
    }
    .lc {
        flex: none;
        text-align: right;
        font-size: var(--luz-fs-nome);
        color: var(--luz-mudo);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .lc.lc-dur {
        width: 64px;
        color: var(--luz-texto);
    }
    .lc.lc-res {
        width: 92px;
    }
    .lc.lc-res.acima {
        color: var(--luz-laranja);
    }
    .lc.lc-tam {
        width: 76px;
    }
    .lc.lc-data {
        width: 100px;
    }
    .mc.cartao {
        position: relative;
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 4px;
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
    }
    .mc.cartao :global(.main) {
        padding: 0;
        width: 100% !important;
        outline: none;
    }
    .mc.cartao :global(.card) {
        border-radius: var(--luz-raio-thumb);
        overflow: hidden;
        background: var(--luz-thumb);
        cursor: pointer;
    }
    .mc.cartao :global(.over:hover > .hover) {
        opacity: 0;
    }
    .mc.cartao:hover {
        background: var(--luz-hover);
        box-shadow: inset 0 0 0 1px var(--luz-borda-forte);
    }
    /* hover: contorno claro no thumb + a dica do que o clique faz (nunca vermelho: vermelho e so "no ar") */
    .mc.cartao:hover :global(.card)::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: var(--luz-raio-thumb);
        box-shadow: inset 0 0 0 2px var(--luz-anel);
        pointer-events: none;
        z-index: 2;
    }
    .alta {
        margin: 0 5px 0 -5px;
        padding: 0 5px;
        height: 100%;
        display: inline-flex;
        align-items: center;
        border-radius: var(--luz-raio-selo) 0 0 var(--luz-raio-selo);
        background: var(--luz-laranja);
        color: #111;
        font-weight: 700;
        cursor: help;
    }
    .dur {
        position: absolute;
        top: var(--luz-respiro-cartao);
        right: var(--luz-respiro-cartao);
        z-index: 3;
        height: var(--luz-selo-h);
        padding: 0 5px;
        display: flex;
        align-items: center;
        border-radius: var(--luz-raio-selo);
        background: var(--luz-selo);
        color: var(--luz-branco);
        font-size: var(--luz-fs-selo);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
    }
    .rep {
        margin-left: 4px;
        font-style: normal;
        font-weight: 700;
    }
    .dica {
        position: absolute;
        left: var(--luz-respiro-cartao);
        bottom: var(--luz-respiro-cartao);
        z-index: 3;
        height: var(--luz-dica-h);
        padding: 0 7px 0 5px;
        display: none;
        align-items: center;
        gap: 4px;
        border-radius: var(--luz-raio-selo);
        background: var(--luz-selo-forte);
        color: var(--luz-branco);
        font-size: var(--luz-fs-micro);
        font-weight: 700;
        letter-spacing: var(--luz-tracking-micro);
        pointer-events: none;
    }
    .mc.cartao:hover .dica {
        display: flex;
    }
    .selo {
        position: absolute;
        top: var(--luz-respiro-cartao);
        left: var(--luz-respiro-cartao);
        z-index: 3;
        padding: 2px 6px;
        border-radius: var(--luz-raio-selo);
        background: var(--luz-vermelho);
        color: var(--luz-branco);
        font-size: var(--luz-fs-micro);
        font-weight: 700;
        line-height: 14px;
        pointer-events: none;
    }
    /* o alvo real do "＋" e 38 x 38 e encosta nas duas bordas do thumb: errar para cima ou para a esquerda ainda cai no ＋, nunca no ar */
    .mais {
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 4;
        width: var(--luz-alvo-mais);
        height: var(--luz-alvo-mais);
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
        color: var(--luz-texto);
    }
    .mais-i {
        position: absolute;
        right: var(--luz-respiro-cartao);
        bottom: var(--luz-respiro-cartao);
        width: var(--luz-mais-i);
        height: var(--luz-mais-i);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--luz-raio-botao);
        background: var(--luz-selo-forte);
        box-shadow: inset 0 0 0 1px var(--luz-borda-forte);
        font-size: var(--luz-fs-mais);
        line-height: 1;
    }
    .mais.ok .mais-i {
        color: var(--luz-verde);
        box-shadow: inset 0 0 0 1px var(--luz-verde-borda);
    }
    .pe {
        height: var(--luz-rodape-h);
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px 0 0 6px;
        min-width: 0;
    }
    .nm {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--luz-fs-nome);
        font-weight: 600;
        color: var(--luz-texto);
    }
    .eng {
        flex: none;
        width: var(--luz-eng);
        height: var(--luz-eng);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: var(--luz-raio-thumb);
        background: transparent;
        color: var(--luz-mudo);
        cursor: pointer;
    }
    .mc.cartao:hover .eng,
    .eng:hover {
        color: var(--luz-texto);
    }
    /* no ar: o cartao INTEIRO fica vermelho (leitura a 2 m), faixa do nome cheia */
    .mc.cartao.ar,
    .mc.cartao.ar:hover {
        background: var(--luz-vermelho);
        box-shadow: 0 0 0 2px var(--luz-vermelho);
    }
    .mc.ar .nm {
        color: var(--luz-branco);
    }
    .mc.ar .eng {
        color: var(--luz-branco-suave);
    }
    .mc.cartao.ar :global(.card)::after {
        display: none;
    }
    /* trava de 700 ms: o thumb escurece e uma barra enche, para o operador ver que o primeiro clique valeu */
    .mc.trava :global(.card) {
        filter: brightness(0.6);
    }
    .mc.trava :global(.card)::before {
        content: "";
        position: absolute;
        left: 0;
        bottom: 0;
        height: 3px;
        width: 100%;
        background: var(--luz-branco);
        z-index: 5;
        transform-origin: left;
        animation: encherTrava var(--luz-trava) linear forwards;
    }
    @keyframes encherTrava {
        from {
            transform: scaleX(0);
        }
        to {
            transform: scaleX(1);
        }
    }
    /* arquivo sumiu: laranja, sem clique, com o motivo escrito */
    .mc.falta {
        background: var(--luz-laranja-lavagem);
        box-shadow: inset 0 0 0 1px var(--luz-laranja-borda);
    }
    .mc.falta :global(.card) {
        cursor: not-allowed;
    }
    .mc.falta .nm {
        color: var(--luz-laranja);
    }
    .sumiu {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        background: var(--luz-thumb);
        color: var(--luz-laranja);
        font-size: var(--luz-fs-micro);
        font-weight: 700;
        letter-spacing: var(--luz-tracking-micro);
        /* cabine 6: o texto quebrava para fora do thumb ("FFLINE") */
        padding: 0 6px;
        text-align: center;
    }
    .sumiu span {
        max-width: 100%;
    }
    .mc.falta .mais,
    .mc.falta .dica {
        display: none;
    }
    .icon {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        /* overflow: hidden; */
        height: 100%;
    }
    .icon :global(svg) {
        height: 100%;
    }

    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        left: 0;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;

        max-width: calc(100% - 21px);
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: var(--luz-selo);
        pointer-events: all;
    }
    .chips {
        pointer-events: none;
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 1;
        display: flex;
        gap: 2px;
        padding: 2px;
    }
    .chips span {
        pointer-events: all;
        background-color: var(--luz-selo);
        color: var(--luz-texto);
        padding: 1px 5px;
        font-size: 0.7em;
        font-weight: bold;
        border-radius: var(--luz-raio-selo);
        outline: 1px solid transparent;
    }
    .chips span.proprio {
        outline-color: var(--secondary);
    }

    .icons span {
        pointer-events: all;
        background-color: var(--luz-selo);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
