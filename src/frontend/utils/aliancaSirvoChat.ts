// ----- AliançaShow · chat do culto (F4 v1, só leitura) · store -----
//
// CAMINHO PRÓPRIO, de propósito: não usa o `chamar()` de aliancaSirvo.ts.
// Um erro do chat (conversa desligada, Sirvo lento, resposta estranha) nunca
// mexe em `status`, `ultimaResposta`, `ultimoRoteiroOk` nem no desvio do
// relógio — o indicador do Sirvo no topo não vira "caído" por causa do chat.
// O erro aparece só dentro do painel.
//
// A única ligação com o ciclo do roteiro: depois de um show_rev bom,
// aliancaSirvo.ts chama `chatAoRev`. A busca do retrato NÃO é aguardada lá
// (o roteiro nunca espera o chat) e há no máximo uma em voo por vez.
//
// Este módulo não importa aliancaSirvo.ts (é importado por ele).

import { get, writable } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { aoErro, aoRetrato, aoRev, estadoInicial, marcarLidas, type EstadoChat, type MensagemChat } from "./aliancaSirvoChatLogica"
import { adicionar, aoResposta, aoRetratoSaida, aoTempo, citacaoDe, descartar, ESPACO_ENVIOS_MS, normalizarOperador, novoItem, precisaDeRelogio, proximoParaEnviar, tentarDeNovo, validarEnvio, type CaixaDeSaida, type Citacao, type RespostaEnvio } from "./aliancaSirvoChatSaida"

type Resposta = { ok: true; dados: any; codigo?: undefined; mensagem?: undefined } | { ok: false; codigo: string; mensagem: string; dados?: undefined }

export const sirvoChat = writable<EstadoChat>(estadoInicial())
/** O painel aberto ou recolhido (gesto do operador; sobrevive à troca de aba). */
export const sirvoChatAberto = writable(false)

// ---------------------------------------------------------------- som (desligado por padrão)
// A saída de áudio deste computador costuma ir para a mesa: o som só toca se
// o operador ligar no painel, e a escolha fica guardada neste computador.

const CHAVE_SOM = "aliancashow:sirvo-chat-som"
function lerSom(): boolean {
    try {
        return localStorage.getItem(CHAVE_SOM) === "1"
    } catch {
        return false
    }
}
export const sirvoChatSom = writable(lerSom())
sirvoChatSom.subscribe((on) => {
    try {
        localStorage.setItem(CHAVE_SOM, on ? "1" : "0")
    } catch {
        // sem armazenamento: vale só nesta sessão
    }
})

// ---------------------------------------------------------------- operador (v1.1, D2)
// "Quem opera hoje": opcional, só exibição ("Sala de vídeo · Pedro"), guardado
// neste computador. Vai como p_operador; o Sirvo limita a 40 letras.

const CHAVE_OPERADOR = "aliancashow:sirvo-chat-operador"
function lerOperador(): string {
    try {
        return (localStorage.getItem(CHAVE_OPERADOR) || "").slice(0, 80)
    } catch {
        return ""
    }
}
export const sirvoChatOperador = writable(lerOperador())
sirvoChatOperador.subscribe((nome) => {
    try {
        localStorage.setItem(CHAVE_OPERADOR, nome)
    } catch {
        // sem armazenamento: vale só nesta sessão
    }
})

let audio: AudioContext | null = null
function tocar() {
    try {
        audio = audio || new AudioContext()
        const t = audio.currentTime
        const osc = audio.createOscillator()
        const ganho = audio.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(880, t)
        ganho.gain.setValueAtTime(0.0001, t)
        ganho.gain.exponentialRampToValueAtTime(0.08, t + 0.02)
        ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
        osc.connect(ganho).connect(audio.destination)
        osc.start(t)
        osc.stop(t + 0.3)
    } catch {
        // sem áudio: o selo âmbar continua avisando
    }
}

// ---------------------------------------------------------------- busca

let geracao = 0
let emVoo = false
// a assinatura mais recente que um show_rev trouxe (para buscar de novo se ela
// mudou enquanto um retrato viajava)
let assinaturaDoRev: string | null = null

function atualizar(fn: (e: EstadoChat) => EstadoChat) {
    const antes = get(sirvoChat)
    const depois = fn(antes)
    if (depois !== antes) sirvoChat.set(depois)
}

/** Chamado pelo ciclo do roteiro depois de um show_rev bom. Nunca lança. */
export function chatAoRev(cultoId: string | null, chat: any) {
    try {
        const antes = get(sirvoChat)
        if (antes.cultoId !== cultoId) geracao++ // resposta do culto antigo não vale mais
        const { estado, buscar } = aoRev(antes, cultoId, chat)
        assinaturaDoRev = typeof chat?.assinatura === "string" ? chat.assinatura : null
        if (estado !== antes) sirvoChat.set(estado)
        if (buscar) buscarRetrato()
    } catch (erro) {
        console.error("Sirvo: falha no chat do culto", erro)
    }
}

