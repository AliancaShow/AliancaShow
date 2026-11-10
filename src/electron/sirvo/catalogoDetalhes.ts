// ----- AliançaShow · detalhes de uma música para o catálogo do Sirvo (puro) -----
//
// O renderer só tem o show "aparado" (nome, categoria, datas). Primeira linha,
// artista, tom, CCLI e número de slides estão no arquivo .show, que só o
// processo principal lê. Servem para o Sirvo mostrar "qual versão é esta" no
// seletor e para achar duplicadas (desenho F3 §2 e §4.1).

export type DetalhesDaMusica = { primeira_linha: string | null; artista: string | null; tom: string | null; ccli: string | null; slides: number | null }

/** Corta, tira caractere de controle e marcação. Vazio vira null. */
export function textoCurto(v: unknown, max: number): string | null {
    if (typeof v !== "string" && typeof v !== "number") return null
    const limpo = String(v)
        .replace(/<[^>]*>/g, " ")
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
        .trim()
    return limpo || null
}

function textoDoSlide(slide: any): string {
    const linhas: string[] = []
    for (const item of Array.isArray(slide?.items) ? slide.items : []) {
        for (const linha of Array.isArray(item?.lines) ? item.lines : []) {
            const t = (Array.isArray(linha?.text) ? linha.text : []).map((x: any) => (typeof x?.value === "string" ? x.value : "")).join("")
            if (t.trim()) linhas.push(t)
        }
    }
    return linhas[0] || ""
}

export function detalhesDoShow(show: any): DetalhesDaMusica {
    const meta = show?.meta || {}
    const layout = show?.layouts?.[show?.settings?.activeLayout] || Object.values(show?.layouts || {})[0]
    const slidesDoLayout: any[] = Array.isArray((layout as any)?.slides) ? (layout as any).slides.filter((s: any) => s && !s.disabled) : []

    let primeira: string | null = null
    let total = 0
    for (const ref of slidesDoLayout) {
        const slide = show?.slides?.[ref.id]
        const filhos: string[] = Array.isArray(slide?.children) ? slide.children : []
        total += 1 + filhos.length
        if (!primeira) primeira = textoCurto(textoDoSlide(slide), 120)
        if (!primeira) for (const f of filhos) if (!primeira) primeira = textoCurto(textoDoSlide(show?.slides?.[f]), 120)
    }

    return {
        primeira_linha: primeira,
        artista: textoCurto(meta.artist || meta.author, 80),
        tom: textoCurto(meta.key, 10),
        ccli: textoCurto(meta.CCLI, 20),
        slides: slidesDoLayout.length ? Math.min(total, 999) : null
    }
}
