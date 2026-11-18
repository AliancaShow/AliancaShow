// Leiaute v2, fatia 3 (Editar na forma final): a conta pura. Sem store, sem DOM, nada aqui escreve em `outputs`.
//
// O que o telao mostra de um show e uma FOTO do slide no momento do envio (aliancaFoto.ts). Editar o slide no ar e livre: a foto nao muda, entao o telao
// so troca quando o slide for mandado de novo. Daqui saem os selos NO AR / EDITADO das miniaturas e a faixa "Mandar pro ar" do centro.
import { indiceDaFoto } from "./aliancaFotoLogica"

/** o `out.slide` de uma saida (so o que a conta olha) */
export type SaidaDoAr = { id?: string; layout?: string; index?: number; foto?: { slideId: string; ocorrencia?: number; slide?: any } | null }

export type Selo = { noAr: true; editado: boolean }

/** o que um slide guarda e que a foto cobre: texto/itens e ajustes do slide (cor, fundo proprio...) */
const assinatura = (slide: any): string => JSON.stringify([slide?.items || [], slide?.settings || {}])

/**
 * Selos por POSICAO do layout vivo: so as posicoes que estao no ar (de alguma saida) aparecem. `editado` = o slide vivo difere da foto que a saida mostra.
 * Slide sem foto (a saida le ao vivo) nunca e "editado": o telao ja mostra o que esta na tela.
 */
export function selosDoShow(e: { showId: string; layout: string; ref: { id: string }[]; slides: { [id: string]: any } | null | undefined; noAr: SaidaDoAr[] }): { [posicao: number]: Selo } {
    const saida: { [posicao: number]: Selo } = {}
    for (const o of e.noAr || []) {
        if (!o || o.id !== e.showId || o.layout !== e.layout || typeof o.index !== "number") continue
        const pos = o.foto ? indiceDaFoto(o.foto, o.index, e.ref as any) : o.index
        if (pos < 0 || !e.ref[pos]) continue
        const editado = !!o.foto && assinatura(e.slides?.[e.ref[pos].id]) !== assinatura(o.foto.slide)
        // varias saidas no mesmo slide: basta uma estar defasada para o selo avisar
        saida[pos] = { noAr: true, editado: editado || !!saida[pos]?.editado }
    }
    return saida
}

export type SituacaoDoSlide = "livre" | "no-ar" | "defasado"

/** a nota e a faixa do centro dependem so disto */
export function situacaoDoSlide(selos: { [posicao: number]: Selo }, posicao: number | null | undefined): SituacaoDoSlide {
    if (typeof posicao !== "number") return "livre"
    const s = selos[posicao]
    if (!s) return "livre"
    return s.editado ? "defasado" : "no-ar"
}

export const NOTA_LIVRE = "Clique no texto para editar. Salva sozinho."
export const NOTA_NO_AR = "Este slide está no ar. Pode editar: o telão só muda quando você mandar pro ar de novo."
export const FAIXA_DEFASADO = "O telão ainda mostra a versão anterior. Ela só troca quando você mandar pro ar de novo."

export function notaDoCentro(s: SituacaoDoSlide): string {
    return s === "livre" ? NOTA_LIVRE : s === "no-ar" ? NOTA_NO_AR : ""
}

// ---------------------------------------------------------------- o que muda no telao NA HORA (decisao 6)

/** o que esta no ar de uma saida (so o que a conta olha) */
export type ConteudoDoAr = { background?: { path?: string; id?: string } | null; overlays?: string[] | null; effects?: string[] | null }

/**
 * Fundo, sobreposicao e efeito sao lidos AO VIVO pelo telao: editar o que esta no ar muda na hora. Devolve o aviso, ou "" quando a edicao nao
 * toca o que esta no ar. (O slide de show e congelado pela foto; versiculo/musica seguem a mesma regra do slide.)
 */
