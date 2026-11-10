// ----- AliançaShow · o operador tirou uma música que o Sirvo pôs: os stores (F3) -----
//
// A conta é aliancaSirvoDispensas.ts. Aqui ficam a memória (no `special`, que
// o FreeShow salva com as configurações), o gancho que o clipboard chama ao
// apagar, o relógio da carência, a fila para o Sirvo e a linha da faixa.
//
// Só UMA porta conta como "o operador tirou": `deleteActions.show` (Delete,
// Ctrl+X, "Remover" do menu). O que sai por outro caminho — a própria
// reconciliação, o Remote, a API, o show apagado da biblioteca — não é
// dispensa, e a passada seguinte repõe.
//
// O envio vai pelo mesmo caminho dos pedidos de conduzir (`pedirAoSirvo`: a
// chave entra no main como p_chave). Só com a chave que conduz; sem rede fica
// na fila e tenta de novo quando a conexão volta. Nada aqui lança: o gancho
// roda dentro do apagar do operador, e a conferência dentro da passada.

import { get, writable } from "svelte/store"
import { uid } from "uid"
import type { ProjectShowRef } from "../../types/Projects"
import { projects, special } from "../stores"
import { pedirAoSirvo, porQueNaoConduz, sirvo, sirvoRoteiro, type RespostaPedido, type Roteiro } from "./aliancaSirvo"
import { aplicarRespostaDevolver, aplicarRespostaTirar, avancarDispensas, desfazer, desistir, dispensasDaRemocao, limparPeloRoteiro, marcarFalha, marcasDispensadas, marcasVoltaram, paraDevolver, paraTirar, proximaCarencia, responderLote, resumirDispensas, type Dispensa, type ResumoDispensas } from "./aliancaSirvoDispensas"
import { linhasDoRoteiro, marcaDe, tirarMarca } from "./aliancaSirvoMusicas"
import { newToast } from "./common"

const CHAVE = "aliancaSirvoDispensas"
const ENVIOS = new Set(["aguardando", "confirmar", "fila", "enviada", "local", "devolver"])
/** depois de uma falha, a fila espera isto antes de tentar de novo (a volta da conexão passa na frente) */
const ESPERA_FALHA_MS = 20_000
/** entre dois pedidos seguidos: o main só aceita uma escrita a cada 500 ms */
const ESPERA_ENTRE_MS = 700
/** recusas do Sirvo (não de rede) até desistir */
const RECUSAS_MAX = 3

export type EstadoDispensas = { eventId: string | null; resumo: ResumoDispensas }
/** a linha da faixa (SirvoProjetoFaixa.svelte) */
export const sirvoDispensas = writable<EstadoDispensas>({ eventId: null, resumo: { tipo: "nada" } })

// a passada da montagem (aliancaSirvoMontar registra: assim não há import circular)
let reagendar: () => void = () => {}
// o projeto ligado ao culto seguido, da última conferência (onde a marca sai do item)
let projetoAtual: string | null = null

// ---------------------------------------------------------------- memória

const valida = (d: any): d is Dispensa => !!d && typeof d === "object" && typeof d.rmId === "string" && !!d.rmId && typeof d.eventId === "string" && typeof d.blocoId === "string" && typeof d.nome === "string" && Number.isFinite(d.em) && ENVIOS.has(d.envio) && typeof d.lote === "string"

export function lerDispensas(): Dispensa[] {
    const m = get(special)?.[CHAVE]
    return Array.isArray(m) ? m.filter(valida) : []
}

function gravar(lista: Dispensa[]) {
    special.update((a) => {
        a[CHAVE] = lista
        return a
    })
}

/** o que a reconciliação trata como já satisfeito, sem mexer em nada */
export function marcasDispensadasSirvo(eventId: string): Set<string> {
    return marcasDispensadas(lerDispensas(), eventId)
}

// ---------------------------------------------------------------- o gancho do apagar

/**
 * `deleteActions.show` chama ANTES de escrever: o que o operador tirou numa
 * ação só. Só vale no projeto ligado ao culto seguido (precisa do roteiro para
 * saber que a linha vive e como ela se chama). Os itens ainda estão no projeto
 * neste momento: a conferência de "voltou?" fica para a passada.
 */
