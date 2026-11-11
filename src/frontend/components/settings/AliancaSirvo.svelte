<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { desconectarSirvo, escolherCultoSirvo, salvarChaveSirvo, sirvo } from "../../utils/aliancaSirvo"
    import { sirvoChatOperador } from "../../utils/aliancaSirvoChat"
    import { LIMITE_OPERADOR } from "../../utils/aliancaSirvoChatSaida"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"

    // ATENÇÃO: todo texto que vem do Sirvo (título do culto) entra aqui só por
    // interpolação {…}, que o Svelte escapa. Nada de {@html} nem de componentes
    // que montam tooltip com HTML (o MaterialDropdown faz isso com o rótulo).

    let chave = ""
    let ambiente: "producao" | "staging" = "producao"
    onMount(async () => (ambiente = (await requestMain(Main.SIRVO_AMBIENTE)) || "producao"))
    let salvando = false
    // "quem opera hoje" (opcional): aparece como "Sala de vídeo · <nome>" nas respostas do chat.
    // Valor inicial lido uma vez: o campo não é reescrito pelo store enquanto se digita.
    let operador = $sirvoChatOperador
    let erro = ""

    async function conectar() {
        salvando = true
        erro = (await salvarChaveSirvo(chave)) || ""
        salvando = false
        chave = "" // nem com erro a chave fica parada na memória do painel
    }

    const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    const quando = (iso: string) => fmt.format(new Date(iso))

    $: ligado = $sirvo.status === "conectado" || $sirvo.status === "caido" || $sirvo.status === "conectando"
    $: rotuloStatus = {
        sem_chave: "Desconectado",
        conectando: "Conectando…",
        conectado: $sirvo.cultoTitulo ? `Seguindo: ${$sirvo.cultoTitulo}` : "Conectado · nenhum culto por perto",
        caido: "Sem conexão com o Sirvo · o timer segue pelo último estado",
        chave_invalida: "Chave inválida ou revogada"
    }[$sirvo.status]
</script>

<div class="painel">
    <div class="topo">
        <span class="ponto" class:ligado={$sirvo.status === "conectado"} class:caido={$sirvo.status === "caido"}></span>
        <div class="texto">
            <span class="titulo"
                >Sirvo · roteiro do culto{#if ambiente === "staging"}
                    <span class="staging">STAGING</span>{/if}</span
            >
            <span class="detalhe">{rotuloStatus}</span>
        </div>
    </div>

    {#if ligado}
        <p class="explicacao">
            O timer <b>sirvo_live</b> e as variáveis <b>sirvo_bloco</b>, <b>sirvo_proximo</b>, <b>sirvo_mensagem</b> e <b>sirvo_fim</b> seguem o roteiro do culto no Sirvo. Coloque no layout de palco os que quiser.
        </p>

        {#if $sirvo.cultos.length}
            <div class="cultos">
                <button class="culto" class:ativo={!$sirvo.escolhaManual} on:click={() => escolherCultoSirvo(null)}>Automático (o que estiver no ar)</button>
                {#each $sirvo.cultos as c (c.event_id)}
                    <button class="culto" class:ativo={$sirvo.escolhaManual === c.event_id} on:click={() => escolherCultoSirvo(c.event_id)}>
                        <span>{c.titulo}</span>
                        <span class="quando">{quando(c.comeca_em)}{c.no_ar ? " · no ar" : c.encerrado ? " · encerrado" : ""}</span>
                    </button>
                {/each}
            </div>
        {/if}

        <!-- on:input: salva a cada letra; o limite é 40 letras -->
        <MaterialTextInput
            label="Quem opera hoje (opcional)"
            value={operador}
            placeholder="Nome que aparece nas respostas do chat"
            on:input={(e) => {
                operador = String(e.detail || "").slice(0, LIMITE_OPERADOR)
                sirvoChatOperador.set(operador)
            }}
        />
        <p class="explicacao">As respostas do chat saem como <b>Sala de vídeo · {operador.trim() || "…"}</b>. Só para as pessoas saberem com quem falam; não dá permissão nenhuma.</p>

        <MaterialButton variant="outlined" icon="logout" on:click={desconectarSirvo} white>Desconectar</MaterialButton>
    {:else}
        <p class="explicacao">
            {#if $sirvo.status === "chave_invalida"}
                A chave guardada não vale mais. Peça uma nova ao administrador do Sirvo (Perfil → AliançaShow) e cole aqui.
            {:else}
                Cole a chave gerada no Sirvo (Perfil → AliançaShow). Ela fica guardada só neste computador, no cofre do sistema.
            {/if}
        </p>

        <!-- on:input, não on:change: o change só sai no blur, e o clique em Conectar logo depois de colar caía no botão ainda desabilitado -->
        <MaterialTextInput label="Chave do Sirvo" value={chave} type="password" on:input={(e) => (chave = e.detail)} />

        {#if erro}
            <p class="erro"><Icon id="alert" size={0.9} white />{erro}</p>
        {/if}

        <MaterialButton variant="contained" icon="cloud" disabled={salvando || !chave.trim()} on:click={conectar}>
            {salvando ? "Conectando…" : "Conectar"}
        </MaterialButton>
        {#if $sirvo.status === "chave_invalida"}
            <MaterialButton variant="outlined" icon="delete" on:click={desconectarSirvo} white>Esquecer a chave</MaterialButton>
        {/if}
    {/if}
</div>

<style>
    .painel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        margin-bottom: 20px;
        background-color: var(--primary-darker);
        border-radius: 8px;
    }

    .topo {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .ponto {
        flex-shrink: 0;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background-color: var(--disconnected);
    }
    .ponto.ligado {
        background-color: var(--connected);
    }
    .ponto.caido {
        background-color: #ff8000;
    }

    .texto {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;
    }
    .titulo {
        font-weight: 600;
    }
    .staging {
        margin-inline-start: 6px;
        padding: 1px 6px;
        border-radius: 4px;
        background-color: var(--secondary);
        color: var(--secondary-text);
        font-size: 0.7em;
        letter-spacing: 0.05em;
    }
    .detalhe {
        font-size: 0.8em;
        opacity: 0.6;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .explicacao {
        margin: 0;
        font-size: 0.85em;
        line-height: 1.55;
        opacity: 0.7;
    }

    .cultos {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .culto {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border: 1px solid transparent;
        border-radius: 6px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-family: inherit;
        font-size: 0.9em;
        text-align: start;
        cursor: pointer;
    }
    .culto:hover {
        background-color: var(--hover);
    }
    .culto.ativo {
        border-color: var(--secondary);
    }
    .quando {
        flex-shrink: 0;
        opacity: 0.6;
    }

    .erro {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 10px 12px;
        background-color: rgb(168 39 39 / 0.15);
        border-radius: 6px;
        font-size: 0.85em;
    }
</style>
