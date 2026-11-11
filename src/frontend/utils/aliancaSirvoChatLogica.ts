// ----- AliançaShow · chat do culto (F4 v1, só leitura) · lógica pura -----
//
// Sem store, sem IPC, sem relógio: só funções que recebem o estado e devolvem
// o próximo. O store (aliancaSirvoChat.ts) chama estas funções; os testes
// (aliancaSirvoChatLogica.test.ts) também.
//
// Modelo (desenho F4 v2 no repo do Sirvo, migration 0084):
//   - O show_rev de cada 2 s traz `chat = { ligado, motivo, assinatura, mudado_em }`.
//   - A assinatura resume as últimas 50 mensagens do canal do culto. Mudou
//     (mensagem nova, apagada ou transcrição que chegou) → busca o retrato
//     inteiro (show_chat) e troca tudo o que mostra. Sem cursor.
//   - O Show guarda a assinatura DO RETRATO, não a do show_rev: se uma
//     mensagem chegar entre as duas chamadas, a próxima pergunta ainda vê
//     diferença e busca de novo.
//   - Não lida = id que está no retrato e ainda não foi reconhecido. O primeiro
//     retrato de um culto conta tudo como lido: só o que chega depois alerta.
//   - Admin desligou "conversa" no meio do culto → o painel CONGELA com o
//     último retrato (nada some da tela) e para de buscar.

export type RespostaChat = { autor: string; trecho: string }
export type MensagemChat = {
    id: string
    criada_em: string
    autor: string
    body: string
    audio_ms: number | null
    transcricao_status: string | null
    resposta: RespostaChat | null
    /** v1.1: quem escreveu. Ausente (Sirvo da v1) = pessoa. */
    autor_tipo?: "pessoa" | "chave"
    /** v1.1: veio desta chave (a Sala de vídeo deste Show) */
    minha?: boolean
    /** v1.1: nome de quem opera, só exibição (nunca identidade) */
    operador?: string | null
    /** v1.1: só quando `minha`; casa a bolha otimista com a mensagem que chegou */
    cliente_id?: string | null
}

/** O pedaço `chat` do show_rev (ou o cabeçalho do show_chat). */
export type ChatDoRev = { ligado: boolean; motivo: string | null; assinatura: string | null; mudado_em: string | null; /** v1.1: a chave também pode responder (interruptor "responde", D1b) */ responde?: boolean }
export type RetratoChat = ChatDoRev & { mensagens: MensagemChat[] }

export type EstadoChat = {
    /** o culto a que este estado pertence */
    cultoId: string | null
    /** a chave tem "conversa" ligada (pelo último show_rev) */
    ligado: boolean
    /** estava ligada neste culto e um admin desligou: mostra o último retrato, acinzentado */
    congelado: boolean
    /** v1.1: a chave pode responder neste culto (o interruptor "responde" está ligado) */
    responde: boolean
    /** quando foi desligada (para "chat desligado por um admin às 19:42") */
    desligadoEm: string | null
    /** por que o culto não serve para o chat: "culto" | "janela" | "rascunho" | null */
    motivo: string | null
    mensagens: MensagemChat[]
    /** a assinatura do retrato que está na tela (null = nenhum ainda) */
    assinatura: string | null
    /** ids já reconhecidos pelo operador (ou presentes no primeiro retrato) */
    reconhecidas: string[]
    /** quantas mensagens na tela ainda não foram reconhecidas */
    naoLidas: number
    /** o próximo retrato é o primeiro deste culto: conta tudo como lido */
    primeiro: boolean
    /** erro da última busca do retrato, curto, só para o painel ("" = nenhum) */
    erro: string
}

export function estadoInicial(cultoId: string | null = null): EstadoChat {
    return { cultoId, ligado: false, responde: false, congelado: false, desligadoEm: null, motivo: null, mensagens: [], assinatura: null, reconhecidas: [], naoLidas: 0, primeiro: true, erro: "" }
}

const MAX_RECONHECIDAS = 500

function contarNaoLidas(mensagens: MensagemChat[], reconhecidas: string[]): number {
    const vistas = new Set(reconhecidas)
    return mensagens.filter((m) => !m.minha && !vistas.has(m.id)).length
}

/** O valor que veio do Sirvo tem a forma do pedaço `chat`? (Sirvo sem a 0084 não manda.) */
export function chatValido(chat: any): chat is ChatDoRev {
    return !!chat && typeof chat === "object" && typeof chat.ligado === "boolean"
}

/**
 * Chegou um show_rev bom. Devolve o próximo estado e se é preciso buscar o
 * retrato. Trocar de culto zera tudo (o primeiro retrato do culto novo conta
 * como lido).
 */
