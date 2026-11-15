import type { AliancaFimMidia, AliancaPasta, Tag } from "../../types/Show"

// ----- AliançaShow · Preparar, fatia 7: pastas de mídia (etiquetas) -----
//
// Uma pasta é uma etiqueta de mídia (`mediaTags`) com `aliancaPasta`. O arquivo nunca sai do lugar no disco.
// Aqui só mora a conta (sem stores, sem tela), para testar.

export type TagsDeMidia = { [id: string]: Tag }

export type MidiaDaPasta = {
    tags?: string[]
    videoType?: string
    loop?: boolean
    aliancaFim?: AliancaFimMidia
}

export const PASTA_RAIZ = "pasta:raiz"
export const PASTA_SIRVO = "pasta:sirvo"
export const PREFIXO_PASTA = "pasta:"

export const PASTA_NOVA: AliancaPasta = { fim: "repetir", camada: "fundo" }

/** o id de aba (`pasta:<id>`) de uma pasta */
export const abaDaPasta = (id: string) => PREFIXO_PASTA + id
/** `pasta:<id>` -> id da etiqueta; null se for a raiz, o Sirvo ou não for aba de pasta */
export function idDaAba(aba: string | null | undefined): string | null {
    if (!aba || !aba.startsWith(PREFIXO_PASTA)) return null
    if (aba === PASTA_RAIZ || aba === PASTA_SIRVO) return null
    return aba.slice(PREFIXO_PASTA.length) || null
}
export const ehAbaDePasta = (aba: string | null | undefined) => !!aba && aba.startsWith(PREFIXO_PASTA)

export const ehPasta = (tag: Tag | undefined | null): boolean => !!tag?.aliancaPasta

/** as pastas, na ordem de `ordem` (depois por nome) */
export function listarPastas(mediaTags: TagsDeMidia): { id: string; tag: Tag; pasta: AliancaPasta }[] {
    return Object.entries(mediaTags || {})
        .filter(([, tag]) => ehPasta(tag))
        .map(([id, tag]) => ({ id, tag, pasta: tag.aliancaPasta as AliancaPasta }))
        .sort((a, b) => (a.tag.name || "").localeCompare(b.tag.name || "", "pt-BR", { sensitivity: "base" }))
}

/** só as etiquetas comuns (o menu de etiquetas e o ManageTags não mostram pastas) */
export function etiquetasComuns(mediaTags: TagsDeMidia): TagsDeMidia {
    const r: TagsDeMidia = {}
    for (const [id, tag] of Object.entries(mediaTags || {})) if (!ehPasta(tag)) r[id] = tag
    return r
}

/** a pasta (id) da mídia: se houver mais de uma, vale a primeira; null se não tem */
export function pastaDaMidia(tags: string[] | undefined, mediaTags: TagsDeMidia): string | null {
    for (const id of tags || []) if (ehPasta(mediaTags?.[id])) return id
    return null
}

/** as etiquetas da mídia depois de mover para a pasta (ou para a raiz, `null`): só troca a etiqueta-pasta, mantém as comuns */
export function moverTags(tags: string[] | undefined, mediaTags: TagsDeMidia, pastaId: string | null): string[] {
    const comuns = (tags || []).filter((id) => !ehPasta(mediaTags?.[id]))
    return pastaId ? [...comuns, pastaId] : comuns
}

/** as etiquetas sem a etiqueta-pasta (o selo de etiquetas do card) */
export const tagsSemPasta = (tags: string[] | undefined, mediaTags: TagsDeMidia): string[] => (tags || []).filter((id) => !ehPasta(mediaTags?.[id]))

/** mídias (caminhos) por pasta, a partir do store `media` */
export function membrosPorPasta(media: { [caminho: string]: MidiaDaPasta }, mediaTags: TagsDeMidia): { [pastaId: string]: string[] } {
    const r: { [pastaId: string]: string[] } = {}
    for (const [caminho, m] of Object.entries(media || {})) {
        const id = pastaDaMidia(m?.tags, mediaTags)
        if (!id) continue
        if (!r[id]) r[id] = []
        r[id].push(caminho)
    }
    return r
}

/** a camada na hora de tocar: a própria da mídia, depois a da pasta; null = vale o disco ou o padrão de hoje */
export function camadaNaHora(midia: MidiaDaPasta | undefined, mediaTags: TagsDeMidia): "background" | "foreground" | null {
    if (midia?.videoType === "background" || midia?.videoType === "foreground") return midia.videoType
    const id = pastaDaMidia(midia?.tags, mediaTags)
    if (!id) return null
    return mediaTags[id].aliancaPasta!.camada === "frente" ? "foreground" : "background"
}