export function registrarRemocaoDeMusicasSirvo(eventId: string, removidos: ProjectShowRef[]) {
    try {
        const r = get(sirvoRoteiro)
        if (!r || r.event_id !== eventId || !removidos.some((i) => marcaDe(i))) return
        const lista = lerDispensas()
        const novas = dispensasDaRemocao(removidos, linhasDoRoteiro(r.blocos), lista, { eventId, agora: Date.now(), lote: uid(5), conduz: get(sirvo).podeConduzir })
        if (!novas.length) return
        const nova = [...lista, ...novas]
        gravar(nova)
        console.info(`Sirvo: o operador tirou do projeto ${novas.map((d) => `"${d.nome}" (${d.envio})`).join(", ")}`)
        armarCarencia(nova)
        publicarResumo(eventId, nova)
    } catch (erro) {
        console.error("Sirvo: falha ao registrar a música tirada do projeto", erro)
    }
}

// ---------------------------------------------------------------- a conferência (na passada)

/** as marcas de música que estão no projeto agora */
function marcasNoProjeto(projetoId: string): Set<string> {
    const marcas = new Set<string>()
    for (const item of get(projects)[projetoId]?.shows || []) {
        const m = marcaDe(item)
        if (m) marcas.add(m)
    }
    return marcas
}

/** a marca sai do item, onde está (vira item do operador); fora do history, como toda escrita do Sirvo */
function tirarMarcas(projetoId: string | null, rmIds: string[]) {
    if (!projetoId || !rmIds.length) return
    const set = new Set(rmIds)
    projects.update((a) => {
        const p = a[projetoId]
        if (!p?.shows) return a
        let mudou = false
        for (const item of p.shows) {
            const m = marcaDe(item)
            if (!m || !set.has(m)) continue
            tirarMarca(item, () => uid(5))
            mudou = true
        }
        if (mudou) {
            p.shows = [...p.shows]
            p.modified = Date.now()
        }
        return a
    })
}

/**
 * Roda na passada da montagem, ANTES da conta, sobre o projeto ligado ao
 * culto: a marca que voltou (colar, Ctrl+Z) derruba a dispensa (ou pede a
 * linha de volta ao Sirvo); a carência vencida vira fila ou local; a linha que
 * saiu do roteiro leva a dispensa dela. Grava só o que mudou, arma o relógio,
 * publica a faixa e empurra a fila. Devolve as marcas que a conta trata como
 * dispensadas. Nunca lança.
 */
export function conferirDispensasSirvo(eventId: string, projetoId: string, r: Roteiro | null): Set<string> {
    try {
        projetoAtual = projetoId
        const antes = lerDispensas()
        const agora = Date.now()
        const conduz = get(sirvo).podeConduzir
        const volta = marcasVoltaram(antes, eventId, marcasNoProjeto(projetoId), conduz, idsEmVoo)
        let lista = volta.lista
        if (volta.tirarMarca.length) tirarMarcas(projetoId, volta.tirarMarca)
        lista = avancarDispensas(lista, agora, conduz)
        if (r && r.event_id === eventId) lista = limparPeloRoteiro(lista, eventId, new Set(linhasDoRoteiro(r.blocos).keys()), agora)
        if (lista !== antes) gravar(lista)
        armarCarencia(lista)
        publicarResumo(eventId, lista)
        if (lista.some((d) => d.eventId === eventId && (d.envio === "fila" || d.envio === "devolver"))) agendarEnvio(0)
        return marcasDispensadas(lista, eventId)
    } catch (erro) {
        console.error("Sirvo: falha ao conferir as músicas tiradas do projeto", erro)
        return new Set()
    }
}

function publicarResumo(eventId: string, lista: Dispensa[]) {
    const novo: EstadoDispensas = { eventId, resumo: resumirDispensas(lista, eventId) }
    const atual = get(sirvoDispensas)
    if (atual.eventId === novo.eventId && JSON.stringify(atual.resumo) === JSON.stringify(novo.resumo)) return
    sirvoDispensas.set(novo)
}

// ---------------------------------------------------------------- a carência

let relogioCarencia: ReturnType<typeof setTimeout> | null = null
function armarCarencia(lista: Dispensa[]) {
    if (relogioCarencia) clearTimeout(relogioCarencia)
    relogioCarencia = null
    const quando = proximaCarencia(lista)
    if (quando === null) return
    relogioCarencia = setTimeout(
        () => {
            relogioCarencia = null
            reagendar() // a passada confere (a marca voltou?) e manda
        },
        Math.max(0, quando - Date.now()) + 50
    )
}

