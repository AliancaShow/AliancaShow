<script context="module" lang="ts">
    // rascunhos POR BLOCO: o que o operador digita não pode sumir se o painel
    // for remontado, nem passar para outro bloco quando ele troca de seção (o
    // painel NÃO é remontado ao trocar de seção: só muda o `blocoId`)
    type Rascunho = { titulo: string; nota: string; link: string; cor: string }
    type Novo = { titulo: string; minutos: number }
    const rascunhos = new Map<string, { editar: Rascunho | null; novo: Novo | null }>()
</script>

<script lang="ts">
    // Painel da seção de um bloco do Sirvo, parte de CONDUZIR (F2, §13.4).
    // Só com a chave que conduz. Duração (−5 −1 +1 +5), subir/descer, editar
    // (título, cor, nota, link: um pedido ao salvar), novo bloco depois deste e
    // apagar (segurando). O Sirvo decide e o resultado chega pelo roteiro: nada
    // aqui muda o projeto antes. O nome no cabeçalho continua trancado: editar
    // ali brigaria com a reconciliação de 2 s.
    // Texto do Sirvo só por interpolação {…}, nunca {@html}.
    import { newToast } from "../../utils/common"
    import { pedirAoSirvo, porQueNaoConduz, sirvo, sirvoRoteiro, type FuncaoDeEscrita } from "../../utils/aliancaSirvo"
    import SirvoSegurar from "./SirvoSegurar.svelte"

    export let blocoId: string

    $: r = $sirvoRoteiro
    $: motivo = porQueNaoConduz($sirvo)
    $: i = r ? r.blocos.findIndex((b) => b.id === blocoId) : -1
    $: lista = r?.blocos || []
    $: bloco = lista[i] || null
    $: noAr = !!r && r.bloco_no_ar === blocoId && !!r.iniciado_em && !r.encerrado_em
    $: passou = !!bloco?.concluido_em
    // nada vai para antes do que já passou nem do bloco no ar (a regra do banco; aqui só para não oferecer)
    $: anterior = i > 0 ? lista[i - 1] || null : null
    $: travaAnterior = !anterior || !!anterior.concluido_em || (!!r?.iniciado_em && !r?.encerrado_em && r?.bloco_no_ar === anterior.id)
    $: podeSubir = !!bloco && !passou && !noAr && !travaAnterior
    $: podeDescer = !!bloco && !passou && !noAr && i < (r?.blocos.length || 0) - 1

    let blocoDoEstado = blocoId
    let estado = rascunhos.get(blocoId) || { editar: null, novo: null }
    $: if (blocoId !== blocoDoEstado) {
        rascunhos.set(blocoDoEstado, estado)
        blocoDoEstado = blocoId
        estado = rascunhos.get(blocoId) || { editar: null, novo: null }
    }
    $: rascunhos.set(blocoDoEstado, estado)

    async function pedir(funcao: FuncaoDeEscrita, args: { [key: string]: any }) {
        const res = await pedirAoSirvo(funcao, args)
        if (!res.ok) newToast(res.mensagem)
        return res
    }

    function duracao(delta: number) {
        if (!bloco || motivo) return
        const base = bloco.duracao_min
        const novo = Math.max(0, Math.min(600, base + delta))
        if (novo === base) return
        pedir("show_ajustar_duracao", { p_bloco: blocoId, p_base: base, p_novo: novo })
    }

    function subir() {
        if (!r || !podeSubir || motivo) return
        // fica depois do que vinha dois antes (ou vira o primeiro)
        pedir("show_mover_bloco", { p_bloco: blocoId, p_depois_de: i >= 2 ? r.blocos[i - 2].id : null })
    }
    function descer() {
        if (!r || !podeDescer || motivo) return
        pedir("show_mover_bloco", { p_bloco: blocoId, p_depois_de: r.blocos[i + 1].id })
    }

    function abrirEditar() {
        if (!bloco) return
        estado = { ...estado, editar: estado.editar || { titulo: bloco.titulo, nota: bloco.nota || "", link: bloco.link || "", cor: bloco.cor || "" } }
    }
    async function salvarEdicao() {
        const e = estado.editar
        if (!e || !bloco || motivo) return
        // só o que mudou: a cor do roteiro é a FINAL (a do tipo, sem cor própria)
        const campos: { [k: string]: string } = {}
        if (e.titulo.trim() !== bloco.titulo) campos.titulo = e.titulo.trim()
        if (e.nota.trim() !== (bloco.nota || "").trim()) campos.nota = e.nota
        let link = e.link.trim()
        if (link && /^http:\/\//i.test(link)) link = "https://" + link.slice(7)
        else if (link && !/^[a-z][a-z0-9+.-]*:/i.test(link)) link = "https://" + link
        if (link !== (bloco.link || "")) campos.link = link
        if (e.cor && e.cor.toLowerCase() !== (bloco.cor || "").toLowerCase()) campos.cor = e.cor
        if (!Object.keys(campos).length) {
            estado = { ...estado, editar: null }
            return
        }
        const res = await pedir("show_editar_bloco", { p_bloco: blocoId, p_campos: campos })
        if (res.ok) estado = { ...estado, editar: null }
    }

    function abrirNovo() {
        estado = { ...estado, novo: estado.novo || { titulo: "", minutos: 5 } }
    }
    async function criar() {
        const n = estado.novo
        if (!n || !r || motivo) return
        const titulo = n.titulo.trim()
        if (!titulo) return newToast("Dê um nome ao bloco novo.")
        const res = await pedir("show_criar_bloco", { p_event: r.event_id, p_depois_de: blocoId, p_titulo: titulo, p_minutos: Math.max(0, Math.min(600, Math.round(Number(n.minutos) || 0))) })
        if (res.ok) estado = { ...estado, novo: null }
    }

    function apagar() {
        if (!bloco || passou || noAr || motivo) return
        pedir("show_apagar_bloco", { p_bloco: blocoId })
    }
</script>

{#if $sirvo.podeConduzir && bloco}
    <div class="conduzir">
        {#if motivo}
            <p class="fraco">{motivo}</p>
        {/if}

        <div class="campo">
            <span class="rotulo">Duração</span>
            <div class="grupo">
                <button tabindex="-1" disabled={!!motivo || passou} on:click={() => duracao(-5)}>−5</button>
                <button tabindex="-1" disabled={!!motivo || passou} on:click={() => duracao(-1)}>−1</button>
                <span class="valor num">{bloco.duracao_min} min</span>
                <button tabindex="-1" disabled={!!motivo || passou} on:click={() => duracao(1)}>+1</button>
                <button tabindex="-1" disabled={!!motivo || passou} on:click={() => duracao(5)}>+5</button>
            </div>
        </div>

        <div class="campo">
            <span class="rotulo">Ordem</span>
            <div class="grupo">
                <button tabindex="-1" disabled={!!motivo || !podeSubir} data-title={noAr ? "O bloco no ar não sai do lugar." : travaAnterior && !passou ? "Nada vai para antes do que já passou nem do bloco no ar." : ""} on:click={subir}>↑ Subir</button>
                <button tabindex="-1" disabled={!!motivo || !podeDescer} data-title={noAr ? "O bloco no ar não sai do lugar." : ""} on:click={descer}>↓ Descer</button>
            </div>
        </div>

        {#if estado.editar}
            <div class="form">
                <label>Título <input class="edit" maxlength="120" bind:value={estado.editar.titulo} /></label>
                <label>Nota <textarea class="edit" maxlength="2000" rows="3" bind:value={estado.editar.nota} /></label>
                <label>Link <input class="edit" maxlength="500" placeholder="https://" bind:value={estado.editar.link} /></label>
                <label class="linhaCor">Cor <input class="edit" type="color" bind:value={estado.editar.cor} /></label>
                <div class="grupo">
                    <button class="forte" tabindex="-1" disabled={!!motivo} on:click={salvarEdicao}>Salvar no Sirvo</button>
                    <button tabindex="-1" on:click={() => (estado = { ...estado, editar: null })}>Cancelar</button>
                </div>
            </div>
        {:else if estado.novo}
            <div class="form">
                <label>Bloco novo depois de “{bloco.titulo}” <input class="edit" maxlength="120" placeholder="Nome" bind:value={estado.novo.titulo} /></label>
                <label class="linhaCor">Minutos <input class="edit" type="number" min="0" max="600" bind:value={estado.novo.minutos} /></label>
                <div class="grupo">
                    <button class="forte" tabindex="-1" disabled={!!motivo} on:click={criar}>Criar no Sirvo</button>
                    <button tabindex="-1" on:click={() => (estado = { ...estado, novo: null })}>Cancelar</button>
                </div>
            </div>
        {:else}
            <div class="grupo">
                <button tabindex="-1" disabled={!!motivo} on:click={abrirEditar}>Editar bloco</button>
                <button tabindex="-1" disabled={!!motivo} on:click={abrirNovo}>Novo bloco depois deste</button>
                <span class="espaco" />
                {#if !passou && !noAr}
                    <SirvoSegurar rotulo="Apagar bloco" dica="Segure para apagar este bloco no Sirvo. O histórico do Sirvo guarda o bloco inteiro." perigo desabilitado={!!motivo} on:feito={apagar} />
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .conduzir {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 10px;
        border-top: 1px solid var(--primary-lighter);
        user-select: none;
    }
    .fraco {
        opacity: 0.6;
        font-size: 0.85em;
    }
    .campo {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .rotulo {
        flex: none;
        min-width: 90px;
        opacity: 0.6;
        font-size: 0.85em;
    }
    .grupo {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }
    .espaco {
        flex: 1;
    }
    .num {
        min-width: 56px;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    button {
        padding: 3px 10px;
        border: 0;
        border-radius: 14px;
        background: rgb(255 255 255 / 0.06);
        color: var(--text);
        font-family: inherit;
        font-size: 0.85em;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.12);
    }
    button.forte {
        background: rgb(255 128 0 / 0.18);
        color: #ffb066;
        font-weight: 600;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        user-select: text;
    }
    .form label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.85em;
        opacity: 0.9;
    }
    .form .linhaCor {
        flex-direction: row;
        align-items: center;
        gap: 10px;
    }
    .form input,
    .form textarea {
        padding: 5px 8px;
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        background: var(--primary-darkest);
        color: var(--text);
        font-family: inherit;
        font-size: 1em;
        resize: vertical;
    }
    .form input[type="color"] {
        width: 40px;
        height: 26px;
        padding: 0 2px;
    }
    .form input[type="number"] {
        width: 80px;
    }
</style>
