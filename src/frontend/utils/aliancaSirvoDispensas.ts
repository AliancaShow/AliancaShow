import type { ProjectShowRef } from "../../types/Projects"
import { marcaDe, type MusicaDoSirvo } from "./aliancaSirvoMusicas"

// ----- AliançaShow · o operador tirou do projeto uma música que o Sirvo pôs (F3) -----
//
// Só a conta, sem store (quem liga aos stores é aliancaSirvoDispensar.ts).
//
// Quando o OPERADOR apaga do projeto um item com a marca `sirvoMusica`, o Show
// respeita (a passada nunca põe de volta) e avisa o Sirvo. Cada item tirado
// vira uma DISPENSA, com um `envio` que anda assim:
//
//   aguardando  carência de CARENCIA_MS: "Desfazer" na faixa; se a marca
//               reaparece no projeto (colar depois do Ctrl+X, Ctrl+Z), cai sem
//               mandar nada. Vencida: uma música só → "fila" (chave conduz) ou
//               "local" (não conduz).
//   confirmar   duas ou mais músicas na MESMA ação: não vai sozinho; a faixa
//               pergunta "Tirar do Sirvo também | Manter só aqui".
//   fila        a mandar ao Sirvo (show_tirar_musicas); `falhou` marca a
//               tentativa que não deu (sem rede, Sirvo caído): fica na fila e
//               tenta de novo quando a conexão volta. Idempotente pelo id.
//   enviada     o Sirvo confirmou. O registro fica até a linha sumir do
//               roteiro, e ainda GUARDA_DEVOLVER_MS depois disso: um Ctrl+Z
//               tardio que devolve o item ao projeto pede ao Sirvo a linha de
//               volta (show_devolver_musica) em vez de ser apagado pela
//               reconciliação.
//   local       só neste PC, de propósito: chave que não conduz, "Manter só
//               aqui", ou o item tirado era só o AVISO cinza (falta no PC /
//               rascunho) — aviso nunca vai ao Sirvo. Cai sozinha quando a
//               linha sai do roteiro.
//   devolver    o item marcado voltou ao projeto depois de enviada: pede a
//               linha de volta ao Sirvo. Enquanto espera, a reconciliação não
//               toca no item.
//
// Enquanto existe uma dispensa de uma linha, a reconciliação trata a linha
// como já satisfeita: não entra na família, não conta como "músicas mudaram".

export type EnvioDispensa = "aguardando" | "confirmar" | "fila" | "enviada" | "local" | "devolver"

export type Dispensa = {
    rmId: string
    eventId: string
    blocoId: string
    nome: string
    /** quando o operador tirou (ms) */
    em: number
    envio: EnvioDispensa
    /** as tiradas na mesma ação têm o mesmo lote (a pergunta de "N músicas") */
    lote: string
    /** o último envio falhou: espera a conexão voltar */
    falhou?: boolean
    /** quando a linha sumiu do roteiro (ms): a "enviada" ainda vive um tempo para o Ctrl+Z tardio */
    sumiuEm?: number
}

export const CARENCIA_MS = 8_000
export const GUARDA_DEVOLVER_MS = 15 * 60_000
/** dispensa de outro culto (ou esquecida) cai depois disto */
export const DESCARTE_MS = 7 * 86_400_000

const ENVIADA_OU_DEPOIS = new Set<EnvioDispensa>(["enviada", "devolver"])
/** nada foi ao Sirvo ainda: cai sem avisar ninguém */
const NAO_ENVIADA = new Set<EnvioDispensa>(["aguardando", "confirmar", "fila", "local"])

const texto = (t: string | null | undefined) => (t || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 120)

export type LinhaDoRoteiro = { blocoId: string; musica: MusicaDoSirvo }

/**
 * O que o operador tirou numa ação só, em dispensas. Só item com a marca cuja
 * linha ainda existe no roteiro (o resto a reconciliação já tiraria sozinha).
 * O aviso cinza (`sirvoFalta`) vira "local" na hora. Música de verdade: uma só
 * na ação → "aguardando"; duas ou mais → "confirmar" (conduz) ou "local".
 * Linha que já tem dispensa não ganha outra.
 */
