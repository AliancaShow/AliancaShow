<script lang="ts">
    // Indicador do Sirvo na barra do topo: QUAL culto o Show está seguindo e se
    // o roteiro está vivo. Visível em todas as telas.
    //
    // - Diz a data e a hora, não só o nome: "Culto de Domingo" vale para todo
    //   domingo, e em 09/ago a equipe rodou o culto no roteiro do domingo seguinte.
    // - Só é clicável com problema (laranja/vermelho): um clique errado no verde,
    //   no meio do culto, não pode tirar o operador da grade de slides.
    // - "Sem conexão" mede a idade da última resposta do ROTEIRO (show_rev /
    //   show_roteiro), com folga para um soluço do Wi-Fi não piscar laranja.
    // - Culto de um dia que já passou fica laranja e clicável: em 08/nov o Show
    //   seguia o teste de 05/nov (escolhido à mão) e "o Show não bate com o Sirvo".
    // Texto do Sirvo só por interpolação {…} (escapada pelo Svelte), nunca {@html}.
    import { onDestroy } from "svelte"
    import { activePage, settingsTab } from "../../stores"
    import { dicaSegura } from "../../utils/aliancaDica"
    import { intervaloRev, sirvo } from "../../utils/aliancaSirvo"
    import { sirvoMaterialEstado } from "../../utils/aliancaSirvoMaterial"

    let agoraMs = Date.now()
    const relogio = setInterval(() => (agoraMs = Date.now()), 2_000)
    onDestroy(() => clearInterval(relogio))

    const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" })
    const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    function quando(iso: string): string {
        const d = new Date(iso)
        if (isNaN(d.getTime())) return ""
        const [h, m] = fmtHora.format(d).split(":")
        return `${fmtDia.format(d).replace(/\.,?/g, "").replace(",", "")} ${h}h${m === "00" ? "" : m}`
    }

    // dia no fuso da igreja, "2026-11-08", para comparar só a data
    const fmtDiaIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    function jaPassou(iso: string, t: number): boolean {
        const d = new Date(iso)
        if (isNaN(d.getTime())) return false
        return fmtDiaIso.format(d) < fmtDiaIso.format(new Date(t))
    }

    function minutos(ms: number): string {
        const min = Math.floor(ms / 60_000)
        return min < 1 ? "há instantes" : `há ${min} min`
    }

    type Visual = { tom: "verde" | "cinza" | "laranja" | "vermelho"; texto: string; dica: string; clicavel: boolean }

    $: culto = $sirvo.cultos.find((c) => c.event_id === $sirvo.cultoId) || null
    $: visual = calcular($sirvo, culto, agoraMs, $sirvoMaterialEstado)

    // F5: o material da semana que o Show baixa do Sirvo ("baixando 2 de 5", "1 falhou")
    function materialTexto(m: typeof $sirvoMaterialEstado): { texto: string; dica: string; falhou: boolean } {
        if (m.falhas.length) {
            const n = m.falhas.length
            const nomes = m.falhas.map((f) => f.nome).join(", ")
            return { texto: ` · ${n} ${n === 1 ? "arquivo falhou" : "arquivos falharam"}`, dica: ` Material do Sirvo que não baixou (o Show tenta de novo sozinho, aos poucos: 1, 5, 15 e 60 min): ${nomes}.`, falhou: true }
        }
        if (m.baixando || m.naFila) return { texto: ` · baixando ${m.lote.feitos} de ${m.lote.total}`, dica: " Baixando o material da semana enviado pelo Sirvo.", falhou: false }
        return { texto: "", dica: "", falhou: false }
    }

    function calcular(e: typeof $sirvo, c: typeof culto, t: number, m: typeof $sirvoMaterialEstado): Visual | null {
        if (e.status === "sem_chave") return null
        if (e.status === "chave_invalida") return { tom: "vermelho", texto: "Chave do Sirvo recusada", dica: "A chave guardada não vale mais. Clique para abrir Conexão.", clicavel: true }
        if (e.status === "conectando") return { tom: "cinza", texto: "Sirvo · conectando…", dica: "", clicavel: false }

        // com culto: vale a idade da última resposta do roteiro; sem culto, o status
        const limite = Math.max(10_000, 2 * intervaloRev())
        const base = c ? e.ultimoRoteiroOk : e.ultimaResposta
        const caido = c ? (base ? t - base > limite : e.status === "caido") : e.status === "caido"
        if (caido) {
            const texto = base ? `Sem Sirvo ${minutos(t - base)}` : "Sem conexão com o Sirvo"
            const dica = e.roteiroNoAr ? "O timer segue pelo último estado recebido. Clique para abrir Conexão." : "Clique para abrir Conexão."
            return { tom: "laranja", texto, dica, clicavel: true }
        }

        if (!c) return { tom: "cinza", texto: "Sirvo · nenhum culto por perto", dica: "", clicavel: false }
        if (jaPassou(c.comeca_em, t) && !e.roteiroNoAr) {
            const como = e.escolhaManual ? "escolhido à mão" : "escolhido automaticamente"
            return { tom: "laranja", texto: `${quando(c.comeca_em)} · já passou`, dica: `Seguindo ${c.titulo}, um culto que já passou (${como}). Clique para escolher outro em Conexão.`, clicavel: true }
        }
        const estado = e.roteiroNoAr ? " · no ar" : e.roteiroEncerrado ? " · encerrado" : ""
        const papel = e.podeConduzir ? " · conduz" : " · só lê"
        const dicaPapel = e.podeConduzir ? " Esta chave conduz: o Show pode encerrar blocos e mexer no roteiro." : " Esta chave só lê o roteiro."
        const dica = `Seguindo ${c.titulo} · ${quando(c.comeca_em)}${estado}${e.escolhaManual ? " · escolhido à mão" : " · escolhido automaticamente"}.${dicaPapel}`
        const mat = materialTexto(m)
        return { tom: mat.falhou ? "laranja" : "verde", texto: `${quando(c.comeca_em)}${estado}${papel}${mat.texto}`, dica: dica + mat.dica, clicavel: false }
    }

    function abrirConexao() {
        if (!visual?.clicavel) return
        settingsTab.set("connection")
        activePage.set("settings")
    }
