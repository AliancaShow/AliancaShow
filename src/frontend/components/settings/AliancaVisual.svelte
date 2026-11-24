<script lang="ts">
    // Cabine 6, fatia V1 (board P2): Configuracoes > Visual. Um Visual diz, para cada saida, que modelo veste cada tipo de conteudo
    // ("Sem modelo" ou um modelo) e, para cada saida de retorno, o leiaute do retorno (campo separado, D16). Aqui e onde manda (D13).
    // Tudo vale na hora (nao conta como "alteracao nao salva"; o Descartar nao desfaz): quem escreve e aliancaVisualAplicador.ts.
    // O operador nunca pensa em "estilo" (Andre, 23/nov): a saida que divide estilo ganha um so dela sozinha (copia exata), sem pergunta.
    import { uid } from "uid"
    import { outputs, special, stageShows, styles, templates } from "../../stores"
    import { clone } from "../helpers/array"
    import { aplicarVisualAtivo, ativarVisual, criarVisualNovo, gravarVisuais, mudarCasa, mudarLinha, mudarVisual, visualPendente } from "../../utils/aliancaVisualAplicador"
    import { casaDe, COLUNAS, COLUNAS_EXTRA, divergencias, duplicar, lerVisuais, planoDeEscrita, saidasDeRetorno, saidasNormais, SEM_MODELO, SLIDE, textoDoProblema, type Coluna, type Problema, type Visual } from "../../utils/aliancaVisualLogica"

    // "aprovo tela-visual" (23/nov): como o Look do ProPresenter, o Visual tambem diz QUAIS CAMADAS cada saida mostra (ex.: OBS por NDI sem a
    // camada de fundo: video e imagem de fundo nao vao para ela), o fundo e o modelo da Biblia com 2–4 versoes. Camadas e fundo valem na hora.
    const CAMADAS = [
        { id: "background", rotulo: "Fundo", dica: "vídeos e imagens de fundo" },
        { id: "slide", rotulo: "Texto", dica: "o slide (letra, Bíblia, avisos)" },
        { id: "overlays", rotulo: "Sobreposições", dica: "sobreposições e mensagens" }
    ]
    const TODAS = CAMADAS.map((c) => c.id)
    const camadasDe = (v: Visual | null, id: string): string[] => {
        const l = (v?.saidas?.[id] as any)?.aparencia?.layers
        return Array.isArray(l) ? l : TODAS
    }
    function alternarCamada(saida: string, camada: string) {
        if (!sel) return
        const atuais = camadasDe(sel, saida)
        const novas = atuais.includes(camada) ? atuais.filter((c) => c !== camada) : TODAS.filter((c) => c === camada || atuais.includes(c))
        mudarLinha(sel.id, saida, (l) => (l.aparencia = { ...(l.aparencia || {}), layers: novas }))
    }
    let abertas: { [saida: string]: boolean } = {}
    const aparenciaDe = (v: Visual | null, id: string): any => (v?.saidas?.[id] as any)?.aparencia || {}
    function mudarAparencia(saida: string, campo: string, valor: any) {
        if (!sel) return
        mudarLinha(sel.id, saida, (l) => {
            const a = { ...(l.aparencia || {}) }
            if (valor === undefined) delete a[campo]
            else a[campo] = valor
            l.aparencia = a
        })
    }
    function escolherExtra(e: Event, saida: string, coluna: string) {
        if (!sel) return
        const valor = (e.currentTarget as HTMLSelectElement).value
        mudarLinha(sel.id, saida, (l) => (l[coluna] = valor))
    }
    const nomeDoArquivo = (c: string) =>
        String(c || "")
            .split(/[\\/]/)
            .pop()

    $: lista = lerVisuais($special)
    $: ativoId = $special?.aliancaVisualAtivo || ""
    let selId = ""
    $: if (!lista.some((v) => v.id === selId)) selId = ativoId || lista[0]?.id || ""
    $: sel = lista.find((v) => v.id === selId) || null
    $: ehAtivo = !!sel && sel.id === ativoId

    $: normais = saidasNormais($outputs)
    $: retornos = saidasDeRetorno($outputs)
    $: modelos = Object.entries($templates || {})
        .map(([id, t]: any) => ({ id, nome: t?.name || "modelo sem nome" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    $: leiautes = Object.entries($stageShows || {})
        .map(([id, l]: any) => ({ id, nome: l?.name || "leiaute sem nome" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    $: plano = sel ? planoDeEscrita(sel, $outputs, $styles, $templates, $stageShows) : { escritas: [], problemas: [] as Problema[] }
    $: fora = ehAtivo && sel ? divergencias(sel, $outputs, $styles, $visualPendente.chaves) : []

    const nomeSaida = (id: string) => ($outputs as any)[id]?.name || id
    function problemaDaCasa(p: Problema[], saida: string, coluna: Coluna): string {
        const achado = p.find((x) => x.tipo === "modeloSumiu" && x.saida === saida && x.coluna === coluna)
        return achado ? textoDoProblema(achado, { saida: nomeSaida }) : ""
    }
    const temModelo = (v: Visual | null, id: string) => !!v && COLUNAS.some((c) => casaDe(v, id, c.id) !== SLIDE)

    // ---- escolher uma casa: se a saida divide o estilo, o aplicador da a ela um so dela antes (copia exata), sem perguntar
    function escolher(e: Event, saida: string, coluna: Coluna) {
        if (!sel) return
        mudarCasa(sel.id, saida, coluna, (e.currentTarget as HTMLSelectElement).value)
    }

    function escolherRetorno(e: Event, saida: string) {
        if (!sel) return
        const v = clone(sel) as Visual
        v.retorno[saida] = (e.currentTarget as HTMLSelectElement).value || null
        mudarVisual(v)
    }

    // ---- lista de visuais
    function criar() {
        const v = criarVisualNovo(lista, uid())
        gravarVisuais([...lista, v])
        selId = v.id
    }
    function duplicarSel() {
        if (!sel) return
        const v = duplicar(sel, lista, uid())
        gravarVisuais([...lista, v])
        selId = v.id
    }
    function renomear(e: Event) {
        if (!sel) return
        const alvo = e.currentTarget as HTMLInputElement
        const nome = alvo.value.trim()
        if (!nome) {
            alvo.value = sel.nome
            return
        }
        if (nome !== sel.nome) mudarVisual({ ...sel, nome })
    }
    let apagando = false
    $: if (selId) apagando = false
    function apagar() {
        if (!sel || ehAtivo || lista.length < 2) return
        gravarVisuais(lista.filter((v) => v.id !== sel?.id))
        apagando = false
    }

    // ---- divergencia: reaplicar ou guardar o que esta na saida
    function guardarDoQueEsta() {
        if (!sel) return
        const v = clone(sel) as Visual
        for (const s of normais) {
            const est: any = ($styles as any)[s.estilo] || null
            if (!est) continue
            v.saidas[s.id] = { ...(v.saidas[s.id] || {}) }
            for (const c of COLUNAS) v.saidas[s.id][c.id] = est[c.campo] || SLIDE
        }
        mudarVisual(v)
    }
</script>

<div class="visual" data-acao="visual-pagina">
    <p class="cota">Um Visual diz, para cada saída, que camadas aparecem e que modelo veste cada tipo de conteúdo (como os Looks do ProPresenter). Só um vale por vez; troca-se aqui ou no botão do telão, na barra de cima.</p>

    <div class="corpo">
        <div class="lista" data-acao="visual-lista">
            <div class="rot">VISUAIS</div>
            {#each lista as v (v.id)}
                <div class="card" class:a={v.id === selId} data-visual={v.id}>
                    <button type="button" class="cardNome" tabindex="-1" on:click={() => (selId = v.id)}>
                        <b>{v.nome}</b>
                        {#if v.id === ativoId}<span class="tag valendo">VALENDO</span>{/if}
                    </button>
                    {#if v.id !== ativoId}
                        <button type="button" class="bt" data-acao="visual-usar" tabindex="-1" on:click={() => ativarVisual(v.id)}>Usar este agora</button>
                    {/if}
                </div>
            {/each}
            {#if !lista.length}<p class="cota">Nenhum Visual ainda: ele nasce sozinho quando as configurações terminam de carregar.</p>{/if}
            <button type="button" class="bt fan" data-acao="visual-novo" tabindex="-1" on:click={criar}>+ Novo visual</button>
            {#if sel}<button type="button" class="bt fan" data-acao="visual-duplicar" tabindex="-1" on:click={duplicarSel}>Duplicar “{sel.nome}”</button>{/if}
        </div>

        {#if sel}
            <div class="detalhe">
                <div class="cab">
                    <input class="nome" value={sel.nome} aria-label="Nome do Visual" data-acao="visual-nome" on:change={renomear} on:keydown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
                    {#if ehAtivo}<span class="tag valendo">VALENDO</span>{/if}
                    <span class="cota dir" data-acao="visual-proximo">Modelos valem a partir do próximo slide; camadas e fundo, na hora.</span>
                    {#if !ehAtivo}
                        {#if apagando}
                            <button type="button" class="bt perigo" data-acao="visual-apagar-mesmo" tabindex="-1" on:click={apagar}>Apagar mesmo</button>
                            <button type="button" class="bt" tabindex="-1" on:click={() => (apagando = false)}>Cancelar</button>
                        {:else}
                            <button type="button" class="bt" data-acao="visual-apagar" tabindex="-1" disabled={lista.length < 2} on:click={() => (apagando = true)}>Apagar</button>
                        {/if}
                    {/if}
                </div>

                {#if fora.length}
                    <div class="faixa" data-acao="visual-divergencia">
                        <span>{fora.length === 1 ? "1 campo das saídas não está" : `${fora.length} campos das saídas não estão`} como o Visual diz (algo mudou a aparência por fora; o app refaz sozinho em instantes).</span>
                        <button type="button" class="bt" tabindex="-1" on:click={aplicarVisualAtivo}>Reaplicar o Visual</button>
                        <button type="button" class="bt" tabindex="-1" on:click={guardarDoQueEsta}>Guardar o que está na saída</button>
                    </div>
                {/if}

                <div class="mtz" style="grid-template-columns: minmax(160px, 200px) minmax(150px, 0.8fr) repeat({COLUNAS.length}, minmax(0, 1fr));" data-acao="visual-tabela">
                    <div />
                    <div class="h">CAMADAS</div>
                    {#each COLUNAS as c}<div class="h">{c.rotulo.toUpperCase()}</div>{/each}
                    {#each normais as s (s.id)}
                        <div class="sd" data-saida={s.id}>
                            <b>{s.nome}</b>
                            {#if !($outputs[s.id]?.enabled ?? true)}<small>desligada</small>{/if}
                            <span class="tag">{temModelo(sel, s.id) ? "COM MODELO" : "SEM MODELO"}</span>
                            <button type="button" class="bt fan mini" data-acao="visual-aparencia" tabindex="-1" aria-expanded={!!abertas[s.id]} on:click={() => (abertas = { ...abertas, [s.id]: !abertas[s.id] })}>{abertas[s.id] ? "▾" : "▸"} Aparência</button>
                        </div>
                        <div class="cel camadas" data-camadas={s.id}>
                            {#each CAMADAS as c}
                                {@const ligada = camadasDe(sel, s.id).includes(c.id)}
                                <button type="button" class="chip" class:on={ligada} title="{c.rotulo}: {c.dica}{ligada ? '' : ' (não vai para esta saída)'}" aria-pressed={ligada} tabindex="-1" on:click={() => alternarCamada(s.id, c.id)}>{c.rotulo}</button>
                            {/each}
                        </div>
                        {#each COLUNAS as c}
                            {@const casa = casaDe(sel, s.id, c.id)}
                            {@const prob = problemaDaCasa(plano.problemas, s.id, c.id)}
                            <label class="cel" class:slide={casa === SLIDE} class:prob={!!prob} title={prob} data-casa="{s.id}:{c.id}">
                                <span class="tx">
                                    <b>{casa === SLIDE ? SEM_MODELO : $templates[casa]?.name || "modelo não existe mais"}</b>
                                    {#if prob}<small>{prob}</small>{/if}
                                </span>
                                <select value={casa} aria-label="{s.nome}: {c.rotulo}" on:change={(e) => escolher(e, s.id, c.id)}>
                                    <option value={SLIDE}>{SEM_MODELO}</option>
                                    {#if casa !== SLIDE && !$templates[casa]}<option value={casa}>modelo não existe mais</option>{/if}
                                    {#each modelos as m (m.id)}<option value={m.id}>{m.nome}</option>{/each}
                                </select>
                            </label>
                        {/each}
                        {#if abertas[s.id]}
                            {@const ap = aparenciaDe(sel, s.id)}
                            <div class="aparencia" data-aparencia={s.id}>
                                <label class="campo">
                                    <span>Cor de fundo</span>
                                    <input type="color" value={ap.background && ap.background !== "transparent" ? ap.background : "#000000"} disabled={ap.background === "transparent"} on:change={(e) => mudarAparencia(s.id, "background", e.currentTarget.value)} />
                                    <label class="chk"><input type="checkbox" checked={ap.background === "transparent"} on:change={(e) => mudarAparencia(s.id, "background", e.currentTarget.checked ? "transparent" : "#000000")} /> Transparente (NDI com alpha)</label>
                                </label>
                                <label class="chk"><input type="checkbox" checked={!!ap.clearStyleBackgroundOnText} on:change={(e) => mudarAparencia(s.id, "clearStyleBackgroundOnText", e.currentTarget.checked)} /> Tirar o fundo quando houver texto</label>
                                {#if ap.backgroundImage}
                                    <span class="campo"><span>Imagem de fundo</span><b>{nomeDoArquivo(ap.backgroundImage)}</b><button type="button" class="bt mini" tabindex="-1" on:click={() => mudarAparencia(s.id, "backgroundImage", undefined)}>Tirar</button></span>
                                {/if}
                                {#each COLUNAS_EXTRA as c}
                                    {@const casa = sel?.saidas?.[s.id]?.[c.id] || SLIDE}
                                    <label class="campo">
                                        <span>{c.rotulo}</span>
                                        <select value={casa} on:change={(e) => escolherExtra(e, s.id, c.id)}>
                                            <option value={SLIDE}>Igual à Bíblia</option>
                                            {#if casa !== SLIDE && !$templates[casa]}<option value={casa}>modelo não existe mais</option>{/if}
                                            {#each modelos as m (m.id)}<option value={m.id}>{m.nome}</option>{/each}
                                        </select>
                                    </label>
                                {/each}
                            </div>
                        {/if}
                    {/each}
                </div>
                {#if !normais.length}<p class="cota">Nenhuma saída cadastrada. Crie as saídas em Telas e saídas.</p>{/if}

                <!-- problema de verdade (modelo ou leiaute apagado) aparece na propria casa, em laranja -->
                <div class="sec">LEIAUTE DO RETORNO <small>separado dos modelos: o retorno mostra o leiaute dele</small></div>
                {#if retornos.length}
                    <div class="mtz" style="grid-template-columns: minmax(160px, 200px) minmax(0, 1fr);" data-acao="visual-retorno">
                        {#each retornos as r (r.id)}
                            {@const pedido = sel?.retorno?.[r.id] || ""}
                            {@const sumiu = !!pedido && !$stageShows[pedido]}
                            <div class="sd"><b>{r.nome}</b><span class="tag">LEIAUTE DE RETORNO</span></div>
                            <label class="cel" class:slide={!pedido} class:prob={sumiu} data-retorno={r.id}>
                                <span class="tx">
                                    <b>{pedido ? $stageShows[pedido]?.name || "leiaute não existe mais" : "não muda"}</b>
                                    <small>{sumiu ? "o leiaute foi apagado: o retorno fica como está" : pedido ? "vale para música, Bíblia e aviso" : "fica o leiaute que a saída já tem"}</small>
                                </span>
                                <select value={pedido} aria-label="{r.nome}: leiaute do retorno" on:change={(e) => escolherRetorno(e, r.id)}>
                                    <option value="">não muda</option>
                                    {#if sumiu}<option value={pedido}>leiaute não existe mais</option>{/if}
                                    {#each leiautes as l (l.id)}<option value={l.id}>{l.nome}</option>{/each}
                                </select>
                            </label>
                        {/each}
                    </div>
                {:else}
                    <p class="cota">Nenhuma saída de retorno.</p>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .visual {
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: var(--luz-texto);
    }
    .cota {
        margin: 0;
        font-size: 12px;
        color: var(--luz-mudo);
        line-height: 1.4;
    }
    .cota.dir {
        margin-left: auto;
    }
    .corpo {
        display: flex;
        gap: 24px;
        min-width: 0;
    }
    .lista {
        width: 236px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .rot,
    .sec {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--luz-mudo);
    }
    .sec {
        margin-top: 22px;
        margin-bottom: 8px;
    }
    .sec small {
        font-weight: 500;
        letter-spacing: 0;
        margin-left: 8px;
    }
    .card {
        padding: 10px 12px;
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .card.a {
        background: var(--luz-hover);
        box-shadow: inset 0 0 0 1px var(--luz-borda-forte);
    }
    .cardNome {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .cardNome b {
        font-size: 14px;
        font-weight: 700;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .tag {
        align-self: flex-start;
        height: 18px;
        padding: 0 6px;
        display: inline-flex;
        align-items: center;
        border-radius: var(--luz-raio-selo);
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-borda);
        color: var(--luz-mudo);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        white-space: nowrap;
    }
    .tag.valendo {
        margin-left: auto;
        background: var(--luz-texto);
        color: var(--luz-tinta);
        box-shadow: none;
    }
    .cab .tag.valendo {
        margin-left: 0;
    }
    .bt {
        height: 30px;
        padding: 0 10px;
        align-self: flex-start;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-botao);
        background: var(--luz-campo);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
    }
    .bt:hover {
        background: var(--luz-hover);
    }
    .bt:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .bt.fan {
        border-color: transparent;
        background: transparent;
        color: var(--luz-texto-80);
    }
    .bt.perigo {
        border-color: var(--luz-vermelho);
        background: var(--luz-vermelho);
    }
    .detalhe {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .cab {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    .nome {
        height: 32px;
        min-width: 160px;
        padding: 0 8px;
        border: 1px solid transparent;
        border-radius: var(--luz-raio-campo);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        font-size: 16px;
        font-weight: 700;
    }
    .nome:hover,
    .nome:focus {
        border-color: var(--luz-borda);
        background: var(--luz-campo);
        outline: none;
    }
    .faixa {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 10px;
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-laranja-lavagem);
        box-shadow: inset 0 0 0 1px var(--luz-laranja-borda);
        font-size: 12px;
        color: var(--luz-texto);
    }
    .faixa > span {
        flex: 1;
        min-width: 200px;
    }
    .mtz {
        display: grid;
        gap: 8px;
        align-items: stretch;
    }
    .mtz .h {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--luz-mudo);
        padding: 0 2px;
        align-self: end;
    }
    .sd {
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        min-width: 0;
    }
    .sd b {
        font-size: 14px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .sd small {
        font-size: 11.5px;
        color: var(--luz-mudo);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .cel {
        position: relative;
        border-radius: var(--luz-raio-cartao);
        border: 1px solid var(--luz-borda);
        background: var(--luz-campo);
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        cursor: pointer;
    }
    .cel.slide {
        border-style: dashed;
        background: transparent;
    }
    .cel.prob {
        box-shadow: 0 0 0 2px var(--luz-laranja);
    }
    .cel .tx {
        min-width: 0;
    }
    .cel .tx b {
        display: block;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .cel.slide .tx b {
        font-weight: 500;
        color: var(--luz-texto-80);
    }
    .cel .tx small {
        display: block;
        font-size: 11px;
        color: var(--luz-mudo);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .cel.prob .tx small {
        color: var(--luz-laranja);
    }
    .bt.mini {
        height: 22px;
        padding: 0 6px;
        font-size: 11px;
    }
    .cel.camadas {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        cursor: default;
    }
    .chip {
        height: 24px;
        padding: 0 8px;
        border: 1px dashed var(--luz-borda);
        border-radius: var(--luz-raio-selo);
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 11.5px;
        text-decoration: line-through;
        cursor: pointer;
    }
    .chip.on {
        border-style: solid;
        background: var(--luz-hover);
        color: var(--luz-texto);
        text-decoration: none;
    }
    .aparencia {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 10px 18px;
        align-items: center;
        padding: 10px 12px;
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-trilho);
        font-size: 12px;
    }
    .aparencia .campo {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .aparencia .campo select {
        width: 180px;
    }
    .aparencia .chk {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    select {
        height: 28px;
        width: 100%;
        padding: 0 6px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-campo);
        background: var(--luz-pop-opaco);
        color: var(--luz-texto);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
</style>
