<script lang="ts">
    // Faixa do Sirvo no topo do projeto aberto (F0b, passos 4 e 6).
    //
    // Fica FORA da área que rola (#projectArea, antes do Autoscroll): não rola
    // com a lista e não muda de altura.
    // - Projeto ligado: DUAS linhas de altura fixa, sempre. A de cima diz o que
    //   está acontecendo; a de baixo tem os botões. A ordem pendente troca o
    //   texto em vez de abrir outra linha: a lista não desce debaixo do mouse no
    //   meio do culto. Antes era uma linha só, e no painel de 290px o aviso
    //   ficava espremido entre dois botões (sobravam ~10 letras): o pendente
    //   ficava mudo. O pendente nunca é silencioso: a linha de cima diz o que
    //   mudou ("Louvor mudou de lugar").
    // - Projeto não ligado: "Montar os blocos aqui?", "Montar de novo?", "ligado
    //   a outro culto" ou "mais de um culto neste dia".
    // - Desligar pede confirmação na própria linha.
    // - F3 "é esta?": música nova do Sirvo com o mesmo nome de uma da
    //   biblioteca. Uma linha a mais, só fora do momento protegido (a lista não
    //   desce no meio do culto).
    // - F3 "você tirou": o operador apagou uma música que o Sirvo pôs. Uma
    //   linha a mais, sempre (é resposta ao gesto dele, e o Desfazer precisa
    //   estar à mão): "Desfazer" na carência; a pergunta do lote; "ainda não
    //   avisei" / "o Sirvo ainda lista". Some sozinha quando confirmado.
    // - Não pega foco: o operador passa slide pelo teclado.
    // Texto do Sirvo só por interpolação {…}, nunca {@html}.
    import { onDestroy } from "svelte"
    import { activeProject, outputs, projects } from "../../stores"
    import { newToast } from "../../utils/common"
    import { pedirAoSirvo, sirvo, sirvoRoteiro } from "../../utils/aliancaSirvo"
    import { sugerirAvanco, type Sugestao } from "../../utils/aliancaSirvoSugestao"
    import { dicaSegura } from "../../utils/aliancaDica"
    import { aplicarOrdemSirvo, desligarDoSirvo, dispensarEEstaSirvo, dispensarFaixaSirvo, ligarMusicaSirvo, montarSirvoAqui, sirvoMontagem } from "../../utils/aliancaSirvoMontar"
    import { desfazerDispensasSirvo, responderLoteSirvo, sirvoDispensas } from "../../utils/aliancaSirvoDispensar"
    import { textoDispensas, type ResumoDispensas } from "../../utils/aliancaSirvoDispensas"
    import SirvoConduzir, { marcarEncerrado } from "./SirvoConduzir.svelte"

    $: projetoId = $activeProject
    $: projeto = projetoId ? $projects[projetoId] : null
    $: ligado = !!projeto?.sirvo?.eventId
    $: estado = projetoId && $sirvoMontagem.projetoId === projetoId ? $sirvoMontagem : null
    // o estado é do culto SEGUIDO; o projeto aberto pode estar ligado a outro
    $: desteCulto = !!estado && ligado && projeto?.sirvo?.eventId === estado.eventId

    let erro = ""
    let confirmando = false
    let vistoProjeto: string | null = null
    $: if (projetoId !== vistoProjeto) {
        vistoProjeto = projetoId
        erro = ""
        confirmando = false
    }

    const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

    // o projeto ligado: o texto muda, a altura não
    type Linhas = { titulo: string; detalhe: string; aplicar: boolean; dicaAplicar: string }
    $: linha = textoLigado(estado, desteCulto)
    function textoLigado(e: typeof estado, deste: boolean): Linhas {
        const base: Linhas = { titulo: deste && e?.titulo ? `Roteiro do Sirvo · ${e.titulo}` : "Ligado a um culto do Sirvo", detalhe: deste && e?.blocos ? `${plural(e.blocos, "bloco", "blocos")} · cabeçalhos trancados` : "Cabeçalhos trancados", aplicar: false, dicaAplicar: "" }
        if (!e || !deste || e.situacao !== "ligado" || !e.pendente) return base
        const dicaNoAr = e.protegido ? "O que está no telão continua no ar, e o próximo segue a ordem nova." : ""
        if (e.pendente === "no_ar") return { titulo: `Sirvo: ${e.resumo || "a ordem dos blocos mudou"}`, detalhe: "A lista não muda até você aplicar.", aplicar: true, dicaAplicar: dicaNoAr }
        if (e.pendente === "roteiro_vazio") return { titulo: "O Sirvo mandou o roteiro sem blocos", detalhe: "Aplicar tira os cabeçalhos vazios.", aplicar: true, dicaAplicar: dicaNoAr }
        return { titulo: `O Sirvo tirou ${plural(e.sumiram, "bloco", "blocos")} de uma vez`, detalhe: e.resumo || "Os que têm conteúdo ficam no lugar.", aplicar: true, dicaAplicar: dicaNoAr }
    }
    $: aplicarBloqueado = !estado || !estado.pendente
    // F3: "é esta?" só fora do momento protegido
    $: eEsta = desteCulto && !confirmando && estado?.eEsta && !estado.protegido ? estado.eEsta : null
    $: pendente = !!(desteCulto && estado?.pendente)

    // F3: "você tirou" — a música que o Sirvo pôs e o operador apagou (aliancaSirvoDispensar.ts)
    $: tirada = desteCulto && !confirmando && estado && $sirvoDispensas.eventId === estado.eventId && $sirvoDispensas.resumo.tipo !== "nada" ? $sirvoDispensas.resumo : null
    function dicaTirada(t: ResumoDispensas, conduz: boolean): string {
        switch (t.tipo) {
            case "aguardando":
                return conduz ? "Não volta sozinha. Daqui a alguns segundos o Sirvo tira do roteiro também. Desfazer põe de volta." : "Não volta sozinha. Esta chave não conduz: no Sirvo ela continua. Desfazer põe de volta."
            case "confirmar":
                return "Tirar do Sirvo também: saem do roteiro no Sirvo. Manter só aqui: continuam no Sirvo, e não voltam a este projeto."
            case "fila":
                return "Sem Sirvo agora: aviso assim que a conexão voltar. Desfazer põe de volta."
            case "local":
                return "Fica fora só neste projeto; no Sirvo ela continua. Desfazer põe de volta."
            case "devolver":
                return "Você pôs de volta uma música que já tinha saído do Sirvo. Peço a linha de volta assim que a conexão voltar."
            default:
                return ""
        }
    }
    function responderTirada(resposta: "tirar" | "manter") {
        if (tirada?.tipo === "confirmar") responderLoteSirvo(tirada.lote, resposta)
    }
    function desfazerTirada() {
        if (tirada) desfazerDispensasSirvo(tirada.rmIds)
    }

    // F2: avanço sugerido (SHOW-DESIGN.md §13.4). Atalho, não caminho principal:
    // só aparece com o MESMO bloco na saída por 5 s, e o botão nasce inerte 3 s.
    // Some sozinho se o slide volta ou se a régia avança (é conta do estado).
    const ESTAVEL_MS = 5000
    const INERTE_MS = 3000
    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 500)
    onDestroy(() => clearInterval(relogio))

    $: rot = $sirvoRoteiro
    $: bruta = calcularSugestao(desteCulto && $sirvo.podeConduzir && !pendente && !confirmando, projeto?.shows || [], $outputs, rot)
    function calcularSugestao(pode: boolean, itens: any[], outs: any, r: typeof rot): Sugestao | null {
        if (!pode || !r) return null
        const slides = Object.values(outs || {})
            .filter((o: any) => o && o.enabled && !o.stageOutput)
            .map((o: any) => o.out?.slide)
        return sugerirAvanco(itens, slides, { noAr: !!r.iniciado_em && !r.encerrado_em, blocoNoAr: r.bloco_no_ar, ordem: r.blocos.map((b) => ({ id: b.id, feito: !!b.concluido_em })) })
    }
    let vista = { chave: "", desde: 0 }
    $: chave = bruta && rot ? `${bruta.destino}|${rot.bloco_no_ar}` : ""
    $: if (chave !== vista.chave) vista = { chave, desde: Date.now() }
    $: sugestao = bruta && agoraMs - vista.desde >= ESTAVEL_MS ? bruta : null
    $: sugestaoInerte = !!sugestao && agoraMs - vista.desde < ESTAVEL_MS + INERTE_MS
    $: destinoId = sugestao?.destino || ""
    $: tituloDestino = (destinoId && rot?.blocos.find((b) => b.id === destinoId)?.titulo) || ""
    let avancando = false

    async function avancar() {
        const s = sugestao
        const r = rot
        if (!s || !r || !r.bloco_no_ar || sugestaoInerte || avancando || $sirvo.enviando) return
        const noAr = r.blocos.find((b) => b.id === r.bloco_no_ar)
        avancando = true
        vista = { chave: vista.chave, desde: Date.now() - ESTAVEL_MS } // inerte de novo enquanto pede
        const res = await pedirAoSirvo("show_avancar", { p_event: r.event_id, p_ao_vivo_esperado: r.bloco_no_ar, p_destino: s.destino })
        avancando = false
        if (!res.ok) return newToast(res.mensagem)
        if (!res.dados?.ja_estava && s.pulados === 1 && noAr) marcarEncerrado(noAr.id, noAr.titulo)
    }

    function montar() {
        if (!projetoId) return
        erro = montarSirvoAqui(projetoId) || ""
    }
    function aplicar() {
        if (!projetoId || aplicarBloqueado) return
        erro = aplicarOrdemSirvo(projetoId) || ""
    }
    function dispensar() {
        if (!projetoId || !estado) return
        dispensarFaixaSirvo(estado.eventId, projetoId)
    }
    function desligar() {
        if (!projetoId) return
        if (!confirmando) {
            confirmando = true
            return
        }
        confirmando = false
        desligarDoSirvo(projetoId)
    }
