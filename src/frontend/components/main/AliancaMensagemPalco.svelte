<script lang="ts">
    // Leiaute v2, coluna No ar: "Mensagem pro palco" (decisao P3). Campo de ate 120 caracteres + Enviar; a mensagem viva aparece embaixo com
    // "Limpar". O envio vai pelo Sirvo (aliancaMensagemPalco.ts): sem a chave "conduz" a faixa de falha acende e a caixa diz o motivo.
    // Ao lado, o botao de MODO "so retorno" (decisao 5, aliancaSoRetorno.ts): liga/desliga o modo; sem retorno configurado fica inerte com o motivo.
    // A validade (1, 3, 5, 10 min; padrao 3) e a contagem regressiva da mensagem viva ficam na caixa; a linha de estado tem altura fixa
    // (nada se desloca quando a mensagem entra, sai ou da erro).
    // Teclado: o campo e `.edit` (o espaco nao passa slide) e o que se digita nao chega aos atalhos, MENOS F1-F5 e Ctrl+L (panico, passam).
    // O 1o Esc solta o cursor; o 2o (ja fora do campo) limpa o telao. Enter envia e sempre devolve o foco a pagina (cabine 6, 23/nov).
    import { onDestroy, onMount } from "svelte"
    import { sirvo, sirvoAgora } from "../../utils/aliancaSirvo"
    import { enviarMensagemPalco, limparMensagemPalco } from "../../utils/aliancaMensagemPalco"
    import { mensagemDaCaixa } from "../../utils/aliancaMensagemPalcoVista"
    import { DURACOES_MINUTOS, LIMITE_MENSAGEM, MINUTOS_PADRAO, PRAZO_APARECER_MS, PRAZO_ERRO_MS, acompanharEnvio, avisoDaCaixa, caminhoDoEnvio, campoAposEnvio, campoEstaNoPalco, conferirDuvida, duvidaDoEnvio, envioAceito, mensagemViva, prepararMensagem, rotuloNoPalco, type Duvida, type Envio } from "../../utils/aliancaMensagemPalcoLogica"
    import { desligarSoRetorno, ligarSoRetorno, porQueNaoLigarSoRetorno, soRetorno } from "../../utils/aliancaSoRetorno"
    import { outputs } from "../../stores"
    import { teclaNoCampo } from "../../utils/aliancaCampoTeclasLogica"
    import { dicaDoEsc } from "../../utils/aliancaToque"

    let texto = ""
    let enviando = false
    let erro = ""
    let tErro: ReturnType<typeof setTimeout> | null = null
    // envio que estourou o tempo e pode ter chegado: a proxima leitura do roteiro diz (conferirDuvida)
    let duvida: (Duvida & { campo: string }) | null = null
    let minutos: number = MINUTOS_PADRAO
    // A3: o envio que deu certo e esta sendo acompanhado: o texto FICA no campo enquanto a mensagem esta no palco
    let envio: Envio | null = null
    let avisoModo = ""
    let tAviso: ReturnType<typeof setTimeout> | null = null
    let tique = 0
    let agora = 0
    // a mensagem some da caixa quando o `ate` passa (o tique reavalia a cada 5 s)
    const lerViva = (_tique: number, m: typeof $mensagemDaCaixa) => mensagemViva(m, sirvoAgora())
    const lerMotivo = (e: typeof $sirvo) => caminhoDoEnvio(e).motivo
    $: viva = lerViva(tique, $mensagemDaCaixa)
    $: if (duvida) conferir(viva)
    $: if (envio) acompanhar(viva, tique)
    $: noPalco = campoEstaNoPalco(texto, viva)
    $: motivo = lerMotivo($sirvo)
    // a contagem nasce certa: com a viva recem-chegada o `agora` ainda podia ter ate 5 s (o relogio so anda de 5 em 5 s sem viva)
    $: if (viva) agora = sirvoAgora()
    $: aviso = avisoDaCaixa({ erro, enviando, avisoModo, motivo })
    // 1 s: a contagem regressiva anda; a mensagem sai da caixa no segundo em que o `ate` passa
    const relogio = setInterval(() => {
        tique += 1
        // sem mensagem viva nada precisa redesenhar a cada segundo: o relogio so anda quando ha contagem
        if (viva || tique % 5 === 0) agora = sirvoAgora()
    }, 1000)
    onMount(() => (agora = sirvoAgora()))
    onDestroy(() => {
        clearInterval(relogio)
        if (tAviso) clearTimeout(tAviso)
        if (tErro) clearTimeout(tErro)
    })
    // o erro some sozinho (PRAZO_ERRO_MS) ou no proximo envio; nunca fica para sempre e nunca esconde a viva nem o Limpar
    function mostrarErro(m: string) {
        erro = m
        if (tErro) clearTimeout(tErro)
        tErro = setTimeout(() => (erro = ""), PRAZO_ERRO_MS)
    }
    function limparErro() {
        erro = ""
        if (tErro) clearTimeout(tErro)
        tErro = null
    }
    function conferir(v: typeof viva) {
        const d = duvida
        if (!d) return
        const c = conferirDuvida(d, v, sirvoAgora())
        if (c === "aberta") return
        duvida = null
        if (c === "vencida") return
        // chegou: o palco tem a mensagem; a caixa deixa de dizer que nao sabe (o texto fica no campo: A3)
        limparErro()
        envio = { campo: d.campo, texto: d.texto, visto: true, venceEm: 0 }
    }
    // A3: o campo so se esvazia quando a mensagem SAI do palco (expirou ou alguem limpou) e ainda e o texto enviado
    function acompanhar(v: typeof viva, _tique: number) {
        const e = envio
        if (!e) return
        const r = acompanharEnvio(e, v, sirvoAgora())
        if (r === "noPalco") e.visto = true
        else if (r === "saiu") {
            texto = campoAposEnvio(texto, e.campo)
            envio = null
        } else if (r === "perdeu") envio = null
    }
    // o motivo do modo depende dos retornos configurados (a loja de saidas)
    const lerModo = (_o: unknown) => porQueNaoLigarSoRetorno()
    $: motivoModo = lerModo($outputs)
    function modo() {
        if ($soRetorno) return desligarSoRetorno()
        const r = ligarSoRetorno()
        if (r.ok) return
        limparErro()
        avisoModo = r.motivo
        if (tAviso) clearTimeout(tAviso)
        tAviso = setTimeout(() => (avisoModo = ""), 6000)
    }

    function soltarFoco() {
        const a = document.activeElement as HTMLElement | null
        if (a && a !== document.body && typeof a.blur === "function") a.blur()
    }
    /** devolve se o envio vai sair (o Enter so larga o foco nesse caso) */
    function enviar(): boolean {
        const aceito = envioAceito(texto, motivo, enviando)
        if (enviando) return false
        enviarAgora()
        return aceito
    }
    async function enviarAgora() {
        enviando = true
        limparErro()
        duvida = null
        const campo = texto
        const r = await enviarMensagemPalco(texto, minutos)
        enviando = false
        if (r.ok) {
            // A3: o texto FICA no campo, destacado como "no palco"; esvazia quando a mensagem sair
            envio = { campo, texto: (prepararMensagem(campo) as { texto?: string }).texto || campo, visto: false, venceEm: sirvoAgora() + PRAZO_APARECER_MS }
        } else {
            mostrarErro(r.mensagem)
            if (r.codigo === "rede") duvida = { ...duvidaDoEnvio((prepararMensagem(campo) as { texto?: string }).texto || campo, minutos, sirvoAgora()), campo }
        }
    }
    async function limpar() {
        if (enviando) return
        enviando = true
        limparErro()
        const r = await limparMensagemPalco()
        enviando = false
        if (!r.ok) mostrarErro(r.mensagem)
        else if (envio) {
            // o operador limpou: o campo esvazia junto (se ainda e o texto enviado)
            texto = campoAposEnvio(texto, envio.campo)
            envio = null
        }
    }
    function aoTeclar(ev: KeyboardEvent) {
        // cabine 6 (Andre, 23/nov): F1-F5 e Ctrl+L passam mesmo digitando; o 1o Esc solta o cursor (o 2o, ja fora do campo, limpa o telao)
        const destino = teclaNoCampo(ev)
        if (destino === "passar") return
        ev.stopPropagation()
        if (destino === "soltar") {
            ev.preventDefault()
            soltarFoco()
            dicaDoEsc()
            return
        }
        if (ev.key === "Enter" && !ev.isComposing) {
            ev.preventDefault()
            // o Enter SEMPRE devolve o foco, ate quando o envio e recusado (a caixa diz o motivo): o espaco seguinte passa slide
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
        <input class="edit campo" class:noar={noPalco} type="text" maxlength={LIMITE_MENSAGEM} placeholder="Pastor, 5 min pro fim" aria-label="Mensagem pro palco" data-acao="mensagem-palco" bind:value={texto} on:keydown={aoTeclar} />
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
        {#if viva}
            <span class="vt"><b class="pal" data-acao="restante-mensagem">● {rotuloNoPalco(viva.ateMs, agora || sirvoAgora())}</b>{#if !noPalco} · “{viva.texto}”{/if}</span><button type="button" class="limpar" tabindex="-1" data-acao="limpar-mensagem-palco" on:mousedown|preventDefault on:click={limpar}>Limpar</button>
        {/if}
    </div>
    <div class="estado" data-acao="aviso-mensagem-palco" role="status">
        {#if aviso}
            <span class="aviso" class:erro>{aviso}</span>
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
        min-width: 82px;
        height: 22px;
        padding: 0 8px;
        border: 1px solid var(--luz-linha);
        border-radius: 11px;
        background: transparent;
        color: var(--luz-mudo);
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
    .pal {
        font-variant-numeric: tabular-nums;
        color: var(--luz-laranja);
        font-weight: 650;
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
    .campo.noar {
        border-color: var(--luz-laranja);
        background: color-mix(in srgb, var(--luz-laranja) 14%, transparent);
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