async function buscarRetrato() {
    if (emVoo) return // a que está em voo confere a assinatura de novo ao voltar
    const cultoId = get(sirvoChat).cultoId
    if (!cultoId) return
    const g = geracao
    emVoo = true
    try {
        const r = ((await requestMain(Main.SIRVO_CHAMAR, { funcao: "show_chat", args: { p_event: cultoId } })) as Resposta | undefined) || { ok: false, codigo: "rede", mensagem: "Sem conexão com o Sirvo." }
        if (g !== geracao) return
        if (r.ok) {
            // as respostas que o retrato já trouxe deixam de ser bolha otimista
            if (get(sirvoChatSaida).length) saidaSet(aoRetratoSaida(get(sirvoChatSaida), Array.isArray(r.dados?.mensagens) ? (r.dados.mensagens as MensagemChat[]) : []))
            let novas = 0
            atualizar((e) => {
                const x = aoRetrato(e, cultoId, r.dados)
                novas = x.novas
                return x.estado
            })
            if (novas > 0 && get(sirvoChatSom)) tocar()
        } else {
            atualizar((e) => aoErro(e, cultoId, r.mensagem))
        }
    } catch (erro) {
        console.error("Sirvo: falha ao ler o chat do culto", erro)
        if (g === geracao) atualizar((e) => aoErro(e, cultoId, "Não consegui ler o chat agora."))
    } finally {
        emVoo = false
    }
    // chegou mensagem enquanto este retrato viajava: busca o novo já, sem esperar o próximo rev
    const agora = get(sirvoChat)
    if (g === geracao && !agora.erro && agora.ligado && !agora.congelado && !agora.motivo && assinaturaDoRev && assinaturaDoRev !== agora.assinatura) buscarRetrato()
}

/** O operador tocou no painel: as novas viram lidas. */
export function marcarChatLido() {
    atualizar(marcarLidas)
}

/** Desconectou, chave recusada: o chat sai junto com o resto do Sirvo. */
export function zerarChat() {
    geracao++
    saidaSet([])
    assinaturaDoRev = null
    sirvoChat.set(estadoInicial())
}

// ---------------------------------------------------------------- responder (F4 v1.1)
// A caixa de saída vive aqui (lógica pura em aliancaSirvoChatSaida.ts). Um
// envio por vez, espaçados (o main limita a um por segundo); o cliente_id nasce
// UMA vez por resposta e é reusado em toda nova tentativa — o Sirvo reconhece
// e não duplica. Sem internet nada fica escondido numa fila: a bolha mostra o
// estado e o operador decide "tentar de novo".

export const sirvoChatSaida = writable<CaixaDeSaida>([])
function saidaSet(c: CaixaDeSaida) {
    if (c !== get(sirvoChatSaida)) sirvoChatSaida.set(c)
    ajustarRelogio()
}

let relogio: ReturnType<typeof setInterval> | null = null
function ajustarRelogio() {
    const precisa = precisaDeRelogio(get(sirvoChatSaida))
    if (precisa && !relogio) relogio = setInterval(() => saidaSet(aoTempo(get(sirvoChatSaida), Date.now())), 2_000)
    else if (!precisa && relogio) {
        clearInterval(relogio)
        relogio = null
    }
}

function novoClienteId(): string {
    try {
        return crypto.randomUUID()
    } catch {
        // contexto sem crypto.randomUUID: v4 simples (o Sirvo só exige um uuid)
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0
            return (c === "x" ? r : (r & 3) | 8).toString(16)
        })
    }
}

let enviandoAgora: string | null = null
let ultimoEnvio = 0
let agendado: ReturnType<typeof setTimeout> | null = null

function andarFila() {
    if (agendado) return
    const prox = proximoParaEnviar(get(sirvoChatSaida), enviandoAgora)
    if (!prox) return
    const espera = Math.max(0, ultimoEnvio + ESPACO_ENVIOS_MS - Date.now())
    agendado = setTimeout(() => {
        agendado = null
        void enviarUm()
    }, espera)
}

async function enviarUm() {
    const item = proximoParaEnviar(get(sirvoChatSaida), enviandoAgora)
    if (!item) return
    enviandoAgora = item.clienteId
    ultimoEnvio = Date.now()
    let r: RespostaEnvio
    try {
        const args = { p_event: item.cultoId, p_texto: item.texto, p_cliente_id: item.clienteId, p_reply_to: item.citacao?.id || null, p_operador: item.operador }
        r = ((await requestMain(Main.SIRVO_CHAMAR, { funcao: "show_chat_enviar", args })) as Resposta | undefined) || { ok: false, codigo: "rede", mensagem: "Sem conexão com o Sirvo." }
    } catch (erro) {
        console.error("Sirvo: falha ao enviar no chat", erro)
        r = { ok: false, codigo: "rede", mensagem: "Sem conexão com o Sirvo." }
    }
    enviandoAgora = null
    saidaSet(aoResposta(get(sirvoChatSaida), item.clienteId, r, Date.now()))
    // o retrato novo costuma chegar no próximo show_rev (até 2 s); a fila segue
    andarFila()
}

/** O operador mandou a resposta. Devolve false (e não faz nada) se o texto não vale ou o chat não responde. */
export function enviarChat(texto: string, citada: MensagemChat | null): boolean {
    const e = get(sirvoChat)
    if (!e.cultoId || !e.ligado || e.congelado || e.motivo || !e.responde) return false
    const v = validarEnvio(texto)
    if (!v.ok) return false
    const cit: Citacao | null = citada ? citacaoDe(citada) : null
    saidaSet(adicionar(get(sirvoChatSaida), novoItem({ clienteId: novoClienteId(), cultoId: e.cultoId, texto: v.texto, citacao: cit, operador: normalizarOperador(get(sirvoChatOperador)), agora: Date.now() })))
    andarFila()
    return true
}

/** "Tentar de novo": o MESMO cliente_id. */
export function tentarChatDeNovo(clienteId: string) {
    saidaSet(tentarDeNovo(get(sirvoChatSaida), clienteId, Date.now()))
    andarFila()
}

export function descartarChat(clienteId: string) {
    saidaSet(descartar(get(sirvoChatSaida), clienteId))
}