export function aoRev(e: EstadoChat, cultoId: string | null, chat: any): { estado: EstadoChat; buscar: boolean } {
    let estado = e.cultoId === cultoId ? e : estadoInicial(cultoId)
    if (!cultoId || !chatValido(chat)) return { estado, buscar: false }

    if (!chat.ligado) {
        // Desligada. Se estava ligada neste culto, congela o que já está na tela.
        if (estado.ligado || estado.congelado) {
            if (!estado.congelado || estado.desligadoEm !== chat.mudado_em || estado.responde) estado = { ...estado, ligado: false, responde: false, congelado: true, desligadoEm: chat.mudado_em || null }
            return { estado, buscar: false }
        }
        return { estado, buscar: false }
    }

    const motivo = chat.motivo || null
    const responde = chat.responde === true
    if (!estado.ligado || estado.congelado || estado.motivo !== motivo || estado.responde !== responde) estado = { ...estado, ligado: true, responde, congelado: false, desligadoEm: null, motivo }
    // Culto que não serve (rascunho, fora da janela): não busca e não apaga o que havia.
    if (motivo) return { estado, buscar: false }
    return { estado, buscar: !!chat.assinatura && chat.assinatura !== estado.assinatura }
}

/**
 * Chegou o retrato (show_chat). `novas` = quantas mensagens apareceram que o
 * operador ainda não tinha visto nem reconhecido (para o som, se ligado).
 */
export function aoRetrato(e: EstadoChat, cultoId: string | null, r: any): { estado: EstadoChat; novas: number } {
    // a resposta é de outro culto (trocaram enquanto ela viajava): não vale
    if (!cultoId || e.cultoId !== cultoId || !chatValido(r)) return { estado: e, novas: 0 }

    if (!r.ligado) return { estado: aoRev(e, cultoId, r).estado, novas: 0 }
    if (r.motivo) return { estado: { ...e, ligado: true, responde: r.responde === true, congelado: false, desligadoEm: null, motivo: r.motivo, erro: "" }, novas: 0 }

    const mensagens = normalizarMensagens((r as RetratoChat).mensagens)
    const antes = new Set(e.mensagens.map((m) => m.id))
    let reconhecidas = e.reconhecidas
    let novas = 0
    if (e.primeiro) {
        reconhecidas = Array.from(new Set([...reconhecidas, ...mensagens.map((m) => m.id)]))
    } else {
        const vistas = new Set(reconhecidas)
        novas = mensagens.filter((m) => !m.minha && !antes.has(m.id) && !vistas.has(m.id)).length
    }
    if (reconhecidas.length > MAX_RECONHECIDAS) reconhecidas = reconhecidas.slice(-MAX_RECONHECIDAS)

    const estado: EstadoChat = {
        ...e,
        ligado: true,
        responde: r.responde === true,
        congelado: false,
        desligadoEm: null,
        motivo: null,
        mensagens,
        assinatura: typeof r.assinatura === "string" ? r.assinatura : null,
        reconhecidas,
        naoLidas: contarNaoLidas(mensagens, reconhecidas),
        primeiro: false,
        erro: ""
    }
    return { estado, novas }
}

/** O operador tocou no painel: tudo o que está na tela vira lido. */
export function marcarLidas(e: EstadoChat): EstadoChat {
    if (!e.naoLidas) return e
    const reconhecidas = Array.from(new Set([...e.reconhecidas, ...e.mensagens.map((m) => m.id)])).slice(-MAX_RECONHECIDAS)
    return { ...e, reconhecidas, naoLidas: 0 }
}

/** A busca do retrato falhou: só o painel fica sabendo. */
export function aoErro(e: EstadoChat, cultoId: string | null, mensagem: string): EstadoChat {
    if (e.cultoId !== cultoId) return e
    const erro = (mensagem || "Não consegui ler o chat agora.").slice(0, 120)
    return e.erro === erro ? e : { ...e, erro }
}

// ---------------------------------------------------------------- texto

