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

/** o erro da caixa some sozinho depois disto (ou no proximo envio) */
export const PRAZO_ERRO_MS = 6000
/** quanto tempo a caixa segue conferindo, pelo roteiro, um envio que estourou o tempo */
export const PRAZO_DUVIDA_MS = 60_000

/**
 * A linha de aviso da caixa (a 2a linha; a 1a e SEMPRE a mensagem viva com o Limpar, que nenhum aviso esconde).
 * Prioridade: erro > "Enviando…" > aviso do modo > motivo de a caixa nao poder mandar.
 */
export function avisoDaCaixa(e: { erro: string; enviando: boolean; avisoModo: string; motivo: string }): string {
    return e.erro || (e.enviando ? "Enviando…" : "") || e.avisoModo || e.motivo
}

/** envio que estourou o tempo ("rede"): pode ter chegado. Quem decide e o proximo roteiro lido (`mensagem_palco`). */
export type Duvida = { texto: string; minAteMs: number; venceEm: number }

/** `minAteMs`: o menor `ate` que ESTE envio produziria (agora + validade, com 15 s de folga de relogio): mensagem velha igual nao conta */
export function duvidaDoEnvio(texto: string, minutos: number, agoraMs: number): Duvida {
    return { texto, minAteMs: agoraMs + minutos * 60_000 - 15_000, venceEm: agoraMs + PRAZO_DUVIDA_MS }
}

export function conferirDuvida(d: Duvida, viva: { texto: string; ateMs: number } | null, agoraMs: number): "resolvida" | "aberta" | "vencida" {
    if (viva && viva.texto === d.texto && viva.ateMs >= d.minAteMs) return "resolvida"
    return agoraMs > d.venceEm ? "vencida" : "aberta"
}

/** M3: depois da resposta, o campo so esvazia se ainda e o texto que foi enviado (o operador pode ja ter digitado a proxima) */
export const campoAposEnvio = (atual: string, enviado: string): string => (atual === enviado ? "" : atual)

/** M6: o envio vai sair? (texto valido, caminho livre, nada em curso). So entao o Enter larga o foco do campo. */
export const envioAceito = (texto: string, motivoSemCaminho: string, enviando: boolean): boolean => !enviando && !motivoSemCaminho && prepararMensagem(texto).ok

/** A3: o rotulo da mensagem no ar ("no palco · 2:41"): o texto FICA no campo e este rotulo diz que ele esta no palco */
export const rotuloNoPalco = (ateMs: number, agoraMs: number): string => `no palco · ${restanteTexto(ateMs, agoraMs)}`

/** A3: o campo e a mensagem viva sao o MESMO texto? (o campo acende como "no palco" so entao) */
export function campoEstaNoPalco(campo: string, viva: { texto: string } | null): boolean {
    if (!viva) return false
    const p = prepararMensagem(campo)
    return p.ok && p.texto === viva.texto
}

/** A3: quanto o envio espera a mensagem viva aparecer no roteiro antes de desistir de acompanhar (o campo, nesse caso, nao e esvaziado) */
export const PRAZO_APARECER_MS = 15_000

export type Envio = { campo: string; texto: string; visto: boolean; venceEm: number }

/**
 * A3: o que acontece com o campo depois de um envio que deu certo. O texto FICA no campo enquanto a mensagem esta no palco; quando ela SAI
 * (expirou ou alguem limpou), o campo se esvazia, se ainda for o texto enviado. "esperando" = o roteiro ainda nao mostrou a mensagem
 * (leva ate ~2 s); "perdeu" = nunca apareceu dentro do prazo (o campo fica como esta, o operador decide).
 */
export function acompanharEnvio(e: Envio, viva: { texto: string } | null, agoraMs: number): "noPalco" | "saiu" | "esperando" | "perdeu" {
    if (viva && viva.texto === e.texto) return "noPalco"
    if (e.visto) return "saiu"
    return agoraMs > e.venceEm ? "perdeu" : "esperando"
}

// ---------------------------------------------------------------- A2: a mensagem viva alimenta o item do layout de palco
// O layout de palco do FreeShow nao tem "item de mensagem" proprio: o item que a igreja poe la (a etiqueta "Mensagem palco") e uma VARIAVEL de texto
// (item "variavel" ou o valor dinamico {$...} num texto). A mensagem viva escreve em toda variavel de texto cujo NOME seja um destes (o mesmo
// identificador que o FreeShow usa: minusculas, espaco vira "_"); `sirvo_mensagem` e a que o Show cria sozinho.
export const NOMES_DA_MENSAGEM = ["sirvo_mensagem", "mensagem_palco"] as const

const idDoNome = (nome: unknown): string => (typeof nome === "string" ? nome.toLowerCase().trim().replace(/ /g, "_") : "")

/** as chaves da loja de variaveis que recebem a mensagem (so as de texto) */
export function chavesDaMensagem(variaveis: { [chave: string]: { name?: string; type?: string } | undefined } | null | undefined): string[] {
    return Object.entries(variaveis || {})
        .filter(([chave, v]) => !!v && (v.type === undefined || v.type === "text") && ((NOMES_DA_MENSAGEM as readonly string[]).includes(idDoNome(v.name)) || (NOMES_DA_MENSAGEM as readonly string[]).includes(chave)))
        .map(([chave]) => chave)
}

/** o texto da mensagem como variavel do FreeShow: sem HTML nem {...} (o mesmo tratamento que o Sirvo ja da a `sirvo_mensagem`), ate 200 */
export const textoDaVariavel = (texto: string | null | undefined): string =>
    (texto || "")
        .replace(/</g, "‹")
        .replace(/>/g, "›")
        .replace(/\{/g, "(")
        .replace(/\}/g, ")")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .slice(0, 200)
