<script lang="ts">
    // AliançaShow (Preparar F4): colar letra (com acordes em cima, estilo cifra) numa música nova ou numa que está "sem letra".
    // O texto colado fica guardado por música: fechar o popup (Esc, clique fora, X) e reabrir devolve o que estava escrito.
    import { onMount } from "svelte"
    import { activePopup, activeShow, categories, popupData, shows, showsCache, textCache } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { duplicadasDe } from "../../../utils/aliancaLista"
    import { prepararLetraColada, type ModoDeDivisao } from "../../../utils/aliancaLetra"
    import { catalogoDaBiblioteca, criarMusicaComLetra, limparRascunhoDaLetra, montarLetra, preencherLetra, rascunhosLetra, ultimaDivisao, type PreviaDaLetra } from "../../../utils/aliancaVarias"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const dados = ($popupData || {}) as { modo?: "nova" | "preencher"; showId?: string }
    const modo: "nova" | "preencher" = dados.modo === "preencher" && dados.showId ? "preencher" : "nova"
    const showId = dados.showId || ""
    const chave = modo === "preencher" ? showId : "nova"

    const guardado = $rascunhosLetra[chave]
    let texto = guardado?.texto || ""
    let nome = guardado?.nome || ""
    let cantor = guardado?.cantor || (modo === "preencher" ? (($showsCache[showId]?.meta as any)?.artist as string) || "" : "")
    let divisao: ModoDeDivisao = guardado?.modo || $ultimaDivisao.modo
    let n = guardado?.n || $ultimaDivisao.n
    let manter: number[] = guardado?.manter || []

    // o cantor da música a preencher vem do show (meta.artist), quando já estiver no cache
    $: nomeDaMusica = modo === "preencher" ? $shows[showId]?.name || "" : nome

    let campo: HTMLTextAreaElement
    onMount(() => setTimeout(() => campo?.focus(), 50))

    // guarda tudo na memória da janela a cada mudança
    $: rascunhosLetra.update((a) => ({ ...a, [chave]: { texto, nome, cantor, modo: divisao, n, manter } }))
    $: ultimaDivisao.set({ modo: divisao, n })

    // a prévia (com um respiro: a conversão de letra longa não precisa rodar a cada tecla)
    let previa: PreviaDaLetra = { slides: [], acordesReconhecidos: 0, absorvidas: [], descartadas: [], show: null }
    let timer: ReturnType<typeof setTimeout> | undefined
    $: agendar(texto, divisao, n, manter)
    function agendar(..._dep: unknown[]) {
        clearTimeout(timer)
        timer = setTimeout(calcular, 200)
    }
    function calcular() {
        try {
            previa = montarLetra(texto, divisao, n, { manterComoLetra: new Set(manter), nome: nomeDaMusica || "x" })
        } catch (erro) {
            console.error("Preparar: falha ao montar a prévia da letra", erro)
            previa = { slides: [], acordesReconhecidos: 0, absorvidas: [], descartadas: [], show: null }
        }
    }
    onMount(calcular)

    function manterComoLetra(indice: number) {
        if (!manter.includes(indice)) manter = [...manter, indice]
    }
    function voltarAAcorde(indice: number) {
        manter = manter.filter((i) => i !== indice)
    }

    // duplicada (só em "nova")
    let letraLimpa = ""
    $: letraLimpa = modo === "nova" && texto ? prepararLetraColada(texto, { manterComoLetra: new Set(manter) }).texto : ""
    $: duplicadas = modo === "nova" && (nome.trim() || letraLimpa) ? duplicadasDe(nome, letraLimpa, catalogoDaBiblioteca($shows, $categories), $textCache) : { porNome: [], porLetra: [] }
    $: avisos = [...duplicadas.porNome.map((d) => ({ id: d.id, texto: `Já existe "${d.nome}"${d.categoria ? ` (${d.categoria})` : ""} na biblioteca` })), ...duplicadas.porLetra.map((d) => ({ id: d.id, texto: `Essa letra parece a de "${d.nome}"${d.categoria ? ` (${d.categoria})` : ""}` }))]

    function abrirEssa(id: string) {
        activeShow.set({ id, type: "show" })
        activePopup.set(null)
    }

    $: temLetra = previa.slides.length > 0
    $: podeConfirmar = temLetra && (modo === "preencher" || !!nome.trim())
    $: rotuloDoBotao = modo === "preencher" ? "Colar letra" : avisos.length ? "Criar outra mesmo assim" : "Criar música"

    async function confirmar() {
        if (!podeConfirmar) return
        // refaz a conta agora (a prévia tem um respiro de 200 ms)
        clearTimeout(timer)
        calcular()
        const atual = previa
        if (!atual.show) return
        if (modo === "preencher") {
            const ok = await preencherLetra(showId, atual)
            if (!ok) {
                newToast("Não deu pra colar a letra nessa música")
                return
            }
            newToast(`Letra colada: ${atual.slides.length} ${atual.slides.length === 1 ? "slide" : "slides"}`)
        } else {
            const id = criarMusicaComLetra(nome.trim(), cantor.trim(), atual)
            if (!id) return
            newToast("Música criada na biblioteca")
        }
        limparRascunhoDaLetra(chave)
        activePopup.set(null)
    }

    function limpar() {
        texto = ""
        manter = []
        campo?.focus()
    }

    const modos: { id: ModoDeDivisao; rotulo: string }[] = [
        { id: "paragrafo", rotulo: "Por parágrafo (linha em branco)" },
        { id: "linha", rotulo: "Cada linha um slide" },
        { id: "n", rotulo: "A cada N linhas" }
    ]
