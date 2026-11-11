// ----- AliançaShow · o material do Sirvo no projeto do culto (F5, S3, renderer) -----
//
// O download é do processo principal (src/electron/sirvo/material.ts): ele
// pede a URL, baixa, confere e guarda no disco. Este arquivo cuida do outro
// lado:
//   - pede ao main que sincronize (a cada ciclo de cultos, 60 s) e guarda o
//     estado dele (sem URL) em `sirvoMaterialEstado`, que o SirvoIndicador mostra;
//   - põe o que chegou no projeto do culto seguido, em "Fora do roteiro", com a
//     marca `data.sirvoMaterial` (a conta é aliancaSirvoMaterialConta.ts);
//   - diz ao Sirvo `no_projeto` (uma vez por item) e `usado` (uma vez, quando o
//     item chega a uma saída).
// Desenho: docs/INTEGRACAO-SIRVO-MATERIAL.md.

import { get, writable } from "svelte/store"
import type { EstadoMaterial } from "../../electron/sirvo/materialLogica"
import type { ProjectShowRef } from "../../types/Projects"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { outputs, special } from "../stores"
import { conciliarMaterial, mapaDoRoteiro, marcaDoMaterial, type Baixado, type MaterialDoRoteiro, type ResultadoMaterial } from "./aliancaSirvoMaterialConta"

const VAZIO: EstadoMaterial = { habilitado: null, baixando: 0, naFila: 0, lote: { total: 0, feitos: 0 }, falhas: [], baixados: [] }
export const sirvoMaterialEstado = writable<EstadoMaterial>(VAZIO)

// ---------------------------------------------------------------- o main

let emVoo = false
let timerPoll: ReturnType<typeof setTimeout> | null = null
let geracaoLocal = 0

function aceitar(e: EstadoMaterial | undefined | null) {
    if (!e || typeof e !== "object") return
    if (JSON.stringify(e) !== JSON.stringify(get(sirvoMaterialEstado))) sirvoMaterialEstado.set(e)
}

/** Chamado a cada ciclo de cultos (60 s) e ao conectar. Nunca lança. */
export async function sincronizarMaterial() {
    if (emVoo) return
    emVoo = true
    const g = geracaoLocal
    try {
        const e = (await requestMain(Main.SIRVO_MATERIAL_SINCRONIZAR)) as EstadoMaterial | undefined
        if (g !== geracaoLocal) return
        aceitar(e)
        acompanhar(g)
    } catch (erro) {
        console.error("Sirvo: falha ao sincronizar o material", erro)
    } finally {
        emVoo = false
    }
}

/** enquanto baixa, olha o estado a cada 3 s (barato: não vai à rede) */
function acompanhar(g: number) {
    if (timerPoll) clearTimeout(timerPoll)
    timerPoll = null
    const e = get(sirvoMaterialEstado)
    if (!e.baixando && !e.naFila) return
    timerPoll = setTimeout(async () => {
        timerPoll = null
        if (g !== geracaoLocal) return
        try {
            aceitar((await requestMain(Main.SIRVO_MATERIAL_ESTADO)) as EstadoMaterial | undefined)
        } catch {}
        if (g === geracaoLocal) acompanhar(g)
    }, 3_000)
}

/** desconectou do Sirvo: o estado some (o que está no disco continua lá, e o main guarda o mapa) */
export function zerarMaterial() {
    geracaoLocal++
    if (timerPoll) clearTimeout(timerPoll)
    timerPoll = null
    sirvoMaterialEstado.set(VAZIO)
}

// ---------------------------------------------------------------- memória

// O que o Show já fez com cada material, guardado no `special` (salvo com as
// configurações): em qual projeto ele pôs o item (o item que o operador tirou à
// mão não volta), e se já avisou o Sirvo de `no_projeto` e `usado`.
const CHAVE_MEMORIA = "aliancaSirvoMaterial"
const PRAZO_MEMORIA_MS = 90 * 86_400_000
type Memoria = { projeto: string; em: number; np?: 1; us?: 1 }

