<script lang="ts">
    // Chamadas (André, 24/nov; desenho chamadas_kids_estacionamento_v1). Coluna No ar, embaixo da "Mensagem pro palco".
    // Escolhe a chamada (chips), preenche os [campos], escolhe o tempo e "Chamar no telão": uma sobreposição com o texto montado entra nas saídas
    // da chamada (utils/aliancaChamadas.ts). "NO AR" com contagem e Tirar. "editar" / "+ Chamada" abrem o editor aqui mesmo.
    // Teclado: os campos são `.edit` (o espaço não passa slide), F1-F5/Ctrl+L passam, o 1o Esc solta o cursor; Enter no último campo chama.
    import { onDestroy } from "svelte"
    import { outputs, overlays } from "../../stores"
    import { abrirChamadaNoEditar, apagarChamada, chamadaEstaNoAr, chamadaNoAr, chamar, garantirChamadasPadrao, listaDeChamadas, salvarChamada, tirarChamada } from "../../utils/aliancaChamadas"
    import { DURACAO_PADRAO, DURACOES, LIMITE_CAMPO, POSICOES, camposDoModelo, montarTexto, nomeNovo, prontaParaChamar, restante, rotuloDoCampo, saidasDaChamada, type Posicao } from "../../utils/aliancaChamadasLogica"
    import { teclaNoCampo } from "../../utils/aliancaCampoTeclasLogica"
    import { dicaDoEsc } from "../../utils/aliancaToque"

    garantirChamadasPadrao()

    $: lista = listaDeChamadas($overlays as any)
    let escolhida = ""
    $: if (!lista.some((c) => c.id === escolhida)) escolhida = lista[0]?.id || ""
    $: atual = lista.find((c) => c.id === escolhida) || null
    $: campos = atual ? camposDoModelo(atual.modelo) : []
    // valores por chamada (trocar de chip não apaga o que foi digitado)
    let valores: Record<string, Record<string, string>> = {}
    $: v = (atual && valores[atual.id]) || {}
    $: texto = atual ? montarTexto(atual.modelo, v) : ""
    $: pronta = !!atual && prontaParaChamar(atual.modelo, v)
    let segundos = DURACAO_PADRAO
    let aviso = ""
    let tAviso: ReturnType<typeof setTimeout> | null = null

    // saidas normais (o retorno mostra o layout de retorno, sem sobreposicao)
    $: normais = Object.entries($outputs as any)
        .filter(([, o]: any) => o && !o.stageOutput && !o.isKeyOutput)
        .map(([id, o]: any) => ({ id, nome: o.name || "Saída" }))

    // NO AR: some sozinho quando a chamada sai das saidas (tempo, limpeza, F-tecla)
    let agora = Date.now()
    const relogio = setInterval(() => (agora = Date.now()), 500)
    onDestroy(() => {
        clearInterval(relogio)
        if (tAviso) clearTimeout(tAviso)
    })
    $: if ($chamadaNoAr && !chamadaEstaNoAr($chamadaNoAr.id, $outputs as any)) chamadaNoAr.set(null)
    $: falta = $chamadaNoAr ? restante($chamadaNoAr.ateMs, agora) : null

    function mudarValor(campo: string, valor: string) {
        if (!atual) return
        valores = { ...valores, [atual.id]: { ...(valores[atual.id] || {}), [campo]: valor } }
    }
    function mostrarAviso(m: string) {
        aviso = m
        if (tAviso) clearTimeout(tAviso)
        tAviso = setTimeout(() => (aviso = ""), 5000)
    }
    function chamarAgora() {
        if (!atual) return
        if (!pronta)
            return mostrarAviso(
                "Preencha " +
                    campos
                        .filter((c) => !String(v[c] || "").trim())
                        .map(rotuloDoCampo)
                        .join(" e ") +
                    "."
            )
        const foi = chamar(atual, v, segundos)
        if (!foi.length) return mostrarAviso("A chamada não entrou: nenhuma saída ligada para ela (veja em editar).")
        aviso = ""
    }
    function soltarFoco() {
        const a = document.activeElement as HTMLElement | null
        if (a && a !== document.body && typeof a.blur === "function") a.blur()
    }
    function aoTeclar(ev: KeyboardEvent, ultimo: boolean) {
        const destino = teclaNoCampo(ev)
        if (destino === "passar") return
        ev.stopPropagation()
        if (destino === "soltar") {
            ev.preventDefault()
            soltarFoco()
            dicaDoEsc()
            return
        }
        if (ev.key === "Enter" && !ev.isComposing) {
            ev.preventDefault()
            if (ultimo) {
                chamarAgora()
                soltarFoco()
            } else {
                const proximo = (ev.currentTarget as HTMLElement).closest(".campos")?.querySelectorAll("input")
                const lista = proximo ? [...proximo] : []
                const i = lista.indexOf(ev.currentTarget as HTMLInputElement)
                lista[i + 1]?.focus()
            }
        }
    }

    // ---- editor (aqui mesmo, no lugar do painel)
    let editando: null | { id: string | null; nome: string; modelo: string; posicao: Posicao; saidas: string[] } = null
    let confirmarApagar = false
    function abrirEditor(id: string | null) {
        confirmarApagar = false
        const c = id ? lista.find((x) => x.id === id) : null
        editando = c ? { id: c.id, nome: c.nome, modelo: c.modelo, posicao: c.posicao, saidas: saidasDaChamada(c.saidas, $outputs as any) } : { id: null, nome: nomeNovo(lista.map((x) => x.nome)), modelo: "", posicao: "faixa", saidas: normais.map((o) => o.id) }
    }
    $: camposDoEditor = editando ? camposDoModelo(editando.modelo) : []
    $: podeSalvar = !!editando && !!editando.nome.trim() && !!editando.modelo.trim() && editando.saidas.length > 0
    function salvar(depois?: "livre") {
        if (!editando || !podeSalvar) return
        const id = salvarChamada(editando.id, editando.nome.trim(), { modelo: editando.modelo.trim(), posicao: editando.posicao, saidas: editando.saidas })
        escolhida = id
        editando = null
        if (depois === "livre") abrirChamadaNoEditar(id)
    }
    function alternarSaida(id: string) {
        if (!editando) return
        editando.saidas = editando.saidas.includes(id) ? editando.saidas.filter((s) => s !== id) : [...editando.saidas, id]
    }
    function apagar() {
        if (!editando?.id) return
        apagarChamada(editando.id)
        editando = null
    }
    function teclaDoEditor(ev: KeyboardEvent) {
        const destino = teclaNoCampo(ev)
        if (destino === "passar") return
        ev.stopPropagation()
        if (destino === "soltar") {
            ev.preventDefault()
            soltarFoco()
        }
    }