</script>

<div class="letra">
    <div class="lado">
        {#if modo === "nova"}
            <div class="campos">
                <label class="campo">
                    <span>Nome da música</span>
                    <input type="text" bind:value={nome} placeholder="Ousado Amor" />
                </label>
                <label class="campo">
                    <span>Cantor (opcional)</span>
                    <input type="text" bind:value={cantor} placeholder="Isaias Saad" />
                </label>
            </div>
            <button class="manter mais" on:click={() => activePopup.set("show")}>Mais opções (buscar a letra na web, modelos)</button>
            {#if avisos.length}
                <div class="aviso" role="status">
                    {#each avisos as a (a.id + a.texto)}
                        <div class="linha-aviso">
                            <span>{a.texto}</span>
                            <button class="abrir" on:click={() => abrirEssa(a.id)}>Abrir essa</button>
                        </div>
                    {/each}
                </div>
            {/if}
        {:else}
            <div class="titulo">
                Letra de: {nomeDaMusica}{#if cantor}
                    · {cantor}{/if}
            </div>
        {/if}

        <label for="alianca-letra-texto" class="titulo">Cole a letra (pode ter os acordes em cima)</label>
        <textarea id="alianca-letra-texto" bind:this={campo} bind:value={texto} rows="14" spellcheck="false" placeholder={"[Refrão]\nSanto, santo, santo\n\nVerso 1\nG       D\nAos teus pés eu venho"}></textarea>

        <fieldset class="divisao">
            <legend class="titulo">Como dividir?</legend>
            {#each modos as m}
                <label class="opcao"><input type="radio" bind:group={divisao} value={m.id} /> {m.rotulo}</label>
            {/each}
            {#if divisao === "n"}
                <label class="opcao nlinhas">A cada <input type="number" min="1" max="8" bind:value={n} /> linhas</label>
            {/if}
        </fieldset>
    </div>

    <div class="lado">
        <div class="titulo">
            Como vai ficar{#if temLetra}
                · {previa.slides.length} {previa.slides.length === 1 ? "slide" : "slides"}{/if}
        </div>
        {#if !temLetra}
            <p class="dica">Cole a letra ao lado pra ver os slides.</p>
        {:else}
            <ol class="slides">
                {#each previa.slides as s}
                    <li>
                        {#if s.grupo}<span class="grupo">{s.grupo}</span>{/if}
                        <span class="texto">{s.texto}</span>
                    </li>
                {/each}
            </ol>
        {/if}

        {#if previa.absorvidas.length || previa.descartadas.length}
            <div class="acordes">
                {#if previa.absorvidas.length}
                    <div class="nota">{previa.acordesReconhecidos} {previa.acordesReconhecidos === 1 ? "acorde reconhecido" : "acordes reconhecidos"} ({previa.absorvidas.length} {previa.absorvidas.length === 1 ? "linha" : "linhas"}): ficam guardados na música, fora do slide.</div>
                    {#each previa.absorvidas as l}
                        <div class="l-acorde"><code>{l.texto}</code><button class="manter" on:click={() => manterComoLetra(l.indice)}>manter como letra</button></div>
                    {/each}
                {/if}
                {#if previa.descartadas.length}
                    <div class="nota">{previa.descartadas.length} {previa.descartadas.length === 1 ? "linha só de acorde (intro/solo) descartada" : "linhas só de acorde (intro/solo) descartadas"}:</div>
                    {#each previa.descartadas as l}
                        <div class="l-acorde riscada"><code>{l.texto}</code><button class="manter" on:click={() => manterComoLetra(l.indice)}>manter como letra</button></div>
                    {/each}
                {/if}
            </div>
        {/if}
        {#if manter.length}
            <div class="nota">
                Mantidas como letra: {manter.length}
                {#each manter as i (i)}<button class="manter" on:click={() => voltarAAcorde(i)}>desfazer linha {i + 1}</button>{/each}
            </div>
        {/if}

        <div class="rodape">
            <div class="botoes">
                <MaterialButton variant="outlined" on:click={limpar} disabled={!texto}>Limpar</MaterialButton>
            </div>
            <div class="botoes">
                <MaterialButton variant="outlined" on:click={() => activePopup.set(null)}>Cancelar</MaterialButton>
                <MaterialButton variant="contained" disabled={!podeConfirmar} on:click={confirmar}>{rotuloDoBotao}</MaterialButton>
            </div>
        </div>
    </div>
</div>

<style>
    .letra {
        display: flex;
        gap: 18px;
        /* o cartão do popup tem as margens da navegação dos dois lados: cabe nelas, sem cortar a coluna da direita */
        width: min(880px, calc(100vw - 2 * var(--navigation-width, 0px) - 56px));
        min-width: 0;
        max-width: 100%;
        font-size: 0.8em;
    }
    .lado {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .titulo {
        font-weight: 600;
        opacity: 0.85;
    }
    .campos {
        display: flex;
        gap: 10px;
    }
    .campo {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .campo span {
        font-weight: 600;
        opacity: 0.85;
    }
    input[type="text"],
    input[type="number"],
    textarea {
        width: 100%;
        padding: 6px 10px;
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        font: inherit;
    }
    input[type="number"] {
        width: 60px;
        padding: 2px 6px;
    }
    textarea {
        resize: vertical;
        min-height: 240px;
        font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    }
    .aviso {
        padding: 6px 10px;
        border-radius: 6px;
        background: rgb(var(--prep-rgb, 224 160 48) / 0.18);
        border: 1px solid rgb(var(--prep-rgb, 224 160 48) / 0.5);
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .linha-aviso {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
    }
    button.abrir,
    button.manter {
        flex: none;
        padding: 1px 8px;
        border-radius: 4px;
        border: 1px solid var(--primary-lighter);
        background: transparent;
        color: var(--text);
        cursor: pointer;
        font-size: 0.9em;
    }
    button.abrir:hover,
    button.manter:hover {
        background: var(--primary-lighter);
    }
    .divisao {
        border: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .opcao {
        display: flex;
        gap: 6px;
        align-items: center;
    }
    .slides {
        list-style: decimal;
        margin: 0;
        padding: 6px 10px 6px 28px;
        max-height: 260px;
        overflow-y: auto;
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        background: var(--primary-darker);
    }
    .slides li {
        padding: 3px 0;
        border-bottom: 1px solid var(--primary-lighter);
    }
    .slides li:last-child {
        border-bottom: none;
    }
    .grupo {
        display: block;
        font-size: 0.85em;
        opacity: 0.6;
        font-style: italic;
    }
    .texto {
        white-space: pre-line;
    }
    .dica,
    .nota {
        opacity: 0.65;
        margin: 0;
    }
    .acordes {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-height: 160px;
        overflow-y: auto;
    }
    .l-acorde {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
    }
    .l-acorde code {
        font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
        white-space: pre;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .riscada code {
        text-decoration: line-through;
        opacity: 0.6;
    }
    .rodape {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: auto;
    }
    .botoes {
        display: flex;
        gap: 8px;
    }

    @media screen and (max-width: 1000px) {
        .letra {
            width: min(880px, calc(100vw - 96px));
        }
    }
</style>