</script>

{#if visual}
    {#if visual.clicavel}
        <button class="sirvo {visual.tom}" data-title={dicaSegura(visual.dica)} on:click={abrirConexao}>
            <span class="ponto" />
            <span class="texto">{visual.texto}</span>
        </button>
    {:else}
        <div class="sirvo {visual.tom}" data-title={dicaSegura(visual.dica)} role="status">
            <span class="ponto" />
            <span class="rotulo">Sirvo</span>
            <span class="texto">{visual.texto}</span>
        </div>
    {/if}
{/if}

<style>
    .sirvo {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        align-self: center;
        padding: 4px 9px 4px 8px;
        border: 0;
        border-radius: 20px;
        background: rgb(255 255 255 / 0.05);
        color: var(--text);
        font-family: inherit;
        font-size: 12px;
        white-space: nowrap;
    }
    button.sirvo {
        cursor: pointer;
    }
    button.sirvo:hover {
        background: rgb(255 255 255 / 0.1);
    }

    .ponto {
        flex: none;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--text);
        opacity: 0.4;
    }
    .verde .ponto {
        background: var(--connected);
        opacity: 1;
    }
    .laranja .ponto {
        background: #ff8000;
        opacity: 1;
    }
    .vermelho .ponto {
        background: var(--disconnected);
        opacity: 1;
    }
    .laranja {
        color: #ffb066;
    }
    .vermelho {
        color: #ff8f97;
    }

    .rotulo {
        opacity: 0.5;
    }
    .texto {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
