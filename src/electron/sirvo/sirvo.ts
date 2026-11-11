// ----- AliançaShow · ponte com o Sirvo (processo principal) -----
//
// A chave do Sirvo mora SÓ aqui, no main: cifrada com safeStorage dentro do
// store ACCESS, e nunca atravessa para o renderer (que exibe texto de fora).
// O renderer pede "chame show_rev com estes argumentos" por IPC; este módulo
// acrescenta a chave e faz o POST. Desenho: docs/INTEGRACAO-SIRVO.md §4-§5.

import { safeStorage } from "electron"
import { isProd } from ".."
import { _store } from "../data/store"

// Endereço e chave PÚBLICA de cada projeto (as mesmas que vão no app web do
// Sirvo). Quem dá acesso é a chave do dispositivo, não esta.
// O Show instalado fala com a PRODUÇÃO; o Show rodando em desenvolvimento
// (npm start) fala com o STAGING do Sirvo — testar nunca mexe no culto real.
const AMBIENTES = {
    producao: { url: "https://acwpsnfvliidyxtjevfv.supabase.co/rest/v1/rpc/", apikey: "sb_publishable_3s0fAbx7UN1nZl6nekdABQ_BlF6KnHo" },
    staging: { url: "https://lnnlkavwgaosnikeacpd.supabase.co/rest/v1/rpc/", apikey: "sb_publishable_mH4z5OVTdZmVoXkJC30ZAQ_Md7kM0q0" }
}
// Calculado na HORA, nunca no carregamento: este módulo é importado (via
// responsesMain) enquanto o index ainda carrega, e um `isProd` lido cedo
// demais viria undefined — o Show de produção cairia no staging.
export function sirvoAmbiente(): keyof typeof AMBIENTES {
    return isProd === false ? "staging" : "producao"
}

// Leitura (F0a) e escrita (F2, migration 0081 do Sirvo). Qualquer outro nome é
// recusado aqui mesmo.
const LEITURA = ["show_cultos", "show_rev", "show_roteiro"]
const ESCRITA = ["show_iniciar", "show_encerrar", "show_reabrir", "show_avancar", "show_desfazer_bloco", "show_ajustar_duracao", "show_mover_bloco", "show_criar_bloco", "show_apagar_bloco", "show_editar_bloco"]
// O chat do culto (F4 v1, migration 0084 do Sirvo): só leitura, caminho próprio
// no renderer (aliancaSirvoChat.ts). Fora da trava de escrita: ler o chat
// nunca pode atrasar "avançar bloco".
const CHAT = ["show_chat"]
// Responder no chat (F4 v1.1, migration 0089 do Sirvo): escrita com trava PRÓPRIA
// de 1 s. A trava de 500 ms do roteiro não é tocada: mandar "ok" e logo em
// seguida tocar "Encerrar bloco" faz os dois funcionarem.
const CHAT_ESCRITA = ["show_chat_enviar"]
const FUNCOES = new Set([...LEITURA, ...ESCRITA, ...CHAT, ...CHAT_ESCRITA])
const DE_ESCRITA = new Set(ESCRITA)
const DO_CHAT = new Set(CHAT)
const DE_CHAT_ESCRITA = new Set(CHAT_ESCRITA)
// No máximo uma escrita a cada 500 ms, venha de onde vier no renderer: protege
// contra duplo clique e contra um renderer que enlouqueça (o Sirvo também limita).
const ESCRITA_MIN_MS = 500
let ultimaEscrita = 0
const CHAT_ESCRITA_MIN_MS = 1_000
let ultimaEscritaChat = 0
const TEMPO_LIMITE_MS = 8_000
// cofre separado por ambiente: a chave do staging nunca é usada contra a produção
const chaveNoCofre = () => (sirvoAmbiente() === "staging" ? "sirvo_staging" : "sirvo")
const FORMATO_DA_CHAVE = /^sirvo_show_[A-Za-z0-9_-]{20,100}$/

