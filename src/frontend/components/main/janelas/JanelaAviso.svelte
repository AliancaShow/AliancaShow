<script lang="ts">
    // AliancaShow (26/nov, "janelas nossas"): aviso como pergunta curta sem cabecalho. Mesma leitura do alertMessage do Alert do FreeShow
    // (chave de traducao, html, legendas, link do Bible Converter, "fechando..." com carregando); o Alert original segue no fecho.
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Link from "../../inputs/Link.svelte"
    import Loader from "../Loader.svelte"

    $: msg = String($alertMessage || "").replace("link#bible-converter", '<a id="bible-converter">Bible Converter</a>')
    $: fechando = msg === "actions.closing"

    function click(e: any) {
        if (e.target.closest("a#bible-converter")) sendMain(Main.URL, "https://github.com/vassbo/bible-converter")
    }
    const fechar = () => activePopup.set(null)
    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !fechando) fechar()
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="pergunta" data-janela="aviso">
    {#if fechando}
        <div class="fechando">
            <Loader />
            <span>{translateText(msg)}</span>
        </div>
    {:else}
        <p class="texto" on:click={click}>
            {#key msg}
                {#if msg.includes("captions#")}
                    {translateText("captions.info")}
                    <br />
                    <Link url={msg.slice(msg.indexOf("#") + 1)}>{msg.slice(msg.indexOf("#") + 1)}</Link>
                {:else if !msg.includes("<") && msg.length - msg.replaceAll(".", "").length === 1}
                    {translateText(msg)}
                {:else}
                    {@html msg}
                {/if}
            {/key}
        </p>
        <div class="acoes">
            <button class="jb principal" data-title="[Enter]" on:click={fechar}>Ok</button>
        </div>
    {/if}
</div>

<style>
    .texto {
        font-size: 13px;
        line-height: 1.5;
        margin: 0;
        white-space: initial;
    }
    .texto :global(a) {
        color: var(--luz-texto);
        text-decoration: underline;
        cursor: pointer;
    }
    .fechando {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
    }
</style>
