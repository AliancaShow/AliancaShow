<script lang="ts">
    // Leiaute v2, coluna No ar: "Mensagem pro palco" (decisao P3). Campo de ate 120 caracteres + Enviar; a mensagem viva aparece embaixo com
    // "Limpar". O envio vai pelo Sirvo (aliancaMensagemPalco.ts): sem a chave "conduz" a faixa de falha acende e a caixa diz o motivo.
    // Ao lado, o botao de MODO "so retorno" (decisao 5, aliancaSoRetorno.ts): liga/desliga o modo; sem retorno configurado fica inerte com o motivo.
    // A validade (1, 3, 5, 10 min; padrao 3) e a contagem regressiva da mensagem viva ficam na caixa; a linha de estado tem altura fixa
    // (nada se desloca quando a mensagem entra, sai ou da erro).
    // Teclado: o campo e `.edit` (o espaco nao passa slide), nada do que se digita chega aos atalhos, Esc nao faz nada aqui (o 2o Esc da
    // pagina limparia o telao) e Enter envia e devolve o foco a pagina.
    import { onDestroy, onMount } from "svelte"
    import { sirvo, sirvoAgora, sirvoRoteiro, porQueNaoConduz } from "../../utils/aliancaSirvo"
    import { enviarMensagemPalco, limparMensagemPalco } from "../../utils/aliancaMensagemPalco"
    import { DURACOES_MINUTOS, LIMITE_MENSAGEM, MINUTOS_PADRAO, mensagemViva, restanteTexto } from "../../utils/aliancaMensagemPalcoLogica"
    import { desligarSoRetorno, iniciarSoRetorno, ligarSoRetorno, porQueNaoLigarSoRetorno, soRetorno } from "../../utils/aliancaSoRetorno"
    import { outputs } from "../../stores"

    let texto = ""
    let enviando = false
    let erro = ""
    let minutos: number = MINUTOS_PADRAO
    let avisoModo = ""
    let tAviso: ReturnType<typeof setTimeout> | null = null
    let tique = 0
    let agora = 0
    // a mensagem some da caixa quando o `ate` passa (o tique reavalia a cada 5 s)
    const lerViva = (_tique: number, r: typeof $sirvoRoteiro) => mensagemViva(r?.mensagem_palco, sirvoAgora())
    const lerMotivo = (_estado: unknown) => porQueNaoConduz()
    $: viva = lerViva(tique, $sirvoRoteiro)
    $: motivo = lerMotivo($sirvo)
    // 1 s: a contagem regressiva anda; a mensagem sai da caixa no segundo em que o `ate` passa
    const relogio = setInterval(() => ((tique += 1), (agora = sirvoAgora())), 1000)
    const parar = iniciarSoRetorno()
    onMount(() => (agora = sirvoAgora()))
    onDestroy(() => {
        clearInterval(relogio)
        parar()
        if (tAviso) clearTimeout(tAviso)
    })
    // o motivo do modo depende dos retornos configurados (a loja de saidas)
    const lerModo = (_o: unknown) => porQueNaoLigarSoRetorno()
    $: motivoModo = lerModo($outputs)
    function modo() {
        if ($soRetorno) return desligarSoRetorno()
        const r = ligarSoRetorno()
        if (r.ok) return
        erro = ""
        avisoModo = r.motivo
        if (tAviso) clearTimeout(tAviso)
        tAviso = setTimeout(() => (avisoModo = ""), 6000)
    }

    function soltarFoco() {
        const a = document.activeElement as HTMLElement | null
        if (a && a !== document.body && typeof a.blur === "function") a.blur()
    }
    async function enviar() {
        if (enviando) return
        enviando = true
        erro = ""
        const r = await enviarMensagemPalco(texto, minutos)
        enviando = false
        if (r.ok) texto = ""
        else erro = r.mensagem
    }
    async function limpar() {
        if (enviando) return
        enviando = true
        erro = ""
        const r = await limparMensagemPalco()
        enviando = false
        if (!r.ok) erro = r.mensagem
    }
    function aoTeclar(ev: KeyboardEvent) {
        ev.stopPropagation()
        if (ev.key === "Escape") {
            ev.preventDefault()
            return
        }
        if (ev.key === "Enter" && !ev.isComposing) {
            ev.preventDefault()
            enviar()
            soltarFoco()
        }
    }
</script>

