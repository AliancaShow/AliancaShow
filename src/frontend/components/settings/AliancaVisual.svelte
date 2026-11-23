<script lang="ts">
    // Cabine 6, fatia V1 (board P2): Configuracoes > Visual. Um Visual diz, para cada saida, que modelo veste cada tipo de conteudo
    // ("usa o slide" ou um modelo) e, para cada saida de retorno, o leiaute do retorno (campo separado, D16). Aqui e onde manda (D13).
    // Tudo vale na hora (nao conta como "alteracao nao salva"; o Descartar nao desfaz): quem escreve e aliancaVisualAplicador.ts.
    import { uid } from "uid"
    import { outputs, special, stageShows, styles, templates } from "../../stores"
    import { clone } from "../helpers/array"
    import { aplicarVisualAtivo, ativarVisual, darEstiloProprio, gravarVisuais, mudarVisual, visualPendente } from "../../utils/aliancaVisualAplicador"
    import { casaDe, COLUNAS, divergencias, duplicar, lerVisuais, novoVisual, planoDeEscrita, precisaDeEstiloProprio, saidasDeRetorno, saidasNormais, SLIDE, textoDoProblema, type Casa, type Coluna, type Problema, type Visual } from "../../utils/aliancaVisualLogica"

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
    $: fora = ehAtivo && sel ? divergencias(sel, $outputs, $styles, $visualPendente.chaves).filter((e) => !plano.problemas.some((p) => p.tipo === "estiloDividido" && p.estilo === e.estilo)) : []

    const nomeSaida = (id: string) => ($outputs as any)[id]?.name || id
    const nomeEstilo = (id: string) => ($styles as any)[id]?.name || "estilo sem nome"
    function problemaDaCasa(p: Problema[], saida: string, coluna: Coluna): string {
        const achado = p.find((x) => (x.tipo === "estiloDividido" ? x.saidas.includes(saida) && x.coluna === coluna : x.tipo !== "leiauteSumiu" && x.saida === saida && x.coluna === coluna))
        return achado ? textoDoProblema(achado, { saida: nomeSaida }) : ""
    }
    const temModelo = (v: Visual | null, id: string) => !!v && COLUNAS.some((c) => casaDe(v, id, c.id) !== SLIDE)

    // ---- escolher uma casa (com a pergunta do estilo proprio quando a saida divide o estilo ou nao tem)
    let confirmar: { saida: string; coluna: Coluna; casa: Casa; motivo: "semEstilo" | "dividido" } | null = null
    function gravarCasa(saida: string, coluna: Coluna, casa: Casa) {
        if (!sel) return
        const v = clone(sel) as Visual
        v.saidas[saida] = { ...(v.saidas[saida] || {}), [coluna]: casa }
        mudarVisual(v)
    }
    function escolher(e: Event, saida: string, coluna: Coluna) {
        if (!sel) return
        const alvo = e.currentTarget as HTMLSelectElement
        const casa = alvo.value
        const motivo = precisaDeEstiloProprio(sel, $outputs, $styles, saida, coluna, casa)
        if (motivo) {
            // a casa so muda depois do "sim": o seletor volta ao que estava enquanto a pergunta esta aberta
            alvo.value = casaDe(sel, saida, coluna)
            confirmar = { saida, coluna, casa, motivo }
            return
        }
        confirmar = null
        gravarCasa(saida, coluna, casa)
    }
    function confirmarEstilo() {
        if (!confirmar) return
        const c = confirmar
        confirmar = null
        if (!darEstiloProprio(c.saida)) return
        gravarCasa(c.saida, c.coluna, c.casa)
    }
    $: compartilham = estiloDe(confirmar?.saida) ? normais.filter((s) => s.id !== confirmar?.saida && s.estilo === estiloDe(confirmar?.saida)).map((s) => s.nome) : []
    const estiloDe = (id: string | undefined): string => (id ? ($outputs as any)[id]?.style || "" : "")

    function escolherRetorno(e: Event, saida: string) {
        if (!sel) return
        const v = clone(sel) as Visual
        v.retorno[saida] = (e.currentTarget as HTMLSelectElement).value || null
        mudarVisual(v)
    }

    // ---- lista de visuais
    function criar() {
        const v = novoVisual(lista, $outputs, uid())
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
    $: esperando = [...$visualPendente.saidas].map(nomeSaida)
</script>

<div class="visual" data-acao="visual-pagina">
    <p class="cota">Um Visual diz, para cada saída, que modelo veste cada tipo de conteúdo. Só um vale por vez; troca-se aqui ou na pílula da barra de cima.</p>

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
                    <span class="cota dir">Mudou uma casa? Vale no próximo slide que for ao ar.</span>
                    {#if !ehAtivo}
                        {#if apagando}
                            <button type="button" class="bt perigo" data-acao="visual-apagar-mesmo" tabindex="-1" on:click={apagar}>Apagar mesmo</button>
                            <button type="button" class="bt" tabindex="-1" on:click={() => (apagando = false)}>Cancelar</button>
                        {:else}
                            <button type="button" class="bt" data-acao="visual-apagar" tabindex="-1" disabled={lista.length < 2} on:click={() => (apagando = true)}>Apagar</button>
                        {/if}
                    {/if}
                </div>

                {#if ehAtivo && esperando.length}
                    <p class="nota" data-acao="visual-esperando">Entra no próximo slide em: {esperando.join(", ")}</p>
                {/if}

                {#if fora.length}
                    <div class="faixa" data-acao="visual-divergencia">
                        <span>{fora.length === 1 ? "1 campo das saídas não está" : `${fora.length} campos das saídas não estão`} como o Visual diz (alguém mexeu em “Estilo da saída”).</span>
                        <button type="button" class="bt" tabindex="-1" on:click={aplicarVisualAtivo}>Reaplicar o Visual</button>
                        <button type="button" class="bt" tabindex="-1" on:click={guardarDoQueEsta}>Guardar o que está na saída</button>
                    </div>
                {/if}

                <div class="mtz" style="grid-template-columns: minmax(160px, 200px) repeat({COLUNAS.length}, minmax(0, 1fr));" data-acao="visual-tabela">
                    <div />
                    {#each COLUNAS as c}<div class="h">{c.rotulo.toUpperCase()}</div>{/each}
                    {#each normais as s (s.id)}
                        <div class="sd" data-saida={s.id}>
                            <b>{s.nome}</b>
                            <small>{s.estilo && $styles[s.estilo] ? `estilo: ${nomeEstilo(s.estilo)}` : "sem estilo próprio"}{($outputs[s.id]?.enabled ?? true) ? "" : " · desligada"}</small>
                            <span class="tag">{temModelo(sel, s.id) ? "APLICA MODELO PRÓPRIO" : "SLIDE COMO FOI FEITO"}</span>
                        </div>
                        {#each COLUNAS as c}
                            {@const casa = casaDe(sel, s.id, c.id)}
                            {@const prob = problemaDaCasa(plano.problemas, s.id, c.id)}
                            <label class="cel" class:slide={casa === SLIDE} class:prob={!!prob} title={prob} data-casa="{s.id}:{c.id}">
                                <span class="tx">
                                    <b>{casa === SLIDE ? "usa o slide" : $templates[casa]?.name || "modelo não existe mais"}</b>
                                    <small>{prob || (casa === SLIDE ? "como foi feito, com ajustes à mão" : "por cima do estilo do slide")}</small>
                                </span>
                                <select value={casa} aria-label="{s.nome}: {c.rotulo}" on:change={(e) => escolher(e, s.id, c.id)}>
                                    <option value={SLIDE}>usa o slide</option>
                                    {#if casa !== SLIDE && !$templates[casa]}<option value={casa}>modelo não existe mais</option>{/if}
                                    {#each modelos as m (m.id)}<option value={m.id}>{m.nome}</option>{/each}
                                </select>
                            </label>
                        {/each}
                    {/each}
                </div>
                {#if !normais.length}<p class="cota">Nenhuma saída cadastrada. Crie as saídas em Telas e saídas.</p>{/if}

                {#if confirmar}
                    <div class="faixa" data-acao="visual-estilo-proprio">
                        <span>
                            {#if confirmar.motivo === "dividido"}
                                {nomeSaida(confirmar.saida)} divide o estilo “{nomeEstilo($outputs[confirmar.saida]?.style || "")}” com {compartilham.join(", ")}. Para valer outro modelo só nela, ela precisa de um estilo próprio (cópia deste).
                            {:else}
                                {nomeSaida(confirmar.saida)} não tem estilo próprio, e é nele que o modelo fica. Criar um estilo só para ela?
                            {/if}
                        </span>
                        <button type="button" class="bt" data-acao="visual-estilo-proprio-sim" tabindex="-1" on:click={confirmarEstilo}>Criar estilo próprio e usar</button>
                        <button type="button" class="bt" tabindex="-1" on:click={() => (confirmar = null)}>Cancelar</button>
                    </div>
                {/if}

                {#if plano.problemas.length}
                    <div class="problemas" data-acao="visual-problemas">
                        {#each plano.problemas as p}
                            <div class="faixa">
                                <span>{textoDoProblema(p, { saida: nomeSaida })}</span>
                                {#if p.tipo === "estiloDividido"}
                                    {#each p.saidas as id}<button type="button" class="bt" tabindex="-1" on:click={() => darEstiloProprio(id)}>Dar estilo próprio a {nomeSaida(id)}</button>{/each}
                                {:else if p.tipo === "semEstilo"}
                                    <button type="button" class="bt" tabindex="-1" on:click={() => darEstiloProprio(p.saida)}>Criar estilo para {nomeSaida(p.saida)}</button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

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
    .nota {
        margin: 0;
        font-size: 12px;
        color: var(--luz-texto);
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
    .problemas {
        display: flex;
        flex-direction: column;
        gap: 6px;
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