// ---------------------------------------------------------------- a fila para o Sirvo

let emVoo = false
// as linhas do pedido em voo: se a marca voltar ao projeto antes da resposta, o pedido pode ter chegado (vira "devolver")
let idsEmVoo = new Set<string>()
let relogioEnvio: ReturnType<typeof setTimeout> | null = null
let vencimentoEnvio = 0
let esperaAte = 0
const recusas = new Map<string, number>()

function agendarEnvio(atraso: number) {
    const quando = Date.now() + atraso
    if (relogioEnvio && vencimentoEnvio <= quando) return
    if (relogioEnvio) clearTimeout(relogioEnvio)
    vencimentoEnvio = quando
    relogioEnvio = setTimeout(() => {
        relogioEnvio = null
        enviar().catch((erro) => console.error("Sirvo: falha ao avisar a música tirada", erro))
    }, atraso)
}

/** um pedido por vez: a leva da fila (show_tirar_musicas) ou UMA linha a devolver */
async function enviar() {
    if (emVoo) return
    const eventId = get(sirvo).cultoId
    if (!eventId) return
    if (Date.now() < esperaAte) return agendarEnvio(esperaAte - Date.now())
    const lista = lerDispensas()
    const tirar = paraTirar(lista, eventId)
    const devolver = paraDevolver(lista, eventId)
    if (!tirar.length && !devolver.length) return
    // sem conexão, sem conduzir ou com outro pedido em voo: espera o próximo gatilho (a volta da conexão, o roteiro novo)
    if (porQueNaoConduz()) return

    emVoo = true
    idsEmVoo = new Set(tirar.length ? tirar.map((d) => d.rmId) : [])
    let falhou = false
    try {
        if (tirar.length) falhou = !(await tirarNoSirvo(tirar.map((d) => d.rmId)))
        else falhou = !(await devolverNoSirvo(devolver[0].rmId))
    } catch (erro) {
        console.error("Sirvo: falha ao avisar a música tirada", erro)
        falhou = true
    } finally {
        emVoo = false
        idsEmVoo = new Set()
    }
    if (falhou) esperaAte = Date.now() + ESPERA_FALHA_MS
    const resta = lerDispensas().some((d) => d.eventId === eventId && (d.envio === "fila" || d.envio === "devolver"))
    if (resta) agendarEnvio(falhou ? ESPERA_FALHA_MS : ESPERA_ENTRE_MS)
    reagendar()
}

/** true se o Sirvo respondeu (mesmo recusando de vez); false para tentar de novo */
async function tirarNoSirvo(ids: string[]): Promise<boolean> {
    const res = await pedirAoSirvo("show_tirar_musicas", { p_linhas: ids })
    if (res.ok && res.dados && typeof res.dados === "object" && res.dados.ok !== false) {
        const lista = aplicarRespostaTirar(lerDispensas(), ids, res.dados)
        gravar(lista)
        ids.forEach((id) => recusas.delete(id))
        const feitas = lista.filter((d) => ids.includes(d.rmId) && d.envio === "enviada").map((d) => d.nome)
        console.info(`Sirvo: tirada(s) do roteiro a pedido do operador: ${feitas.join(", ") || "nenhuma"}`)
        return true
    }
    naoDeu(ids, "fila", res)
    return false
}

async function devolverNoSirvo(rmId: string): Promise<boolean> {
    const res = await pedirAoSirvo("show_devolver_musica", { p_linha: rmId })
    if (res.ok && res.dados && typeof res.dados === "object") {
        const r = aplicarRespostaDevolver(lerDispensas(), rmId, res.dados)
        gravar(r.lista)
        recusas.delete(rmId)
        if (r.tirarMarca) {
            tirarMarcas(projetoAtual, [rmId])
            newToast(`O Sirvo não pôs a música de volta (${res.dados.motivo === "cheio" ? "o bloco está cheio" : "o bloco não existe mais"}). Ela fica no projeto como item seu.`)
        } else {
            console.info(`Sirvo: a música voltou ao roteiro a pedido do operador${res.dados.ja_estava ? " (já estava)" : ""}`)
        }
        return true
    }
    naoDeu([rmId], "devolver", res)
    return false
}

