<script lang="ts">
    // Faixa do Sirvo no topo do projeto aberto (F0b, passo 4).
    //
    // - Projeto ligado: UMA linha de altura fixa ("Roteiro do Sirvo · culto" e
    //   Desligar). A ordem pendente troca o texto DESSA linha em vez de abrir
    //   outra: a lista não desce debaixo do mouse no meio do culto.
    // - Projeto não ligado: "Montar os blocos aqui?", "Montar de novo?", "ligado
    //   a outro culto" ou "mais de um culto neste dia".
    // - Desligar pede confirmação na própria linha.
    // - Não pega foco: o operador passa slide pelo teclado.
    // Texto do Sirvo só por interpolação {…}, nunca {@html}.
    import { activeProject, projects } from "../../stores"
    import { aplicarOrdemSirvo, desligarDoSirvo, dispensarFaixaSirvo, montarSirvoAqui, sirvoMontagem } from "../../utils/aliancaSirvoMontar"

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

    // a linha do projeto ligado: o texto muda, a altura não
    $: linha = textoLigado(estado, desteCulto)
    function textoLigado(e: typeof estado, deste: boolean): { texto: string; aplicar: boolean; dicaAplicar: string } {
        const base = { texto: deste && e?.titulo ? `Roteiro do Sirvo · ${e.titulo}` : "Ligado a um culto do Sirvo", aplicar: false, dicaAplicar: "" }
        if (!e || !deste || e.situacao !== "ligado" || !e.pendente) return base
        if (e.pendente === "no_ar") return { texto: "O Sirvo mudou a ordem dos blocos. A ordem nova entra quando o culto não estiver no ar e a tela estiver limpa.", aplicar: true, dicaAplicar: "Aplicar com o culto no ar chega no próximo passo." }
        const dica = e.protegido ? "Com o culto no ar ou algo na tela, espere a tela ficar limpa." : ""
        if (e.pendente === "roteiro_vazio") return { texto: "O Sirvo mandou o roteiro sem blocos. Aplicar?", aplicar: true, dicaAplicar: dica }
        return { texto: `O Sirvo tirou ${plural(e.sumiram, "bloco", "blocos")} de uma vez. Aplicar?`, aplicar: true, dicaAplicar: dica }
    }
    $: aplicarBloqueado = !estado || estado.pendente === "no_ar" || estado.protegido

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
            <div class="linha" class:aviso={!!(desteCulto && estado?.pendente)}>
                <span class="ponto" />
                {#if confirmando}
                    <span class="texto">Desligar do Sirvo? Os cabeçalhos viram seções comuns e nada sai do lugar.</span>
                    <button tabindex="-1" on:click={desligar}>Desligar</button>
                    <button class="fraco" tabindex="-1" on:click={() => (confirmando = false)}>Cancelar</button>
                {:else}
                    <span class="texto" data-title={linha.texto}>{linha.texto}</span>
                    {#if linha.aplicar}
                        <button tabindex="-1" disabled={aplicarBloqueado} data-title={linha.dicaAplicar} on:click={aplicar}>Aplicar</button>
                    {/if}
                    <button class="fraco" tabindex="-1" on:click={desligar}>Desligar do Sirvo</button>
                {/if}
            </div>
        {/if}

        {#if erro}
            <div class="linha erro">
                <span class="texto" data-title={erro}>{erro}</span>
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
    .ponto {
        flex: none;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--connected);
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
