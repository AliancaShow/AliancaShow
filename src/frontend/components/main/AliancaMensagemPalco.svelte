<script lang="ts">
    // Leiaute v2, coluna No ar: "Mensagem pro palco" (decisao P3). Campo de ate 120 caracteres + Enviar; a mensagem viva aparece embaixo com
    // "Limpar". O envio vai pelo Sirvo (aliancaMensagemPalco.ts): sem a chave "conduz" a faixa de falha acende e a caixa diz o motivo.
    // Ao lado, o botao de MODO "so retorno" (decisao 5): ainda desligado (D17), a logica vem depois; ele nao muda nada na saida.
    // Teclado: o campo e `.edit` (o espaco nao passa slide), nada do que se digita chega aos atalhos, Esc nao faz nada aqui (o 2o Esc da
    // pagina limparia o telao) e Enter envia e devolve o foco a pagina.
    import { onDestroy } from "svelte"
    import { sirvo, sirvoAgora, sirvoRoteiro, porQueNaoConduz } from "../../utils/aliancaSirvo"
    import { enviarMensagemPalco, limparMensagemPalco } from "../../utils/aliancaMensagemPalco"
    import { LIMITE_MENSAGEM, mensagemViva } from "../../utils/aliancaMensagemPalcoLogica"

    const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

    let texto = ""
    let enviando = false
    let erro = ""
    let tique = 0
    // a mensagem some da caixa quando o `ate` passa (o tique reavalia a cada 5 s)
    $: viva = (tique, mensagemViva($sirvoRoteiro?.mensagem_palco, sirvoAgora()))
    $: motivo = ($sirvo, porQueNaoConduz())
    const relogio = setInterval(() => (tique += 1), 5000)
    onDestroy(() => clearInterval(relogio))

    function soltarFoco() {
        const a = document.activeElement as HTMLElement | null
        if (a && a !== document.body && typeof a.blur === "function") a.blur()
    }
    async function enviar() {
        if (enviando) return
        enviando = true
        erro = ""
        const r = await enviarMensagemPalco(texto)
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
        <button type="button" class="modo" disabled aria-pressed="false" tabindex="-1" data-acao="modo-so-retorno" title="Só retorno: o que você mandar vai só para o monitor de retorno, não para o telão. Ainda não ligado.">○ Só retorno</button>
    </div>
    <div class="linha">
        <input class="edit campo" type="text" maxlength={LIMITE_MENSAGEM} placeholder="Pastor, 5 min pro fim" aria-label="Mensagem pro palco" data-acao="mensagem-palco" bind:value={texto} on:keydown={aoTeclar} />
        <button type="button" class="enviar" tabindex="-1" disabled={enviando || !texto.trim()} data-acao="enviar-mensagem-palco" on:mousedown|preventDefault on:click={enviar}>Enviar</button>
    </div>
    {#if viva}
        <div class="viva"><span class="vt">No palco: “{viva.texto}” · até {fmtHora.format(new Date(viva.ateMs))}</span><button type="button" class="limpar" tabindex="-1" on:mousedown|preventDefault on:click={limpar}>Limpar</button></div>
    {:else if erro}
        <div class="aviso erro">{erro}</div>
    {:else if motivo}
        <div class="aviso">{motivo}</div>
    {/if}
    {#if viva && erro}<div class="aviso erro">{erro}</div>{/if}
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
        cursor: not-allowed;
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
    .viva {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        color: var(--luz-mudo);
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