function duracao(ms: number | null): string {
    const s = Math.max(0, Math.round((ms || 0) / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** O texto de uma mensagem como o painel mostra (áudio vira "🎤 0:12 — transcrição"). */
export function textoDaMensagem(m: MensagemChat): string {
    const body = (m.body || "").replace(/\s+/g, " ").trim()
    if (m.audio_ms === null || m.audio_ms === undefined) return body
    let resto = body
    if (!resto) {
        if (m.transcricao_status === "pendente") resto = "transcrevendo…"
        else resto = "áudio sem transcrição — ouça no celular"
    }
    return `🎤 ${duracao(m.audio_ms)} — ${resto}`
}

/** "Ana: pode soltar o vídeo" — a linha do painel recolhido. */
export function resumoDaUltima(mensagens: MensagemChat[]): string {
    const m = mensagens[mensagens.length - 1]
    if (!m) return ""
    return `${m.autor || "Alguém"}: ${textoDaMensagem(m)}`
}

const MOTIVOS: { [k: string]: string } = {
    rascunho: "A escala deste culto ainda não saiu; o chat abre quando sair.",
    janela: "Este culto está fora do horário do chat.",
    culto: "O chat deste culto não está disponível para esta chave."
}
export function textoDoMotivo(motivo: string | null): string {
    if (!motivo) return ""
    return MOTIVOS[motivo] || "O chat deste culto não está disponível agora."
}

// ---------------------------------------------------------------- texto hostil (v1.1)
// Tudo o que vem do Sirvo é texto de gente: o Svelte já escapa HTML, e aqui se
// tiram também os caracteres de controle e os que invertem o sentido do texto
// (RLO/LRO e companhia), que fariam "Sala de vídeo" se passar por outra coisa.

// faixas (decimal) de caracteres de controle e de inversão de texto: NUL..BS, VT, FF, SO..US, DEL..APC, ZWSP..RLM, LRE..RLO, WJ..isolates, BOM
const FAIXAS_CONTROLE = [
    [0, 8],
    [11, 12],
    [14, 31],
    [127, 159],
    [8203, 8207],
    [8234, 8238],
    [8288, 8297],
    [65279, 65279]
]
const CONTROLE = new RegExp("[" + FAIXAS_CONTROLE.map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("") + "]", "g")

/** Limpa um texto vindo de fora. `multilinha` mantém as quebras de linha (corpo da mensagem). */
export function limparTexto(valor: unknown, max: number, multilinha = false): string {
    if (typeof valor !== "string") return ""
    let t = valor.replace(/\r\n?/g, "\n").replace(CONTROLE, "")
    t = multilinha ? t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : t.replace(/\s+/g, " ")
    t = t.trim()
    const pontos = Array.from(t)
    return pontos.length > max ? pontos.slice(0, max).join("") : t
}

const ID = /^[A-Za-z0-9_-]{1,64}$/
function umaMensagem(m: any): MensagemChat | null {
    if (!m || typeof m.id !== "string" || !ID.test(m.id)) return null
    const resposta = m.resposta && typeof m.resposta === "object" ? { autor: limparTexto(m.resposta.autor, 60) || "Alguém", trecho: limparTexto(m.resposta.trecho, 120) } : null
    const duracaoMs = typeof m.audio_ms === "number" && isFinite(m.audio_ms) ? m.audio_ms : null
    const chave = m.autor_tipo === "chave"
    const clienteId = typeof m.cliente_id === "string" && ID.test(m.cliente_id) ? m.cliente_id.toLowerCase() : null
    return {
        id: m.id,
        criada_em: typeof m.criada_em === "string" ? m.criada_em.slice(0, 40) : "",
        autor: limparTexto(m.autor, 80) || (chave ? "Sala de vídeo" : "Alguém"),
        body: limparTexto(m.body, 4000, true),
        audio_ms: duracaoMs,
        transcricao_status: typeof m.transcricao_status === "string" ? m.transcricao_status.slice(0, 20) : null,
        resposta,
        autor_tipo: chave ? "chave" : "pessoa",
        minha: m.minha === true,
        operador: limparTexto(m.operador, 40) || null,
        cliente_id: clienteId
    }
}

/** O retrato inteiro, mensagem por mensagem, sem repetir id e sem aceitar o que não tem forma. */
export function normalizarMensagens(lista: unknown): MensagemChat[] {
    if (!Array.isArray(lista)) return []
    const vistos = new Set<string>()
    const fora: MensagemChat[] = []
    for (const bruta of lista) {
        const m = umaMensagem(bruta)
        if (!m || vistos.has(m.id)) continue
        vistos.add(m.id)
        fora.push(m)
    }
    return fora
}

/** Quem aparece como autor: "Ana" ou "Sala de vídeo · Pedro" (o nome da chave vem sempre na frente). */
export function nomeDoAutor(m: Pick<MensagemChat, "autor" | "autor_tipo" | "operador">): string {
    if (m.autor_tipo !== "chave") return m.autor || "Alguém"
    const base = m.autor || "Sala de vídeo"
    const op = m.operador || ""
    if (!op || base.endsWith(` · ${op}`)) return base
    return `${base} · ${op}`
}

/** O trecho que cita uma mensagem ao responder (no máximo 80 caracteres, uma linha). */
export function trechoDaCitacao(m: MensagemChat): { autor: string; trecho: string } {
    const t = textoDaMensagem(m).replace(/\s+/g, " ")
    const pontos = Array.from(t)
    return { autor: nomeDoAutor(m), trecho: pontos.length > 80 ? pontos.slice(0, 80).join("") + "…" : t }
}
