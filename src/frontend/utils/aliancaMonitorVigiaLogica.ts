// Cabine 6 ("aprovo monitor-desconectado", 23/nov): a parte pura do vigia que carimba o MONITOR de cada saida (aliancaMonitorVigia.ts).
// Carimba SO em gesto do operador (o mapa, "Tela de saida", valores a mao, Ctrl+arrastar a janela): uma saida que ja existia muda `screen` ou
// `bounds`. Nunca na carga inicial nem numa troca do store inteiro (perfil): uma config antiga carimbaria o monitor errado (o LED de 23/nov
// estava em cima do retorno). Revisao cetica, achado 6.
import type { AliancaMonitor, RegistroMonitor } from "../../types/aliancaMonitorCanais"

export type SaidaVista = {
    name?: string
    enabled?: boolean
    invisible?: boolean
    alwaysOnTop?: boolean
    screen?: string | null
    bounds?: { x?: number; y?: number; width?: number; height?: number } | null
    aliancaMonitor?: AliancaMonitor | null
}

const temJanela = (s: SaidaVista | undefined) => !!s && !s.invisible
const screenDe = (s: SaidaVista) => (s.screen === undefined || s.screen === null || s.screen === "" ? null : String(s.screen))
const limites = (s: SaidaVista) => JSON.stringify([s.bounds?.x ?? null, s.bounds?.y ?? null, s.bounds?.width ?? null, s.bounds?.height ?? null])

export type Carimbos = { peloScreen: string[]; pelaJanela: string[] }

/** o que o operador mudou entre duas fotos das saidas; `antes` null = carga inicial (nao carimba nada) */
export function gestosDoOperador(antes: { [id: string]: SaidaVista } | null, depois: { [id: string]: SaidaVista }): Carimbos {
    const r: Carimbos = { peloScreen: [], pelaJanela: [] }
    if (!antes) return r
    for (const [id, s] of Object.entries(depois)) {
        const a = antes[id]
        if (!a || !temJanela(s)) continue
        const sc = screenDe(s)
        if (sc !== null && sc !== screenDe(a)) r.peloScreen.push(id)
        else if (sc !== null && limites(s) !== limites(a)) r.peloScreen.push(id)
        else if (sc === null && (limites(s) !== limites(a) || screenDe(a) !== null)) r.pelaJanela.push(id)
    }
    return r
}

/** troca do store inteiro (outro perfil, restaurar configuracoes): mais da metade das saidas sumiu ou apareceu de uma vez -> nova carga inicial */
export function trocaDoStoreInteiro(antes: { [id: string]: unknown }, depois: { [id: string]: unknown }): boolean {
    const a = Object.keys(antes)
    const d = new Set(Object.keys(depois))
    const iguais = a.filter((id) => d.has(id)).length
    const total = Math.max(a.length, d.size)
    return total > 0 && iguais * 2 < total
}

/** a saida tem janela, esta habilitada e nao diz em que monitor fica (config antiga: o LED sem `screen`) -> aviso laranja para escolher */
export function precisaEscolherMonitor(s: SaidaVista): boolean {
    return s.enabled !== false && temJanela(s) && screenDe(s) === null && !s.aliancaMonitor
}

/** o que vai para o processo principal pelo canal ALIANCA_MONITOR_REGISTRO */
export function registroDaSaida(id: string, s: SaidaVista): RegistroMonitor {
    const b = s.bounds || {}
    return {
        outputId: id,
        nome: s.name || "",
        screen: screenDe(s),
        aliancaMonitor: s.aliancaMonitor || null,
        ...(b.width && b.height ? { bounds: { x: Number(b.x) || 0, y: Number(b.y) || 0, width: Number(b.width), height: Number(b.height) } } : {}),
        invisible: !!s.invisible,
        enabled: s.enabled !== false,
        alwaysOnTop: s.alwaysOnTop !== false
    }
}

/** as saidas cujo registro mudou (so os campos que o processo principal usa) */
export function registrosMudados(antes: { [id: string]: SaidaVista } | null, depois: { [id: string]: SaidaVista }): string[] {
    return Object.keys(depois).filter((id) => !antes || !antes[id] || JSON.stringify(registroDaSaida(id, antes[id])) !== JSON.stringify(registroDaSaida(id, depois[id])))
}

/** o texto do aviso de monitor na linha de avisos */
export function textoDoMonitor(estado: string, saida: string, monitor: string): { texto: string; nivel: "info" | "aviso" | "erro"; fixo: boolean } | null {
    switch (estado) {
        case "desconectado":
            return { texto: `${saida}: monitor ${monitor} desconectado. A saída volta sozinha quando ele for religado, ou escolha outra tela em Configurações › Saídas.`, nivel: "erro", fixo: true }
        case "voltou":
            return { texto: `${saida}: monitor ${monitor} de volta.`, nivel: "info", fixo: false }
        case "escala":
            return { texto: `${saida}: a escala do Windows no monitor ${monitor} mudou desde que a saída foi posta lá. Confira o tamanho.`, nivel: "aviso", fixo: false }
        case "sem-monitor":
            return { texto: `${saida}: escolha o monitor desta saída em Configurações › Saídas (ela ainda está em coordenadas soltas e pode cair no monitor errado se o Windows trocar a ordem).`, nivel: "aviso", fixo: false }
        case "fora-das-telas":
            return { texto: `${saida}: a janela não está em nenhum monitor. Escolha a tela em Configurações › Saídas.`, nivel: "aviso", fixo: false }
    }
    return null
}
