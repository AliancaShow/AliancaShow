<script lang="ts">
    // AliancaShow Teste: a aba "API" foi removida. O app usa apenas a NVI local
    // (Bibles/NVI.fsb). A lista de API vinha do churchapps com a chave do projeto
    // original, que nao podemos usar, e trazia so traducoes em ingles.
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { scriptures } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    let localBibles: { path: string; name: string }[] = []

    onMount(getLocalBibles)
    async function getLocalBibles() {
        localBibles = (await requestMain(Main.READ_BIBLES_FOLDER)) || []
        const existingBibles = Object.values($scriptures).map((a) => a.name.replace(/\.fsb$/i, ""))
        // remove already existing
        localBibles = localBibles.filter((a) => !existingBibles.includes(a.name))
    }

    function importBible(path: string) {
        sendMain(Main.IMPORT_FILES, { id: "BIBLE", paths: [path] })
    }
</script>

{#if localBibles.length}
    <div class="existingBiblesList">
        {#each localBibles as localBible}
            <MaterialButton variant="outlined" icon="import" style="justify-content: left;" on:click={() => importBible(localBible.path)} white>
                {localBible.name}
            </MaterialButton>
        {/each}
    </div>

    <HRule />
{/if}

<p style="font-size: 1.1em;"><T id="scripture.supported_formats" /></p>
<ul style="list-style: inside;">
    <li>
        <span style="font-size: 0.9em;font-weight: bold;">XML</span>
        <span style="font-size: 0.8em;opacity: 0.8;margin-left: 10px;">Zefania/OSIS/Beblia/OpenSong</span>
    </li>
    <li>
        <span style="font-size: 0.9em;font-weight: bold;">JSON</span>
        <span style="font-size: 0.8em;opacity: 0.8;margin-left: 10px;">AliançaShow</span>
    </li>
</ul>

<MaterialButton
    variant="outlined"
    icon="import"
    style="margin-top: 20px;"
    on:click={() => sendMain(Main.IMPORT, { channel: "BIBLE", format: { name: "Bible", extensions: ["xml", "xmm", "json", "fsb"] } })}
>
    <T id="scripture.local" />
</MaterialButton>

<style>
    .existingBiblesList {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
</style>