export function dispensasDaRemocao(removidos: ProjectShowRef[], linhas: Map<string, LinhaDoRoteiro>, existentes: Dispensa[], ctx: { eventId: string; agora: number; lote: string; conduz: boolean }): Dispensa[] {
    const ja = new Set(existentes.map((d) => d.rmId))
    const vistas = new Set<string>()
    const avisos: Dispensa[] = []
    const musicas: Dispensa[] = []
    for (const item of removidos) {
        const rmId = marcaDe(item)
        if (!rmId || ja.has(rmId) || vistas.has(rmId)) continue
        const linha = linhas.get(rmId)
        if (!linha) continue
        vistas.add(rmId)
        const d: Dispensa = { rmId, eventId: ctx.eventId, blocoId: linha.blocoId, nome: texto(linha.musica.nome) || texto(item.name) || "música", em: ctx.agora, envio: "local", lote: ctx.lote }
        if (item.data?.sirvoFalta || item.type === "section") avisos.push(d)
        else musicas.push(d)
    }
    const envio: EnvioDispensa = musicas.length === 1 ? "aguardando" : ctx.conduz ? "confirmar" : "local"
    for (const d of musicas) d.envio = envio
    return [...avisos, ...musicas]
}

/**
 * O passo do tempo: a carência vencida vira "fila" (a chave conduz) ou
 * "local". A chave que deixou de conduzir com algo na fila: vira "local"
 * (ninguém mais vai mandar). Devolve a MESMA lista quando nada muda.
 */
export function avancarDispensas(lista: Dispensa[], agora: number, conduz: boolean): Dispensa[] {
    let mudou = false
    const nova = lista.map((d) => {
        if (d.envio === "fila" && !conduz) {
            mudou = true
            return { ...d, envio: "local", falhou: false } as Dispensa
        }
        if (d.envio !== "aguardando" || agora - d.em < CARENCIA_MS) return d
        mudou = true
        return { ...d, envio: conduz ? "fila" : "local" } as Dispensa
    })
    return mudou ? nova : lista
}

/** quando a próxima carência vence (ms), ou null sem nenhuma esperando */
export function proximaCarencia(lista: Dispensa[]): number | null {
    let t: number | null = null
    for (const d of lista) if (d.envio === "aguardando" && (t === null || d.em + CARENCIA_MS < t)) t = d.em + CARENCIA_MS
    return t
}

export type ResultadoVolta = { lista: Dispensa[]; /** marcas a tirar do item (vira item do operador) */ tirarMarca: string[] }

/**
 * A marca voltou ao projeto (colar, Ctrl+Z): a dispensa que ainda não foi ao
 * Sirvo cai, sem mandar nada. A "enviada" — e a da fila cujo pedido está EM
 * VOO agora (`emVoo`: pode chegar) — vira "devolver" (a chave conduz): o Sirvo
 * recebe a linha de volta, e `ja_estava` é inócuo se o pedido não chegou. Sem
 * conduzir, a marca sai do item (vira item do operador, onde está) e a
 * dispensa cai.
 */
export function marcasVoltaram(lista: Dispensa[], eventId: string, marcasNoProjeto: Set<string>, conduz: boolean, emVoo: Set<string> = new Set()): ResultadoVolta {
    const tirarMarca: string[] = []
    let mudou = false
    const nova: Dispensa[] = []
    for (const d of lista) {
        // "devolver" já é a resposta à volta: espera o Sirvo
        if (d.eventId !== eventId || d.envio === "devolver" || !marcasNoProjeto.has(d.rmId)) {
            nova.push(d)
            continue
        }
        mudou = true
        const podeTerChegado = d.envio === "enviada" || (d.envio === "fila" && emVoo.has(d.rmId))
        if (!podeTerChegado) continue // nada foi ao Sirvo: cai
        if (conduz) nova.push({ ...d, envio: "devolver", falhou: false })
        else tirarMarca.push(d.rmId)
    }
    return { lista: mudou ? nova : lista, tirarMarca }
}

/**
 * O roteiro novo chegou: a linha que não existe mais no Sirvo leva a dispensa
 * dela embora — a "enviada" só depois de GUARDA_DEVOLVER_MS (o Ctrl+Z tardio),
 * e a "devolver" fica (o Sirvo ainda não respondeu). Dispensa de outro culto
 * ou velha demais cai. Devolve a MESMA lista quando nada muda.
 */
