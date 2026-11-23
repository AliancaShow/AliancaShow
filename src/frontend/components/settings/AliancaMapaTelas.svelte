<script lang="ts">
    // Configuracoes > Telas e saidas (C4): "Onde esta cada tela" (mapa) e "Todas as saidas" (lista). A tela vermelha e a que a saida ESCOLHIDA ocupa.
    // Clicar numa tela NAO move: abre uma confirmacao no proprio mapa ("Mover Telao para Monitor 2?"), com o botao Mover em outro pixel e inerte por ~1 s.
    // Depois de mover, "Desfazer" por 10 s restaura a tela anterior. Recusa em voz alta a tela da cabine, tela ocupada, saida so de rede e saida com posicao travada.
    import { onDestroy, onMount } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { currentOutputSettings, outputDisplay, outputs, stageShows } from "../../stores"
    import { estadoDaSaida, ordenarTelas, podeMover, resumoDaSaida, rotuloDaTela, tamanhoProprio, telaDaCabine, type TelaDoSistema } from "../../utils/aliancaSaidasLogica"
    import { send } from "../../utils/request"
    import { clone, keysToID, sortByName, sortObject } from "../helpers/array"

    let telas: TelaDoSistema[] = []
    async function lerTelas(): Promise<TelaDoSistema[]> {
        // gancho so de DEV para a fumaca (t13): telas falsas no lugar das reais, para provar o mover sem um segundo monitor; sai do build de producao
        const falsas = import.meta.env.DEV ? (globalThis as any).__telasDoSistemaFalsas : undefined
        telas = ordenarTelas((falsas || (await requestMain(Main.GET_DISPLAYS)) || []) as TelaDoSistema[])
        return telas
    }
    onMount(lerTelas)

    $: escolhida = $currentOutputSettings || ""
    $: lista = sortObject(sortByName(keysToID($outputs)), "stageOutput")

    // largura/altura do mapa: cada tela proporcional ao tamanho real, a maior cabe em 112 x 63 (a "1080p" do desenho)
    const BASE = 112
    $: maior = Math.max(1, ...telas.map((t) => t.bounds.width))
    const tamanho = (t: TelaDoSistema) => ({ w: Math.round((t.bounds.width / maior) * BASE), h: Math.round((t.bounds.height / maior) * BASE) })

    const cabine = (ts: TelaDoSistema[]) => telaDaCabine(ts, typeof window !== "undefined" ? { x: window.screenX + window.outerWidth / 2, y: window.screenY + window.outerHeight / 2 } : null)

    // cabine 6 ("aprovo monitor-desconectado"): saida de tamanho proprio (o LED 896x320) vai para o CANTO da tela, mantendo o tamanho
    type Pedido = { tela: TelaDoSistema; numero: number; saidaId: string; nome: string; tamanho: string }
    let pedido: Pedido | null = null
    let pronto = false
    let recusa = ""
    let desfazer: { saidaId: string; nome: string; bounds: any; screen: any; tinhaScreen: boolean; aliancaMonitor: any } | null = null
    let tPronto: ReturnType<typeof setTimeout> | null = null
    let tRecusa: ReturnType<typeof setTimeout> | null = null
    let tDesfazer: ReturnType<typeof setTimeout> | null = null
    const limpar = (t: ReturnType<typeof setTimeout> | null) => t && clearTimeout(t)

    function recusar(texto: string) {
        pedido = null
        recusa = texto
        limpar(tRecusa)
        tRecusa = setTimeout(() => (recusa = ""), 8000)
    }

    /** clicar numa tela: valida e PEDE confirmacao (nunca move) */
    async function pedir(t: TelaDoSistema) {
        recusa = ""
        const ts = await lerTelas() // o mapa nao fica velho: le as telas de novo no clique
        const tela = ts.find((x) => String(x.id) === String(t.id))
        if (!tela) return recusar("Essa tela não está mais ligada.")
        const v = podeMover(escolhida, $outputs as any, tela, ts, cabine(ts))
        if (!v.ok) return recusar(v.motivo)
        const numero = ts.findIndex((x) => String(x.id) === String(tela.id)) + 1
        const s: any = $outputs[escolhida]
        pedido = { tela, numero, saidaId: escolhida, nome: s?.name || "Saída", tamanho: tamanhoProprio(s || {}, tela) ? `${s.bounds.width}×${s.bounds.height}` : "" }
        pronto = false
        limpar(tPronto)
        tPronto = setTimeout(() => (pronto = true), 1000)
    }
    function cancelar() {
        pedido = null
        pronto = false
        limpar(tPronto)
    }
    // trocar de saida com um pedido aberto cancela o pedido (ele era para a outra)
    $: if (pedido && pedido.saidaId !== escolhida) cancelar()

    async function confirmar() {
        if (!pedido || !pronto) return
        const { saidaId, tela: alvo } = pedido
        const ts = await lerTelas()
        const tela = ts.find((x) => String(x.id) === String(alvo.id))
        const v = tela ? podeMover(saidaId, $outputs as any, tela, ts, cabine(ts)) : ({ ok: false, motivo: "Essa tela não está mais ligada." } as const)
        if (!tela || !v.ok) return recusar(v.ok ? "" : v.motivo)
        const antes = $outputs[saidaId]
        desfazer = { saidaId, nome: antes?.name || "Saída", bounds: clone(antes?.bounds), screen: antes?.screen, tinhaScreen: antes?.screen !== undefined, aliancaMonitor: clone((antes as any)?.aliancaMonitor ?? null) }
        // tamanho proprio: no canto da tela, mesmo tamanho, sem screen (o vigia carimba o monitor); senao, a tela inteira (screen)
        if (tamanhoProprio((antes as any) || {}, tela)) aplicar(saidaId, { x: tela.bounds.x, y: tela.bounds.y, width: antes!.bounds!.width, height: antes!.bounds!.height }, null)
        else aplicar(saidaId, { x: tela.bounds.x, y: tela.bounds.y, width: tela.bounds.width, height: tela.bounds.height }, tela.id.toString())
        cancelar()
        limpar(tDesfazer)
        tDesfazer = setTimeout(() => (desfazer = null), 10000)
    }

    /** a mesma troca do popup "Tela de saida" (bounds + screen + UPDATE_BOUNDS); nao liga janela que estava desligada */
    function aplicar(id: string, bounds: any, screen: any, aliancaMonitor?: any) {
        outputs.update((a: any) => {
            if (!a[id]) return a
            if (aliancaMonitor !== undefined) a[id].aliancaMonitor = aliancaMonitor
            if (bounds === undefined) delete a[id].bounds
            else a[id].bounds = bounds
            if (screen === undefined) delete a[id].screen
            else a[id].screen = screen
            return a
        })
        if ($outputs[id]?.enabled) setTimeout(() => send(OUTPUT, ["UPDATE_BOUNDS"], { id, ...$outputs[id] }), 100)
    }

    function desfazerMover() {
        if (!desfazer) return
        const { saidaId, bounds, screen, aliancaMonitor } = desfazer
        aplicar(saidaId, bounds, screen, aliancaMonitor)
        desfazer = null
        limpar(tDesfazer)
    }
    onDestroy(() => {
        limpar(tPronto)
        limpar(tRecusa)
        limpar(tDesfazer)
    })
