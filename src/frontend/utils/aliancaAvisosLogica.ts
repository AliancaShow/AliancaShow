// Cabine 6 (Andre, 23/nov: "tudo nesse toast e tao feio"): os avisos da janela principal moram NO leiaute, numa linha de estado no pe da tela
// (AliancaAvisos.svelte), nunca flutuando por cima do No ar ou da grade. Aqui so a conta, sem store e sem DOM:
//   - o nivel de cada mensagem antiga do `newToast` (info neutro, aviso laranja, erro vermelho);
//   - a chave de traducao que nao existe (falha alta: a linha mostra a CHAVE, nunca um texto vazio);
//   - a fila: info some sozinho em INFO_MS; aviso e erro ficam ate resolver ou ate o x; a mesma chave nao empilha (conta as vezes);
//   - o historico curto ("ultimos avisos").

export type Nivel = "info" | "aviso" | "erro"
export type Aviso = { id: number; chave: string; texto: string; nivel: Nivel; em: number; vezes: number }

export const INFO_MS = 5000
export const HISTORICO_MAX = 30

/** chaves (ou comeco de texto) que sao ERRO: algo pedido nao aconteceu por defeito ou arquivo faltando */
const ERRO_CHAVE = /^(error\.|toast\.error_media\b)/
const ERRO_TEXTO = /^(error\b|erro\b|failed\b|could not\b|arquivo não encontrado|não consegui|falha\b)/i

/** chaves que sao AVISO: o pedido foi recusado e o operador precisa saber por que */
const AVISO_CHAVE = /^(empty\.|output\.state_locked\b|show\.locked\b|profile\.locked\b|remote\.wrong_password\b|create_show\.exists\b|toast\.(no_name|one_output|midi_|unsupported_video|lyrics_undefined|verse_undefined|delete_shows_empty|empty_styles|autosize_disabled|action_no_id))/
/** textos (pt, ja prontos) que sao AVISO: recusa, travado, "abra de novo" */
const AVISO_TEXTO = /^(não |nao |o telão está congelado|telão congelado|há um culto|o roteiro desse culto|a seleção mudou|a lista mudou|o roteiro mudou|timed out|device already|invalid |a pasta do sirvo|esse show não tem|o sirvo não|a bíblia .* ainda não|máximo |marque pelo menos|escolha |é o primeiro|só dá|ponha o cursor|dê um nome|clique com o botão direito|did you mean|note:|nenhum |mídia offline|a pasta ".*" não tem|versículo não encontrado|o telão não)/i

export function nivelDaMensagem(msg: string): Nivel {
    const m = String(msg ?? "").trim()
    if (ERRO_CHAVE.test(m) || ERRO_TEXTO.test(m)) return "erro"
    if (AVISO_CHAVE.test(m) || AVISO_TEXTO.test(m)) return "aviso"
    return "info"
}

/**
 * a chave de traducao que a mensagem traz no COMECO e que o dicionario nao tem (ou null). So o comeco: "toast.midi_no_slide 3" olha
 * "toast.midi_no_slide"; um caminho "C:/x.mp4" no meio de um texto nunca e chave.
 */
export function chaveSemTexto(msg: string, tem: (grupo: string, chave: string) => boolean): string | null {
    const m = /^([a-z][a-zA-Z0-9_-]*)\.([a-zA-Z0-9_-]+)(?=\s|$)/.exec(String(msg ?? "").trim())
    if (!m) return null
    return tem(m[1], m[2]) ? null : `${m[1]}.${m[2]}`
}

/** o texto que a linha mostra: a traducao, ou a CHAVE com o defeito dito (falha alta, nunca vazio) */
export function textoDaMensagem(msg: string, traduzir: (s: string) => string, tem: (grupo: string, chave: string) => boolean): { texto: string; nivel: Nivel } {
    const falta = chaveSemTexto(msg, tem)
    if (falta) return { texto: `${msg} (mensagem sem texto: ${falta})`, nivel: "aviso" }
    const texto = traduzir(msg)
    if (!texto.trim()) return { texto: `(mensagem vazia: ${JSON.stringify(msg)})`, nivel: "aviso" }
    return { texto, nivel: nivelDaMensagem(msg) }
}

/** pares do Toast antigo: quando `quando` chega, o `se` (em curso) ja nao vale */
export const RESOLVE: { se: string; quando: string }[] = [
    { se: "toast.saving", quando: "toast.saved" },
    { se: "cloud.syncing", quando: "cloud.sync_complete" },
    { se: "error.media", quando: "toast.media_replaced" },
    { se: "settings.backup_started", quando: "settings.backup_finished" },
    { se: "settings.restore_started", quando: "settings.restore_finished" },
    { se: "toast.recording_started", quando: "toast.recording_stopped" },
    { se: "actions.copied", quando: "actions.pasted" }
]

/** poe um aviso na fila. A mesma chave nao empilha: atualiza texto/nivel, soma as vezes e volta a contar o tempo */
export function acrescentar(lista: Aviso[], novo: { chave: string; texto: string; nivel: Nivel }, id: number, agora: number): Aviso[] {
    const resolvidos = RESOLVE.filter((r) => r.quando === novo.chave).map((r) => r.se)
    const base = lista.filter((a) => !resolvidos.includes(a.chave))
    const i = base.findIndex((a) => a.chave === novo.chave)
    if (i < 0) return [...base, { id, chave: novo.chave, texto: novo.texto, nivel: novo.nivel, em: agora, vezes: 1 }]
    const antigo = base[i]
    return [...base.slice(0, i), ...base.slice(i + 1), { ...antigo, texto: novo.texto, nivel: novo.nivel, em: agora, vezes: antigo.vezes + 1 }]
}

/** info passa sozinho; aviso e erro nunca vencem (ficam ate resolver ou ate o x) */
export function vencer(lista: Aviso[], agora: number): Aviso[] {
    const fica = lista.filter((a) => a.nivel !== "info" || agora - a.em < INFO_MS)
    return fica.length === lista.length ? lista : fica
}

export const tirarId = (lista: Aviso[], id: number): Aviso[] => lista.filter((a) => a.id !== id)
export const tirarChave = (lista: Aviso[], chave: string): Aviso[] => (lista.some((a) => a.chave === chave) ? lista.filter((a) => a.chave !== chave) : lista)

const PESO: Record<Nivel, number> = { erro: 2, aviso: 1, info: 1 }

/**
 * o que a linha mostra agora: erro passa na frente de tudo; aviso e info dividem a vez pelo mais novo (a info passageira, como a dica do Esc,
 * aparece por cima de um aviso velho e some em 5 s, devolvendo a linha ao aviso). Entre iguais, o mais novo. `outros` = quantos ficam atras
 */
export function principal(lista: Aviso[]): { aviso: Aviso | null; outros: number } {
    let melhor: Aviso | null = null
    for (const a of lista) if (!melhor || PESO[a.nivel] > PESO[melhor.nivel] || (PESO[a.nivel] === PESO[melhor.nivel] && a.em >= melhor.em)) melhor = a
    return { aviso: melhor, outros: melhor ? lista.length - 1 : 0 }
}

/** historico: o mais novo em cima, no maximo HISTORICO_MAX; a mesma chave seguida nao repete a linha */
export function noHistorico(hist: Aviso[], a: Aviso): Aviso[] {
    const sem = hist[0]?.chave === a.chave ? hist.slice(1) : hist
    return [a, ...sem].slice(0, HISTORICO_MAX)
}