function lerMemoria(): { [id: string]: Memoria } {
    const m = get(special)?.[CHAVE_MEMORIA]
    return m && typeof m === "object" ? m : {}
}

function mudarMemoria(fn: (m: { [id: string]: Memoria }) => void) {
    special.update((a) => {
        const nova = { ...(a[CHAVE_MEMORIA] || {}) }
        fn(nova)
        const corte = Date.now() - PRAZO_MEMORIA_MS
        for (const k of Object.keys(nova)) if (!(nova[k]?.em > corte)) delete nova[k]
        a[CHAVE_MEMORIA] = nova
        return a
    })
}

// ---------------------------------------------------------------- avisar o Sirvo

const emRelato = new Set<string>()
let relatarApos = 0 // recuo: rede, interruptor desligado ou limite de 60/min

/** `no_projeto` / `usado`: uma vez por item; se não chegou, a próxima passada tenta de novo */
async function relatar(id: string, status: "no_projeto" | "usado", codec: string | null | undefined) {
    const chave = `${id}|${status}`
    if (emRelato.has(chave) || Date.now() < relatarApos) return
    emRelato.add(chave)
    try {
        const r: any = await requestMain(Main.SIRVO_CHAMAR, { funcao: "show_material_status", args: { p_id: id, p_status: status, p_detalhe: null, p_codec: codec ?? null } })
        // o Sirvo recusar ("erro") não melhora tentando de novo; rede e chave desligada, sim
        // 54000 (mais de 60/min) e 55000 (ainda não pronto) ficam para a próxima passada
        if (!r?.ok && (r?.codigo === "rede" || r?.codigo === "nao_baixa" || r?.pg === "54000")) relatarApos = Date.now() + (r?.codigo === "nao_baixa" ? 300_000 : 60_000)
        if (r?.ok || ((r?.codigo === "erro" || r?.codigo === "culto_inexistente") && r?.pg !== "54000" && r?.pg !== "55000")) mudarMemoria((m) => m[id] && (m[id][status === "usado" ? "us" : "np"] = 1))
    } catch (erro) {
        console.error("Sirvo: falha ao avisar o material", erro)
    } finally {
        emRelato.delete(chave)
    }
}

// ---------------------------------------------------------------- no projeto

export type MaterialPreparado = ResultadoMaterial & {
    /** a lista como estava (para quem compara) */
    mudou: boolean
    /** chamar DEPOIS de escrever a lista (ou quando nada mudou): guarda a memória e avisa o Sirvo */
    commit: () => void
}

/**
 * A conta do material para o projeto ligado. Síncrona, sem `await`: lê o
 * estado de agora, conta e devolve. Quem chama escreve a lista e então chama
 * `commit()`. `null` = não há o que fazer (sem material no Show, sem roteiro).
 */
