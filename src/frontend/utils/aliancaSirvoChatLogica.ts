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
}

/** O pedaço `chat` do show_rev (ou o cabeçalho do show_chat). */
export type ChatDoRev = { ligado: boolean; motivo: string | null; assinatura: string | null; mudado_em: string | null }
export type RetratoChat = ChatDoRev & { mensagens: MensagemChat[] }

export type EstadoChat = {
    /** o culto a que este estado pertence */
    cultoId: string | null
    /** a chave tem "conversa" ligada (pelo último show_rev) */
    ligado: boolean
    /** estava ligada neste culto e um admin desligou: mostra o último retrato, acinzentado */
    congelado: boolean
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
    return { cultoId, ligado: false, congelado: false, desligadoEm: null, motivo: null, mensagens: [], assinatura: null, reconhecidas: [], naoLidas: 0, primeiro: true, erro: "" }
}

const MAX_RECONHECIDAS = 500

function contarNaoLidas(mensagens: MensagemChat[], reconhecidas: string[]): number {
    const vistas = new Set(reconhecidas)
    return mensagens.filter((m) => !vistas.has(m.id)).length
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
            if (!estado.congelado || estado.desligadoEm !== chat.mudado_em) estado = { ...estado, ligado: false, congelado: true, desligadoEm: chat.mudado_em || null }
            return { estado, buscar: false }
        }
        return { estado, buscar: false }
    }

    const motivo = chat.motivo || null
    if (!estado.ligado || estado.congelado || estado.motivo !== motivo) estado = { ...estado, ligado: true, congelado: false, desligadoEm: null, motivo }
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
    if (r.motivo) return { estado: { ...e, ligado: true, congelado: false, desligadoEm: null, motivo: r.motivo, erro: "" }, novas: 0 }

    const lista: unknown = (r as RetratoChat).mensagens
    const mensagens: MensagemChat[] = Array.isArray(lista) ? lista.filter((m: any) => m && typeof m.id === "string") : []
    const antes = new Set(e.mensagens.map((m) => m.id))
    let reconhecidas = e.reconhecidas
    let novas = 0
    if (e.primeiro) {
        reconhecidas = Array.from(new Set([...reconhecidas, ...mensagens.map((m) => m.id)]))
    } else {
        const vistas = new Set(reconhecidas)
        novas = mensagens.filter((m) => !antes.has(m.id) && !vistas.has(m.id)).length
    }
    if (reconhecidas.length > MAX_RECONHECIDAS) reconhecidas = reconhecidas.slice(-MAX_RECONHECIDAS)

    const estado: EstadoChat = {
        ...e,
        ligado: true,
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
