<script lang="ts">
    import { onDestroy } from "svelte"
    import { media, mediaTags } from "../../../stores"
    import { apagarPasta, mudarComportamento, quantasComAjuste, renomearPasta, voltarTodasPraPasta } from "../../../utils/aliancaPastasMidia"
    import { membros } from "../../../utils/aliancaPastasMidiaEstado"
    import { newToast } from "../../../utils/common"

    // AliançaShow (Preparar F7): o ⚙ da pasta. Só existe no Preparar. Nunca apaga arquivo: a pasta é uma etiqueta.
    export let pastaId: string

    $: tag = $mediaTags[pastaId]
    $: pasta = tag?.aliancaPasta
    $: total = ($membros[pastaId] || []).length
    // recalcula quando o ajuste de qualquer mídia muda
    $: proprias = recontar($media, $membros)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function recontar(..._dependencias: any[]) {
        return quantasComAjuste(pastaId)
    }

    // o campo so e recarregado quando o nome da pasta muda de fora (digitar nao deve ser desfeito)
    let nome = ""
    let nomeDaTag = ""
    $: if (tag && tag.name !== nomeDaTag) {
        nomeDaTag = tag.name
        nome = tag.name
    }

    function salvarNome() {
        if (nome.trim() && nome.trim() !== tag?.name) renomearPasta(pastaId, nome)
        else nome = tag?.name || ""
    }

    function trocarCamada(camada: "fundo" | "frente") {
        if (!pasta || pasta.camada === camada) return
        mudarComportamento(pastaId, { camada })
        if (total) newToast(`${total} ${total === 1 ? "mídia muda" : "mídias mudam"} de camada, inclusive as que são fundo de slide em shows`)
    }

    // apagar: a confirmação fica no próprio botão, por 3 s
    let confirmando = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function apagar() {
        if (!confirmando) {
            confirmando = true
            timer = setTimeout(() => (confirmando = false), 3000)
            return
        }
        clearTimeout(timer)
        confirmando = false
        apagarPasta(pastaId)
    }
    onDestroy(() => clearTimeout(timer))
</script>

{#if pasta}
    <div class="cfg" data-pasta-cfg>
        <label class="linha">
            <span class="rotulo">Nome</span>
            <input class="nome" type="text" bind:value={nome} on:change={salvarNome} on:keydown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        </label>

        <div class="linha">
            <span class="rotulo">Ao terminar</span>
            <div class="grupo" role="group">
                <button type="button" class:ligado={pasta.fim === "repetir"} data-fim="repetir" on:click={() => mudarComportamento(pastaId, { fim: "repetir" })}>Repetir</button>
                <button type="button" class:ligado={pasta.fim === "parar"} data-fim="parar" on:click={() => mudarComportamento(pastaId, { fim: "parar" })}>Parar (fica no último quadro)</button>
            </div>
        </div>

        <div class="linha">
            <span class="rotulo">Camada</span>
            <div class="grupo" role="group">
                <button type="button" class:ligado={pasta.camada === "fundo"} data-camada="fundo" on:click={() => trocarCamada("fundo")}>Fundo (sem som)</button>
                <button type="button" class:ligado={pasta.camada === "frente"} data-camada="frente" on:click={() => trocarCamada("frente")}>Frente (com som, limpa os slides)</button>
            </div>
        </div>
        <p class="aviso">Mudar a camada vale para as {total} mídias da pasta, inclusive quando são fundo de slide em shows. Fundo de slide de pasta "frente" fica mudo, e o próximo slide do mesmo show o limpa.</p>

        <label class="linha check">
            <input type="checkbox" checked={!!pasta.repetirAudio} on:change={(e) => mudarComportamento(pastaId, { repetirAudio: e.currentTarget.checked })} />
            <span>Repetir também os áudios desta pasta (padrão: o áudio para)</span>
        </label>
        <p class="aviso">Vale para o vídeo na próxima vez que tocar. O áudio lê a regra no fim.</p>

        <div class="linha rodape">
            <span>{proprias} {proprias === 1 ? "mídia" : "mídias"} com ajuste próprio</span>
            <button type="button" class="link" disabled={!proprias} data-voltar on:click={() => voltarTodasPraPasta(pastaId)}>Voltar todas pra pasta</button>
            <button type="button" class="apagar" class:confirmando data-apagar on:click={apagar}>
                {confirmando ? `Apagar? as ${total} mídias voltam pra Mídias` : "Apagar pasta"}
            </button>
        </div>
    </div>
{/if}

<style>
    .cfg {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
        font-size: 0.85em;
    }
    .linha {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    .rotulo {
        min-width: 90px;
        opacity: 0.7;
    }
    .nome {
        flex: 1;
        min-width: 160px;
        padding: 4px 8px;
        background: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        color: var(--text);
        border-radius: 6px;
    }
    .grupo {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }
    button {
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid var(--primary-lighter);
        background: transparent;
        color: var(--text);
    }
    button.ligado {
        background: var(--secondary-opacity);
        border-color: var(--secondary);
    }
    .aviso {
        margin: 0;
        font-size: 0.85em;
        opacity: 0.6;
    }
    .check {
        gap: 8px;
    }
    .rodape {
        justify-content: space-between;
    }
    button.link {
        border: none;
        text-decoration: underline;
    }
    button.link:disabled {
        opacity: 0.4;
        text-decoration: none;
    }
    button.apagar {
        margin-inline-start: auto;
    }
    button.apagar.confirmando {
        border-color: var(--secondary);
        background: var(--secondary-opacity);
    }
</style>
