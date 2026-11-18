<script lang="ts">
    // Leiaute v2: "Chat do culto" na coluna No ar. O motor e o de SirvoChat.svelte (F4), levado sem mudar; a marcação e a do protótipo:
    // sempre aberto, ocupa o resto da coluna (flex: 1, mínimo de 140 px) e rola por dentro. (Texto original de SirvoChat abaixo.)
    // "Chat do culto" (F4) — o canal do culto que o Show está seguindo. v1: leitura.
    // v1.1: com o interruptor "responde" ligado na chave, o painel ganha o campo de
    // resposta ("Sala de vídeo"); sem ele, continua só leitura.
    //
    // Mora na coluna da direita, logo acima do aviso "o roteiro mudou".
    //  - Recolhido (padrão): uma linha de altura fixa. Mensagem nova = selo âmbar
    //    com o número, que fica até alguém tocar no painel. Nada pisca.
    //  - Aberto: altura FIXA, rola por dentro, colado no fim. Chegar mensagem nunca
    //    muda a altura: o aviso, o relógio e os botões de baixo não saem do lugar.
    //  - O foco NUNCA vai para o campo sozinho (nem quando chega mensagem). Enquanto
    //    ele tem o foco: class="edit" (o espaço não passa slide), Enter envia e
    //    devolve o foco à página, Shift+Enter quebra a linha, Esc não faz nada
    //    (engolido aqui: o 2º Esc da página limparia a saída). O campo fica fora de
    //    qualquer {#each}: chegar mensagem não o recria nem derruba o foco.
    //  - Os botões não recebem foco no clique e, se receberem, o foco volta para a
    //    página (o espaço seguinte passa slide, não aperta o botão).
    //  - Som: desligado por padrão; a saída de áudio costuma ir para a mesa.
    //  - Admin desligou "conversa" no meio do culto: congela acinzentado, com aviso.
    // Texto do Sirvo só por interpolação {…}, nunca {@html}.
    import { afterUpdate, tick } from "svelte"
    import { sirvo } from "../../utils/aliancaSirvo"
    import { descartarChat, enviarChat, marcarChatLido, sirvoChat, sirvoChatOperador, sirvoChatSaida, sirvoChatSom, tentarChatDeNovo } from "../../utils/aliancaSirvoChat"
    import { nomeDoAutor, resumoDaUltima, textoDaMensagem, textoDoMotivo, trechoDaCitacao, type MensagemChat } from "../../utils/aliancaSirvoChatLogica"
    import { bolhasDoCulto, dicaDeIdentidade, LIMITE_TEXTO, nomeDaChave, normalizarOperador, rotuloDoEstado } from "../../utils/aliancaSirvoChatSaida"

    const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    const hora = (iso: string | null | undefined) => {
        const t = iso ? Date.parse(iso) : NaN
        return isNaN(t) ? "" : fmtHora.format(new Date(t))
    }

    $: e = $sirvoChat
    $: visivel = !!$sirvo.cultoId && e.cultoId === $sirvo.cultoId && (e.ligado || e.congelado)
    const aberto = true
    $: resumo = e.motivo ? textoDoMotivo(e.motivo) : resumoDaUltima(e.mensagens) || "Nenhuma mensagem ainda."

    // ---- responder (v1.1)
    // pode responder: interruptor ligado, culto que serve, não congelado
    $: pode = e.ligado && e.responde && !e.congelado && !e.motivo
    let offline = typeof navigator !== "undefined" && navigator.onLine === false
    $: semSirvo = offline || $sirvo.status !== "conectado"
    $: bolhas = bolhasDoCulto($sirvoChatSaida, e.cultoId, e.mensagens)
    $: nomeChave = nomeDaChave(e.mensagens)
    $: identidade = dicaDeIdentidade(nomeChave, normalizarOperador($sirvoChatOperador))
    let rascunho = ""
    let citada: MensagemChat | null = null
    let digitando = false
    $: citacao = citada ? trechoDaCitacao(citada) : null

    function responderA(m: MensagemChat) {
        citada = m
        soltarFoco()
    }
    function enviar() {
        if (!pode || semSirvo) return
        if (enviarChat(rascunho, citada)) {
            rascunho = ""
            citada = null
        }
    }
    function aoTeclar(ev: KeyboardEvent) {
        // nada do que se digita aqui chega aos atalhos do FreeShow (janela/Preview)
        ev.stopPropagation()
        if (ev.key === "Escape") {
            ev.preventDefault()
            return
        }
        if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
            ev.preventDefault()
            enviar()
            soltarFoco() // Enter sempre devolve o foco: o espaço seguinte passa slide
        }
    }
    const noCampo = (ev: Event) => !!(ev.target as HTMLElement | null)?.closest?.("textarea")
    function aoApertar(ev: MouseEvent) {
        if (!noCampo(ev)) ev.preventDefault() // o painel não rouba foco; o campo é a exceção
    }

    function soltarFoco() {
        const a = document.activeElement as HTMLElement | null
        if (a && a !== document.body && typeof a.blur === "function") a.blur()
    }
    function tocar(ev: MouseEvent) {
        marcarChatLido()
        if (!noCampo(ev)) soltarFoco()
    }
    function alternarSom() {
        sirvoChatSom.update((s) => !s)
        soltarFoco()
    }

    // colado no fim: se o operador estava no fim, continua no fim quando chega mensagem
    let lista: HTMLElement | null = null
    let noFim = true
    function aoRolar() {
        if (lista) noFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 24
    }
    function colarNoFim(forcar = false) {
        if (lista && (forcar || noFim)) lista.scrollTop = lista.scrollHeight
    }
    afterUpdate(() => colarNoFim())