</script>

{#if projetoId && (ligado || (estado && estado.situacao !== "nenhuma" && estado.situacao !== "ligado"))}
    <div class="faixa" role="status">
        {#if estado?.situacao === "varios_no_dia"}
            <div class="linha aviso">
                <span class="ponto" />
                <span class="texto" data-title="O nome do projeto quando há dois cultos no mesmo dia ainda está sendo combinado. Monte este projeto à mão por enquanto.">Há mais de um culto neste dia — a montagem automática ainda não cobre esse caso.</span>
                <button tabindex="-1" on:click={dispensar}>Entendi</button>
            </div>
        {:else if estado?.situacao === "perguntar"}
            <div class="linha aviso">
                <span class="ponto" />
                {#if estado.motivo === "outro_culto"}
                    <span class="texto" data-title="Montar aqui troca os cabeçalhos do outro culto pelos deste. Os que tinham conteúdo ficam no lugar, marcados como removidos.">Este projeto já está ligado a outro culto do Sirvo{estado.outroCulto ? ` (${estado.outroCulto})` : ""}. Montar {estado.titulo || "o culto seguido"} aqui?</span>
                    <button tabindex="-1" on:click={montar}>Montar aqui</button>
                {:else if estado.motivo === "montado_antes"}
                    <span class="texto" data-title="Os blocos deste culto já foram montados uma vez e o projeto foi apagado ou desligado.">Os blocos de {estado.titulo || "este culto"} já foram montados uma vez. Montar de novo?</span>
                    <button tabindex="-1" on:click={montar}>Montar de novo</button>
                {:else}
                    <span class="texto" data-title="O que já está no projeto fica todo no topo; arraste cada item para debaixo do bloco dele.">Este culto tem roteiro no Sirvo ({plural(estado.blocos, "bloco", "blocos")}). Montar os blocos aqui?</span>
                    <button tabindex="-1" on:click={montar}>Montar</button>
                {/if}
                <button class="fraco" tabindex="-1" on:click={dispensar}>Agora não</button>
            </div>
        {/if}

        {#if ligado}
            {#if confirmando}
                <div class="linha aviso">
                    <span class="ponto" />
                    <span class="texto" data-title="Os cabeçalhos viram seções comuns, destrancadas, e nada sai do lugar.">Desligar do Sirvo? Os cabeçalhos viram seções comuns e nada sai do lugar.</span>
                </div>
                <div class="linha botoes">
                    <button tabindex="-1" on:click={desligar}>Desligar</button>
                    <button class="fraco" tabindex="-1" on:click={() => (confirmando = false)}>Cancelar</button>
                </div>
            {:else}
                {#if sugestao}
                    <div class="linha sugestao">
                        <span class="ponto" />
                        <span class="texto titulo" data-title={dicaSegura(`A saída já está em ${tituloDestino}. Avançar encerra no Sirvo ${sugestao.pulados === 1 ? "o bloco no ar" : `os ${sugestao.pulados} blocos antes dele`}.`)}>Na saída: {tituloDestino}{sugestao.pulados > 1 ? ` · pula ${sugestao.pulados - 1}` : ""}</span>
                        <button tabindex="-1" disabled={sugestaoInerte || avancando || $sirvo.enviando} on:mousedown|preventDefault on:click={avancar}>Avançar</button>
                    </div>
                {:else}
                    <div class="linha" class:aviso={pendente}>
                        <span class="ponto" />
                        <span class="texto titulo" data-title={dicaSegura(linha.titulo)}>{linha.titulo}</span>
                    </div>
                {/if}
                <div class="linha botoes" class:aviso={pendente}>
                    <span class="texto detalhe" data-title={dicaSegura(linha.detalhe)}>{linha.detalhe}</span>
                    {#if linha.aplicar}
                        <button tabindex="-1" disabled={aplicarBloqueado} data-title={linha.dicaAplicar} on:click={aplicar}>Aplicar</button>
                    {/if}
                    <button class="fraco" tabindex="-1" data-title="Desligar do Sirvo: os cabeçalhos viram seções comuns" on:click={desligar}>{pendente ? "Desligar" : "Desligar do Sirvo"}</button>
                </div>
                {#if desteCulto}
                    <!-- F2: só com a chave que conduz; uma linha a mais, de altura fixa -->
                    <SirvoConduzir />
                {/if}
            {/if}
        {/if}

        {#if eEsta}
            <div class="linha aviso">
                <span class="ponto" />
                <span class="texto" data-title={dicaSegura(`O Sirvo pediu a música nova "${eEsta.nome}". "${eEsta.showNome}" da biblioteca é esta? Se for, ela entra no lugar do aviso, e o Sirvo passa a usá-la.`)}>Música nova do Sirvo: é “{eEsta.showNome}”?</span>
                <button tabindex="-1" on:click={() => eEsta && ligarMusicaSirvo(eEsta.rmId, eEsta.showId)}>É esta</button>
                <button class="fraco" tabindex="-1" on:click={() => eEsta && dispensarEEstaSirvo(eEsta.rmId)}>Não é</button>
            </div>
        {/if}

        {#if tirada}
            <!-- F3: o operador tirou uma música que o Sirvo pôs; o Show respeita e avisa o Sirvo -->
            <div class="linha aviso">
                <span class="ponto" />
                <span class="texto" data-title={dicaSegura(dicaTirada(tirada, $sirvo.podeConduzir))}>{textoDispensas(tirada)}</span>
                {#if tirada.tipo === "confirmar"}
                    <button tabindex="-1" on:click={() => responderTirada("tirar")}>Tirar do Sirvo também</button>
                    <button class="fraco" tabindex="-1" on:click={() => responderTirada("manter")}>Manter só aqui</button>
                {:else if tirada.tipo !== "devolver"}
                    <button class="fraco" tabindex="-1" on:click={desfazerTirada}>Desfazer</button>
                {/if}
            </div>
        {/if}

        {#if erro}
            <div class="linha erro">
                <span class="texto" data-title={dicaSegura(erro)}>{erro}</span>
                <button class="fraco" tabindex="-1" on:click={() => (erro = "")}>Ok</button>
            </div>
        {/if}
    </div>
{/if}

<style>
    .faixa {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 8px;
        border-bottom: 1px solid var(--primary-lighter);
        font-size: 12px;
        user-select: none;
    }

    .linha {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 26px;
        min-width: 0;
    }
    /* a segunda linha do projeto ligado: o detalhe recuado na altura do texto de cima */
    .linha.botoes {
        gap: 6px;
        padding-inline-start: 15px;
    }
    .titulo {
        font-weight: 600;
    }
    .detalhe {
        opacity: 0.7;
    }
    .ponto {
        flex: none;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--connected);
    }
    .sugestao .ponto {
        background: #3b9eff;
    }
    .aviso .ponto {
        background: #ff8000;
    }
    .aviso .texto {
        color: #ffb066;
    }
    .erro .texto {
        color: #ff8f97;
    }

    .texto {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    button {
        flex: none;
        padding: 3px 10px;
        border: 0;
        border-radius: 14px;
        background: rgb(255 128 0 / 0.18);
        color: #ffb066;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: rgb(255 128 0 / 0.3);
    }
    button.fraco {
        background: rgb(255 255 255 / 0.06);
        color: var(--text);
        font-weight: normal;
        opacity: 0.8;
    }
    button.fraco:hover {
        background: rgb(255 255 255 / 0.12);
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
