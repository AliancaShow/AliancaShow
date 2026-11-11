// ----- AliançaShow · chat do culto (F4 v1.1, responde) · caixa de saída, lógica pura -----
//
// Sem store, sem IPC, sem relógio (o `agora` entra por parâmetro): só funções
// que recebem a caixa de saída e devolvem a próxima. O store
// (aliancaSirvoChat.ts) chama estas funções; os testes também.
//
// Ciclo de uma resposta (desenho F4 v2, §4.4):
//   enviando   → o pedido está na fila / viajando
//   enviada    → o Sirvo confirmou; some quando o retrato trouxer o mesmo cliente_id
//   conferindo → estourou o tempo ("não sei se o Sirvo recebeu"): quem diz é o
//                próximo retrato; se não vier em 30 s, vira "falhou"
//   falhou     → botão "tentar de novo", com o MESMO cliente_id (o Sirvo
//                reconhece e não duplica)
//   recusada   → o Sirvo respondeu com uma frase ("Mensagens demais…"); o
//                botão tenta de novo com o mesmo cliente_id, ou descarta
// Sem fila oculta: nada fica esperando por rede voltar — quem decide tentar é o operador.

import { limparTexto, trechoDaCitacao, type MensagemChat } from "./aliancaSirvoChatLogica"

export const LIMITE_TEXTO = 1000
export const LIMITE_OPERADOR = 40
/** Sem retrato com o cliente_id depois disto, "conferindo…" vira "tentar de novo". */
export const CONFERIR_ATE_MS = 30_000
/** Uma "enviada" que o retrato nunca trouxe (apagada, fora das 50 últimas) sai da tela depois disto. */
export const ENVIADA_ATE_MS = 60_000
/** O main deixa uma resposta por segundo; o store espaça os envios um pouco além disso. */
export const ESPACO_ENVIOS_MS = 1_100

export type EstadoSaida = "enviando" | "enviada" | "conferindo" | "falhou" | "recusada"

export type Citacao = { id: string; autor: string; trecho: string }

export type ItemSaida = {
    clienteId: string
    cultoId: string
    texto: string
    /** a mensagem que está sendo respondida (id para o Sirvo, autor/trecho para a tela) */
    citacao: Citacao | null
    /** já limpo e com no máximo 40 letras; null = sem operador */
    operador: string | null
    estado: EstadoSaida
    /** a frase do Sirvo (recusada) ou aviso curto da falha */
    erro: string
    /** quando entrou no estado atual (conta os 30 s e os 60 s) */
    desde: number
}

export type CaixaDeSaida = ItemSaida[]

// ---------------------------------------------------------------- o que se pode enviar

/** O nome de quem opera hoje, como vai para o Sirvo: sem lixo, no máximo 40, vazio = null. */
export function normalizarOperador(valor: unknown): string | null {
    return limparTexto(valor, LIMITE_OPERADOR) || null
}

export type Validacao = { ok: true; texto: string } | { ok: false; motivo: "vazio" | "longo" }

/** O texto do campo vira o texto enviado: sem espaço nas pontas, 1 a 1000 caracteres. */
export function validarEnvio(bruto: unknown): Validacao {
    const texto = limparTexto(typeof bruto === "string" ? bruto : "", 100_000, true)
    if (!texto) return { ok: false, motivo: "vazio" }
    if (Array.from(texto).length > LIMITE_TEXTO) return { ok: false, motivo: "longo" }
    return { ok: true, texto }
}

export function citacaoDe(m: MensagemChat): Citacao {
    return { id: m.id, ...trechoDaCitacao(m) }
}

// ---------------------------------------------------------------- a caixa

export function novoItem(args: { clienteId: string; cultoId: string; texto: string; citacao: Citacao | null; operador: unknown; agora: number }): ItemSaida {
    return { clienteId: args.clienteId, cultoId: args.cultoId, texto: args.texto, citacao: args.citacao, operador: normalizarOperador(args.operador), estado: "enviando", erro: "", desde: args.agora }
}

function trocar(caixa: CaixaDeSaida, clienteId: string, fn: (i: ItemSaida) => ItemSaida): CaixaDeSaida {
    let mudou = false
    const nova = caixa.map((i) => {
        if (i.clienteId !== clienteId) return i
        const x = fn(i)
        if (x !== i) mudou = true
        return x
    })
    return mudou ? nova : caixa
}

export function adicionar(caixa: CaixaDeSaida, item: ItemSaida): CaixaDeSaida {
    return caixa.some((i) => i.clienteId === item.clienteId) ? caixa : [...caixa, item]
}

export function descartar(caixa: CaixaDeSaida, clienteId: string): CaixaDeSaida {
    return caixa.some((i) => i.clienteId === clienteId) ? caixa.filter((i) => i.clienteId !== clienteId) : caixa
}

/** O próximo da fila a enviar (o mais antigo em "enviando"), ou null. */
export function proximoParaEnviar(caixa: CaixaDeSaida, emVoo: string | null): ItemSaida | null {
    if (emVoo) return null
    return caixa.find((i) => i.estado === "enviando") || null
}

// ---------------------------------------------------------------- o que o Sirvo respondeu

export type RespostaEnvio = { ok: true; dados?: any } | { ok: false; codigo: string; mensagem: string }