</script>

<div class="chamadas" data-regiao-filho="chamadas">
    {#if !editando}
        <div class="cabeca">
            <span class="titulo">CHAMADAS</span>
            {#if atual}<button type="button" class="link" tabindex="-1" data-acao="editar-chamada" on:mousedown|preventDefault on:click={() => abrirEditor(escolhida)}>editar</button>{/if}
        </div>
        <div class="chips" role="group" aria-label="Chamadas">
            {#each lista as c (c.id)}
                <button type="button" class="chip" class:sel={c.id === escolhida} class:noar={$chamadaNoAr?.id === c.id} tabindex="-1" data-acao="chip-chamada" on:mousedown|preventDefault on:click={() => (escolhida = c.id)}>{c.nome}</button>
            {/each}
            <button type="button" class="chip mais" tabindex="-1" data-acao="nova-chamada" on:mousedown|preventDefault on:click={() => abrirEditor(null)}>+ Chamada</button>
        </div>
        {#if atual}
            {#if campos.length}
                <div class="campos">
                    {#each campos as campo, i (campo)}
                        <label class="campo">
                            <span>{rotuloDoCampo(campo)}</span>
                            <input class="edit" type="text" maxlength={LIMITE_CAMPO} value={v[campo] || ""} data-acao="campo-chamada" on:input={(e) => mudarValor(campo, e.currentTarget.value)} on:keydown={(e) => aoTeclar(e, i === campos.length - 1)} />
                        </label>
                    {/each}
                </div>
            {/if}
            <div class="previa pos-{atual.posicao}" title="Como entra no telão">
                <span class="caixa">{texto}</span>
            </div>
            <div class="linha">
                <select class="dur" bind:value={segundos} tabindex="-1" aria-label="Quanto tempo fica" data-acao="duracao-chamada">
                    {#each DURACOES as d}<option value={d.s}>{d.rotulo}</option>{/each}
                </select>
                <button type="button" class="chamar" tabindex="-1" disabled={!pronta} data-acao="chamar" on:mousedown|preventDefault on:click={chamarAgora}>Chamar no telão</button>
            </div>
        {:else}
            <p class="nota">Nenhuma chamada. Crie uma em “+ Chamada”.</p>
        {/if}
        {#if $chamadaNoAr}
            <div class="noar-linha" data-acao="chamada-no-ar">
                <b>NO AR</b><span class="t" title={$chamadaNoAr.texto}>{$chamadaNoAr.texto}</span>{#if falta}<span class="rel">{falta}</span>{/if}
                <button type="button" class="tirar" tabindex="-1" data-acao="tirar-chamada" on:mousedown|preventDefault on:click={() => $chamadaNoAr && tirarChamada($chamadaNoAr.id)}>Tirar</button>
            </div>
        {/if}
        {#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}
    {:else}
        <div class="cabeca">
            <span class="titulo">{editando.id ? "EDITAR CHAMADA" : "NOVA CHAMADA"}</span>
            <button type="button" class="link" tabindex="-1" on:mousedown|preventDefault on:click={() => (editando = null)}>cancelar</button>
        </div>
        <label class="campo">
            <span>Nome</span>
            <input class="edit" type="text" maxlength="30" bind:value={editando.nome} data-acao="nome-chamada" on:keydown={teclaDoEditor} />
        </label>
        <div class="bloco">
            <span class="rot">Texto — campos entre colchetes viram caixinhas no painel</span>
            <textarea class="edit" rows="2" maxlength="160" bind:value={editando.modelo} placeholder="Pais da criança [número], favor comparecer ao Kids" data-acao="texto-chamada" on:keydown={teclaDoEditor}></textarea>
            <span class="rot">
                {#if camposDoEditor.length}Campos: {#each camposDoEditor as c}<span class="camp">{c}</span>{/each}{:else}Sem campos: a chamada entra sempre igual.{/if}
            </span>
        </div>
        <div class="bloco">
            <span class="rot">Onde aparece no telão</span>
            <div class="seg" role="group">
                {#each POSICOES as p}
                    <button type="button" class:sel={editando.posicao === p.id} tabindex="-1" data-acao="posicao-chamada" on:mousedown|preventDefault on:click={() => editando && (editando.posicao = p.id)}>{p.rotulo}</button>
                {/each}
            </div>
            {#if editando.posicao === "livre"}<span class="rot">Cor, fonte, tamanho e lugar: “Salvar e ajustar” abre a chamada no Editar.</span>{/if}
        </div>
        <div class="bloco">
            <span class="rot">Em quais saídas</span>
            <div class="saidas">
                {#each normais as o (o.id)}
                    <label class="tg"><input type="checkbox" checked={editando.saidas.includes(o.id)} on:change={() => alternarSaida(o.id)} />{o.nome}</label>
                {/each}
            </div>
        </div>
        <div class="linha">
            {#if editando.id}
                {#if confirmarApagar}
                    <button type="button" class="perigo" tabindex="-1" data-acao="apagar-chamada-sim" on:mousedown|preventDefault on:click={apagar}>Apagar</button>
                    <button type="button" class="link" tabindex="-1" on:mousedown|preventDefault on:click={() => (confirmarApagar = false)}>Não</button>
                {:else}
                    <button type="button" class="link" tabindex="-1" data-acao="apagar-chamada" on:mousedown|preventDefault on:click={() => (confirmarApagar = true)}>Apagar</button>
                {/if}
            {/if}
            <span class="esp"></span>
            {#if editando.posicao === "livre"}
                <button type="button" class="secundario" tabindex="-1" disabled={!podeSalvar} data-acao="salvar-ajustar-chamada" on:mousedown|preventDefault on:click={() => salvar("livre")}>Salvar e ajustar</button>
            {/if}
            <button type="button" class="salvar" tabindex="-1" disabled={!podeSalvar} data-acao="salvar-chamada" on:mousedown|preventDefault on:click={() => salvar()}>Salvar</button>
        </div>
    {/if}
</div>

<style>
    .chamadas {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .cabeca {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    .titulo {
        font-size: 12px;
        font-weight: 600;
        color: var(--luz-mudo);
        letter-spacing: 0.04em;
    }
    .link {
        border: 0;
        background: none;
        padding: 0;
        font: inherit;
        font-size: 11px;
        color: var(--luz-texto);
        text-decoration: underline;
        cursor: pointer;
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .chip {
        height: 24px;
        padding: 0 10px;
        border: 1px solid var(--luz-linha);
        border-radius: 12px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 11.5px;
        cursor: pointer;
    }
    .chip.sel {
        background: var(--luz-texto);
        border-color: var(--luz-texto);
        color: var(--luz-tinta);
        font-weight: 600;
    }
    .chip.noar:not(.sel) {
        border-color: var(--luz-vermelho, #e63946);
    }
    .chip.mais {
        border-style: dashed;
        color: var(--luz-mudo);
    }
    .campos {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .campo {
        display: grid;
        grid-template-columns: 76px 1fr;
        align-items: center;
        gap: 6px;
    }
    .campo span,
    .rot {
        font-size: 11px;
        color: var(--luz-mudo);
    }
    input.edit,
    textarea.edit {
        min-width: 0;
        box-sizing: border-box;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
    }
    input.edit {
        height: 30px;
        padding: 0 8px;
    }
    textarea.edit {
        width: 100%;
        padding: 6px 8px;
        resize: none;
    }
    input.edit:focus,
    textarea.edit:focus {
        outline: none;
        border-color: var(--luz-texto);
    }
    .previa {
        position: relative;
        aspect-ratio: 16 / 5;
        border-radius: 4px;
        background: linear-gradient(135deg, #1d3557, #4a3a6b);
        overflow: hidden;
    }
    .caixa {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        background: #e63946;
        color: #fff;
        font-weight: 700;
        font-size: 10.5px;
        line-height: 1.2;
        padding: 3px 6px;
        box-sizing: border-box;
        overflow: hidden;
    }
    .pos-faixa .caixa,
    .pos-livre .caixa {
        left: 0;
        right: 0;
        bottom: 0;
        min-height: 28%;
    }
    .pos-canto .caixa {
        top: 6%;
        right: 3%;
        width: 38%;
        min-height: 40%;
        border-radius: 4px;
        font-size: 9px;
    }
    .pos-centro .caixa {
        top: 22%;
        left: 12%;
        right: 12%;
        bottom: 22%;
        border-radius: 5px;
    }
    .linha {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .esp {
        flex: 1;
    }
    .dur {
        height: 32px;
        border: 1px solid var(--luz-borda);
        border-radius: 6px;
        background: var(--luz-fundo, transparent);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
        padding: 0 4px;
    }
    .chamar {
        flex: 1;
        height: 32px;
        border: 0;
        border-radius: 7px;
        background: #e63946;
        color: #fff;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
    }
    .chamar:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .noar-linha {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 7px;
        background: color-mix(in srgb, #e63946 14%, transparent);
        box-shadow: inset 0 0 0 1px #e63946;
        font-size: 11.5px;
    }
    .noar-linha b {
        color: #e63946;
        font-size: 10.5px;
    }
    .noar-linha .t {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--luz-texto);
    }
    .rel {
        font-variant-numeric: tabular-nums;
        color: var(--luz-texto);
    }
    .tirar,
    .salvar {
        height: 26px;
        padding: 0 12px;
        border: 0;
        border-radius: 6px;
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font: inherit;
        font-size: 12px;
        font-weight: 650;
        cursor: pointer;
    }
    .secundario {
        height: 26px;
        padding: 0 10px;
        border: 1px solid var(--luz-texto);
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .salvar:disabled,
    .secundario:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .perigo {
        height: 26px;
        padding: 0 10px;
        border: 0;
        border-radius: 6px;
        background: #e63946;
        color: #fff;
        font: inherit;
        font-size: 12px;
        font-weight: 650;
        cursor: pointer;
    }
    .bloco {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .camp {
        display: inline-block;
        margin-left: 4px;
        padding: 0 5px;
        border-radius: 4px;
        background: #2a9d8f;
        color: #fff;
        font-size: 11px;
    }
    .seg {
        display: flex;
        gap: 2px;
        padding: 2px;
        border-radius: 7px;
        background: var(--luz-campo, rgba(127, 127, 127, 0.15));
    }
    .seg button {
        flex: 1;
        height: 24px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
    }
    .seg button.sel {
        background: var(--luz-texto);
        color: var(--luz-tinta);
        font-weight: 600;
    }
    .saidas {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .tg {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        padding: 3px 8px;
        border-radius: 12px;
        border: 1px solid var(--luz-linha);
        color: var(--luz-texto);
        cursor: pointer;
    }
    .nota,
    .aviso {
        margin: 0;
        font-size: 11px;
        color: var(--luz-mudo);
    }
    .aviso {
        color: var(--luz-laranja);
    }
</style>
