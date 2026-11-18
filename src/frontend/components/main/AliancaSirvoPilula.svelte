<script lang="ts">
    // Leiaute v2, topo: a pilula "Sirvo" (bolinha na cor do estado + a palavra). Fatia 4: o clique abre um popover (surgir curto, fecha por
    // clique fora ou Esc) com o culto seguido, se a chave conduz, o material e o chat, mais o texto do estado; o botao do pe leva a
    // Configuracoes na conexao (antes o clique ia direto, e so com problema). Sem chave (`sem_chave`) a pilula NAO some: fica apagada ("○ Sirvo")
    // e o popover explica e leva as Configuracoes do Sirvo. Texto do Sirvo so por interpolacao {...}, nunca {@html}.
    import { onDestroy } from "svelte"
    import { settingsTab } from "../../stores"
    import { trocarTela } from "../../utils/aliancaTela"
    import { escFechou } from "../../utils/aliancaToque"
    import { dicaSegura } from "../../utils/aliancaDica"
    import { sirvo } from "../../utils/aliancaSirvo"
    import { calcular, quando } from "../../utils/aliancaSirvoPilulaLogica"
    import { sirvoChat } from "../../utils/aliancaSirvoChat"
    import { sirvoMaterialEstado } from "../../utils/aliancaSirvoMaterial"

    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 2_000)
    onDestroy(() => clearInterval(relogio))

    // F5 (v5): ha quanto tempo a limpeza do material esta adiada (laranja depois de 7 dias)
    let adiadaDesde = 0
    function lerAdiadaDesde(): number {
        try {
            const salvo = Number(localStorage.getItem("sirvoLimpezaAdiadaDesde"))
            if (salvo) return salvo
            localStorage.setItem("sirvoLimpezaAdiadaDesde", String(Date.now()))
        } catch {}
        return Date.now()
    }
    $: if (!$sirvoMaterialEstado.disco?.limpeza?.adiada) {
        adiadaDesde = 0
        try {
            localStorage.removeItem("sirvoLimpezaAdiadaDesde")
        } catch {}
    } else if (!adiadaDesde) adiadaDesde = lerAdiadaDesde()

    $: culto = $sirvo.cultos.find((c) => c.event_id === $sirvo.cultoId) || null
    $: visual = calcular($sirvo, culto, agoraMs, $sirvoMaterialEstado, adiadaDesde)

    // o que o popover conta (so leitura do estado: nada aqui escreve no Sirvo)
    $: material = (() => {
        const m = $sirvoMaterialEstado
        if (m.falhas.length) return `${m.falhas.length} ${m.falhas.length === 1 ? "arquivo falhou" : "arquivos falharam"} (o Show tenta de novo sozinho)`
        if (m.baixando || m.naFila) return `baixando ${m.lote.feitos} de ${m.lote.total}`
        if (m.habilitado === false) return "desligado nesta chave"
        return m.baixados.length ? `${m.baixados.length} ${m.baixados.length === 1 ? "arquivo baixado" : "arquivos baixados"}` : "nada para baixar"
    })()
    $: chat = !$sirvo.cultoId ? "sem culto" : $sirvoChat.ligado ? ($sirvoChat.responde ? "ligado, a chave responde" : "ligado, só leitura") : $sirvoChat.congelado ? "desligado por um admin" : "desligado"
    $: escolha = culto ? ($sirvo.escolhaManual ? "escolhido à mão" : "escolhido automaticamente") : ""

    // o popover (fecha por clique fora ou Esc; o Esc e engolido para nao limpar o telao)
    let aberto = false
    function irParaConfig() {
        aberto = false
        settingsTab.set("connection")
        trocarTela("settings", "pilula-sirvo")
    }
    function fora(e: MouseEvent) {
        if (aberto && !(e.target as HTMLElement)?.closest?.(".sirvoRaiz")) aberto = false
    }
    function tecla(e: KeyboardEvent) {
        if (aberto && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            escFechou()
            aberto = false
        }
    }
    if (typeof window !== "undefined") window.addEventListener("keydown", tecla, true)
    onDestroy(() => typeof window !== "undefined" && window.removeEventListener("keydown", tecla, true))
</script>

<svelte:window on:mousedown={fora} />