export function limparPeloRoteiro(lista: Dispensa[], eventId: string, linhasVivas: Set<string>, agora: number): Dispensa[] {
    let mudou = false
    const nova: Dispensa[] = []
    for (const d of lista) {
        if (agora - d.em > DESCARTE_MS) {
            mudou = true
            continue
        }
        if (d.eventId !== eventId) {
            nova.push(d)
            continue
        }
        if (linhasVivas.has(d.rmId)) {
            if (d.sumiuEm === undefined) {
                nova.push(d)
                continue
            }
            // a linha voltou (o Sirvo devolveu, ou a régia pôs de novo): o registro segue, sem o relógio
            const { sumiuEm: _s, ...resto } = d
            nova.push(resto)
            mudou = true
            continue
        }
        if (d.envio === "devolver") {
            nova.push(d)
            continue
        }
        if (NAO_ENVIADA.has(d.envio)) {
            mudou = true
            continue
        }
        // enviada: espera o Ctrl+Z tardio
        if (d.sumiuEm === undefined) {
            nova.push({ ...d, sumiuEm: agora })
            mudou = true
            continue
        }
        if (agora - d.sumiuEm > GUARDA_DEVOLVER_MS) {
            mudou = true
            continue
        }
        nova.push(d)
    }
    return mudou ? nova : lista
}

/** as linhas que a reconciliação trata como já satisfeitas (toda dispensa viva deste culto) */
export function marcasDispensadas(lista: Dispensa[], eventId: string): Set<string> {
    return new Set(lista.filter((d) => d.eventId === eventId).map((d) => d.rmId))
}

/** o que está na fila para o show_tirar_musicas */
export const paraTirar = (lista: Dispensa[], eventId: string) => lista.filter((d) => d.eventId === eventId && d.envio === "fila")
/** o que está esperando o show_devolver_musica */
export const paraDevolver = (lista: Dispensa[], eventId: string) => lista.filter((d) => d.eventId === eventId && d.envio === "devolver")

/** resposta do show_tirar_musicas: `{tiradas, ja_estavam}` → enviadas; o resto da leva fica na fila, marcado */
export function aplicarRespostaTirar(lista: Dispensa[], pedidas: string[], resposta: { tiradas?: unknown; ja_estavam?: unknown } | null | undefined): Dispensa[] {
    const ids = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [])
    const feitas = new Set([...ids(resposta?.tiradas), ...ids(resposta?.ja_estavam)])
    const pedidasSet = new Set(pedidas)
    let mudou = false
    const nova = lista.map((d) => {
        if (d.envio !== "fila" || !pedidasSet.has(d.rmId)) return d
        mudou = true
        return feitas.has(d.rmId) ? ({ ...d, envio: "enviada", falhou: false } as Dispensa) : { ...d, falhou: true }
    })
    return mudou ? nova : lista
}

/** o envio não deu (rede, Sirvo caído, "Calma"): fica na fila, marcado, para tentar de novo */
export function marcarFalha(lista: Dispensa[], pedidas: string[], envio: "fila" | "devolver"): Dispensa[] {
    const set = new Set(pedidas)
    let mudou = false
    const nova = lista.map((d) => {
        if (d.envio !== envio || !set.has(d.rmId) || d.falhou) return d
        mudou = true
        return { ...d, falhou: true }
    })
    return mudou ? nova : lista
}

export type RespostaDevolver = { ok?: unknown; devolvida?: unknown; ja_estava?: unknown; motivo?: unknown } | null | undefined

/**
 * Resposta do show_devolver_musica: devolvida ou já estava → a dispensa cai
 * (a reconciliação passa a cuidar do item, que a linha de volta satisfaz).
 * Recusada (`cheio`, `sem_bloco`) → cai também, e a marca sai do item: vira
 * item do operador, onde está.
 */
export function aplicarRespostaDevolver(lista: Dispensa[], rmId: string, resposta: RespostaDevolver): { lista: Dispensa[]; tirarMarca: boolean } {
    const d = lista.find((x) => x.rmId === rmId && x.envio === "devolver")
    if (!d) return { lista, tirarMarca: false }
    const deu = resposta?.ok === true && (resposta.devolvida === true || resposta.ja_estava === true)
    return { lista: lista.filter((x) => x !== d), tirarMarca: !deu }
}

/**
 * "Desfazer" na faixa: a dispensa cai e a reconciliação traz o item de volta.
 * A que estava na fila pode ter chegado ao Sirvo sem o Show saber (tempo
 * estourado): devolve quais pedir de volta, por garantia (ja_estava é inócuo).
 */