/**
 * Sem resposta boa. Rede, "ocupado" ou "agora não" (porQueNaoConduz): fica na
 * fila, marcada, e tenta de novo. Recusa do Sirvo: conta, e na terceira
 * desiste — a da fila fica só daqui, a de devolver vira item do operador.
 */
function naoDeu(ids: string[], envio: "fila" | "devolver", res: RespostaPedido) {
    const mensagem = res.ok ? "resposta inesperada" : res.mensagem
    const transitoria = !res.ok && (!res.codigo || res.codigo === "rede" || res.codigo === "ocupado")
    let lista = marcarFalha(lerDispensas(), ids, envio)
    if (!transitoria) {
        const esgotadas = ids.filter((id) => {
            const n = (recusas.get(id) || 0) + 1
            recusas.set(id, n)
            return n >= RECUSAS_MAX
        })
        if (esgotadas.length) {
            const r = desistir(lista, esgotadas)
            lista = r.lista
            tirarMarcas(projetoAtual, r.tirarMarca)
            esgotadas.forEach((id) => recusas.delete(id))
            newToast(envio === "fila" ? `O Sirvo não aceitou tirar a música (${mensagem}). Ela fica fora só aqui.` : `O Sirvo não aceitou a música de volta (${mensagem}). Ela fica no projeto como item seu.`)
        }
    }
    gravar(lista)
    console.warn(`Sirvo: ${envio === "fila" ? "tirar a música" : "devolver a música"} não deu (${mensagem})${transitoria ? "; tento de novo" : ""}`)
}

// ---------------------------------------------------------------- botões da faixa

/**
 * "Desfazer": a dispensa cai e a reconciliação traz o item de volta. A que
 * estava na fila pode ter chegado ao Sirvo sem o Show saber (tempo estourado):
 * pede a linha de volta por garantia (`ja_estava` é inócuo).
 */
export function desfazerDispensasSirvo(rmIds: string[]) {
    try {
        const r = desfazer(lerDispensas(), rmIds)
        gravar(r.lista)
        if (r.devolverPorGarantia.length) devolverPorGarantia(r.devolverPorGarantia).catch((erro) => console.warn("Sirvo: a devolução por garantia não deu", erro))
        reagendar()
    } catch (erro) {
        console.error("Sirvo: falha ao desfazer a música tirada", erro)
    }
}

async function devolverPorGarantia(ids: string[]) {
    const pausa = () => new Promise((resolve) => setTimeout(resolve, ESPERA_ENTRE_MS))
    for (const id of ids) {
        // o main só aceita uma escrita a cada 500 ms (o "tirar" pode ter acabado de sair): "ocupado" tenta de novo
        for (let tentativa = 0; tentativa < 3; tentativa++) {
            if (porQueNaoConduz()) return
            const res = await pedirAoSirvo("show_devolver_musica", { p_linha: id })
            if (res.ok || (res.codigo !== "ocupado" && res.codigo !== "rede")) {
                if (!res.ok) console.warn(`Sirvo: a devolução por garantia não deu (${res.mensagem})`)
                break
            }
            await pausa()
        }
        await pausa()
    }
}

/** a resposta à pergunta do lote: "Tirar do Sirvo também" / "Manter só aqui" */
export function responderLoteSirvo(lote: string, resposta: "tirar" | "manter") {
    try {
        gravar(responderLote(lerDispensas(), lote, resposta))
        reagendar()
    } catch (erro) {
        console.error("Sirvo: falha ao responder sobre as músicas tiradas", erro)
    }
}

// ---------------------------------------------------------------- início

let iniciado = false
/** Chamado por iniciarMontagemSirvo, com a função que agenda a passada. */
export function iniciarDispensasSirvo(passada: () => void) {
    if (iniciado) return
    iniciado = true
    reagendar = passada
    // a conexão voltou, ou a chave passou a conduzir: a fila tenta na hora.
    // Quem assina não pode lançar (o `set` roda os assinantes ali mesmo).
    let antes = get(sirvo)
    sirvo.subscribe((e) => {
        try {
            const voltou = (e.status === "conectado" && antes.status !== "conectado") || (e.podeConduzir && !antes.podeConduzir)
            antes = e
            if (!voltou) return
            esperaAte = 0
            agendarEnvio(0)
        } catch (erro) {
            console.error("Sirvo: falha ao retomar a fila das músicas tiradas", erro)
        }
    })
}
