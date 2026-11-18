<script lang="ts">
    // Leiaute v2, topo: a pilula "Sirvo" (bolinha na cor do estado + a palavra). O texto do estado e a dica ficam no title.
    // Clicavel so com problema (laranja/vermelho): o clique abre Configuracoes na conexao, como o indicador de antes. Sem chave (`sem_chave`) a pilula
    // NAO some: fica apagada ("○ Sirvo") e o clique abre um popover que explica e leva as Configuracoes do Sirvo.
    import { onDestroy } from "svelte"
    import { activePage, settingsTab } from "../../stores"
    import { dicaSegura } from "../../utils/aliancaDica"
    import { sirvo } from "../../utils/aliancaSirvo"
    import { calcular } from "../../utils/aliancaSirvoPilulaLogica"
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

    function abrirConexao() {
        if (!visual?.clicavel) return
        settingsTab.set("connection")
        activePage.set("settings")
    }

    // sem chave: popover de explicacao (fecha por clique fora ou Esc; o Esc e engolido para nao limpar o telao)
    let semChaveAberto = false
    function irParaConfig() {
        semChaveAberto = false
        settingsTab.set("connection")
        activePage.set("settings")
    }
    function fora(e: MouseEvent) {
        if (semChaveAberto && !(e.target as HTMLElement)?.closest?.(".semChaveRaiz")) semChaveAberto = false
    }
    function tecla(e: KeyboardEvent) {
        if (semChaveAberto && e.key === "Escape") {
            e.preventDefault()
            e.stopImmediatePropagation()
            semChaveAberto = false
        }
    }
    if (typeof window !== "undefined") window.addEventListener("keydown", tecla, true)
    onDestroy(() => typeof window !== "undefined" && window.removeEventListener("keydown", tecla, true))
</script>

<svelte:window on:mousedown={fora} />

{#if visual}
    <button class="sirvo {visual.tom}" data-acao="sirvo" aria-label={`Sirvo: ${visual.texto}`} data-title={dicaSegura(`${visual.texto}. ${visual.dica}`)} tabindex="-1" on:mousedown|preventDefault on:click={abrirConexao}>
        <span class="ponto" />
        Sirvo
    </button>
{:else}
    <div class="semChaveRaiz">
        <button class="sirvo apagado" data-acao="sirvo" data-estado="sem_chave" aria-haspopup="dialog" aria-expanded={semChaveAberto} aria-label="Sirvo: sem chave" tabindex="-1" on:mousedown|preventDefault on:click={() => (semChaveAberto = !semChaveAberto)}>
            <span class="ponto vazio" />
            Sirvo
        </button>
        {#if semChaveAberto}
            <div class="pop" role="dialog" aria-label="Sirvo sem chave" data-acao="sirvo-pop">
                <div class="titulo">Sirvo desconectado</div>
                <div class="txt">Sem a chave do Sirvo, o AliançaShow não lê o roteiro do culto, não recebe os avisos nem mostra o chat. Cole a chave nas Configurações do Sirvo.</div>
                <button class="ir" tabindex="-1" on:mousedown|preventDefault on:click={irParaConfig}>Abrir Configurações do Sirvo</button>
            </div>
        {/if}
    </div>
{/if}

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
    .sirvo.verde,
    .sirvo.laranja,
    .sirvo.vermelho {
        cursor: default;
    }
    .sirvo.laranja,
    .sirvo.vermelho {
        cursor: pointer;
    }
    .semChaveRaiz {
        position: relative;
    }
    .sirvo.apagado {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        color: var(--luz-fraco);
        cursor: pointer;
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
        width: 280px;
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