export function desfazer(lista: Dispensa[], rmIds: string[]): { lista: Dispensa[]; devolverPorGarantia: string[] } {
    const set = new Set(rmIds)
    const devolverPorGarantia: string[] = []
    const nova = lista.filter((d) => {
        if (!set.has(d.rmId) || ENVIADA_OU_DEPOIS.has(d.envio)) return true
        if (d.envio === "fila") devolverPorGarantia.push(d.rmId)
        return false
    })
    return { lista: nova.length === lista.length ? lista : nova, devolverPorGarantia }
}

/**
 * O Sirvo recusou de vez (não é rede): a da fila fica só daqui ("local"); a
 * que esperava a linha de volta cai, e a marca sai do item.
 */
export function desistir(lista: Dispensa[], rmIds: string[]): { lista: Dispensa[]; tirarMarca: string[] } {
    const set = new Set(rmIds)
    const tirarMarca: string[] = []
    let mudou = false
    const nova: Dispensa[] = []
    for (const d of lista) {
        if (!set.has(d.rmId) || (d.envio !== "fila" && d.envio !== "devolver")) {
            nova.push(d)
            continue
        }
        mudou = true
        if (d.envio === "fila") nova.push({ ...d, envio: "local", falhou: false })
        else tirarMarca.push(d.rmId)
    }
    return { lista: mudou ? nova : lista, tirarMarca }
}

/** a resposta à pergunta do lote: "Tirar do Sirvo também" → fila; "Manter só aqui" → local */
export function responderLote(lista: Dispensa[], lote: string, resposta: "tirar" | "manter"): Dispensa[] {
    let mudou = false
    const nova = lista.map((d) => {
        if (d.lote !== lote || d.envio !== "confirmar") return d
        mudou = true
        return { ...d, envio: resposta === "tirar" ? "fila" : "local" } as Dispensa
    })
    return mudou ? nova : lista
}

// ---------------------------------------------------------------- a faixa

export type ResumoDispensas = { tipo: "nada" } | { tipo: "aguardando" | "fila" | "local" | "devolver"; rmIds: string[]; nomes: string[] } | { tipo: "confirmar"; lote: string; rmIds: string[]; nomes: string[] }

/**
 * Uma linha só na faixa, pela urgência: a pergunta do lote; a carência (dá
 * para desfazer); o que ainda não chegou ao Sirvo; o que é só daqui; o que
 * está voltando e não conseguiu. "Enviada" não aparece (o aviso de mudança do
 * Sirvo cobre, e o eco do próprio Show já é mudo).
 */
export function resumirDispensas(lista: Dispensa[], eventId: string): ResumoDispensas {
    const deste = lista.filter((d) => d.eventId === eventId)
    const confirmar = deste.find((d) => d.envio === "confirmar")
    if (confirmar) {
        const doLote = deste.filter((d) => d.envio === "confirmar" && d.lote === confirmar.lote)
        return { tipo: "confirmar", lote: confirmar.lote, rmIds: doLote.map((d) => d.rmId), nomes: doLote.map((d) => d.nome) }
    }
    for (const tipo of ["aguardando", "fila", "local"] as const) {
        const das = deste.filter((d) => d.envio === tipo)
        if (das.length) return { tipo, rmIds: das.map((d) => d.rmId), nomes: das.map((d) => d.nome) }
    }
    const devolver = deste.filter((d) => d.envio === "devolver" && d.falhou)
    if (devolver.length) return { tipo: "devolver", rmIds: devolver.map((d) => d.rmId), nomes: devolver.map((d) => d.nome) }
    return { tipo: "nada" }
}

const listaDeNomes = (nomes: string[]) => {
    const n = nomes.map((x) => x || "música")
    if (n.length === 1) return n[0]
    if (n.length === 2) return `${n[0]} e ${n[1]}`
    return `${n.length} músicas`
}

/** o texto da linha ("" para nada) */
export function textoDispensas(r: ResumoDispensas): string {
    switch (r.tipo) {
        case "nada":
            return ""
        case "confirmar":
            return `Você tirou ${r.nomes.length} músicas`
        case "aguardando":
            return `Você tirou ${listaDeNomes(r.nomes)}`
        case "fila":
            return `Você tirou ${listaDeNomes(r.nomes)} — ainda não avisei o Sirvo`
        case "local":
            return `Você tirou ${listaDeNomes(r.nomes)} — o Sirvo ainda lista`
        case "devolver":
            return `${listaDeNomes(r.nomes)} voltou ao projeto — ainda não avisei o Sirvo`
    }
}
