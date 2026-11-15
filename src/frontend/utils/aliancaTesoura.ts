import { get } from "svelte/store"
import { uid } from "uid"
import type { Line } from "../../types/Show"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { outputs, showsCache } from "../stores"
import { newToast } from "./common"
import type { ModoDeDivisao } from "./aliancaLetra"
import { caixasComLinhas, cortarComLinhas, cortarEntreLinhas, juntarComAnterior, motivoDeNaoCortar, motivoDeNaoJuntar, motivoDeNaoRedividir, paiDe, redividirGrupo, textoDaLinha, type RascunhoDoShow } from "./aliancaTesouraLogica"

export * from "./aliancaTesouraLogica"

// ----- AliançaShow · Preparar, fatia 5: cortar e juntar slides (o que mexe nos stores) -----
//
// A conta mora em aliancaTesouraLogica.ts. Aqui: pegar o show, gravar UMA entrada de histórico por ação (sem `override`:
// cada corte tem o seu Ctrl+Z) e acertar a foto do slide no ar.

/** um rascunho (clone) do show do cache */
export function rascunhoDoShow(showId: string): (RascunhoDoShow & { [chave: string]: any }) | null {
    const show: any = get(showsCache)[showId]
    return show ? clone(show) : null
}

/** grava no histórico: o show inteiro se o layout mexeu (como o `mergeSlides`), senão só os slides */
function gravar(showId: string, rascunho: RascunhoDoShow & { [chave: string]: any }, mexeuNoLayout: boolean) {
    if (mexeuNoLayout) history({ id: "UPDATE", newData: { data: rascunho }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    else history({ id: "UPDATE", newData: { key: "slides", data: rascunho.slides }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
}

/** a foto de quem estava no ar e foi apagado passa a ser do slide que ficou (a saída não redesenha: `foto.slide` não muda) */
function reapontarFotos(showId: string, apagados: string[], paraId: string) {
    // muda no lugar, SEM `outputs.update`: o update mandaria o slide inteiro de novo e a janela de saída redesenharia
    // (a foto.slide, que é o que ela mostra, não muda; o slideId só serve ao app principal para achar a posição)
    for (const out of Object.values(get(outputs))) {
        const slide: any = out?.out?.slide
        if (slide?.id === showId && slide.foto && apagados.includes(slide.foto.slideId)) slide.foto.slideId = paraId
    }
}

/** corte entre linhas (vista Dividir). `linhaIdx` = quantas linhas ficam em cima. Devolve o id do slide novo. */
export function cortarNaLinha(showId: string, slideId: string, itemIdx: number, linhaIdx: number): string | null {
    const r = rascunhoDoShow(showId)
    if (!r) return null
    const motivo = motivoDeNaoCortar(r, slideId)
    if (motivo) {
        newToast(motivo)
        return null
    }
    const novoId = uid()
    const res = cortarEntreLinhas(r, slideId, itemIdx, linhaIdx, novoId)
    if (!res) return null
    gravar(showId, r, res.mexeuNoLayout)
    return novoId
}

/** Ctrl+Enter no cursor: o slide fica com `primeiras`, o novo (filho, logo depois) com `segundas`. Uma entrada só. */
export function cortarNoCursor(showId: string, slideId: string, itemIdx: number, primeiras: Line[], segundas: Line[]): string | null {
    const r = rascunhoDoShow(showId)
    if (!r || !r.slides[slideId]?.items?.[itemIdx]) return null
    const motivo = r.locked ? "Show travado: destrave para cortar" : null
    if (motivo) {
        newToast(motivo)
        return null
    }
    const novoId = uid()
    const res = cortarComLinhas(r, slideId, itemIdx, clone(primeiras), clone(segundas), novoId)
    gravar(showId, r, res.mexeuNoLayout)
    return novoId
}

/** junta o slide no anterior do grupo (o anterior mantém o id). Devolve o id do anterior. */
export function juntarSlide(showId: string, slideId: string): string | null {
    const r = rascunhoDoShow(showId)
    if (!r) return null
    const motivo = motivoDeNaoJuntar(r, slideId)
    if (motivo) {
        newToast(motivo)
        return null
    }
    const res = juntarComAnterior(r, slideId)
    if (!res) return null
    reapontarFotos(showId, [slideId], res.anteriorId)
    gravar(showId, r, res.mexeuNoLayout)
    return res.anteriorId
}

/** "Cortar ao meio" do menu/Alt+Enter na grade: ao meio entre as linhas de cada slide, uma entrada de histórico só */
export function cortarAoMeio(showId: string, slideIds: string[]): number {
    const r = rascunhoDoShow(showId)
    if (!r) return 0
    let feitos = 0
    let mexeu = false
    let motivo: string | null = null
    for (const id of [...new Set(slideIds)]) {
        const m = motivoDeNaoCortar(r, id)
        if (m) {
            motivo = m
            continue
        }
        const caixa = caixasComLinhas(r.slides[id])[0]
        const n = (r.slides[id].items[caixa].lines || []).length
        if (n < 2) continue
        const res = cortarEntreLinhas(r, id, caixa, Math.ceil(n / 2), uid())
        if (!res) continue
        feitos++
        if (res.mexeuNoLayout) mexeu = true
    }
    if (feitos) gravar(showId, r, mexeu)
    else if (motivo) newToast(motivo)
    return feitos
}

/** "Juntar" do menu na grade: os slides escolhidos têm que ser vizinhos no mesmo grupo. Uma entrada de histórico só. */
export function juntarSelecao(showId: string, slideIds: string[]): boolean {
    const r = rascunhoDoShow(showId)
    if (!r) return false
    const ids = [...new Set(slideIds)]
    if (!ids.length) return false
    const pais = new Set(ids.map((id) => paiDe(r, id)))
    if (pais.size !== 1) {
        newToast("Só dá para juntar slides do mesmo grupo")
        return false
    }
    const paiId = [...pais][0]!
    const cadeia = [paiId, ...(r.slides[paiId]?.children || [])]
    const pos = ids.map((id) => cadeia.indexOf(id)).sort((a, b) => a - b)
    if (ids.length === 1) {
        if (pos[0] === 0) {
            newToast("É o primeiro do grupo: não há com quem juntar")
            return false
        }
        pos.unshift(pos[0] - 1)
    }
    for (let i = 1; i < pos.length; i++) {
        if (pos[i] !== pos[i - 1] + 1) {
            newToast("Escolha slides vizinhos do mesmo grupo para juntar")
            return false
        }
    }
    const apagados: string[] = []
    let anterior = cadeia[pos[0]]
    let mexeu = false
    for (const p of pos.slice(1)) {
        const id = cadeia[p]
        const m = motivoDeNaoJuntar(r, id)
        if (m) {
            newToast(m)
            return false
        }
        const res = juntarComAnterior(r, id)
        if (!res) return false
        apagados.push(id)
        anterior = res.anteriorId
        if (res.mexeuNoLayout) mexeu = true
    }
    reapontarFotos(showId, apagados, anterior)
    gravar(showId, r, mexeu)
    return true
}

/** "Dividir de novo" de um grupo. Devolve { antes, depois } ou null. */
export function redividirDoGrupo(showId: string, paiId: string, modo: ModoDeDivisao, n: number): { antes: number; depois: number } | null {
    const r = rascunhoDoShow(showId)
    if (!r) return null
    const motivo = motivoDeNaoRedividir(r, paiId, modo)
    if (motivo) {
        newToast(motivo)
        return null
    }
    const res = redividirGrupo(r, paiId, modo, n, () => uid())
    if (!res) return null
    if (res.apagados.length) reapontarFotos(showId, res.apagados, paiId)
    gravar(showId, r, false)
    return { antes: res.antes, depois: res.depois }
}

// ---------------------------------------------------------------- Esc cancela a edição rápida (I2)

type Retrato = { showId: string; slideId: string; itemIdx: number; lines: Line[] }
let retrato: Retrato | null = null

/** ao focar a caixa da edição rápida (lista): guarda como estava */
export function guardarRetrato(showId: string, slideId: string, itemIdx: number) {
    const lines: Line[] | undefined = (get(showsCache)[showId] as any)?.slides?.[slideId]?.items?.[itemIdx]?.lines
    if (!lines) return
    retrato = { showId, slideId, itemIdx, lines: clone(lines) }
}

export function soltarRetrato() {
    retrato = null
}

/**
 * Esc na edição rápida: se o texto mudou desde o foco, repõe como estava (UMA entrada de histórico, o Ctrl+Z devolve o
 * digitado). Devolve se desfez. O Esc segue depois a ordem de sempre (tirar o foco).
 */
export function cancelarEdicao(showId: string, slideId: string, itemIdx: number): boolean {
    const r = retrato
    if (!r || r.showId !== showId || r.slideId !== slideId || r.itemIdx !== itemIdx) return false
    const atual: Line[] | undefined = (get(showsCache)[showId] as any)?.slides?.[slideId]?.items?.[itemIdx]?.lines
    if (!atual) return false
    // o retrato vale só uma vez: o próximo foco tira outro
    retrato = null
    if (JSON.stringify(atual) === JSON.stringify(r.lines)) return false
    history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([r.lines]), slides: [slideId], items: [itemIdx], showId }, location: { page: "none" } })
    return true
}

/** só o texto, para as conferências */
export const textosDoSlide = (showId: string, slideId: string, itemIdx = 0): string[] => (((get(showsCache)[showId] as any)?.slides?.[slideId]?.items?.[itemIdx]?.lines || []) as Line[]).map(textoDaLinha)
