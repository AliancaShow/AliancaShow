<script lang="ts">
    // Leiaute v2, fatia 4: o vazio do centro (nada aberto em Mostrar ou em Editar). No estilo Luz e sem conteudo de FreeShow: sem link para a
    // documentacao do FreeShow, sem versiculo do dia (votd.org) e sem os atalhos de "novo projeto" e "busca rapida" (projetos e QuickSearch nao
    // existem mais na cabine). O texto da igreja (`special.splashText`, botao direito > texto personalizado) continua valendo; links dele abrem
    // como antes. Um unico gesto: "Novo show".
    import { activePopup, special, version } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import Link from "../inputs/Link.svelte"
    import Center from "../system/Center.svelte"

    let links: string[] = []
    function extractLinksAndCleanText(text: string) {
        links = []

        // extract and remove links from <a> tags
        const textWithoutATags = text.replace(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>.*?<\/a>/gi, (_match, url) => {
            links.push(url)
            return ""
        })
        // extract and remove raw links from plain text
        const finalText = textWithoutATags.replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
            links.push(url)
            return ""
        })

        return finalText.replaceAll("\n", "<br>").replace(/\s+/g, " ").trim()
    }
</script>

<Center class="context #splash">
    <div class="splash" data-acao="splash">
        <img class="wordmark" src="./assets/lockup.webp" alt="AliançaShow" draggable={false} />
        <p class="versao">v{$version}</p>
        {#if $special.splashText}
            <p class="texto">
                {@html extractLinksAndCleanText($special.splashText)}
                <span class="links">
                    {#each links as link}
                        <Link url={link}>
                            {link.replace(/^(https?:\/\/)/, "")}
                            <Icon id="launch" white />
                        </Link>
                    {/each}
                </span>
            </p>
        {:else}
            <p class="texto">Escolha um item no roteiro ou na biblioteca.</p>
        {/if}
        <button class="novo" data-acao="splash-novo-show" tabindex="-1" on:mousedown|preventDefault on:click={() => activePopup.set("show")}>＋ Novo show</button>
    </div>
</Center>

<style>
    .splash {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        color: var(--luz-texto);
        font-family: var(--luz-fonte);
    }
    .wordmark {
        height: 3.5em;
        max-width: 92%;
        object-fit: contain;
        user-select: none;
    }
    p {
        margin: 0;
        overflow: initial;
    }
    .versao {
        font-size: 12px;
        color: var(--luz-fraco);
    }
    .texto {
        max-width: 480px;
        padding-top: 14px;
        font-size: 13px;
        text-align: center;
        white-space: normal;
        color: var(--luz-mudo);
    }
    .links {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .novo {
        margin-top: 10px;
        height: 40px;
        padding: 0 18px;
        border: 1px solid var(--luz-borda);
        border-radius: 8px;
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .novo:hover {
        background: var(--luz-hover);
    }

    @media screen and (max-height: 500px) {
        .wordmark {
            height: 3em;
        }
    }
    @media screen and (max-width: 800px) {
        .wordmark {
            height: 2em;
        }
    }
</style>
