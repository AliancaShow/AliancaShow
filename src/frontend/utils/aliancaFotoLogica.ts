import type { LayoutRef, OutSlide } from "../../types/Show"

// Parte pura da "foto" do slide (sem dependencias de app): ver aliancaFoto.ts

export type FotoDoSlide = {
    slideId: string // id do slide no momento do envio (a posicao no layout pode andar depois)
    ocorrencia?: number // a n-esima vez (de 0) que o slideId aparece no layout no momento do envio (refrao repetido)
    index: number // posicao no layout no momento do envio
    slide: any // o slide inteiro (items, settings, customDynamicValues...)
    slideData: any // o `data` do layout ref: transicao, filtros, cor, actions.animate...
}

/** A n-esima vez (de 0) que o slide da posição `index` aparece no layout. */
export function ocorrenciaNoLayout(layoutRef: LayoutRef[], index: number): number {
    const id = layoutRef[index]?.id
    let n = 0
    for (let i = 0; i < index; i++) if (layoutRef[i]?.id === id) n++
    return n
}

/** So show de verdade. Temp (Biblia), tempText, PDF, PPT e outros tipos seguem lendo ao vivo. */
export function podeTerFoto(data: any): boolean {
    if (!data?.id || data.id === "temp" || data.id === "tempText") return false
    return !data.type || data.type === "show"
}

/**
 * A foto e do mesmo slide que esta sendo enviado agora (mesmo show, layout e posicao)? Muda so line/revealCount/projectIndex.
 * Alem de id+layout+index, o slide que esta HOJE nessa posicao do layout vivo tem que ser o da foto: se o layout andou
 * (inseriu/tirou slide), o mesmo index pode ser outro slide e a foto antiga nao vale.
 */
export function mesmoSlideDaFoto(atual: OutSlide | null | undefined, novo: any, layoutRef: LayoutRef[]): boolean {
    if (!atual?.foto || atual.id !== novo?.id || atual.layout !== novo?.layout || atual.index !== novo?.index) return false
    return layoutRef[novo.index]?.id === atual.foto.slideId
}

/**
 * Onde o slide da foto esta no layout VIVO agora. Se `layoutRef[index].id` ainda e o da foto, e o `index`.
 * Senao, a ocorrencia mais proxima do index antigo (refrao repetido aparece varias vezes no layout achatado).
 * -1 = o slide sumiu do layout.
 */
export function indiceDaFoto(foto: { slideId: string; ocorrencia?: number } | undefined | null, index: number | undefined, layoutRef: LayoutRef[]): number {
    const idx = typeof index === "number" ? index : -1
    if (!foto) return idx

    // com a ocorrencia gravada no envio, a n-esima vez que o slide aparece e a certa (cortar/juntar nao a embaralha);
    // "a mais proxima" so vale quando a n-esima nao existe mais (ou foto antiga, sem ocorrencia)
    if (typeof foto.ocorrencia === "number") {
        let n = 0
        for (let i = 0; i < layoutRef.length; i++) {
            if (layoutRef[i]?.id !== foto.slideId) continue
            if (n === foto.ocorrencia) return i
            n++
        }
    } else if (layoutRef[idx]?.id === foto.slideId) return idx

    let melhor = -1
    let distancia = Infinity
    layoutRef.forEach((ref, i) => {
        if (ref?.id !== foto.slideId) return
        const d = Math.abs(i - idx)
        if (d < distancia) {
            melhor = i
            distancia = d
        }
    })
    return melhor
}

/** Copia do slide sem a foto (pra mandar pro Remote/Stage web e pro disco). */
export function semFoto<T extends { foto?: any } | null | undefined>(slide: T): T {
    if (!slide || !(slide as any).foto) return slide
    const { foto: _foto, ...resto } = slide as any
    return resto
}

/** `out` sem a foto do slide. */
export function outSemFoto(out: any): any {
    if (!out?.slide?.foto) return out
    return { ...out, slide: semFoto(out.slide) }
}
