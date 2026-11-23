// Configuracoes > Telas e saidas (C4): a parte pura do mapa das telas e da lista "Todas as saidas".

export type SaidaDoMapa = {
    enabled?: boolean
    name?: string
    screen?: string | null
    invisible?: boolean
    stageOutput?: string
    ndi?: boolean
    blackmagic?: boolean
    webrtc?: boolean
    rtmp?: boolean
    ndiData?: { framerate?: string | number }
    bounds?: { x?: number; y?: number; width?: number; height?: number }
    /** cabine 6 ("aprovo monitor-desconectado"): o monitor de uma saida de tamanho proprio (o LED 896x320) */
    aliancaMonitor?: { id: string; nome?: string; dx?: number; dy?: number } | null
}
export type TelaDoSistema = { id: number | string; internal?: boolean; label?: string; bounds: { x: number; y: number; width: number; height: number } }

const temScreen = (s: SaidaDoMapa) => s.screen !== null && s.screen !== undefined && s.screen !== ""

/** o monitor que a saida diz ocupar (screen ou carimbo) nao esta ligado? (lista vazia = ainda lendo: nao acusa) */
export function monitorDesconectado(s: SaidaDoMapa, telas: TelaDoSistema[]): string | null {
    if (s.invisible || !telas.length) return null
    const id = temScreen(s) ? String(s.screen) : s.aliancaMonitor?.id ? String(s.aliancaMonitor.id) : null
    if (id === null || telas.some((t) => String(t.id) === id)) return null
    return s.aliancaMonitor && String(s.aliancaMonitor.id) === id && s.aliancaMonitor.nome ? s.aliancaMonitor.nome : "salvo"
}

/** a saida tem tamanho proprio, menor que a tela (o LED 896x320 num monitor 1024x768)? Mover pelo mapa mantem o tamanho, no canto da tela */
export function tamanhoProprio(s: SaidaDoMapa, tela: TelaDoSistema): boolean {
    const w = Number(s.bounds?.width) || 0
    const h = Number(s.bounds?.height) || 0
    return !temScreen(s) && w > 0 && h > 0 && w <= tela.bounds.width && h <= tela.bounds.height && (w < tela.bounds.width || h < tela.bounds.height)
}

/** ordem das telas como o sistema as mostra: a interna primeiro, depois da esquerda para a direita */
export function ordenarTelas<T extends TelaDoSistema>(telas: T[]): T[] {
    return [...telas].sort((a, b) => Number(!!b.internal) - Number(!!a.internal) || a.bounds.x - b.bounds.x)
}

/** numero (1, 2, 3...) da tela na ordem acima; 0 = a saida nao esta em tela nenhuma */
export function numeroDaTela(telas: TelaDoSistema[], s: SaidaDoMapa): number {
    return ordenarTelas(telas).findIndex((t) => ocupaATela(s, t)) + 1
}

/**
 * a saida e dona da tela? pelo id da tela; sem id, pelo monitor carimbado (o LED 896x320 ocupa o monitor dele sem cobri-lo inteiro: antes
 * aparecia "2 Livre"); sem os dois (saida antiga), pelos limites iguais (o mesmo casamento que o popup "Tela de saida" faz)
 */
export function ocupaATela(s: SaidaDoMapa & { bounds?: { x?: number; y?: number; width?: number; height?: number } }, tela: TelaDoSistema): boolean {
    if (temScreen(s)) return String(s.screen) === String(tela.id)
    if (s.aliancaMonitor?.id) return String(s.aliancaMonitor.id) === String(tela.id)
    const b = s.bounds
    return !!b && b.x === tela.bounds.x && b.y === tela.bounds.y && b.width === tela.bounds.width && b.height === tela.bounds.height
}

/** o que a tela mostra no mapa: o nome da saida que a ocupa; sem saida, "Cabine" (tela interna) ou "Livre" */
export function rotuloDaTela(tela: TelaDoSistema, saidas: { [id: string]: SaidaDoMapa }, escolhida: string): { nome: string; ocupadaPelaEscolhida: boolean } {
    const donas = Object.entries(saidas).filter(([, s]) => s.enabled !== false && !s.invisible && ocupaATela(s, tela))
    const minha = donas.find(([id]) => id === escolhida)
    if (minha) return { nome: minha[1].name || "Saída", ocupadaPelaEscolhida: true }
    if (donas.length) return { nome: donas[0][1].name || "Saída", ocupadaPelaEscolhida: false }
    return { nome: tela.internal ? "Cabine" : "Livre", ocupadaPelaEscolhida: false }
}

/** a linha cinza de "Todas as saidas": "Monitor 2 + NDI", "só NDI · 1080p30", "Monitor 3 · palco “Palavra”" */
export function resumoDaSaida(s: SaidaDoMapa, telas: TelaDoSistema[], nomeDoPalco = ""): string {
    const redes = [s.ndi && "NDI", s.blackmagic && "Blackmagic", s.webrtc && "WebRTC", s.rtmp && "RTMP"].filter(Boolean) as string[]
    const n = numeroDaTela(telas, s)
    const sumido = monitorDesconectado(s, telas)
    const tam = s.bounds?.width && s.bounds?.height && !temScreen(s) && s.aliancaMonitor ? ` (${s.bounds.width}×${s.bounds.height})` : ""
    const janela = !s.invisible ? (sumido ? (sumido === "salvo" ? "monitor salvo desconectado" : `monitor ${sumido} desconectado`) : n ? `Monitor ${n}${tam}` : "janela") : ""
    const partes = [janela, ...redes].filter(Boolean)
    let base = partes.join(" + ")
    if (s.invisible && redes.length) {
        const h = s.bounds?.height || 1080
        const fps = s.ndiData?.framerate ? String(s.ndiData.framerate) : "30"
        base = `só ${redes.join(" + ")} · ${h}p${fps}`
    }
    if (nomeDoPalco) base += (base ? " · " : "") + `palco “${nomeDoPalco}”`
    return base || "desligada"
}

