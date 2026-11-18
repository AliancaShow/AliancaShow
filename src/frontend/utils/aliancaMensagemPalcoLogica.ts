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
 * A recusa do Sirvo em portugues claro, pelo `codigo` que o Show ja recebe (`pedirAoSirvo`): o main repassa a frase do proprio Sirvo
 * (0081/0093: "Esta chave só lê o roteiro...", "Pedidos demais desta chave em um minuto...", "Culto inexistente."), entao so o que o main
 * ja classifica (culto inexistente, chave recusada, rede, ocupado) ganha frase propria; o resto passa como veio, com o texto do Sirvo.
 */
export function mensagemDeErro(codigo: string | undefined, mensagem: string): string {
    switch (codigo) {
        case "culto_inexistente":
            return "Esse culto não existe mais no Sirvo. Escolha o culto de novo."
        case "chave_invalida":
            return "O Sirvo recusou a chave. Confira a chave em Configurações."
        case "ocupado":
            return "Calma: um pedido de cada vez. Tente de novo."
        default:
            return mensagem || "O Sirvo não aceitou."
    }
}

/**
 * Por que a caixa nao pode mandar agora, com texto VERDADEIRO para cada motivo. `persistente` = promessa quebrada que so uma pessoa
 * conserta (a chave nao conduz): so esse acende a faixa de falha da janela. O resto e passageiro (Sirvo fora do ar, sem culto
 * seguido, sem chave): fala so na linha de estado da caixa e some quando a causa some.
 */
export function caminhoDoEnvio(e: { status: string; cultoId: string | null; podeConduzir: boolean }): { motivo: string; persistente: boolean } {
    if (e.status === "sem_chave" || e.status === "chave_invalida") return { motivo: "Sem chave do Sirvo. Coloque a chave em Configurações.", persistente: false }
    if (!e.cultoId) return { motivo: "Nenhum culto do Sirvo sendo seguido.", persistente: false }
    if (e.status !== "conectado") return { motivo: "O Sirvo não está respondendo agora. Tente de novo em instantes.", persistente: false }
    if (!e.podeConduzir) return { motivo: "Esta chave só lê o roteiro. Um admin liga “conduz” no Sirvo (Perfil → chaves do AliançaShow).", persistente: true }
    return { motivo: "", persistente: false }
}