export type RespostaSirvo = { ok: true; dados: any } | { ok: false; codigo: "sem_chave" | "chave_invalida" | "culto_inexistente" | "rede" | "erro"; mensagem: string }

let chaveEmMemoria: string | null = null

function lerDoCofre(): string | null {
    if (chaveEmMemoria) return chaveEmMemoria
    const salvo = _store.ACCESS?.get(chaveNoCofre()) as { cifrada?: string } | undefined
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
    _store.ACCESS?.set(chaveNoCofre(), { cifrada })
    chaveEmMemoria = limpa
    return { ok: true }
}

// devolve algo de propósito: o IPC só responde quando há resposta, e sem ela
// o renderer esperaria o tempo-limite de 15 s para saber que desconectou
export function sirvoApagarChave(): { ok: true } {
    _store.ACCESS?.delete(chaveNoCofre())
    chaveEmMemoria = null
    return { ok: true }
}

export async function sirvoChamar(funcao: string, args: { [key: string]: any } = {}): Promise<RespostaSirvo> {
    if (!FUNCOES.has(funcao)) return { ok: false, codigo: "erro", mensagem: "Função do Sirvo não permitida." }
    const chave = lerDoCofre()
    if (!chave) return { ok: false, codigo: "sem_chave", mensagem: "Sem chave do Sirvo." }
    const escrita = DE_ESCRITA.has(funcao)
    if (escrita) {
        const agora = Date.now()
        if (agora - ultimaEscrita < ESCRITA_MIN_MS) return { ok: false, codigo: "erro", mensagem: "Calma: um pedido de cada vez." }
        ultimaEscrita = agora
    }

    const escritaChat = DE_CHAT_ESCRITA.has(funcao)
    if (escritaChat) {
        const agora = Date.now()
        if (agora - ultimaEscritaChat < CHAT_ESCRITA_MIN_MS) return { ok: false, codigo: "erro", mensagem: "Calma: um pedido de cada vez." }
        ultimaEscritaChat = agora
    }

    const controle = new AbortController()
    const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS)
    try {
        const ambiente = AMBIENTES[sirvoAmbiente()]
        const resposta = await fetch(ambiente.url + funcao, {
            method: "POST",
            headers: { apikey: ambiente.apikey, "Content-Type": "application/json" },
            body: JSON.stringify({ ...args, p_chave: chave }),
            signal: controle.signal
        })
        const corpo: any = await resposta.json().catch(() => null)
        if (resposta.ok) return { ok: true, dados: corpo }

        const codigo = corpo?.code
        // 42501 também é "permission denied" do Postgres (um GRANT faltando numa
        // migration). Só é chave recusada com a mensagem do próprio Sirvo; o
        // resto vira erro comum: o Show segue tentando em vez de se desligar.
        if (codigo === "42501" && String(corpo?.message || "").startsWith("Chave do Sirvo")) return { ok: false, codigo: "chave_invalida", mensagem: "Chave do Sirvo inválida ou revogada." }
        if (codigo === "P0002") return { ok: false, codigo: "culto_inexistente", mensagem: "Culto não encontrado no Sirvo." }
        // Numa escrita (e no chat), a recusa do Sirvo é a frase que o operador
        // precisa ler ("O bloco no ar não muda de lugar…"): repassa, curta e só texto.
        if ((escrita || escritaChat || DO_CHAT.has(funcao)) && typeof corpo?.message === "string" && corpo.message) return { ok: false, codigo: "erro", mensagem: corpo.message.slice(0, 200) }
        return { ok: false, codigo: "erro", mensagem: `Sirvo respondeu ${resposta.status}.` }
    } catch {
        // Escrita que estourou o tempo pode ter chegado: quem diz é o próximo rev.
        if (escrita || escritaChat) return { ok: false, codigo: "rede", mensagem: "Não sei se o Sirvo recebeu — conferindo…" }
        return { ok: false, codigo: "rede", mensagem: "Sem conexão com o Sirvo." }
    } finally {
        clearTimeout(limite)
    }
}
