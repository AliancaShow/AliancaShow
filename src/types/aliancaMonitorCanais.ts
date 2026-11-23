// Cabine 6 ("aprovo monitor-desconectado", 23/nov): a saida presa ao MONITOR, nao a coordenadas soltas da area de trabalho.
// Canais proprios (fora de Channels.ts, que e do fecho): o preload repassa qualquer canal.
//
// Arquivo so de tipos e constantes: importado pelo processo principal e pela janela principal.

/** janela principal -> processo principal: o que o operador escolheu para a saida (monitor, tamanho, se esta ligada) */
export const ALIANCA_MONITOR_REGISTRO = "ALIANCA_MONITOR_REGISTRO"
/** processo principal -> janela principal: o monitor de uma saida sumiu, voltou */
export const ALIANCA_MONITOR_AVISO = "ALIANCA_MONITOR_AVISO"

/**
 * o monitor de uma saida de tamanho proprio (o LED 896x320) e a posicao da janela DENTRO dele, em pixels logicos (como `bounds`).
 * `id` = `Display.id` do Electron (estavel: trocar a ordem e desconectar/reconectar nao o mudam, testes de 23/nov); `nome` = `Display.label`, so para mostrar.
 */
export type AliancaMonitor = { id: string; nome: string; dx: number; dy: number; escala?: number }

export type RegistroMonitor = {
    outputId: string
    nome?: string
    /** monitor inteiro (o mapa / "Tela de saida" gravam); vazio = janela de tamanho proprio */
    screen?: string | null
    aliancaMonitor?: AliancaMonitor | null
    bounds?: { x: number; y: number; width: number; height: number }
    invisible?: boolean
    enabled?: boolean
    alwaysOnTop?: boolean
}

export type EstadoMonitor = "desconectado" | "voltou" | "sem-monitor" | "escala"

export type AvisoMonitor = {
    outputId: string
    nome: string
    estado: EstadoMonitor
    /** nome do monitor ("T27C310") ou o numero, quando o nome nao e conhecido */
    monitor: string
    em: number
}
