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
import { media, outputs, overlays, playingAudio, projects, shows, special, stageShows, styles, templates, themes } from "../stores"
import { sirvo } from "./aliancaSirvo"
import { conciliarMaterial, copiarMidiaDaTroca, extrairCaminhosSirvo, mapaDoRoteiro, marcaDoMaterial, normCam, podeLimparAgora, VERSAO, type Baixado, type MaterialDoRoteiro, type ResultadoMaterial } from "./aliancaSirvoMaterialConta"

const VAZIO: EstadoMaterial = { habilitado: null, baixando: 0, naFila: 0, lote: { total: 0, feitos: 0 }, falhas: [], baixados: [], disco: { usado: -1, livre: -1, limpeza: { em: 0, arquivos: 0, bytes: 0, adiada: null } } }
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
        void talvezLimpar(g)
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

// ---------------------------------------------------------------- limpeza (gatilho)

// A limpeza é do main, mas QUEM decide que é seguro é o renderer: só com nada na saída, nada tocando
// (nem pausado: `playingAudio`) e fora do roteiroNoAr. Manda as referências vivas dos stores em memória
// (cobre o que ainda não foi salvo). Pelo menos 24 h entre uma e outra.
let limpando = false

/** caminhos sob Online/Sirvo que aparecem nos stores em memória; projetos: só item NÃO marcado */
function caminhosVivos(): string[] {
    const textos: string[] = []
    const seguro = (v: unknown) => {
        try {
            textos.push(JSON.stringify(v ?? {}))
        } catch {}
    }
    for (const proj of Object.values(get(projects) || {}) as any[]) seguro((proj?.shows || []).filter((i: any) => !marcaDoMaterial(i)).map((i: any) => i?.id))
    for (const st of [shows, overlays, templates, stageShows, themes, styles]) seguro(get(st as any))
    const achados = new Set<string>()
    for (const t of textos) for (const c of extrairCaminhosSirvo(t)) achados.add(c)
    return [...achados]
}

function algoNaSaida(): number {
    return Object.values(get(outputs) || {}).filter((o: any) => o?.enabled && !o.stageOutput && (o.out?.slide || o.out?.background)).length
}

async function talvezLimpar(g: number) {
    if (limpando) return
    const e = get(sirvoMaterialEstado)
    if (e.habilitado !== true) return
    if (!podeLimparAgora({ roteiroNoAr: get(sirvo).roteiroNoAr, saidasComAlgo: algoNaSaida(), tocando: Object.keys(get(playingAudio) || {}).length, ultimaEm: e.disco.limpeza.em, agora: Date.now() })) return
    limpando = true
    try {
        const novo = (await requestMain(Main.SIRVO_MATERIAL_LIMPAR, { vivos: caminhosVivos() })) as EstadoMaterial | undefined
        if (g === geracaoLocal) aceitar(novo)
    } catch (erro) {
        console.error("Sirvo: falha ao pedir a limpeza do material", erro)
    } finally {
        limpando = false
    }
}

// ---------------------------------------------------------------- memória

// O que o Show já fez com cada ARQUIVO, guardado no `special` (salvo com as configurações), com a chave
// `<event_id>:<arquivo_id>`: em qual projeto ele pôs o item (o que o operador tirou à mão não volta), e
// a VERSÃO de que já avisou o Sirvo (`np` = no_projeto, `us` = usado). Versão nova = relata de novo.
const CHAVE_MEMORIA = "aliancaSirvoMaterial"
const PRAZO_MEMORIA_MS = 90 * 86_400_000
type Memoria = { projeto: string; em: number; np?: string; npUso?: string; us?: string; usUso?: string }

export const chaveDaMemoria = (eventId: string, arquivoId: string) => `${eventId}:${arquivoId}`

function lerMemoria(): { [chave: string]: Memoria } {
    const m = get(special)?.[CHAVE_MEMORIA]
    return m && typeof m === "object" ? m : {}
}