export function avisoAoVivo(e: { tipo?: string; id?: string; noAr: ConteudoDoAr[] }): string {
    const id = e.id || ""
    if (!id || !e.tipo) return ""
    const noAr = (e.noAr || []).some((o) => {
        if (!o) return false
        if (e.tipo === "overlay") return (o.overlays || []).includes(id)
        if (e.tipo === "effect") return (o.effects || []).includes(id)
        if (e.tipo === "media") return o.background?.path === id || o.background?.id === id
        return false
    })
    return noAr ? "Isto está no ar: o que você mudar aparece no telão na hora." : ""
}

// ---------------------------------------------------------------- o item em edicao (roteiro ou aberto da biblioteca)

export type TipoEditavel = "show" | "media" | "audio" | "camera" | "overlay" | "template" | "effect"
export type ItemEditavel = { chave: string; tipo: TipoEditavel; id: string; nome: string }
export const MAX_AVULSOS = 5

export const chaveDoItem = (tipo: string, id: string): string => `${tipo}:${id}`

/** o ultimo aberto vai para a frente; repetido nao duplica; guarda ate `max` (memoria, nao vai para o disco) */
export function empurrarAvulso(lista: ItemEditavel[], item: ItemEditavel, max = MAX_AVULSOS): ItemEditavel[] {
    return [item, ...lista.filter((a) => a.chave !== item.chave)].slice(0, max)
}

/** tira um item que nao existe mais (show apagado) */
export function tirarAvulso(lista: ItemEditavel[], chave: string): ItemEditavel[] {
    return lista.filter((a) => a.chave !== chave)
}

/** o item aberto esta no roteiro (culto) aberto? So `show`: midia e demais so entram como avulso. */
export function estaNoRoteiro(roteiro: { id?: string; type?: string }[] | null | undefined, tipo: string, id: string): boolean {
    if (tipo !== "show") return false
    return (roteiro || []).some((i) => i && i.id === id && (i.type || "show") === "show")
}

/** O tipo curto que o seletor mostra ao lado do nome (o prototipo usa um simbolo) */
export const SIMBOLO_DO_TIPO: { [t in TipoEditavel]: string } = { show: "♪", media: "▶", audio: "♫", camera: "◉", overlay: "▭", template: "▤", effect: "✦" }

/** o rotulo do tipo na linha "EDITANDO" quando nao e um show (sem slides para contar) */
export const ROTULO_DO_TIPO: { [t in TipoEditavel]: string } = { show: "slides", media: "mídia", audio: "áudio", camera: "câmera", overlay: "sobreposição", template: "modelo", effect: "efeito" }

/** a contagem do cabecalho: "6 slides" (singular com 1) */
export function contagemDeSlides(n: number): string {
    return n === 1 ? "1 slide" : `${n} slides`
}

/**
 * Que item o `activeEdit`/`activeShow` descrevem agora? null = nada aberto. O show vem de `activeEdit.showId` ou do `activeShow`.
 * `nomeDe` e injetado (le os stores no componente).
 */
export function itemEmEdicao(e: { edit: { type?: string; id?: string; showId?: string } | null | undefined; show: { id?: string; type?: string } | null | undefined; nomeDe: (tipo: TipoEditavel, id: string) => string }): ItemEditavel | null {
    const tipoEdit = (e.edit?.type || "show") as TipoEditavel
    let tipo: TipoEditavel
    let id = ""
    if (tipoEdit === "show") {
        tipo = "show"
        // a mesma ordem do Editor e dos slides: o show aberto manda, o `showId` do editor e o reserva (como em `Editor.svelte`)
        id = (e.show && (e.show.type === undefined || e.show.type === "show") ? e.show.id || "" : "") || e.edit?.showId || ""
    } else {
        tipo = tipoEdit
        id = e.edit?.id || ""
    }
    if (!id) return null
    return { chave: chaveDoItem(tipo, id), tipo, id, nome: e.nomeDe(tipo, id) || "" }
}
