// Mensagem pro palco (leiaute v2, coluna No ar): a parte pura. Mesmas regras de `enviar_stage_message` do Sirvo (migration 0079): texto de
// 1 a 120 caracteres, validade de 1 a 60 minutos (padrao 3), uma mensagem viva por igreja (a nova encerra a anterior).

export const LIMITE_MENSAGEM = 120
export const MINUTOS_PADRAO = 3
export const MINUTOS_MAXIMO = 60

/** o texto que vai ao Sirvo: sem quebra de linha nem espaco duplicado, ate 120; vazio = recusado (nunca manda mensagem em branco) */
export function prepararMensagem(bruto: string): { ok: true; texto: string } | { ok: false; motivo: string } {
    const texto = (bruto || "")
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    if (!texto) return { ok: false, motivo: "Escreva a mensagem." }
    if (texto.length > LIMITE_MENSAGEM) return { ok: false, motivo: `Até ${LIMITE_MENSAGEM} caracteres.` }
    return { ok: true, texto }
}

export const minutosValidos = (m: number) => Number.isInteger(m) && m >= 1 && m <= MINUTOS_MAXIMO

/** a mensagem viva no palco: so enquanto `ate` nao passou (o relogio entra de fora) */
export function mensagemViva(msg: { id: string; texto: string; ate: string } | null | undefined, agoraMs: number): { texto: string; ateMs: number } | null {
    if (!msg?.texto) return null
    const ateMs = Date.parse(msg.ate)
    return Number.isFinite(ateMs) && ateMs > agoraMs ? { texto: msg.texto, ateMs } : null
}
