// ----- AliançaShow · ponte com o Sirvo (processo principal) -----
//
// A chave do Sirvo mora SÓ aqui, no main: cifrada com safeStorage dentro do
// store ACCESS, e nunca atravessa para o renderer (que exibe texto de fora).
// O renderer pede "chame show_rev com estes argumentos" por IPC; este módulo
// acrescenta a chave e faz o POST. Desenho: docs/INTEGRACAO-SIRVO.md §4-§5.

import { safeStorage } from "electron"
import { _store } from "../data/store"

// Endereço e chave PÚBLICA do projeto (a mesma que vai no app web do Sirvo).
// Quem dá acesso é a chave do dispositivo, não esta.
const SIRVO_URL = "https://acwpsnfvliidyxtjevfv.supabase.co/rest/v1/rpc/"
const SIRVO_APIKEY = "sb_publishable_3s0fAbx7UN1nZl6nekdABQ_BlF6KnHo"

// Só as funções de leitura da F0a. Qualquer outro nome é recusado aqui mesmo.
const FUNCOES = new Set(["show_cultos", "show_rev", "show_roteiro"])
const TEMPO_LIMITE_MS = 8_000
const CHAVE_NO_COFRE = "sirvo"
const FORMATO_DA_CHAVE = /^sirvo_show_[A-Za-z0-9_-]{20,100}$/

export type RespostaSirvo = { ok: true; dados: any } | { ok: false; codigo: "sem_chave" | "chave_invalida" | "culto_inexistente" | "rede" | "erro"; mensagem: string }

let chaveEmMemoria: string | null = null

function lerDoCofre(): string | null {
    if (chaveEmMemoria) return chaveEmMemoria
    const salvo = _store.ACCESS?.get(CHAVE_NO_COFRE) as { cifrada?: string } | undefined
    if (!salvo?.cifrada) return null
    try {
        chaveEmMemoria = safeStorage.decryptString(Buffer.from(salvo.cifrada, "base64"))
        return chaveEmMemoria
    } catch {
        // cofre de outro usuário do Windows / outra máquina: trata como sem chave
        return null
    }
}

export function sirvoTemChave(): boolean {
    return !!lerDoCofre()
}

export function sirvoSalvarChave(chave: string): { ok: boolean; erro?: string } {
    const limpa = (chave || "").trim()
    if (!FORMATO_DA_CHAVE.test(limpa)) return { ok: false, erro: "Isso não parece uma chave do Sirvo (começa com sirvo_show_)." }
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, erro: "Este computador não oferece cofre seguro para guardar a chave." }
    const cifrada = safeStorage.encryptString(limpa).toString("base64")
    _store.ACCESS?.set(CHAVE_NO_COFRE, { cifrada })
    chaveEmMemoria = limpa
    return { ok: true }
}

// devolve algo de propósito: o IPC só responde quando há resposta, e sem ela
// o renderer esperaria o tempo-limite de 15 s para saber que desconectou
export function sirvoApagarChave(): { ok: true } {
    _store.ACCESS?.delete(CHAVE_NO_COFRE)
    chaveEmMemoria = null
    return { ok: true }
}

export async function sirvoChamar(funcao: string, args: { [key: string]: any } = {}): Promise<RespostaSirvo> {
    if (!FUNCOES.has(funcao)) return { ok: false, codigo: "erro", mensagem: "Função do Sirvo não permitida." }
    const chave = lerDoCofre()
    if (!chave) return { ok: false, codigo: "sem_chave", mensagem: "Sem chave do Sirvo." }

    const controle = new AbortController()
    const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS)
    try {
        const resposta = await fetch(SIRVO_URL + funcao, {
            method: "POST",
            headers: { apikey: SIRVO_APIKEY, "Content-Type": "application/json" },
            body: JSON.stringify({ ...args, p_chave: chave }),
            signal: controle.signal
        })
        const corpo: any = await resposta.json().catch(() => null)
        if (resposta.ok) return { ok: true, dados: corpo }

        const codigo = corpo?.code
        if (codigo === "42501") return { ok: false, codigo: "chave_invalida", mensagem: "Chave do Sirvo inválida ou revogada." }
        if (codigo === "P0002") return { ok: false, codigo: "culto_inexistente", mensagem: "Culto não encontrado no Sirvo." }
        return { ok: false, codigo: "erro", mensagem: `Sirvo respondeu ${resposta.status}.` }
    } catch {
        return { ok: false, codigo: "rede", mensagem: "Sem conexão com o Sirvo." }
    } finally {
        clearTimeout(limite)
    }
}
