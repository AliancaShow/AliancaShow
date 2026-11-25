<script lang="ts">
    // Coluna No ar, secao "Recados" (Andre, 25/nov: desenho coluna_no_ar_secoes_recolhiveis_v1, "concordo com Recados", abas so aberta).
    // Junta a Mensagem pro palco e as Chamadas (uso esporadico) numa secao recolhivel; nasce recolhida e lembra a escolha e a ultima aba.
    // As duas ficam MONTADAS mesmo escondidas (texto digitado, chamada escolhida, vigia do NO AR). O que esta no ar aparece como pilula na
    // linha do titulo mesmo recolhida: clique no nome abre a secao na aba; Tirar/Limpar agem dali.
    import { onDestroy } from "svelte"
    import { overlays } from "../../stores"
    import { blocos, definirBloco } from "../../utils/aliancaBlocosEstado"
    import { blocoAberto } from "../../utils/aliancaBlocosLogica"
    import { chamadaNoAr, tirarChamada } from "../../utils/aliancaChamadas"
    import { limparMensagemPalco } from "../../utils/aliancaMensagemPalco"
    import { mensagemViva } from "../../utils/aliancaMensagemPalcoLogica"
    import { mensagemDaCaixa } from "../../utils/aliancaMensagemPalcoVista"
    import { CHAVE_ABA_PALCO, CHAVE_RECADOS, RECADOS_ABERTO_PADRAO, pilulasDosRecados, type AbaRecados } from "../../utils/aliancaRecadosLogica"
    import { sirvoAgora } from "../../utils/aliancaSirvo"
    import AliancaChamadas from "./AliancaChamadas.svelte"
    import AliancaMensagemPalco from "./AliancaMensagemPalco.svelte"
    import AliancaSecaoNoAr from "./AliancaSecaoNoAr.svelte"

    $: aba = (blocoAberto($blocos, CHAVE_ABA_PALCO, false) ? "palco" : "chamadas") as AbaRecados
    const escolher = (a: AbaRecados) => definirBloco(CHAVE_ABA_PALCO, a === "palco")
    function abrirEm(a: AbaRecados) {
        escolher(a)
        definirBloco(CHAVE_RECADOS, true)
    }

    // dois relogios: a chamada conta no relogio do PC; a mensagem do palco no do Sirvo (sirvoAgora). A pilula do palco vem para o do PC.
    let agora = Date.now()
    let agoraSirvo = sirvoAgora()
    const relogio = setInterval(() => {
        agora = Date.now()
        agoraSirvo = sirvoAgora()
    }, 500)
    onDestroy(() => clearInterval(relogio))

    $: palco = mensagemViva($mensagemDaCaixa, agoraSirvo)
    $: palcoNoPc = palco ? { texto: palco.texto, ateMs: palco.ateMs - agoraSirvo + agora } : null
    $: pilulas = pilulasDosRecados({ palco: palcoNoPc, chamada: $chamadaNoAr, nomeChamada: $chamadaNoAr ? ($overlays as any)[$chamadaNoAr.id]?.name : "", agoraMs: agora })

    let limpando = false
    async function agir(tipo: AbaRecados) {
        if (tipo === "chamadas") return $chamadaNoAr && tirarChamada($chamadaNoAr.id)
        if (limpando) return
        limpando = true
        await limparMensagemPalco()
        limpando = false
    }
</script>

<AliancaSecaoNoAr titulo="RECADOS" chave={CHAVE_RECADOS} padrao={RECADOS_ABERTO_PADRAO} manterMontado acao="recados">
    <svelte:fragment slot="direita">
        {#each pilulas as p (p.tipo)}
            <span class="pilula" data-acao="pilula-{p.tipo}" title={p.titulo}>
                <button type="button" class="nome" tabindex="-1" on:mousedown|preventDefault on:click={() => abrirEm(p.tipo)}
                    >● {p.rotulo}{#if p.tempo}<span class="tempo">{p.tempo}</span>{/if}</button
                >
                <button type="button" class="agir" tabindex="-1" data-acao="pilula-{p.tipo}-tirar" on:mousedown|preventDefault on:click={() => agir(p.tipo)}>{p.tipo === "palco" ? "Limpar" : "Tirar"}</button>
            </span>
        {/each}
    </svelte:fragment>
    <div class="abas" role="tablist" aria-label="Recados">
        <button role="tab" class="aba" class:on={aba === "palco"} aria-selected={aba === "palco"} tabindex="-1" data-acao="aba-recados" data-aba="palco" title="Mensagem só no monitor de retorno" on:mousedown|preventDefault on:click={() => escolher("palco")}>Palco</button>
        <button role="tab" class="aba" class:on={aba === "chamadas"} aria-selected={aba === "chamadas"} tabindex="-1" data-acao="aba-recados" data-aba="chamadas" title="Chamadas no telão (Kids, Estacionamento...)" on:mousedown|preventDefault on:click={() => escolher("chamadas")}>Chamadas</button>
    </div>
    <div class="painel" class:fora={aba !== "palco"}><AliancaMensagemPalco semTitulo /></div>
    <div class="painel" class:fora={aba !== "chamadas"}><AliancaChamadas semTitulo /></div>
</AliancaSecaoNoAr>

<style>
    .abas {
        display: flex;
        gap: 2px;
        padding: 2px;
        background: var(--luz-trilho);
        border-radius: 7px;
    }
    .aba {
        flex: 1 1 0;
        min-width: 0;
        height: 26px;
        border: none;
        border-radius: 5px;
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        background: transparent;
        color: var(--luz-mudo);
        transition: background 120ms;
    }
    .aba.on {
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .painel.fora {
        display: none;
    }
    .pilula {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        height: 22px;
        border-radius: 11px;
        background: var(--luz-vermelho);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        overflow: hidden;
    }
    .pilula button {
        height: 22px;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
        white-space: nowrap;
    }
    .nome {
        min-width: 0;
        padding: 0 6px 0 9px;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .tempo {
        margin-left: 5px;
        font-variant-numeric: tabular-nums;
        opacity: 0.9;
    }
    .agir {
        padding: 0 9px;
        border-left: 1px solid rgba(255, 255, 255, 0.35) !important;
    }
    .agir:hover,
    .nome:hover {
        background: rgba(0, 0, 0, 0.15);
    }
</style>
