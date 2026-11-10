// ----- AliançaShow · detalhes de uma música para o catálogo do Sirvo (puro) -----
//
// O renderer só tem o show "aparado" (nome, categoria, datas). Primeira linha,
// artista, CCLI e o trecho estão no arquivo .show, que só o processo principal
// lê. Servem para o Sirvo mostrar "qual versão é esta" no seletor e para achar
// duplicadas (desenho F3 §2 e §4.1).
//
// Trecho (decisão do André, 10/nov — substitui tom e número de slides): as
// duas primeiras linhas do primeiro verso e a primeira do refrão, cada pedaço
// com o nome do grupo. `[{grupo, linhas}]`, no máximo 3 pedaços de ≤ 2 linhas
// (o Sirvo limpa de novo em `private.trecho_do_show`, migration 0086).

export type PedacoDoTrecho = { grupo: string; linhas: string[] }
export type DetalhesDaMusica = { primeira_linha: string | null; artista: string | null; ccli: string | null; trecho: PedacoDoTrecho[] | null }

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

function linhasDoSlide(slide: any): string[] {
    const linhas: string[] = []
    for (const item of Array.isArray(slide?.items) ? slide.items : []) {
        for (const linha of Array.isArray(item?.lines) ? item.lines : []) {
            const t = textoCurto((Array.isArray(linha?.text) ? linha.text : []).map((x: any) => (typeof x?.value === "string" ? x.value : "")).join(""), 120)
            if (t) linhas.push(t)
        }
    }
    return linhas
}

const NOME_DO_GLOBAL: { [g: string]: string } = { verse: "Verso", chorus: "Refrão", pre_chorus: "Pré-refrão", bridge: "Ponte", intro: "Intro", outro: "Final", tag: "Tag", break: "Instrumental" }

/** o tipo do grupo: pelo grupo global do FreeShow, senão pelo nome escrito */
function tipoDoGrupo(slide: any): "verso" | "refrao" | null {
    const g = typeof slide?.globalGroup === "string" ? slide.globalGroup : ""
    if (g === "verse") return "verso"
    if (g === "chorus") return "refrao"
    const nome = String(slide?.group || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/\s*\d+$/, "")
        .trim()
    if (/^(verso|verse|estrofe)$/.test(nome)) return "verso"
    if (/^(refrao|coro|chorus)$/.test(nome)) return "refrao"
    return null
}

function nomeDoGrupo(slide: any, padrao: string): string {
    return textoCurto(slide?.group, 30) || NOME_DO_GLOBAL[slide?.globalGroup] || padrao
}

export function detalhesDoShow(show: any): DetalhesDaMusica {
    const meta = show?.meta || {}
    const layout = show?.layouts?.[show?.settings?.activeLayout] || Object.values(show?.layouts || {})[0]
    const slidesDoLayout: any[] = Array.isArray((layout as any)?.slides) ? (layout as any).slides.filter((s: any) => s && !s.disabled) : []

    // cada slide do layout (o pai dá o grupo) com as linhas dele e dos filhos
    const grupos: { slide: any; linhas: string[] }[] = []
    for (const ref of slidesDoLayout) {
        const slide = show?.slides?.[ref.id]
        if (!slide) continue
        const filhos: string[] = Array.isArray(slide?.children) ? slide.children : []
        const linhas = [...linhasDoSlide(slide), ...filhos.flatMap((f) => linhasDoSlide(show?.slides?.[f]))]
        if (linhas.length) grupos.push({ slide, linhas })
    }

    const refrao = grupos.find((g) => tipoDoGrupo(g.slide) === "refrao")
    const verso = grupos.find((g) => tipoDoGrupo(g.slide) === "verso") || grupos.find((g) => g !== refrao)
    const trecho: PedacoDoTrecho[] = []
    if (verso) trecho.push({ grupo: nomeDoGrupo(verso.slide, "Verso"), linhas: verso.linhas.slice(0, 2) })
    if (refrao) trecho.push({ grupo: nomeDoGrupo(refrao.slide, "Refrão"), linhas: refrao.linhas.slice(0, 1) })

    return {
        primeira_linha: grupos[0]?.linhas[0] || null,
        artista: textoCurto(meta.artist || meta.author, 80),
        ccli: textoCurto(meta.CCLI, 20),
        trecho: trecho.length ? trecho : null
    }
}
