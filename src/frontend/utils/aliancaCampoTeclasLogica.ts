// Cabine 6 (Andre, 23/nov): o modelo do Esc nos campos de texto da coluna No ar (Mensagem pro palco, chat do culto).
// O 1o Esc SOLTA o cursor (blur) e nao limpa nada; o 2o Esc (ja sem campo com foco) limpa o telao como sempre. As teclas de panico F1-F5 e o
// Ctrl+L (congelar) PASSAM mesmo com o cursor no campo. O resto e do campo (o espaco nao passa slide, letra nao vira atalho). Pura.

export type DestinoDaTecla = "soltar" | "passar" | "campo"

const PANICO = /^F[1-5]$/

export function teclaNoCampo(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean }): DestinoDaTecla {
    if (e.isComposing) return "campo"
    if (e.key === "Escape") return "soltar"
    if (PANICO.test(e.key)) return "passar"
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "l") return "passar"
    return "campo"
}

/** a dica da linha de avisos quando o Esc so soltou o cursor / fechou uma camada (info, some sozinha) */
export const DICA_ESC = "Esc soltou o cursor ou fechou a janelinha. Aperte Esc de novo para limpar o telão."
export const CHAVE_DICA_ESC = "esc-soltou"
/** dois avisos do mesmo Esc (a trava e o popover que fechou) nao contam duas vezes */
export const DICA_ESC_JANELA_MS = 150