export type OrigemDoFim = "proprio" | "item" | "pasta" | "pedido" | "hoje"
export type FimResolvido = {
    loop: boolean | undefined
    origem: OrigemDoFim
    /** no fim do vídeo sem repetir, para no último quadro em vez de limpar o fundo */
    podeCongelar: boolean
}

/**
 * O fim do vídeo, resolvido NA HORA de tocar. Precedência (decisão do André, 14/nov):
 *   ajuste próprio (`aliancaFim`, ou o `loop` que o FreeShow já tinha) > "repetir" do item do culto > pasta > o que quem chamou pediu > padrão de hoje.
 * `semPasta`: as portas que não seguem a pasta (pasta aberta no centro, timeline, API, Bíblia) pulam o passo da pasta.
 * `podeCongelar`: a mídia mora numa pasta (ou tem ajuste de fim próprio); sem repetir, ela para no último quadro.
 */
export function resolverFim(o: { midia?: MidiaDaPasta; mediaTags: TagsDeMidia; loopDoItem?: boolean; loopPedido?: boolean; semPasta?: boolean }): FimResolvido {
    const { midia, mediaTags } = o
    const pastaId = o.semPasta ? null : pastaDaMidia(midia?.tags, mediaTags)
    const podeCongelar = !!pastaId || (!o.semPasta && !!midia?.aliancaFim)

    if (midia?.aliancaFim) return { loop: midia.aliancaFim === "repetir", origem: "proprio", podeCongelar }
    if (typeof midia?.loop === "boolean") return { loop: midia.loop, origem: "proprio", podeCongelar }
    if (typeof o.loopDoItem === "boolean") return { loop: o.loopDoItem, origem: "item", podeCongelar }
    if (pastaId) return { loop: mediaTags[pastaId].aliancaPasta!.fim === "repetir", origem: "pasta", podeCongelar }
    if (typeof o.loopPedido === "boolean") return { loop: o.loopPedido, origem: "pedido", podeCongelar: false }
    return { loop: undefined, origem: "hoje", podeCongelar: false }
}

/** o áudio: o `loop` próprio que já existia vale; a pasta só manda repetir se `repetirAudio` foi ligado de propósito */
export function audioRepete(midia: MidiaDaPasta | undefined, mediaTags: TagsDeMidia): boolean | undefined {
    if (typeof midia?.loop === "boolean") return midia.loop
    const id = pastaDaMidia(midia?.tags, mediaTags)
    if (id && mediaTags[id].aliancaPasta!.repetirAudio) return true
    return undefined
}

// ---------------------------------------------------------------- o estado que o histórico guarda

/** só estes campos da mídia entram no desfazer (nunca o objeto inteiro: `info`, `tracks` etc. chegam em segundo plano) */
export const CAMPOS_DO_AJUSTE = ["tags", "aliancaFim", "videoType", "loop"] as const
export type CampoDoAjuste = (typeof CAMPOS_DO_AJUSTE)[number]
/** valor `null` = a chave não existe */
export type EstadoDePastas = {
    mediaTags?: { [id: string]: Tag | null }
    midia?: { [caminho: string]: { [K in CampoDoAjuste]?: any } }
}

const copia = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

/** o retrato dos ids de etiqueta e dos caminhos tocados (para o "antes") */
export function capturar(origem: { mediaTags: TagsDeMidia; media: { [caminho: string]: any } }, ids: string[], caminhos: string[]): EstadoDePastas {
    const e: EstadoDePastas = { mediaTags: {}, midia: {} }
    for (const id of ids) e.mediaTags![id] = origem.mediaTags[id] ? copia(origem.mediaTags[id]) : null
    for (const c of caminhos) {
        const m = origem.media[c]
        const o: { [k: string]: any } = {}
        for (const k of CAMPOS_DO_AJUSTE) o[k] = m && m[k] !== undefined ? copia(m[k]) : null
        e.midia![c] = o
    }
    return e
}

/** aplica o estado nas cópias de `mediaTags`/`media` (muta e devolve). `null` apaga a chave; o resto do objeto da mídia fica como está */
export function aplicarEstado(estado: EstadoDePastas, alvo: { mediaTags: TagsDeMidia; media: { [caminho: string]: any } }) {
    for (const [id, tag] of Object.entries(estado.mediaTags || {})) {
        if (tag === null) delete alvo.mediaTags[id]
        else alvo.mediaTags[id] = copia(tag)
    }
    for (const [caminho, campos] of Object.entries(estado.midia || {})) {
        const m = alvo.media[caminho] || (alvo.media[caminho] = {})
        for (const [k, v] of Object.entries(campos)) {
            if (v === null || v === undefined || (k === "tags" && Array.isArray(v) && !v.length)) delete m[k]
            else m[k] = copia(v)
        }
    }
    return alvo
}