</script>

<svelte:window on:online={() => (offline = false)} on:offline={() => (offline = true)} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="chat" class:congelado={e.congelado} class:vazio={!visivel} data-regiao-filho="chat" on:mousedown={aoApertar} on:click={tocar}>
    <div class="cabeca">
        <span class="titulo">CHAT DO CULTO</span>
        {#if visivel && e.naoLidas > 0}<span class="selo">{e.naoLidas} {e.naoLidas === 1 ? "nova" : "novas"}</span>{/if}
    </div>
    {#if !visivel}
        <p class="semCulto">Sem chat: nenhum culto seguido.</p>
    {:else}
        {#if e.congelado}
            <p class="faixa">Chat desligado por um admin{e.desligadoEm ? ` às ${hora(e.desligadoEm)}` : ""}. Esta é a última conversa que chegou.</p>
        {/if}
        <div class="lista" bind:this={lista} on:scroll={aoRolar}>
            {#if e.motivo}
                <p class="vazioTxt">{textoDoMotivo(e.motivo)}</p>
            {:else if !e.mensagens.length}
                <p class="vazioTxt">Nenhuma mensagem ainda.</p>
            {/if}
            {#each e.mensagens as m (m.id)}
                <div class="msg" class:minha={m.minha}>
                    <span class="quem"><b>{nomeDoAutor(m)}</b>{#if m.minha} · você{/if} · {hora(m.criada_em)}{#if pode}<button class="acao" tabindex="-1" on:click|stopPropagation={() => responderA(m)}>responder</button>{/if}</span>
                    {#if m.resposta}<span class="resposta">↪ {m.resposta.autor}: {m.resposta.trecho}</span>{/if}
                    <span class="balao" class:nova={!m.minha && e.naoLidas > 0 && e.mensagens.indexOf(m) >= e.mensagens.length - e.naoLidas} class:fraco={m.audio_ms !== null && !m.body}>{textoDaMensagem(m)}</span>
                </div>
            {/each}
            {#each bolhas as b (b.clienteId)}
                <div class="msg minha" class:falha={b.estado === "falhou" || b.estado === "recusada"}>
                    <span class="quem"><b>{b.operador ? `${nomeChave} · ${b.operador}` : nomeChave}</b> · {rotuloDoEstado(b)}
                        {#if b.estado === "falhou" || b.estado === "recusada"}
                            <button class="acao" tabindex="-1" on:click|stopPropagation={() => tentarChatDeNovo(b.clienteId)}>tentar de novo</button>
                            <button class="acao" tabindex="-1" on:click|stopPropagation={() => descartarChat(b.clienteId)}>descartar</button>
                        {/if}</span>
                    {#if b.citacao}<span class="resposta">↪ {b.citacao.autor}: {b.citacao.trecho}</span>{/if}
                    <span class="balao">{b.texto}</span>
                </div>
            {/each}
        </div>
        {#if pode}
            <div class="compor">
                {#if citacao}
                    <div class="citando"><span class="citandoTexto">↪ {citacao.autor}: {citacao.trecho}</span><button class="acao" tabindex="-1" on:click|stopPropagation={() => (citada = null)}>×</button></div>
                {/if}
                <textarea class="edit campo" rows="1" maxlength={LIMITE_TEXTO} disabled={semSirvo} placeholder={semSirvo ? "Sem conexão com o Sirvo — não dá para responder agora." : "Escrever pra equipe…"} bind:value={rascunho} on:keydown={aoTeclar} on:focus={() => (digitando = true)} on:blur={() => (digitando = false)}></textarea>
            </div>
        {/if}
        <div class="rodape">
            <span class="dica">{e.erro ? e.erro : pode ? (digitando ? "digitando no chat · Enter envia" : identidade) : "Responder pelo celular ou na régia"}</span>
            <button class="som" tabindex="-1" on:click|stopPropagation={alternarSom} data-title="O som sai pelo áudio padrão deste computador — que pode ser a mesa da igreja.">Som: {$sirvoChatSom ? "ligado" : "desligado"}</button>
        </div>
    {/if}
</div>

<style>
    .chat {
        flex: 1 1 0;
        min-height: 140px;
        display: flex;
        flex-direction: column;
        border-top: 1px solid var(--luz-linha);
        padding-top: 10px;
        user-select: none;
    }
    .chat.congelado {
        filter: grayscale(1);
        opacity: 0.6;
    }
    .cabeca {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding-bottom: 6px;
    }
    .titulo {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
    }
    .selo {
        font-size: 11px;
        font-weight: 600;
        color: var(--luz-laranja);
    }
    .semCulto,
    .vazioTxt {
        margin: 0;
        font-size: 12px;
        color: var(--luz-mudo);
    }
    .faixa {
        margin: 0 0 6px;
        font-size: 11px;
        color: var(--luz-laranja);
    }
    .lista {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .msg {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    .quem {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .quem b {
        color: var(--luz-texto);
    }
    .resposta {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .balao {
        font-size: 13px;
        line-height: 1.35;
        padding: 6px 8px;
        border-radius: 8px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        user-select: text;
    }
    .balao.nova {
        background: rgba(242, 26, 39, 0.12);
    }
    .balao.fraco {
        opacity: 0.7;
    }
    .falha .balao {
        outline: 1px solid var(--luz-vermelho);
    }
    .acao {
        margin-left: 6px;
        border: 0;
        background: none;
        font: inherit;
        font-size: 11px;
        color: var(--luz-mudo);
        cursor: pointer;
        text-decoration: underline;
    }
    .compor {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .citando {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .campo {
        height: 40px;
        box-sizing: border-box;
        resize: none;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: transparent;
        color: var(--luz-texto);
        padding: 10px;
        font: inherit;
        font-size: 12px;
    }
    .rodape {
        margin-top: 6px;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .dica {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .som {
        flex: none;
        border: 0;
        background: none;
        font: inherit;
        font-size: 11px;
        color: var(--luz-mudo);
        cursor: pointer;
    }
</style>
