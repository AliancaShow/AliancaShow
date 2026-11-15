import type { Item, Line, Slide, SlideData } from "../../types/Show"
import { linhasPorSlideDoModo, type ModoDeDivisao } from "./aliancaLetra"

// ----- AliançaShow · Preparar, fatia 5: cortar e juntar slides (parte pura, sem stores) -----
//
// Tudo aqui trabalha sobre um "rascunho" do show (`{ slides, layouts }`) que o chamador já clonou: as funções mudam o
// rascunho e devolvem o que o chamador precisa (ou o motivo de não poder). Quem grava no histórico é aliancaTesoura.ts.
//
// Por que não usar `splitItemInTwo` / `mergeSlides` do FreeShow (o Culto continua com eles):
//  - splitItemInTwo apaga linha vazia e o 1º segmento vazio, e duplica acorde em slide de 1 linha;
//  - mergeSlides tira do layout TODA ocorrência dos slides juntados: juntar um refrão que aparece 3 vezes apaga 2.

export type RascunhoDoShow = {
    locked?: boolean
    slides: { [id: string]: Slide }
    layouts: { [id: string]: { name?: string; notes?: string; slides: SlideData[] } }
}

const ehTexto = (item: Item | undefined): boolean => !!item && (item.type || "text") === "text"

export const textoDaLinha = (linha: Line | undefined): string => (linha?.text || []).map((t) => t.value || "").join("")
export const linhaVazia = (linha: Line | undefined): boolean => textoDaLinha(linha).trim() === ""

/** índices dos itens de texto do slide */
export function indicesDeTexto(slide: Slide | undefined): number[] {
    const r: number[] = []
    ;(slide?.items || []).forEach((it, i) => {
        if (ehTexto(it)) r.push(i)
    })
    return r
}

/** itens de texto que têm linhas (a caixa onde a letra mora) */
export function caixasComLinhas(slide: Slide | undefined): number[] {
    return indicesDeTexto(slide).filter((i) => (slide!.items[i].lines || []).length > 0)
}

/** o pai do slide: ele mesmo, ou o slide que o tem em `children` */
export function paiDe(show: RascunhoDoShow, slideId: string): string | null {
    if (!show.slides[slideId]) return null
    for (const [id, s] of Object.entries(show.slides)) if (s?.children?.includes(slideId)) return id
    return slideId
}

