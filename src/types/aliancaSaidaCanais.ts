// Cabine 6, passo intermediario do video (fatia A): canais IPC proprios do AliancaShow para as previas por captura e o vigia de queda.
// Ficam fora de `Channels.ts`/`IPC/Main.ts` (fecho) de proposito: o preload repassa qualquer canal, e assim o diff do fecho fica em
// `OutputLifecycle.ts` (ligar o vigia) e nos dois pontos que trocam o espelho pela captura.
//
// Arquivo so de tipos e constantes: importado pelo processo principal e pelas duas janelas.

/** janela principal ou de saida -> processo principal: "qual e a fonte de captura da janela da saida X?" (resposta no mesmo canal, com o id de escuta) */
export const ALIANCA_FONTE_SAIDA = "ALIANCA_FONTE_SAIDA"
/** processo principal -> janela principal: a janela de uma saida caiu, travou, voltou */
export const ALIANCA_QUEDA_SAIDA = "ALIANCA_QUEDA_SAIDA"

/** estado da janela de uma saida, visto pelo processo principal. `fonteId` vem SO de `BrowserWindow.getMediaSourceId()` daquela janela: nunca pelo titulo */
export type FonteSaida = {
    outputId: string
    /** "window:HWND:0"; null quando a janela nao existe */
    fonteId: string | null
    existe: boolean
    visivel: boolean
    minimizada: boolean
    /** o processo da janela caiu e ainda nao recarregou */
    caida: boolean
}

export type EstadoQueda = "caiu" | "travou" | "respondeu" | "voltou" | "fora"

export type QuedaSaida = {
    outputId: string
    nome: string
    estado: EstadoQueda
    motivo: string
    /** Date.now() do evento */
    em: number
    /** so em "voltou": ms entre a queda e a pagina da saida carregada de novo */
    ms?: number
}