/** resumo de uma secao rara recolhida, para o cabecalho: "nenhuma placa encontrada", "desligado", "2 destinos" */
export function resumoDeRede(tipo: "blackmagic" | "rtmp" | "webrtc", s: { blackmagic?: boolean; rtmp?: boolean; webrtc?: boolean; blackmagicData?: { deviceId?: string; displayMode?: string }; rtmpData?: { destinations?: { url?: string }[] }; webrtcData?: { url?: string } }, placas = 0): string {
    if (tipo === "blackmagic") {
        if (!s.blackmagic) return placas ? `${placas} placa${placas > 1 ? "s" : ""} encontrada${placas > 1 ? "s" : ""}` : "nenhuma placa encontrada"
        return s.blackmagicData?.displayMode || (s.blackmagicData?.deviceId ? "placa escolhida" : "ligado")
    }
    if (tipo === "rtmp") {
        if (!s.rtmp) return "desligado"
        const n = (s.rtmpData?.destinations || []).filter((d) => d.url).length
        return n ? `${n} destino${n > 1 ? "s" : ""}` : "sem destino"
    }
    if (!s.webrtc) return "desligado"
    return s.webrtcData?.url ? "com endereço" : "sem endereço"
}

/** a tela da cabine: a que contem o centro da janela principal; sem essa informacao, a tela interna (a mesma que o mapa chama de "Cabine") */
export function telaDaCabine(telas: TelaDoSistema[], centro?: { x: number; y: number } | null): string | null {
    if (centro) {
        const dentro = telas.find((t) => centro.x >= t.bounds.x && centro.x < t.bounds.x + t.bounds.width && centro.y >= t.bounds.y && centro.y < t.bounds.y + t.bounds.height)
        if (dentro) return String(dentro.id)
        // o centro nao caiu em tela nenhuma (janela esticada entre monitores, lista velha): vale a tela MAIS PERTO dele, nunca "nenhuma" em silencio
        const dist = (t: TelaDoSistema) => {
            const dx = Math.max(t.bounds.x - centro.x, 0, centro.x - (t.bounds.x + t.bounds.width))
            const dy = Math.max(t.bounds.y - centro.y, 0, centro.y - (t.bounds.y + t.bounds.height))
            return dx * dx + dy * dy
        }
        const perto = [...telas].sort((a, b) => dist(a) - dist(b))[0]
        if (perto) return String(perto.id)
    }
    const interna = telas.find((t) => t.internal)
    return interna ? String(interna.id) : null
}

export type PodeMover = { ok: true } | { ok: false; motivo: string }

/** pode mover a saida `id` para a tela `tela`? Recusa dizendo o porque (nunca em silencio): cabine, tela ocupada, saida so de rede, posicao travada */
export function podeMover(id: string, saidas: { [id: string]: SaidaDoMapa & { boundsLocked?: boolean } }, tela: TelaDoSistema, telas: TelaDoSistema[], cabine: string | null): PodeMover {
    const s = saidas[id]
    if (!s) return { ok: false, motivo: "Escolha uma saída antes de mover." }
    const nome = s.name || "Esta saída"
    const n = ordenarTelas(telas).findIndex((t) => String(t.id) === String(tela.id)) + 1
    if (s.invisible) return { ok: false, motivo: `“${nome}” é só de rede (NDI, WebRTC, RTMP ou Blackmagic): não tem janela para mover.` }
    if (s.boundsLocked) return { ok: false, motivo: `“${nome}” está com a posição travada (cadeado em Tela de saída). Destrave antes de mover.` }
    if (ocupaATela(s, tela)) return { ok: false, motivo: `“${nome}” já está no Monitor ${n}.` }
    if (cabine !== null && String(tela.id) === cabine) return { ok: false, motivo: `O Monitor ${n} é a tela da cabine, onde está esta janela: a saída taparia a interface.` }
    const dona = Object.entries(saidas).find(([oid, o]) => oid !== id && o.enabled !== false && !o.invisible && ocupaATela(o, tela))
    if (dona) return { ok: false, motivo: `O Monitor ${n} já é de “${dona[1].name || "outra saída"}”. Mova aquela saída primeiro.` }
    return { ok: true }
}

type SaidaComConteudo = SaidaDoMapa & { out?: { [k: string]: any } | null }

/** a saida esta mostrando alguma coisa agora? (slide, fundo, overlay ou efeito; `refresh` e `transition` nao contam) */
export function temConteudoNoAr(s: SaidaComConteudo): boolean {
    const o = s.out || {}
    return (["background", "slide", "effects", "overlays"] as const).some((k) => (Array.isArray(o[k]) ? o[k].length > 0 : !!o[k]))
}

/** "" desligada; "ligada" habilitada (verde); "ar" so quando a janela esta ligada E ha conteudo na saida (vermelho) */
export function estadoDaSaida(s: SaidaComConteudo, janelasLigadas: boolean): "" | "ligada" | "ar" {
    if (s.enabled === false) return ""
    return janelasLigadas && temConteudoNoAr(s) ? "ar" : "ligada"
}