<div class="palco" data-regiao-filho="mensagem-palco">
    <div class="cabeca">
        <span class="titulo">MENSAGEM PRO PALCO</span>
        <button type="button" class="modo" class:ligado={$soRetorno} class:inerte={!$soRetorno && !!motivoModo} aria-pressed={$soRetorno} aria-disabled={!$soRetorno && !!motivoModo} tabindex="-1" data-acao="modo-so-retorno" title={$soRetorno ? "Só retorno ligado: clique para voltar ao normal." : motivoModo || "Só retorno: o que você mandar ao ar vai só para o monitor de retorno, não para o telão."} on:mousedown|preventDefault on:click={modo}>{$soRetorno ? "● Só retorno" : "○ Só retorno"}</button>
    </div>
    <div class="linha">
        <input class="edit campo" type="text" maxlength={LIMITE_MENSAGEM} placeholder="Pastor, 5 min pro fim" aria-label="Mensagem pro palco" data-acao="mensagem-palco" bind:value={texto} on:input={() => (erro = "")} on:keydown={aoTeclar} />
        <button type="button" class="enviar" tabindex="-1" disabled={enviando || !texto.trim()} data-acao="enviar-mensagem-palco" on:mousedown|preventDefault on:click={enviar}>Enviar</button>
    </div>
    <div class="opcoes">
        <div class="duracao" role="group" aria-label="Quanto tempo fica no palco">
            {#each DURACOES_MINUTOS as m}
                <button type="button" class="dur" class:sel={minutos === m} aria-pressed={minutos === m} tabindex="-1" data-acao="duracao-mensagem" data-min={m} on:mousedown|preventDefault on:click={() => (minutos = m)}>{m}</button>
            {/each}
            <span class="un">min</span>
        </div>
        <span class="conta" class:cheio={texto.length >= LIMITE_MENSAGEM} data-acao="contador-mensagem">{texto.length}/{LIMITE_MENSAGEM}</span>
    </div>
    <div class="estado" data-acao="estado-mensagem-palco">
        {#if erro}
            <span class="aviso erro">{erro}</span>
        {:else if avisoModo}
            <span class="aviso">{avisoModo}</span>
        {:else if viva}
            <span class="vt">No palco: “{viva.texto}” · sai em <b class="rest" data-acao="restante-mensagem">{restanteTexto(viva.ateMs, agora || sirvoAgora())}</b></span><button type="button" class="limpar" tabindex="-1" data-acao="limpar-mensagem-palco" on:mousedown|preventDefault on:click={limpar}>Limpar</button>
        {:else if motivo}
            <span class="aviso">{motivo}</span>
        {/if}
    </div>
</div>

<style>
    .palco {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .cabeca {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    .titulo {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
    }
    .modo {
        height: 22px;
        padding: 0 8px;
        border: 1px solid var(--luz-linha);
        border-radius: 11px;
        background: transparent;
        color: var(--luz-fraco);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
    }
    .modo.inerte {
        cursor: not-allowed;
        opacity: 0.7;
    }
    .modo.ligado {
        background: var(--luz-laranja);
        border-color: var(--luz-laranja);
        color: var(--luz-tinta);
    }
    .opcoes {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        height: 22px;
    }
    .duracao {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .dur {
        min-width: 28px;
        height: 22px;
        padding: 0 6px;
        border: 1px solid var(--luz-linha);
        border-radius: 11px;
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
    }
    .dur.sel {
        border-color: var(--luz-texto);
        color: var(--luz-texto);
    }
    .un,
    .conta {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .conta.cheio {
        color: var(--luz-laranja);
    }
    .estado {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 16px;
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .rest {
        font-variant-numeric: tabular-nums;
        color: var(--luz-texto);
    }
    .linha {
        display: flex;
        gap: 6px;
    }
    .campo {
        flex-grow: 1;
        min-width: 0;
        height: 40px;
        box-sizing: border-box;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: transparent;
        color: var(--luz-texto);
        padding: 0 10px;
        font: inherit;
        font-size: 12px;
    }
    .campo:focus {
        outline: none;
        border-color: var(--luz-texto);
    }
    .enviar {
        height: 40px;
        padding: 0 12px;
        border: 1px solid var(--luz-texto);
        border-radius: 8px;
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font: inherit;
        font-size: 13px;
        font-weight: 650;
        cursor: pointer;
    }
    .enviar:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .vt {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .limpar {
        flex: none;
        border: 0;
        background: none;
        font: inherit;
        font-size: 11px;
        color: var(--luz-texto);
        text-decoration: underline;
        cursor: pointer;
    }
    .aviso {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .aviso.erro {
        color: var(--luz-laranja);
    }
</style>