<div class="sirvoRaiz">
    {#if visual}
        <button class="sirvo {visual.tom}" class:aberto data-acao="sirvo" aria-haspopup="dialog" aria-expanded={aberto} aria-label={`Sirvo: ${visual.texto}`} data-title={aberto ? "" : dicaSegura(`${visual.texto}. ${visual.dica}`)} tabindex="-1" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>
            <span class="ponto" />
            Sirvo
        </button>
        {#if aberto}
            <div class="pop" role="dialog" aria-label="Culto do Sirvo" data-acao="sirvo-pop">
                <div class="secao">CULTO DO SIRVO</div>
                {#if culto}
                    <div class="culto">{culto.titulo}</div>
                    <div class="txt">{quando(culto.comeca_em)} · {escolha}</div>
                {:else}
                    <div class="txt">Nenhum culto por perto.</div>
                {/if}
                <div class="linha">
                    <span>Conduz o culto</span>
                    <span class="chip" class:on={$sirvo.podeConduzir} data-acao="sirvo-conduz">{$sirvo.podeConduzir ? "sim" : "só lê"}</span>
                </div>
                <div class="txt">Material: {material}</div>
                <div class="txt">Chat: {chat}</div>
                {#if visual.tom === "laranja" || visual.tom === "vermelho"}<div class="txt estado" data-acao="sirvo-problema">{visual.texto}. {visual.dica}</div>{/if}
                <button class="ir" tabindex="-1" on:mousedown|preventDefault on:click={irParaConfig}>Abrir Conexão do Sirvo</button>
            </div>
        {/if}
    {:else}
        <button class="sirvo apagado" class:aberto data-acao="sirvo" data-estado="sem_chave" aria-haspopup="dialog" aria-expanded={aberto} aria-label="Sirvo: sem chave" tabindex="-1" on:mousedown|preventDefault on:click={() => (aberto = !aberto)}>
            <span class="ponto vazio" />
            Sirvo
        </button>
        {#if aberto}
            <div class="pop" role="dialog" aria-label="Sirvo sem chave" data-acao="sirvo-pop">
                <div class="titulo">Sirvo desconectado</div>
                <div class="txt">Sem a chave do Sirvo, o AliançaShow não lê o roteiro do culto, não recebe os avisos nem mostra o chat. Cole a chave nas Configurações do Sirvo.</div>
                <button class="ir" tabindex="-1" on:mousedown|preventDefault on:click={irParaConfig}>Abrir Configurações do Sirvo</button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .sirvo {
        height: 32px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        border: none;
        border-radius: 16px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: default;
        color: var(--luz-mudo);
    }
    .sirvo {
        cursor: pointer;
    }
    .sirvo.aberto {
        box-shadow: inset 0 0 0 1px var(--luz-borda-forte);
    }
    .sirvoRaiz {
        position: relative;
    }
    .sirvo.apagado {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        color: var(--luz-fraco);
    }
    .sirvo.apagado:hover {
        color: var(--luz-mudo);
    }
    .ponto.vazio {
        background: transparent;
        box-shadow: inset 0 0 0 1.5px var(--luz-fraco);
    }
    .pop {
        position: absolute;
        z-index: 40;
        top: 38px;
        left: 0;
        width: 320px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--luz-pop);
        border: 1px solid var(--luz-borda);
        border-radius: 12px;
        box-shadow:
            inset 0 0 0 1px var(--luz-borda),
            0 18px 40px rgba(0, 0, 0, 0.5);
        backdrop-filter: var(--luz-vidro, none);
        transform-origin: top left;
        animation: luz-surgir 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
        font-size: 13px;
        color: var(--luz-texto);
    }
    .pop .titulo {
        font-weight: 600;
    }
    .pop .secao {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
    }
    .pop .culto {
        font-size: 14px;
        font-weight: 600;
    }
    .pop .linha {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .pop .chip {
        padding: 2px 10px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
        background: var(--luz-campo);
        color: var(--luz-mudo);
    }
    .pop .chip.on {
        background: rgba(94, 196, 141, 0.14);
        color: var(--luz-verde);
    }
    .pop .estado {
        padding-top: 6px;
        border-top: 1px solid var(--luz-linha);
    }
    .pop .txt {
        margin: 0;
        font-size: 12px;
        color: var(--luz-mudo);
        line-height: 1.4;
    }
    .ir {
        height: 36px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    .ir:hover {
        background: var(--luz-hover);
    }
    .ponto {
        width: 7px;
        height: 7px;
        border-radius: 4px;
        background: var(--luz-mudo);
    }
    .verde {
        background: rgba(94, 196, 141, 0.14);
        color: var(--luz-verde);
    }
    .verde .ponto {
        background: var(--luz-verde);
        box-shadow: 0 0 0 3px rgba(94, 196, 141, 0.28);
    }
    .laranja {
        background: rgba(235, 166, 64, 0.14);
        color: var(--luz-laranja);
    }
    .laranja .ponto {
        background: var(--luz-laranja);
        box-shadow: 0 0 0 3px rgba(235, 166, 64, 0.28);
    }
    .vermelho {
        background: rgba(242, 26, 39, 0.14);
        color: #ff9aa0;
    }
    .vermelho .ponto {
        background: var(--luz-vermelho);
        box-shadow: 0 0 0 3px rgba(242, 26, 39, 0.28);
    }
</style>
