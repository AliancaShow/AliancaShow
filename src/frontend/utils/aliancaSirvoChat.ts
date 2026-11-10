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
import { aoErro, aoRetrato, aoRev, estadoInicial, marcarLidas, type EstadoChat } from "./aliancaSirvoChatLogica"

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
    assinaturaDoRev = null
    sirvoChat.set(estadoInicial())
}