function mudarMemoria(fn: (m: { [chave: string]: Memoria }) => void) {
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

/**
 * `no_projeto` / `usado`: uma vez por (arquivo, versão); se não chegou, a próxima passada tenta de novo.
 * `p_id` é a VERSÃO e `p_uso` o uso do roteiro (obrigatório nesses dois status). A memória guarda a versão.
 */
async function relatar(chaveMemoria: string, versaoId: string, usoId: string, status: "no_projeto" | "usado", codec: string | null | undefined) {
    const chave = `${versaoId}|${status}`
    if (emRelato.has(chave) || Date.now() < relatarApos) return
    emRelato.add(chave)
    try {
        const r: any = await requestMain(Main.SIRVO_CHAMAR, { funcao: "show_material_status", args: { p_id: versaoId, p_status: status, p_detalhe: null, p_codec: codec ?? null, p_uso: usoId } })
        // o Sirvo recusar ("erro") não melhora tentando de novo; rede e chave desligada, sim
        // 54000 (mais de 60/min) e 55000 (ainda não pronto) ficam para a próxima passada
        if (!r?.ok && (r?.codigo === "rede" || r?.codigo === "nao_baixa" || r?.pg === "54000")) relatarApos = Date.now() + (r?.codigo === "nao_baixa" ? 300_000 : 60_000)
        if (r?.ok || ((r?.codigo === "erro" || r?.codigo === "culto_inexistente") && r?.pg !== "54000" && r?.pg !== "55000")) mudarMemoria((m) => m[chaveMemoria] && { const mm = m[chaveMemoria]; if (mm) { if (status === "usado") { mm.us = versaoId; mm.usUso = usoId } else { mm.np = versaoId; mm.npUso = usoId } } })
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
    /** chamar DEPOIS de escrever a lista (ou quando nada mudou): guarda a memória, copia a mídia da troca e avisa o Sirvo */
    commit: () => void
    /** "versão nova de X, Y" para a faixa "Aplicar" (vazio se não há troca esperando) */
    textoTrocaPendente: string
}

// o que o roteiro do culto seguido diz agora (para o `usado`) e se há troca esperando o uso baixar
let linhasDoRoteiro = new Map<string, MaterialDoRoteiro>()
let eventoSeguido = ""
let trocaEsperandoUso = false
let pedirPassada: (() => void) | null = null
/** o montador registra aqui como agendar uma passada (evita ciclo de import) */
export function aoSoltarUso(fn: () => void) {
    pedirPassada = fn
}

/** os caminhos em uso FORA do projeto: nas saídas e nas CHAVES de `playingAudio` (pausado conta; `playingAudioPaths` não serve) */
export function caminhosEmUso(): Set<string> {
    const c = emSaida()
    for (const k of Object.keys(get(playingAudio) || {})) c.add(normCam(k))
    return c
}

/**
 * A conta do material para o projeto ligado. Síncrona, sem `await`: lê o
 * estado de agora, conta e devolve. Quem chama escreve a lista e então chama
 * `commit()`. `null` = não há o que fazer (sem material no Show, sem roteiro).
 */
export function prepararMaterial(projetoId: string, roteiro: { event_id: string; material?: MaterialDoRoteiro[] | null }, itens: ProjectShowRef[], contexto: { ativos: number[]; protegido: boolean; congelarRemocao: boolean; forcar: boolean }): MaterialPreparado | null {
    const e = get(sirvoMaterialEstado)
    // sem o interruptor "baixa material" (ou sem a lista) a conta não faz nada: material [] não é "apagou tudo"
    const noRoteiro = mapaDoRoteiro(roteiro.material, e.habilitado)
    // as versões que importam: as citadas por material[] e as que os itens marcados tocam agora
    const citadas = new Set<string>()
    for (const r of noRoteiro?.values() || []) if (r.versao_id) citadas.add(r.versao_id)
    for (const i of itens) if (marcaDoMaterial(i) && typeof i.data?.[VERSAO] === "string") citadas.add(i.data[VERSAO])
    const baixados = new Map<string, Baixado>()
    for (const b of e.baixados) if (citadas.has(b.id)) baixados.set(b.id, b)
    // sem material no disco nem no projeto, não há nada a fazer (a conta nem corre)
    if (!baixados.size && !itens.some((i) => marcaDoMaterial(i))) return null

    linhasDoRoteiro = noRoteiro || new Map()
    eventoSeguido = roteiro.event_id
    const memoria = lerMemoria()
    const prefixo = `${roteiro.event_id}:`
    const jaPostos = new Set(Object.keys(memoria).filter((k) => k.startsWith(prefixo) && memoria[k].projeto === projetoId).map((k) => k.slice(prefixo.length)))
    const emUso = caminhosEmUso()
    const res = conciliarMaterial(itens, { baixados, noRoteiro, eventoId: roteiro.event_id, jaPostos, emUso, ativos: contexto.ativos, protegido: contexto.protegido, congelarRemocao: contexto.congelarRemocao, forcar: contexto.forcar, agora: Date.now() })
    trocaEsperandoUso = res.trocaEmUso.length > 0

    return {
        ...res,
        mudou: res.itens !== itens || res.mudouCampos,
        textoTrocaPendente: res.trocaPendente.length ? `versão nova de ${res.trocaPendente.join(", ")}` : "",
        commit: () => {
            // a troca no lugar leva o ajuste do operador (lista branca), só se a mídia nova ainda não existe
            if (res.trocas.length) media.update((m) => res.trocas.reduce((acc, t) => copiarMidiaDaTroca(acc, t.de, t.para), m))
            // o que está no projeto agora com a marca (inclusive o que acabou de entrar)
            const presentes = res.itens.map((i) => marcaDoMaterial(i)).filter((m): m is string => !!m)
            // a memória só é escrita quando algo muda (o `special` é salvo com as configurações)
            const lida0 = lerMemoria()
            const chaveDe = (arq: string) => chaveDaMemoria(roteiro.event_id, arq)
            const novosNaMemoria = presentes.filter((arq) => !lida0[chaveDe(arq)] || lida0[chaveDe(arq)].projeto !== projetoId)
            if (res.tirados.length || novosNaMemoria.length) {
                mudarMemoria((m) => {
                    for (const arq of res.tirados) delete m[chaveDe(arq)] // se o Sirvo restaurar, o item volta
                    for (const arq of novosNaMemoria) m[chaveDe(arq)] = { projeto: projetoId, em: Date.now() }
                })
            }
            // avisa `no_projeto` da VERSÃO que o item toca agora, se ainda não foi avisada (entrou ou trocou) e não está esmaecido
            const lida = lerMemoria()
            for (const item of res.itens) {
                const arq = marcaDoMaterial(item)
                const versao = item.data?.[VERSAO]
                const r = arq ? noRoteiro?.get(arq) : undefined
                if (!arq || typeof versao !== "string" || !r || r.status === "apagando" || (lida[chaveDe(arq)]?.np === versao && lida[chaveDe(arq)]?.npUso === r.id) || !baixados.has(versao)) continue
                void relatar(chaveDe(arq), versao, r.id, "no_projeto", baixados.get(versao)?.codec)
            }
        }
    }
}

// ---------------------------------------------------------------- usado

const norm = (p: string) =>
    String(p || "")
        .replace(/\\/g, "/")
        .toLowerCase()

/** os caminhos que estão em alguma saída agora (normalizados) */
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
    const emUso = caminhosEmUso()
    if (!emUso.size) return
    const memoria = lerMemoria()
    for (const b of get(sirvoMaterialEstado).baixados) {
        if (!emUso.has(norm(b.caminho))) continue
        // o caminho tocado é de um baixado → o arquivo → a linha de material[] do culto seguido; sem linha, não relata
        const linha = linhasDoRoteiro.get(b.arquivo_id)
        if (!linha || !eventoSeguido) continue
        const chave = chaveDaMemoria(eventoSeguido, b.arquivo_id)
        // só conta o que o Show pôs (ou o operador pôs a mão no mesmo arquivo): precisa estar na memória; pula se `us` já é esta versão
        if (!memoria[chave] || (memoria[chave].us === b.id && memoria[chave].usUso === linha.id)) continue
        void relatar(chave, b.id, linha.id, "usado", b.codec)
    }
}

let iniciado = false
/** Chamado uma vez na inicialização (junto de iniciarMontagemSirvo). */
export function iniciarMaterialSirvo() {
    if (iniciado) return
    iniciado = true
    // quem assina não pode lançar erro: o `set` do Svelte roda os assinantes na hora
    // com troca esperando o uso baixar, uma nova passada quando o conjunto em uso diminui
    let tamanhoAntes = 0
    const aoMudarUso = () => {
        try {
            conferirUsadoComFreio()
            const agora = caminhosEmUso().size
            if (trocaEsperandoUso && agora < tamanhoAntes) pedirPassada?.()
            tamanhoAntes = agora
        } catch (erro) {
            console.error("Sirvo: falha ao conferir o uso do material", erro)
        }
    }
    outputs.subscribe(aoMudarUso)
    playingAudio.subscribe(aoMudarUso)
}