/**
 * O que fazer depois de uma resposta do show_chat_enviar.
 *  - ok → enviada (inclusive `repetida: true`: o Sirvo já tinha, e é isso que queríamos).
 *  - rede (tempo-limite, sem conexão) ou 5xx → conferindo: pode ter chegado; o próximo retrato diz.
 *  - chave recusada / sem chave → recusada, sem tentar de novo sozinho.
 *  - qualquer outra frase do Sirvo ("Mensagens demais…") → recusada, com a frase.
 */
export function decidirResposta(r: RespostaEnvio): { estado: "enviada" | "conferindo" | "recusada"; erro: string } {
    if (r.ok) return { estado: "enviada", erro: "" }
    if (r.codigo === "rede") return { estado: "conferindo", erro: "" }
    if (r.codigo === "erro" && /^Sirvo respondeu 5\d\d\./.test(r.mensagem || "")) return { estado: "conferindo", erro: "" }
    if (r.codigo === "chave_invalida" || r.codigo === "sem_chave") return { estado: "recusada", erro: "Sem chave do Sirvo válida. Confira em Configurações." }
    return { estado: "recusada", erro: limparTexto(r.mensagem, 200) || "O Sirvo não aceitou a mensagem." }
}

export function aoResposta(caixa: CaixaDeSaida, clienteId: string, r: RespostaEnvio, agora: number): CaixaDeSaida {
    const d = decidirResposta(r)
    return trocar(caixa, clienteId, (i) => (i.estado === "enviando" ? { ...i, estado: d.estado, erro: d.erro, desde: agora } : i))
}

/** "Tentar de novo": volta para a fila com o MESMO cliente_id. Só vale para falhou/recusada. */
export function tentarDeNovo(caixa: CaixaDeSaida, clienteId: string, agora: number): CaixaDeSaida {
    return trocar(caixa, clienteId, (i) => (i.estado === "falhou" || i.estado === "recusada" ? { ...i, estado: "enviando", erro: "", desde: agora } : i))
}

/** O relógio andou: conferindo há mais de 30 s vira falhou; enviada há mais de 60 s sai. */
export function aoTempo(caixa: CaixaDeSaida, agora: number): CaixaDeSaida {
    let mudou = false
    const nova: CaixaDeSaida = []
    for (const i of caixa) {
        if (i.estado === "conferindo" && agora - i.desde >= CONFERIR_ATE_MS) {
            mudou = true
            nova.push({ ...i, estado: "falhou", erro: "Não sei se chegou.", desde: agora })
        } else if (i.estado === "enviada" && agora - i.desde >= ENVIADA_ATE_MS) {
            mudou = true
        } else nova.push(i)
    }
    return mudou ? nova : caixa
}

/** Há algo que depende do relógio (para ligar e desligar o temporizador do store)? */
export function precisaDeRelogio(caixa: CaixaDeSaida): boolean {
    return caixa.some((i) => i.estado === "conferindo" || i.estado === "enviada")
}

// ---------------------------------------------------------------- o retrato trouxe

/**
 * Chegou um retrato: tudo o que ele traz como `minha` com um cliente_id da
 * caixa deixa de ser bolha otimista (a mensagem de verdade já está na lista).
 * Vale também para um item que ainda esperava a vez: a primeira tentativa chegou
 * mesmo assim, então não há o que reenviar.
 */
export function aoRetratoSaida(caixa: CaixaDeSaida, mensagens: MensagemChat[]): CaixaDeSaida {
    const chegou = new Set(mensagens.filter((m) => m.minha && m.cliente_id).map((m) => m.cliente_id as string))
    if (!chegou.size) return caixa
    return caixa.some((i) => chegou.has(i.clienteId)) ? caixa.filter((i) => !chegou.has(i.clienteId)) : caixa
}

/** As bolhas otimistas de um culto, na ordem em que foram escritas, sem as que o retrato já trouxe. */
export function bolhasDoCulto(caixa: CaixaDeSaida, cultoId: string | null, mensagens: MensagemChat[]): ItemSaida[] {
    if (!cultoId) return []
    const chegou = new Set(mensagens.filter((m) => m.minha && m.cliente_id).map((m) => m.cliente_id as string))
    return caixa.filter((i) => i.cultoId === cultoId && !chegou.has(i.clienteId))
}

// ---------------------------------------------------------------- textos do painel

export function rotuloDoEstado(i: Pick<ItemSaida, "estado" | "erro">): string {
    switch (i.estado) {
        case "enviando":
            return "enviando…"
        case "enviada":
            return "enviada"
        case "conferindo":
            return "conferindo…"
        case "falhou":
            return i.erro || "Não sei se chegou."
        case "recusada":
            return i.erro || "Não enviou."
    }
}

/** "você está como Sala de vídeo · Pedro" (a dica do painel quando pode responder). */
export function dicaDeIdentidade(nomeDaChave: string, operador: unknown): string {
    const base = nomeDaChave || "Sala de vídeo"
    const op = normalizarOperador(operador)
    return `você está como ${op ? `${base} · ${op}` : base}`
}

/** O nome da chave, aprendido numa mensagem `minha` já recebida (senão, "Sala de vídeo"). */
export function nomeDaChave(mensagens: MensagemChat[]): string {
    for (let k = mensagens.length - 1; k >= 0; k--) {
        const m = mensagens[k]
        if (!m.minha || !m.autor) continue
        const op = m.operador ? ` · ${m.operador}` : ""
        return op && m.autor.endsWith(op) ? m.autor.slice(0, -op.length) || "Sala de vídeo" : m.autor
    }
    return "Sala de vídeo"
}
