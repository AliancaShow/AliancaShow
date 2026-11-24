<script lang="ts">
    // Cabine 6, fatia V1 (board P2): Configuracoes > Visual. Um Visual diz, para cada saida, que modelo veste cada tipo de conteudo
    // ("Sem modelo" ou um modelo) e, para cada saida de retorno, o leiaute do retorno (campo separado, D16). Aqui e onde manda (D13).
    // Tudo vale na hora (nao conta como "alteracao nao salva"; o Descartar nao desfaz): quem escreve e aliancaVisualAplicador.ts.
    // O operador nunca pensa em "estilo" (Andre, 23/nov): a saida que divide estilo ganha um so dela sozinha (copia exata), sem pergunta.
    import { uid } from "uid"
    import Icon from "../helpers/Icon.svelte"
    import { indiceDaLetra } from "../../utils/aliancaTextoLigadoLogica"
    import AliancaEscolha from "./AliancaEscolha.svelte"
    import { outputs, special, stageShows, styles, templates } from "../../stores"
    import { clone } from "../helpers/array"
    import { aplicarVisualAtivo, ativarVisual, criarVisualNovo, gravarVisuais, mudarCasa, mudarLinha, mudarVisual, visualPendente } from "../../utils/aliancaVisualAplicador"
    import { casaDe, COLUNAS, divergencias, duplicar, lerVisuais, planoDeEscrita, saidasDeRetorno, saidasNormais, SEM_MODELO, SLIDE, textoDoProblema, type Coluna, type Problema, type Visual } from "../../utils/aliancaVisualLogica"

    // "aprovo tela-visual" (23/nov): como o Look do ProPresenter, o Visual tambem diz QUAIS CAMADAS cada saida mostra (ex.: OBS por NDI sem a
    // camada de fundo: video e imagem de fundo nao vao para ela), o fundo e o modelo da Biblia com 2–4 versoes. Camadas e fundo valem na hora.
    // desenho v4 ("fechou", 24/nov): os mesmos icones e teclas dos botoes de limpar
    const CAMADAS = [
        { id: "background", rotulo: "Fundo", tecla: "F1", icone: "image" },
        { id: "slide", rotulo: "Texto", tecla: "F2", icone: "slide" },
        { id: "overlays", rotulo: "Avisos", tecla: "F3", icone: "overlays" }
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
    // mini monitor: a caixa LETRA do modelo de musica (mesma regra do telao) em % da tela; sem modelo, no centro
    function caixaDaLetra(modeloId: string, todos: any): { l: number; t: number; w: number; h: number } | null {
        const itens = modeloId && modeloId !== SLIDE ? todos?.[modeloId]?.items : null
        if (!Array.isArray(itens)) return null
        const i = indiceDaLetra({ emModelo: true, itens })
        const estilo = String(itens[i]?.style || "")
        const px = (k: string) => Number(estilo.match(new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*(-?[\\d.]+)px`))?.[1])
        const [l, t, w, h] = [px("left") / 19.2, px("top") / 10.8, px("width") / 19.2, px("height") / 10.8]
        if (![l, t, w, h].every((n) => Number.isFinite(n)) || w <= 0 || h <= 0) return null
        const c = (n: number) => Math.max(0, Math.min(100, n))
        return { l: c(l), t: c(t), w: Math.min(c(w), 100 - c(l)), h: Math.min(c(h), 100 - c(t)) }
    }
    const resolucao = (id: string) => {
        const b = ($outputs as any)[id]?.bounds
        return b?.width && b?.height ? `${Math.round(b.width)}×${Math.round(b.height)}` : ""
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
        .map(([id, l]: any) => ({ id, nome: l?.name || "modelo de retorno sem nome" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    $: plano = sel ? planoDeEscrita(sel, $outputs, $styles, $templates, $stageShows) : { escritas: [], problemas: [] as Problema[] }
    $: fora = ehAtivo && sel ? divergencias(sel, $outputs, $styles, $visualPendente.chaves) : []

    const nomeSaida = (id: string) => ($outputs as any)[id]?.name || id
    function problemaDaCasa(p: Problema[], saida: string, coluna: Coluna): string {
        const achado = p.find((x) => x.tipo === "modeloSumiu" && x.saida === saida && x.coluna === coluna)
        return achado ? textoDoProblema(achado, { saida: nomeSaida }) : ""
    }

    // ---- escolher uma casa (mudarCasa): se a saida divide o estilo, o aplicador da a ela um so dela antes (copia exata), sem perguntar
    function escolherRetorno(valor: string, saida: string) {
        if (!sel) return
        const v = clone(sel) as Visual
        v.retorno[saida] = valor || null
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

                <div class="linhas" data-acao="visual-tabela">
                    {#each normais as s (s.id)}
                        {@const ap = aparenciaDe(sel, s.id)}
                        {@const camadas = camadasDe(sel, s.id)}
                        {@const letra = caixaDaLetra(casaDe(sel, s.id, "musica"), $templates)}
                        {@const desligada = !($outputs[s.id]?.enabled ?? true)}
                        <div class="linha" data-saida={s.id}>
                            <div class="principal">
                                <div class="mon" title="Prévia: como esta saída mostra uma música">
                                    <div class="mFundo" class:off={!camadas.includes("background")} class:transp={ap.background === "transparent"} style={ap.background && ap.background !== "transparent" && !ap.backgroundImage ? `background:${ap.background}` : ""} />
                                    <div class="mTexto" class:off={!camadas.includes("slide")} style={letra ? `left:${letra.l}%;top:${letra.t}%;width:${letra.w}%;height:${letra.h}%;` : ""}>
                                        <i style="width:78%" /><i style="width:58%" />
                                    </div>
                                    <div class="mAviso" class:off={!camadas.includes("overlays")} />
                                </div>
                                <div class="meio">
                                    <div class="topo">
                                        <b>{s.nome}</b>
                                        <small>{desligada ? "desligada" : resolucao(s.id)}</small>
                                        <div class="camadas" data-camadas={s.id}>
                                            {#each CAMADAS as c}
                                                {@const ligada = camadas.includes(c.id)}
                                                <button type="button" class="cam" class:no={!ligada} title="{c.rotulo} ({c.tecla}): {ligada ? 'aparece' : 'não aparece'} nesta saída" aria-pressed={ligada} tabindex="-1" on:click={() => alternarCamada(s.id, c.id)}>
                                                    <Icon id={c.icone} size={0.85} white />
                                                </button>
                                            {/each}
                                        </div>
                                    </div>
                                    <div class="escolhas">
                                        {#each COLUNAS as c}
                                            <AliancaEscolha rotulo={c.id === "musica" ? "Música" : c.rotulo} valor={casaDe(sel, s.id, c.id)} opcoes={modelos} neutra={{ id: SLIDE, nome: SEM_MODELO }} problema={problemaDaCasa(plano.problemas, s.id, c.id)} acao="casa-{s.id}-{c.id}" on:escolher={(e) => sel && mudarCasa(sel.id, s.id, c.id, e.detail)} />
                                        {/each}
                                    </div>
                                </div>
                                <button type="button" class="eng" class:on={!!abertas[s.id]} title="Mais ajustes" data-acao="visual-aparencia" aria-expanded={!!abertas[s.id]} tabindex="-1" on:click={() => (abertas = { ...abertas, [s.id]: !abertas[s.id] })}>
                                    <Icon id="settings" size={0.9} white />
                                </button>
                            </div>
                            {#if abertas[s.id]}
                                <div class="ajustes" data-aparencia={s.id}>
                                    <label class="aj" title="Cor quando não há imagem nem vídeo de fundo">
                                        <span>Cor de fundo</span>
                                        <span class="bolinha" class:transp={ap.background === "transparent"} style="background:{ap.background && ap.background !== 'transparent' ? ap.background : '#000000'}">
                                            <input type="color" value={ap.background && ap.background !== "transparent" ? ap.background : "#000000"} disabled={ap.background === "transparent"} on:change={(e) => mudarAparencia(s.id, "background", e.currentTarget.value)} />
                                        </span>
                                    </label>
                                    <button type="button" class="aj" title="Para NDI / OBS sobrepor no vídeo" tabindex="-1" on:click={() => mudarAparencia(s.id, "background", ap.background === "transparent" ? "#000000" : "transparent")}>
                                        <span>Fundo transparente</span><i class="chave" class:on={ap.background === "transparent"} />
                                    </button>
                                    <button type="button" class="aj" title="Tira o fundo do estilo enquanto há letra na tela" tabindex="-1" on:click={() => mudarAparencia(s.id, "clearStyleBackgroundOnText", !ap.clearStyleBackgroundOnText)}>
                                        <span>Sem fundo com letra</span><i class="chave" class:on={!!ap.clearStyleBackgroundOnText} />
                                    </button>
                                    {#if ap.backgroundImage}
                                        <button type="button" class="aj" title={ap.backgroundImage} tabindex="-1" on:click={() => mudarAparencia(s.id, "backgroundImage", undefined)}>
                                            <span>Imagem: {nomeDoArquivo(ap.backgroundImage)}</span><small>Tirar</small>
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}

                    {#each retornos as r (r.id)}
                        {@const pedido = sel?.retorno?.[r.id] || ""}
                        {@const sumiu = !!pedido && !$stageShows[pedido]}
                        <div class="linha" data-retorno={r.id}>
                            <div class="principal">
                                <div class="mon retorno" title="Monitor de retorno: mostra o modelo de retorno inteiro">
                                    <div class="r1" />
                                    <div class="r2" />
                                    <div class="r3" />
                                </div>
                                <div class="meio">
                                    <div class="topo"><b>{r.nome}</b><small>retorno</small></div>
                                    <div class="escolhas">
                                        <AliancaEscolha rotulo="Modelo" valor={pedido} opcoes={leiautes} neutra={{ id: "", nome: "Não muda" }} problema={sumiu ? "o modelo de retorno foi apagado: o retorno fica como está" : ""} acao="retorno-{r.id}" on:escolher={(e) => escolherRetorno(e.detail, r.id)} />
                                        <span />
                                    </div>
                                </div>
                                <span class="eng vazio" />
                            </div>
                        </div>
                    {/each}
                </div>
                {#if !normais.length && !retornos.length}<p class="cota">Nenhuma saída cadastrada. Crie as saídas em Telas e saídas.</p>{/if}
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
    .rot {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--luz-mudo);
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
    .linhas {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: 760px;
    }
    .linha {
        border-radius: var(--luz-raio-cartao);
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
    }
    .principal {
        display: grid;
        grid-template-columns: 112px minmax(0, 1fr) 28px;
        gap: 14px;
        align-items: center;
        padding: 9px 10px 9px 9px;
    }
    .mon {
        position: relative;
        width: 112px;
        aspect-ratio: 16 / 9;
        border-radius: 4px;
        overflow: hidden;
        background: #000;
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.08),
            0 1px 3px rgba(0, 0, 0, 0.35);
    }
    .mFundo {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #1d3557, #6a4c93 60%, #e07a5f);
        transition: opacity 0.2s;
    }
    .mFundo.transp,
    .bolinha.transp {
        background: repeating-conic-gradient(#4a4a4a 0 25%, #2e2e2e 0 50%) 0 0 / 8px 8px !important;
    }
    .mTexto {
        position: absolute;
        left: 8%;
        top: 30%;
        width: 84%;
        height: 40%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        transition: opacity 0.2s;
    }
    .mTexto i {
        height: 3.5px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.92);
    }
    .mAviso {
        position: absolute;
        right: 3px;
        top: 3px;
        width: 22px;
        height: 7px;
        border-radius: 2px;
        background: var(--luz-vermelho);
        transition: opacity 0.2s;
    }
    .off {
        opacity: 0;
    }
    .mon.retorno {
        display: grid;
        grid-template-columns: 2fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 3px;
        padding: 4px;
        box-sizing: border-box;
    }
    .mon.retorno div {
        border: 1px dashed #666;
        border-radius: 2px;
    }
    .mon.retorno .r1 {
        grid-row: span 2;
        border-color: #aaa;
    }
    .meio {
        display: flex;
        flex-direction: column;
        gap: 7px;
        min-width: 0;
    }
    .topo {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
        white-space: nowrap;
    }
    .topo b {
        font-size: 13px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .topo small {
        font-size: 10.5px;
        color: var(--luz-mudo);
        font-variant-numeric: tabular-nums;
    }
    .camadas {
        display: flex;
        gap: 1px;
        margin-left: auto;
        align-self: center;
        padding: 2px;
        border-radius: 6px;
        background: var(--luz-campo);
    }
    .cam {
        width: 24px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 4px;
        background: var(--luz-hover);
        cursor: pointer;
        padding: 0;
    }
    .cam.no {
        opacity: 0.35;
        background: transparent;
    }
    .escolhas {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 6px;
    }
    .eng {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 6px;
        background: var(--luz-campo);
        opacity: 0.9;
        cursor: pointer;
        padding: 0;
    }
    .eng:hover,
    .eng.on {
        opacity: 1;
        background: var(--luz-hover);
    }
    .eng.vazio {
        visibility: hidden;
    }
    .ajustes {
        display: flex;
        gap: 6px;
        padding: 0 10px 9px 135px;
    }
    .aj {
        flex: 1;
        min-width: 0;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 8px;
        border: 1px solid var(--luz-linha);
        border-radius: 6px;
        background: transparent;
        color: var(--luz-texto-80);
        font: inherit;
        font-size: 11.5px;
        white-space: nowrap;
        cursor: pointer;
    }
    .aj:hover {
        background: var(--luz-campo);
    }
    .aj > span:first-child {
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .aj small {
        color: var(--luz-mudo);
        font-size: 11px;
    }
    .bolinha {
        position: relative;
        flex: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        box-shadow: 0 0 0 1px var(--luz-borda);
        overflow: hidden;
    }
    .bolinha input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
    }
    .chave {
        flex: none;
        position: relative;
        width: 26px;
        height: 15px;
        border-radius: 8px;
        background: var(--luz-borda);
        transition: background 0.15s;
    }
    .chave::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #fff;
        transition: left 0.15s;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
    }
    .chave.on {
        background: var(--luz-verde);
    }
    .chave.on::after {
        left: 13px;
    }
</style>
