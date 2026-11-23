// Cabine 6 ("aprovo monitor-desconectado", 23/nov): para ONDE vai a janela de uma saida. Puro (sem Electron), testado em aliancaMonitorLogica.test.ts.
// Desenho: docs/passagem/referencia/desenho-monitor-desconectado.md
//   1. `screen` salvo                     -> o monitor inteiro; monitor ausente = DESCONECTADO (antes caia calado nas coordenadas soltas)
//   2. sem `screen`, com `aliancaMonitor` -> tamanho proprio DENTRO do monitor (x = monitor.x + dx); monitor ausente = DESCONECTADO
//   3. sem nenhum dos dois                -> config antiga: as coordenadas soltas de sempre ("antigo"; quem chama avisa para escolher o monitor)
import type { AliancaMonitor } from "../../types/aliancaMonitorCanais"

export type Retangulo = { x: number; y: number; width: number; height: number }
export type Monitor = { id: string | number; label?: string; bounds: Retangulo; scaleFactor?: number }
export type SaidaNoMonitor = { screen?: string | null; aliancaMonitor?: AliancaMonitor | null; bounds?: Partial<Retangulo> | null }

export type Destino = { tipo: "monitor-inteiro"; bounds: Retangulo; monitor: Monitor } | { tipo: "dentro-do-monitor"; bounds: Retangulo; monitor: Monitor; escalaMudou: boolean } | { tipo: "desconectado"; monitor: string } | { tipo: "antigo" }

const temScreen = (s: SaidaNoMonitor) => s.screen !== null && s.screen !== undefined && s.screen !== ""

export function destinoDaSaida(s: SaidaNoMonitor, monitores: Monitor[]): Destino {
    if (temScreen(s)) {
        const m = monitores.find((d) => String(d.id) === String(s.screen))
        if (!m) return { tipo: "desconectado", monitor: s.aliancaMonitor && String(s.aliancaMonitor.id) === String(s.screen) && s.aliancaMonitor.nome ? s.aliancaMonitor.nome : String(s.screen) }
        return { tipo: "monitor-inteiro", bounds: { ...m.bounds }, monitor: m }
    }

    const am = s.aliancaMonitor
    if (am && am.id !== undefined && am.id !== null && String(am.id) !== "") {
        const m = monitores.find((d) => String(d.id) === String(am.id))
        if (!m) return { tipo: "desconectado", monitor: am.nome || String(am.id) }
        const width = Number(s.bounds?.width) || m.bounds.width
        const height = Number(s.bounds?.height) || m.bounds.height
        const escalaMudou = am.escala !== undefined && m.scaleFactor !== undefined && am.escala !== m.scaleFactor
        return { tipo: "dentro-do-monitor", bounds: { x: m.bounds.x + (Number(am.dx) || 0), y: m.bounds.y + (Number(am.dy) || 0), width, height }, monitor: m, escalaMudou }
    }

    return { tipo: "antigo" }
}

/**
 * o monitor de uma janela posta pelo operador: o que contem o CANTO SUPERIOR ESQUERDO dela (o LED 896x320 cabe no canto do monitor; o centro
 * de uma janela grande pode cair no vizinho). null = o canto nao esta em monitor nenhum (valor digitado a mao fora das telas): nao carimba.
 */
export function monitorDaJanela(b: Retangulo, monitores: Monitor[]): AliancaMonitor | null {
    const m = monitores.find((d) => b.x >= d.bounds.x && b.y >= d.bounds.y && b.x < d.bounds.x + d.bounds.width && b.y < d.bounds.y + d.bounds.height)
    if (!m) return null
    return { id: String(m.id), nome: m.label || "", dx: b.x - m.bounds.x, dy: b.y - m.bounds.y, ...(m.scaleFactor !== undefined ? { escala: m.scaleFactor } : {}) }
}

/** o monitor inteiro escolhido no mapa / em "Tela de saida": o carimbo dele (dx/dy 0) */
export function carimboDoMonitorInteiro(m: Monitor): AliancaMonitor {
    return { id: String(m.id), nome: m.label || "", dx: 0, dy: 0, ...(m.scaleFactor !== undefined ? { escala: m.scaleFactor } : {}) }
}
