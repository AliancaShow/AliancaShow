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
}
export type TelaDoSistema = { id: number | string; internal?: boolean; bounds: { x: number; y: number; width: number; height: number } }

/** ordem das telas como o sistema as mostra: a interna primeiro, depois da esquerda para a direita */
export function ordenarTelas<T extends TelaDoSistema>(telas: T[]): T[] {
    return [...telas].sort((a, b) => Number(!!b.internal) - Number(!!a.internal) || a.bounds.x - b.bounds.x)
}

/** numero (1, 2, 3...) da tela na ordem acima; 0 = a saida nao esta em tela nenhuma */
export function numeroDaTela(telas: TelaDoSistema[], s: SaidaDoMapa): number {
    return ordenarTelas(telas).findIndex((t) => ocupaATela(s, t)) + 1
}

/** a saida e dona da tela? pelo id da tela; sem id salvo (saida antiga), pelos limites iguais (o mesmo casamento que o popup "Tela de saida" faz) */
export function ocupaATela(s: SaidaDoMapa & { bounds?: { x?: number; y?: number; width?: number; height?: number } }, tela: TelaDoSistema): boolean {
    if (s.screen !== null && s.screen !== undefined && s.screen !== "") return String(s.screen) === String(tela.id)
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
    const janela = !s.invisible ? (n ? `Monitor ${n}` : "janela") : ""
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
