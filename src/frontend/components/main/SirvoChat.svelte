<script lang="ts">
    // "Chat do culto" (F4 v1) — o canal do culto que o Show está seguindo, SÓ LEITURA.
    //
    // Mora na coluna da direita, logo acima do aviso "o roteiro mudou".
    //  - Recolhido (padrão): uma linha de altura fixa. Mensagem nova = selo âmbar
    //    com o número, que fica até alguém tocar no painel. Nada pisca.
    //  - Aberto: altura FIXA, rola por dentro, colado no fim. Chegar mensagem nunca
    //    muda a altura: o aviso, o relógio e os botões de baixo não saem do lugar.
    //  - Sem campo de texto nesta versão (responder é pelo celular ou pela régia).
    //  - Não pega foco: o operador passa slide pelo teclado (espaço). Os botões
    //    não recebem foco no clique e, se receberem, o foco volta para a página.
    //  - Som: desligado por padrão; a saída de áudio costuma ir para a mesa.
    //  - Admin desligou "conversa" no meio do culto: congela acinzentado, com aviso.
    // Texto do Sirvo só por interpolação {…}, nunca {@html}.
    import { afterUpdate, tick } from "svelte"
    import { sirvo } from "../../utils/aliancaSirvo"
    import { marcarChatLido, sirvoChat, sirvoChatAberto, sirvoChatSom } from "../../utils/aliancaSirvoChat"
    import { resumoDaUltima, textoDaMensagem, textoDoMotivo } from "../../utils/aliancaSirvoChatLogica"

    const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    const hora = (iso: string | null | undefined) => {
        const t = iso ? Date.parse(iso) : NaN
        return isNaN(t) ? "" : fmtHora.format(new Date(t))
    }

    $: e = $sirvoChat
    $: visivel = !!$sirvo.cultoId && e.cultoId === $sirvo.cultoId && (e.ligado || e.congelado)
    $: aberto = $sirvoChatAberto
    $: resumo = e.motivo ? textoDoMotivo(e.motivo) : resumoDaUltima(e.mensagens) || "Nenhuma mensagem ainda."

    function soltarFoco() {
        const a = document.activeElement as HTMLElement | null
        if (a && a !== document.body && typeof a.blur === "function") a.blur()
    }
    function tocar() {
        marcarChatLido()
        soltarFoco()
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

{#if visivel}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="sirvoChat" class:aberto class:congelado={e.congelado} on:mousedown|preventDefault on:click={tocar}>
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
                    <div class="msg">
                        <div class="quem"><b>{m.autor || "Alguém"}</b> <span class="hora">{hora(m.criada_em)}</span></div>
                        {#if m.resposta}
                            <div class="resposta">↪ {m.resposta.autor}: {m.resposta.trecho}</div>
                        {/if}
                        <div class="texto" class:fraco={m.audio_ms !== null && !m.body}>{textoDaMensagem(m)}</div>
                    </div>
                {/each}
            </div>
            <div class="rodape">
                <span class="dica">{e.erro ? e.erro : "Responder pelo celular ou na régia"}</span>
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