</script>

<aside class="lado" data-acao="saidas-mapa">
    <div class="rot">ONDE ESTÁ CADA TELA</div>
    <div class="mapa" data-acao="saidas-mapa-telas">
        {#each telas as t, i (t.id)}
            {@const r = rotuloDaTela(t, $outputs, escolhida)}
            {@const m = tamanho(t)}
            <button type="button" class="tela" class:minha={r.ocupadaPelaEscolhida} class:alvo={pedido && String(pedido.tela.id) === String(t.id)} style="width: {m.w}px; height: {m.h}px;" data-tela={t.id} data-numero={i + 1} tabindex="-1" disabled={!escolhida} on:click={() => pedir(t)}>
                <b>{i + 1}</b>
                {r.nome}
                {#if t.label}<small class="aparelho" data-acao="saidas-mapa-aparelho">{t.label}</small>{/if}
            </button>
        {/each}
        {#if !telas.length}<span class="cota">Procurando as telas…</span>{/if}
    </div>
    {#if pedido}
        <div class="confirma" data-acao="saidas-mapa-confirma" role="alertdialog" aria-label="Confirmar mover a saída">
            <span class="q"
                >Mover <b>{pedido.nome}</b> para {#if pedido.tamanho}o canto do
                {/if}Monitor {pedido.numero}{pedido.tela.label ? ` (${pedido.tela.label})` : ""}{#if pedido.tamanho}, mantendo {pedido.tamanho}{/if}?</span
            >
            <button type="button" class="mover" data-acao="saidas-mapa-mover" tabindex="-1" disabled={!pronto} on:click={confirmar}>Mover</button>
            <button type="button" class="cancela" data-acao="saidas-mapa-cancelar" tabindex="-1" on:click={cancelar}>Cancelar</button>
        </div>
    {/if}
    {#if recusa}
        <p class="recusa" data-acao="saidas-mapa-recusa" role="alert">{recusa}</p>
    {/if}
    {#if desfazer}
        <div class="desfaz" data-acao="saidas-mapa-desfazer-faixa" role="status">
            <span>“{desfazer.nome}” mudou de tela.</span>
            <button type="button" class="cancela" data-acao="saidas-mapa-desfazer" tabindex="-1" on:click={desfazerMover}>Desfazer</button>
        </div>
    {/if}
    <p class="cota">A tela em vermelho é a que esta saída ocupa agora. Clique em outra para pedir a troca: nada se move sem a sua confirmação. Abaixo do número, o nome do monitor (o Windows numera diferente).</p>

    <div class="rot todas">TODAS AS SAÍDAS</div>
    <div class="lista" data-acao="saidas-todas">
        {#each lista as o (o.id)}
            {@const est = estadoDaSaida(o, $outputDisplay)}
            <button type="button" class="linha" class:a={o.id === escolhida} data-saida={o.id} tabindex="-1" on:click={() => currentOutputSettings.set(o.id)}>
                {#if est !== ""}<i class="pt {est}"></i>{:else}<i class="pt"></i>{/if}
                <b>{o.name || "Sem nome"}</b>
                <span class="res">{resumoDaSaida(o, telas, o.stageOutput ? $stageShows[o.stageOutput]?.name || "" : "")}</span>
            </button>
        {/each}
    </div>
</aside>

<style>
    .lado {
        flex: 1;
        min-width: 0;
        padding-top: 22px;
    }
    .rot {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--luz-mudo);
        margin-bottom: 8px;
    }
    .rot.todas {
        margin-top: 26px;
    }
    .mapa {
        min-height: 150px;
        border-radius: 10px;
        background: var(--luz-trilho);
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        box-sizing: border-box;
    }
    .tela {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
        padding: 0;
        border-radius: 5px;
        border: 1px solid var(--luz-borda-forte);
        background: transparent;
        color: var(--luz-mudo);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
    }
    .tela:hover:not(:disabled) {
        background: var(--luz-hover);
    }
    .tela b {
        font-size: 17px;
        color: var(--luz-texto);
    }
    .tela .aparelho {
        max-width: 100%;
        padding: 0 4px;
        font-size: 9px;
        color: var(--luz-mudo);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .tela.minha .aparelho {
        color: var(--luz-branco);
    }
    .tela.minha {
        background: var(--luz-vermelho);
        border-color: var(--luz-vermelho);
        color: var(--luz-branco);
        cursor: default;
    }
    .tela.minha b {
        color: var(--luz-branco);
    }
    .tela.alvo {
        box-shadow: 0 0 0 2px var(--luz-laranja);
    }
    .confirma,
    .desfaz {
        margin-top: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: var(--luz-raio-campo);
        background: var(--luz-campo);
        box-shadow: inset 0 0 0 1px var(--luz-laranja);
        font-size: 13px;
        color: var(--luz-texto);
    }
    .desfaz {
        box-shadow: inset 0 0 0 1px var(--luz-linha);
    }
    .confirma .q,
    .desfaz span {
        margin-right: auto;
    }
    .mover,
    .cancela {
        height: var(--luz-botao-h);
        padding: 0 14px;
        border: 1px solid var(--luz-borda);
        border-radius: var(--luz-raio-acao);
        background: var(--luz-campo);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--luz-texto);
        cursor: pointer;
    }
    .mover {
        border-color: var(--luz-texto);
        background: var(--luz-texto);
        color: var(--luz-tinta);
    }
    .mover:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .cancela:hover {
        background: var(--luz-hover);
    }
    .recusa {
        margin: 10px 0 0;
        padding: 8px 10px;
        border-radius: var(--luz-raio-campo);
        box-shadow: inset 0 0 0 1px var(--luz-laranja);
        font-size: 13px;
        line-height: 1.4;
        color: var(--luz-texto);
    }
    .cota {
        margin: 10px 0 0;
        font-size: 12px;
        line-height: 1.4;
        color: var(--luz-mudo);
    }
    .lista {
        border-radius: 10px;
        box-shadow: inset 0 0 0 1px var(--luz-linha);
        overflow: hidden;
        font-size: 13px;
    }
    .linha {
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 12px;
        border: 0;
        border-top: 1px solid var(--luz-linha);
        background: transparent;
        color: var(--luz-texto);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .linha:first-child {
        border-top: 0;
    }
    .linha.a {
        background: var(--luz-hover);
    }
    .linha b {
        font-weight: 600;
    }
    .res {
        margin-left: auto;
        color: var(--luz-mudo);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .pt {
        width: 7px;
        height: 7px;
        border-radius: 4px;
        background: var(--luz-fraco);
        flex-shrink: 0;
    }
    .pt.ar {
        background: var(--luz-vermelho);
    }
    .pt.ligada {
        background: var(--luz-verde);
    }
</style>