/** o show todo travado, ou o grupo travado (o slide pai com `locked`) */
export function travado(show: RascunhoDoShow, slideId: string): boolean {
    const pai = paiDe(show, slideId)
    return !!show.locked || !!(pai && show.slides[pai]?.locked)
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

// ---------------------------------------------------------------- cortar

/** por que a vista NÃO oferece o corte entre linhas neste slide (null = pode) */
export function motivoDeNaoCortar(show: RascunhoDoShow, slideId: string): string | null {
    const slide = show.slides[slideId]
    if (!slide) return "Slide não encontrado"
    if (travado(show, slideId)) return "Show ou grupo travado: destrave para cortar"
    if (slide.customDynamicValues) return "Slide de Bíblia: corte no editor"
    if (caixasComLinhas(slide).length !== 1) return "Slide com mais de uma caixa de texto: corte no editor"
    return null
}

/** as entradas do layout (de TODOS os layouts) em que esse slide aparece */
function entradasDoSlide(show: RascunhoDoShow, slideId: string, paiId: string): { entrada: SlideData; filho: boolean }[] {
    const r: { entrada: SlideData; filho: boolean }[] = []
    for (const layout of Object.values(show.layouts || {})) {
        for (const e of layout.slides || []) if (e.id === paiId) r.push({ entrada: e, filho: slideId !== paiId })
    }
    return r
}

/**
 * Corta `slideId` em dois: o slide mantém `primeiras` e um slide NOVO (`novoId`, filho do mesmo pai, logo depois dele)
 * fica com `segundas` na caixa `itemIdx`. Clona o resto do slide (mídia e camadas vão para as duas metades).
 * Escondido (I4): o novo nasce escondido nas mesmas ocorrências; `end` (voltar ao início) vai para a 2ª metade.
 * Devolve se mexeu em `layouts` (aí o chamador grava o show inteiro).
 */
export function cortarComLinhas(show: RascunhoDoShow, slideId: string, itemIdx: number, primeiras: Line[], segundas: Line[], novoId: string): { mexeuNoLayout: boolean } {
    const slide = show.slides[slideId]
    const paiId = paiDe(show, slideId)!
    const novo: Slide = clone(slide)
    delete novo.id
    delete novo.globalGroup
    delete novo.children
    novo.group = null
    novo.color = null
    slide.items[itemIdx].lines = primeiras
    novo.items[itemIdx].lines = segundas
    show.slides[novoId] = novo

    const pai = show.slides[paiId]
    const filhos = [...(pai.children || [])]
    const pos = slideId === paiId ? 0 : filhos.indexOf(slideId) + 1
    filhos.splice(pos, 0, novoId)
    pai.children = filhos

    let mexeu = false
    for (const { entrada, filho } of entradasDoSlide(show, slideId, paiId)) {
        const dadosDeCima: SlideData | undefined = filho ? entrada.children?.[slideId] : entrada
        if (!dadosDeCima) continue
        const novosDados: any = {}
        if (dadosDeCima.disabled) novosDados.disabled = true
        if (dadosDeCima.end) {
            novosDados.end = true
            delete dadosDeCima.end
            mexeu = true
        }
        if (Object.keys(novosDados).length) {
            entrada.children = { ...(entrada.children || {}), [novoId]: novosDados }
            mexeu = true
        }
    }
    return { mexeuNoLayout: mexeu }
}

/** corte entre linhas: `linhaIdx` = quantas linhas ficam em cima (1..n-1), contando `item.lines` SEM filtrar (B4) */
export function cortarEntreLinhas(show: RascunhoDoShow, slideId: string, itemIdx: number, linhaIdx: number, novoId: string): { mexeuNoLayout: boolean } | null {
    const slide = show.slides[slideId]
    const linhas: Line[] = slide?.items?.[itemIdx]?.lines || []
    if (!slide || linhaIdx < 1 || linhaIdx >= linhas.length) return null
    return cortarComLinhas(show, slideId, itemIdx, linhas.slice(0, linhaIdx), linhas.slice(linhaIdx), novoId)
}

// ---------------------------------------------------------------- juntar

/** o slide que vem logo antes de `slideId` dentro do grupo (o pai, ou o filho anterior). null = `slideId` é o pai */
export function anteriorNoGrupo(show: RascunhoDoShow, slideId: string): string | null {
    const paiId = paiDe(show, slideId)
    if (!paiId || paiId === slideId) return null
    const filhos = show.slides[paiId].children || []
    const i = filhos.indexOf(slideId)
    if (i < 0) return null
    return i === 0 ? paiId : filhos[i - 1]
}

/** por que o vão "Juntar" fica desabilitado (null = pode juntar o slide com o anterior) */
export function motivoDeNaoJuntar(show: RascunhoDoShow, slideId: string): string | null {
    const slide = show.slides[slideId]
    if (!slide) return "Slide não encontrado"
    if (travado(show, slideId)) return "Show ou grupo travado: destrave para juntar"
    const anteriorId = anteriorNoGrupo(show, slideId)
    if (!anteriorId) return "É o primeiro do grupo: não há com quem juntar"
    const anterior = show.slides[anteriorId]
    if (slide.customDynamicValues || anterior?.customDynamicValues) return "Slide de Bíblia: junte no editor"
    if (indicesDeTexto(slide).length !== indicesDeTexto(anterior).length) return "Os dois slides têm números diferentes de caixas de texto: junte no editor"
    return null
}

/** o filho tem dados próprios no layout (fundo, áudio, ações, escondido...)? Juntar vai perdê-los. */
export function dadosDoFilhoNoLayout(show: RascunhoDoShow, slideId: string): boolean {
    const paiId = paiDe(show, slideId)
    if (!paiId || paiId === slideId) return false
    return entradasDoSlide(show, slideId, paiId).some(({ entrada }) => {
        const d = entrada.children?.[slideId]
        return !!d && Object.keys(d).length > 0
    })
}

/**
 * Junta `slideId` NO slide anterior do grupo (que mantém o id). As linhas (objetos `Line`, com os acordes) entram no fim da
 * caixa; itens que não são texto e ainda não existem no anterior são adicionados; as notas são concatenadas. O filho some de
 * `children` e do rascunho. NÃO mexe em `layouts[*].slides`: filho não está lá, e todas as ocorrências do refrão continuam.
 * Devolve o id do anterior (e se tirou dados de layout).
 */
export function juntarComAnterior(show: RascunhoDoShow, slideId: string): { anteriorId: string; mexeuNoLayout: boolean } | null {
    if (motivoDeNaoJuntar(show, slideId)) return null
    const anteriorId = anteriorNoGrupo(show, slideId)!
    const slide = show.slides[slideId]
    const anterior = show.slides[anteriorId]
    const paiId = paiDe(show, slideId)!

    const caixasA = indicesDeTexto(anterior)
    const caixasB = indicesDeTexto(slide)
    caixasB.forEach((iB, k) => {
        const iA = caixasA[k]
        anterior.items[iA].lines = [...(anterior.items[iA].lines || []), ...clone(slide.items[iB].lines || [])]
    })
    const jaTem = new Set(anterior.items.filter((it) => !ehTexto(it)).map((it) => JSON.stringify(it)))
    for (const it of slide.items) {
        if (ehTexto(it)) continue
        const s = JSON.stringify(it)
        if (jaTem.has(s)) continue
        anterior.items.push(clone(it))
        jaTem.add(s)
    }
    const notas = [anterior.notes, slide.notes].filter((n) => (n || "").trim().length)
    if (notas.length) anterior.notes = notas.join("\n")

    show.slides[paiId].children = (show.slides[paiId].children || []).filter((c) => c !== slideId)
    delete show.slides[slideId]

    let mexeu = false
    for (const layout of Object.values(show.layouts || {})) {
        for (const e of layout.slides || []) {
            if (e.id !== paiId || !e.children || !(slideId in e.children)) continue
            delete e.children[slideId]
            mexeu = true
        }
    }
    return { anteriorId, mexeuNoLayout: mexeu }
}

// ---------------------------------------------------------------- "Dividir de novo"

/** quebra as linhas em blocos: por parágrafo (a linha vazia some), de 1 em 1 ou de N em N (linha vazia é descartada) */
export function dividirLinhasEmBlocos(linhas: Line[], modo: ModoDeDivisao, n: number): Line[][] {
    const blocos: Line[][] = []
    if (modo === "paragrafo") {
        let atual: Line[] = []
        for (const l of linhas) {
            if (linhaVazia(l)) {
                if (atual.length) blocos.push(atual)
                atual = []
            } else atual.push(l)
        }
        if (atual.length) blocos.push(atual)
        return blocos
    }
    const por = linhasPorSlideDoModo(modo, n)
    const cheias = linhas.filter((l) => !linhaVazia(l))
    for (let i = 0; i < cheias.length; i += por) blocos.push(cheias.slice(i, i + por))
    return blocos
}

/** a cadeia do grupo: pai, depois os filhos que existem */
export function cadeiaDoGrupo(show: RascunhoDoShow, paiId: string): string[] {
    const pai = show.slides[paiId]
    if (!pai) return []
    return [paiId, ...(pai.children || []).filter((c) => show.slides[c])]
}

const semLinhas = (item: Item) => {
    const { lines: _l, autoFontSize: _a, previewAutoFontSize: _p, id: _i, ...resto } = item as any
    return JSON.stringify(resto)
}

const MOTIVO_MIDIA = "Essa música tem mídia ou ajuste próprio em algum slide: use a tesoura pra não perder."

/** por que "Dividir de novo" não vale para este grupo (null = pode). `modo` só importa para "paragrafo". */
export function motivoDeNaoRedividir(show: RascunhoDoShow, paiId: string, modo: ModoDeDivisao | null = null): string | null {
    const cadeia = cadeiaDoGrupo(show, paiId)
    if (!cadeia.length) return "Grupo não encontrado"
    if (travado(show, paiId)) return "Show ou grupo travado: destrave para dividir de novo"
    const slides = cadeia.map((id) => show.slides[id])
    if (slides.some((s) => s.customDynamicValues)) return "Slide de Bíblia: não dá para dividir de novo"
    for (const s of slides) if (caixasComLinhas(s).length !== 1 || indicesDeTexto(s).length !== 1) return MOTIVO_MIDIA
    const ref = slides[0]
    const caixaRef = semLinhas(ref.items[indicesDeTexto(ref)[0]])
    const outros = (s: Slide) => JSON.stringify(s.items.filter((it) => !ehTexto(it)))
    const outrosRef = outros(ref)
    const configRef = JSON.stringify(ref.settings || {})
    for (const s of slides) {
        if (semLinhas(s.items[indicesDeTexto(s)[0]]) !== caixaRef) return "Os slides do grupo têm caixas de texto com estilo diferente: use a tesoura pra não perder."
        if (outros(s) !== outrosRef) return MOTIVO_MIDIA
        if (JSON.stringify(s.settings || {}) !== configRef) return "Os slides do grupo têm ajustes diferentes: use a tesoura pra não perder."
    }
    if (slides.slice(1).some((s) => (s.notes || "").trim())) return "Há notas em slides do grupo: use a tesoura pra não perder."
    for (const layout of Object.values(show.layouts || {})) {
        for (const e of layout.slides || []) {
            if (e.id !== paiId) continue
            for (const id of cadeia.slice(1)) if (e.children?.[id] && Object.keys(e.children[id]).length) return MOTIVO_MIDIA
        }
    }
    if (modo === "paragrafo") {
        const linhas = cadeia.flatMap((id) => show.slides[id].items[indicesDeTexto(show.slides[id])[0]].lines || [])
        if (!linhas.some(linhaVazia)) return "Esse grupo não tem linha vazia: escolha outra divisão."
    }
    return null
}

/** quantos slides o grupo teria (para a prévia "antes → depois") */
export function contagemDepoisDeRedividir(show: RascunhoDoShow, paiId: string, modo: ModoDeDivisao, n: number): number {
    const linhas = cadeiaDoGrupo(show, paiId).flatMap((id) => show.slides[id].items[indicesDeTexto(show.slides[id])[0]].lines || [])
    return dividirLinhasEmBlocos(linhas, modo, n).length
}

/**
 * Remonta o grupo pela regra nova. O pai mantém o id e recebe o 1º bloco; filhos antigos são reaproveitados por posição
 * (mesmo id), os que faltam nascem de `novoIdDe()`, os que sobram são apagados. Devolve os ids apagados.
 */
export function redividirGrupo(show: RascunhoDoShow, paiId: string, modo: ModoDeDivisao, n: number, novoIdDe: () => string): { apagados: string[]; antes: number; depois: number } | null {
    if (motivoDeNaoRedividir(show, paiId, modo)) return null
    const cadeia = cadeiaDoGrupo(show, paiId)
    const caixa = (id: string) => indicesDeTexto(show.slides[id])[0]
    const linhas = cadeia.flatMap((id) => show.slides[id].items[caixa(id)].lines || [])
    const blocos = dividirLinhasEmBlocos(linhas, modo, n)
    if (!blocos.length) return null

    const modelo = show.slides[paiId]
    const molde: Slide = clone(show.slides[cadeia[cadeia.length - 1]])
    const novosFilhos: string[] = []
    blocos.forEach((bloco, i) => {
        if (i === 0) {
            modelo.items[caixa(paiId)].lines = bloco
            return
        }
        const velho = cadeia[i]
        if (velho) {
            show.slides[velho].items[caixa(velho)].lines = bloco
            novosFilhos.push(velho)
            return
        }
        const id = novoIdDe()
        const novo: Slide = clone(molde)
        delete novo.id
        delete novo.globalGroup
        delete novo.children
        novo.group = null
        novo.color = null
        novo.items[indicesDeTexto(novo)[0]].lines = bloco
        show.slides[id] = novo
        novosFilhos.push(id)
    })
    const apagados = cadeia.slice(blocos.length)
    for (const id of apagados) delete show.slides[id]
    modelo.children = novosFilhos
    return { apagados, antes: cadeia.length, depois: blocos.length }
}

// ---------------------------------------------------------------- o que a vista Dividir desenha

export type SlideDaVista = { id: string; linhas: Line[]; caixa: number; escondido: boolean; filho: boolean; motivoCortar: string | null; motivoJuntar: string | null; temMidia: boolean }
export type GrupoDaVista = { paiId: string; ocorrencias: number; slides: SlideDaVista[]; motivoRedividir: string | null }

/** os grupos ÚNICOS do layout, na ordem da 1ª ocorrência (refrão repetido aparece uma vez, com `ocorrencias`) */
export function gruposDaVista(show: RascunhoDoShow, layoutId: string): GrupoDaVista[] {
    const layout = show.layouts?.[layoutId]
    if (!layout) return []
    const ordem: string[] = []
    const conta: { [id: string]: number } = {}
    for (const e of layout.slides || []) {
        if (!show.slides[e.id]) continue
        if (!(e.id in conta)) {
            conta[e.id] = 0
            ordem.push(e.id)
        }
        conta[e.id]++
    }
    return ordem.map((paiId) => ({
        paiId,
        ocorrencias: conta[paiId],
        motivoRedividir: motivoDeNaoRedividir(show, paiId),
        slides: cadeiaDoGrupo(show, paiId).map((id) => {
            const s = show.slides[id]
            const caixas = caixasComLinhas(s)
            const entradas = entradasDoSlide(show, id, paiId)
            const escondido = entradas.length > 0 && entradas.every(({ entrada, filho }) => !!(filho ? entrada.children?.[id] : entrada)?.disabled)
            return {
                id,
                linhas: caixas.length ? s.items[caixas[0]].lines || [] : [],
                caixa: caixas[0] ?? -1,
                escondido,
                filho: id !== paiId,
                motivoCortar: motivoDeNaoCortar(show, id),
                motivoJuntar: id === paiId ? null : motivoDeNaoJuntar(show, id),
                temMidia: s.items.some((it) => !ehTexto(it))
            }
        })
    }))
}