export function prepararMaterial(projetoId: string, roteiro: { event_id: string; material?: MaterialDoRoteiro[] | null }, itens: ProjectShowRef[], contexto: { ativos: number[]; protegido: boolean; congelarRemocao: boolean; forcar: boolean }): MaterialPreparado | null {
    const e = get(sirvoMaterialEstado)
    const baixados = new Map<string, Baixado>()
    for (const b of e.baixados) if (b.event_id === roteiro.event_id) baixados.set(b.id, b)
    // sem o interruptor "baixa material" (ou sem a lista) a conta não faz nada: material [] não é "apagou tudo"
    const noRoteiro = mapaDoRoteiro(roteiro.material, e.habilitado)
    // sem material no disco nem no projeto, não há nada a fazer (a conta nem corre)
    if (!baixados.size && !itens.some((i) => marcaDoMaterial(i))) return null

    const memoria = lerMemoria()
    const jaPostos = new Set(Object.keys(memoria).filter((id) => memoria[id].projeto === projetoId))
    const res = conciliarMaterial(itens, { baixados, noRoteiro, eventoId: roteiro.event_id, jaPostos, ativos: contexto.ativos, protegido: contexto.protegido, congelarRemocao: contexto.congelarRemocao, forcar: contexto.forcar, agora: Date.now() })

    return {
        ...res,
        mudou: res.itens !== itens || res.mudouCampos,
        commit: () => {
            // o que está no projeto agora com a marca (inclusive o que acabou de entrar)
            const presentes = res.itens.map((i) => marcaDoMaterial(i)).filter((m): m is string => !!m)
            // a memória só é escrita quando algo muda (o `special` é salvo com as configurações)
            const lida0 = lerMemoria()
            const novosNaMemoria = presentes.filter((id) => !lida0[id] || lida0[id].projeto !== projetoId)
            if (res.tirados.length || novosNaMemoria.length) {
                mudarMemoria((m) => {
                    for (const id of res.tirados) delete m[id] // se o Sirvo restaurar, o item volta
                    for (const id of novosNaMemoria) m[id] = { projeto: projetoId, em: Date.now() }
                })
            }
            // avisa `no_projeto` de quem ainda não foi avisado (e não está esmaecido)
            const lida = lerMemoria()
            for (const id of presentes) {
                const r = noRoteiro?.get(id)
                if (lida[id]?.np || !baixados.has(id) || !r || r.status === "apagando") continue
                void relatar(id, "no_projeto", baixados.get(id)?.codec)
            }
        }
    }
}

// ---------------------------------------------------------------- usado

const norm = (p: string) =>
    String(p || "")
        .replace(/\\/g, "/")
        .toLowerCase()

/** os arquivos de material que estão em alguma saída agora */
function emSaida(): Set<string> {
    const caminhos = new Set<string>()
    for (const o of Object.values(get(outputs) || {}) as any[]) {
        if (!o?.enabled || o.stageOutput) continue
        const p = o.out?.background?.path
        if (typeof p === "string" && p) caminhos.add(norm(p))
    }
    return caminhos
}

let ultimaConferencia = 0
let conferenciaMarcada: ReturnType<typeof setTimeout> | null = null
const CONFERIR_USADO_MIN_MS = 5_000

/** no máximo uma conferência a cada 5 s (as saídas mudam toda hora); a última chamada nunca se perde */
function conferirUsadoComFreio() {
    const espera = ultimaConferencia + CONFERIR_USADO_MIN_MS - Date.now()
    if (espera > 0) {
        if (!conferenciaMarcada) {
            conferenciaMarcada = setTimeout(() => {
                conferenciaMarcada = null
                conferirUsadoComFreio()
            }, espera)
        }
        return
    }
    ultimaConferencia = Date.now()
    conferirUsado()
}

function conferirUsado() {
    // sem o interruptor ligado não há material para acompanhar
    if (get(sirvoMaterialEstado).habilitado !== true) return
    const naSaida = emSaida()
    if (!naSaida.size) return
    const memoria = lerMemoria()
    for (const b of get(sirvoMaterialEstado).baixados) {
        if (!naSaida.has(norm(b.caminho)) || memoria[b.id]?.us) continue
        // só conta o que o Show pôs (ou o operador pôs a mão no mesmo arquivo): precisa estar na memória
        if (!memoria[b.id]) continue
        void relatar(b.id, "usado", b.codec)
    }
}

let iniciado = false
/** Chamado uma vez na inicialização (junto de iniciarMontagemSirvo). */
export function iniciarMaterialSirvo() {
    if (iniciado) return
    iniciado = true
    // quem assina não pode lançar erro: o `set` do Svelte roda os assinantes na hora
    outputs.subscribe(() => {
        try {
            conferirUsadoComFreio()
        } catch (erro) {
            console.error("Sirvo: falha ao conferir o uso do material", erro)
        }
    })
}
