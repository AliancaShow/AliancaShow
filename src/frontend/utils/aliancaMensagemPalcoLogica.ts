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

/** as validades que o operador escolhe (minutos); a 3 e a padrao */
export const DURACOES_MINUTOS = [1, 3, 5, 10] as const

/** "m:ss" ate a mensagem sair (nunca negativo) */
export function restanteTexto(ateMs: number, agoraMs: number): string {
    const s = Math.max(0, Math.ceil((ateMs - agoraMs) / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/**
 * A recusa do Sirvo em portugues claro, por codigo do Postgres (`pg`) — nunca a frase crua do banco.
 * 42501 = sem "conduz" (ou chave recusada), 54000 = limite de escritas por minuto, P0002 = culto inexistente, 22023/23514 = texto/validade fora da regra.
 * Sem codigo: a mensagem do proprio Show (ja em portugues: "Calma...", "Sem conexao...") passa como veio.
 */
export function mensagemDeErro(pg: string | undefined, mensagem: string): string {
    switch (pg) {
        case "42501":
            return "O Sirvo recusou: esta chave não pode conduzir o culto (um admin liga “conduz” no Perfil)."
        case "54000":
            return "Muitas mensagens em pouco tempo. Espere um minuto e envie de novo."
        case "P0002":
            return "Esse culto não existe mais no Sirvo."
        case "22023":
        case "23514":
        case "22001":
            return "O Sirvo recusou o texto ou o tempo: confira (até 120 caracteres, de 1 a 60 min)."
        default:
            return mensagem || "O Sirvo não aceitou."
    }
}
