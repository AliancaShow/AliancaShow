<script lang="ts">
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
    import { descartarChat, enviarChat, marcarChatLido, sirvoChat, sirvoChatAberto, sirvoChatOperador, sirvoChatSaida, sirvoChatSom, tentarChatDeNovo } from "../../utils/aliancaSirvoChat"
    import { nomeDoAutor, resumoDaUltima, textoDaMensagem, textoDoMotivo, trechoDaCitacao, type MensagemChat } from "../../utils/aliancaSirvoChatLogica"
    import { bolhasDoCulto, dicaDeIdentidade, LIMITE_TEXTO, nomeDaChave, normalizarOperador, rotuloDoEstado } from "../../utils/aliancaSirvoChatSaida"

    const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    const hora = (iso: string | null | undefined) => {
        const t = iso ? Date.parse(iso) : NaN
        return isNaN(t) ? "" : fmtHora.format(new Date(t))
    }

    $: e = $sirvoChat
    $: visivel = !!$sirvo.cultoId && e.cultoId === $sirvo.cultoId && (e.ligado || e.congelado)
    $: aberto = $sirvoChatAberto
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
    async function alternar() {
        sirvoChatAberto.set(!aberto)
        marcarChatLido()
        soltarFoco()
        if (!aberto) {
            await tick()
            colarNoFim(true)
        }
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

{#if visivel}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="sirvoChat" class:aberto class:congelado={e.congelado} on:mousedown={aoApertar} on:click={tocar}>
        <button class="cabeca" tabindex="-1" on:click|stopPropagation={alternar} data-title={aberto ? "Recolher o chat" : "Abrir o chat do culto"}>
            <span class="titulo">Chat do culto</span>
            {#if e.naoLidas > 0}
                <span class="selo">{e.naoLidas} {e.naoLidas === 1 ? "nova" : "novas"}</span>
            {/if}
            {#if !aberto}
                <span class="resumo">{resumo}</span>
            {:else}
                <span class="resumo" />
            {/if}
            <span class="seta">{aberto ? "▾" : "▸"}</span>
        </button>

        {#if e.congelado}
            <p class="faixa">Chat desligado por um admin{e.desligadoEm ? ` às ${hora(e.desligadoEm)}` : ""}. Esta é a última conversa que chegou.</p>
        {/if}

        {#if aberto}
            <div class="lista" bind:this={lista} on:scroll={aoRolar}>
                {#if e.motivo}
                    <p class="vazio">{textoDoMotivo(e.motivo)}</p>
                {:else if !e.mensagens.length}
                    <p class="vazio">Nenhuma mensagem ainda.</p>
                {/if}
                {#each e.mensagens as m (m.id)}
                    <div class="msg" class:minha={m.minha} class:chave={m.autor_tipo === "chave"}>
                        <div class="quem">
                            <b>{nomeDoAutor(m)}</b>
                            {#if m.minha}<span class="voce">você</span>{/if}
                            <span class="hora">{hora(m.criada_em)}</span>
                            {#if pode}<button class="acao" tabindex="-1" on:click|stopPropagation={() => responderA(m)} data-title="Responder esta mensagem">responder</button>{/if}
                        </div>
                        {#if m.resposta}
                            <div class="resposta">↪ {m.resposta.autor}: {m.resposta.trecho}</div>
                        {/if}
                        <div class="texto" class:fraco={m.audio_ms !== null && !m.body}>{textoDaMensagem(m)}</div>
                    </div>
                {/each}
                <!-- respostas ainda não confirmadas pelo retrato (otimistas) -->
                {#each bolhas as b (b.clienteId)}
                    <div class="msg minha chave bolha" class:falha={b.estado === "falhou" || b.estado === "recusada"}>
                        <div class="quem">
                            <b>{b.operador ? `${nomeChave} · ${b.operador}` : nomeChave}</b>
                            <span class="voce">você</span>
                            <span class="estado">{rotuloDoEstado(b)}</span>
                            {#if b.estado === "falhou" || b.estado === "recusada"}
                                <button class="acao" tabindex="-1" on:click|stopPropagation={() => tentarChatDeNovo(b.clienteId)}>tentar de novo</button>
                                <button class="acao" tabindex="-1" on:click|stopPropagation={() => descartarChat(b.clienteId)}>descartar</button>
                            {/if}
                        </div>
                        {#if b.citacao}
                            <div class="resposta">↪ {b.citacao.autor}: {b.citacao.trecho}</div>
                        {/if}
                        <div class="texto">{b.texto}</div>
                    </div>
                {/each}
            </div>
            {#if pode}
                <!-- Fora de qualquer {#each}/{#key}: chegar mensagem não recria o campo nem tira o foco. -->
                <div class="compor">
                    <div class="citando">
                        {#if citacao}
                            <span class="citandoTexto">↪ {citacao.autor}: {citacao.trecho}</span>
                            <button class="acao" tabindex="-1" on:click|stopPropagation={() => (citada = null)} data-title="Não citar">×</button>
                        {/if}
                    </div>
                    <textarea class="edit campo" rows="2" maxlength={LIMITE_TEXTO} disabled={semSirvo} placeholder={semSirvo ? "Sem conexão com o Sirvo — não dá para responder agora." : "Responder como Sala de vídeo…"} bind:value={rascunho} on:keydown={aoTeclar} on:focus={() => (digitando = true)} on:blur={() => (digitando = false)}></textarea>
                </div>
            {/if}
            <div class="rodape">
                <span class="dica">{e.erro ? e.erro : pode ? (digitando ? "digitando no chat · Enter envia" : identidade) : "Responder pelo celular ou na régia"}</span>
                <button class="som" tabindex="-1" on:click|stopPropagation={alternarSom} data-title="O som sai pelo áudio padrão deste computador — que pode ser a mesa da igreja.">
                    Som: {$sirvoChatSom ? "ligado" : "desligado"}
                </button>
            </div>
        {/if}
    </div>
{/if}

<style>
    .sirvoChat {
        flex: none;
        display: flex;
        flex-direction: column;
        margin: 8px 8px 0;
        margin-top: auto;
        border-radius: 10px;
        border: 1px solid rgb(255 255 255 / 0.12);
        background: rgb(255 255 255 / 0.04);
        font-size: 12px;
        user-select: none;
        overflow: hidden;
    }
    .sirvoChat.congelado {
        filter: grayscale(1);
        opacity: 0.6;
    }

    .cabeca {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 34px;
        min-height: 34px;
        padding: 0 12px;
        border: 0;
        background: none;
        color: var(--text);
        font-family: inherit;
        font-size: 12px;
        text-align: start;
        cursor: pointer;
    }
    .cabeca:hover {
        background: rgb(255 255 255 / 0.05);
    }
    .titulo {
        flex: none;
        font-weight: 600;
    }
    .selo {
        flex: none;
        padding: 1px 8px;
        border-radius: 10px;
        background: #ff8000;
        color: #1b1b1b;
        font-weight: 700;
    }
    .resumo {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.75;
    }
    .seta {
        flex: none;
        opacity: 0.6;
    }

    .faixa {
        margin: 0;
        padding: 6px 12px;
        border-top: 1px solid rgb(255 255 255 / 0.08);
        font-weight: 600;
    }

    .lista {
        height: 220px;
        overflow-y: auto;
        padding: 6px 12px;
        border-top: 1px solid rgb(255 255 255 / 0.08);
    }
    .vazio {
        margin: 8px 0;
        opacity: 0.6;
    }
    .msg {
        padding: 4px 0;
        line-height: 1.4;
    }
    .quem .hora {
        opacity: 0.5;
        font-size: 11px;
    }
    .resposta {
        padding-left: 8px;
        border-left: 2px solid rgb(255 255 255 / 0.2);
        opacity: 0.6;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .texto {
        white-space: pre-wrap;
        word-break: break-word;
    }
    .texto.fraco {
        opacity: 0.6;
        font-style: italic;
    }

    .msg.minha {
        margin-inline-start: 12px;
        padding-inline-start: 8px;
        border-inline-start: 2px solid #ff8000;
    }
    .voce,
    .estado {
        font-size: 11px;
        opacity: 0.6;
    }
    .msg.bolha {
        opacity: 0.85;
    }
    .msg.falha .estado {
        color: #ff8000;
        opacity: 1;
        font-weight: 600;
    }
    .acao {
        padding: 0 6px;
        border: 0;
        border-radius: 8px;
        background: rgb(255 255 255 / 0.08);
        color: var(--text);
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
    }
    .acao:hover {
        background: rgb(255 255 255 / 0.18);
    }

    .compor {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 12px 0;
        border-top: 1px solid rgb(255 255 255 / 0.08);
    }
    /* linha reservada: citar não muda a altura do painel */
    .citando {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 18px;
        min-height: 18px;
        overflow: hidden;
        opacity: 0.7;
    }
    .citandoTexto {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .campo {
        width: 100%;
        height: 44px;
        box-sizing: border-box;
        resize: none;
        padding: 4px 8px;
        border: 1px solid rgb(255 255 255 / 0.15);
        border-radius: 6px;
        background: rgb(0 0 0 / 0.25);
        color: var(--text);
        font-family: inherit;
        font-size: 12px;
        line-height: 1.4;
        user-select: text;
    }
    .campo:focus {
        outline: none;
        border-color: rgb(255 255 255 / 0.55);
    }
    .campo:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .rodape {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-top: 1px solid rgb(255 255 255 / 0.08);
    }
    .dica {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.6;
    }
    .som {
        flex: none;
        padding: 3px 10px;
        border: 0;
        border-radius: 12px;
        background: rgb(255 255 255 / 0.08);
        color: var(--text);
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
    }
    .som:hover {
        background: rgb(255 255 255 / 0.15);
    }
</style>
