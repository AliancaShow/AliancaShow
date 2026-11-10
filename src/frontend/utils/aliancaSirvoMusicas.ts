import type { ProjectShowRef } from "../../types/Projects"

// ----- AliançaShow · as músicas que o Sirvo escolheu para cada bloco (F3) -----
//
// Desenho: desenho-f3-musicas.md §4.3–§4.4 e as decisões do André de 10/nov.
// Só conta, sem store (quem chama é a reconciliação, aliancaSirvoProjeto.ts).
//
// Marca: todo item que o Sirvo pôs leva `data.sirvoMusica = <id da linha no
// Sirvo>` (rundown_musicas.id). O Show só cria, move e apaga item COM a marca;
// o que o operador pôs (e o que veio do Remote, que entra sem marca em "Fora do
// roteiro") nunca é tocado.
//
// Cada música vira:
//   - o show, `{id: showId, type: "show", data: {sirvoMusica}}`, se ele existe
//     neste computador e não é rascunho;
//   - senão um AVISO cinza, uma seção com id `smf_<linha>` — fora do prefixo
//     `sirvo_` (B2), então `papelDoItem` devolve null: o aviso é conteúdo da
//     família, não abre família, não vira lápide nem entra na trava
//     `muitos_sumiram`, e não fica trancado.

export const PREFIXO_AVISO_MUSICA = "smf_"
export const PREFIXO_RASCUNHO = "sn_"
export const CATEGORIA_NOVAS = "sirvo_novas"
export const NOME_CATEGORIA_NOVAS = "Novas do Sirvo"
export const COR_AVISO_MUSICA = "#808080"

/** uma música do bloco como o `show_roteiro` manda (migration 0086 do Sirvo) */
export type MusicaDoSirvo = { id: string; show_id: string | null; nome: string; ordem: number; letra?: string | null; na_biblioteca?: boolean }

/** o que a conta precisa saber do computador */
export type ContextoMusicas = {
    /** o show existe na biblioteca deste PC */
    existe: (showId: string) => boolean
    /** o show é rascunho (ainda na categoria "Novas do Sirvo"): nunca vai sozinho para o projeto */
    rascunho: (showId: string) => boolean
    /** "é esta?": linha do Sirvo → show que o operador ligou */
    ligacoes: { [rmId: string]: string }
}

/** o id do rascunho que o Show cria para a música nova de uma linha: fixo, para dois passes não criarem dois */
export const idDoRascunho = (rmId: string) => `${PREFIXO_RASCUNHO}${String(rmId).replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 80)
export const idDoAviso = (rmId: string) => `${PREFIXO_AVISO_MUSICA}${rmId}`

const marcaDe = (item: ProjectShowRef | null | undefined): string | null => {
    const m = item?.data?.sirvoMusica
    return typeof m === "string" && m ? m : null
}
export const ehMusicaDoSirvo = (item: ProjectShowRef | null | undefined) => !!marcaDe(item)

const texto = (t: string | null | undefined, max = 120) => (t || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max)

/** qual show esta linha é, neste computador (null = não há show) */
export function showDaMusica(m: MusicaDoSirvo, ctx: ContextoMusicas): string | null {
    if (m.show_id) return m.show_id
    const ligado = ctx.ligacoes[m.id]
    if (ligado) return ligado
    const rascunho = idDoRascunho(m.id)
    return ctx.existe(rascunho) ? rascunho : null
}

export type Desejado = { rmId: string; tipo: "show"; showId: string } | { rmId: string; tipo: "aviso"; nome: string }

export function desejadoDe(m: MusicaDoSirvo, ctx: ContextoMusicas): Desejado {
    const showId = showDaMusica(m, ctx)
    const nome = texto(m.nome) || "música"
    if (showId && ctx.existe(showId) && !ctx.rascunho(showId)) return { rmId: m.id, tipo: "show", showId }
    if (showId && ctx.existe(showId)) return { rmId: m.id, tipo: "aviso", nome: `✎ Rascunho: ${nome} — revise em ${NOME_CATEGORIA_NOVAS}` }
    if (m.show_id) return { rmId: m.id, tipo: "aviso", nome: `⚠ Falta no PC: ${nome}` }
    return { rmId: m.id, tipo: "aviso", nome: `⚠ Falta criar: ${nome}` }
}

export function itemDe(d: Desejado): ProjectShowRef {
    if (d.tipo === "show") return { id: d.showId, type: "show", data: { sirvoMusica: d.rmId } }
    return { id: idDoAviso(d.rmId), type: "section", name: d.nome, color: COR_AVISO_MUSICA, data: { sirvoMusica: d.rmId, sirvoFalta: true } }
}

/** o item já é o que se quer (mesmo tipo e mesmo show)? O nome do aviso ajusta no próprio objeto */
function bate(item: ProjectShowRef, d: Desejado) {
    if (d.tipo === "show") return item.type === "show" && item.id === d.showId
    return item.type === "section" && item.id === idDoAviso(d.rmId)
}

/** as músicas do bloco, sem repetir linha e na ordem do Sirvo */
export function musicasDoBloco(musicas: MusicaDoSirvo[] | null | undefined): MusicaDoSirvo[] {
    const vistas = new Set<string>()
    return (Array.isArray(musicas) ? musicas : [])
        .filter((m) => {
            if (!m?.id || vistas.has(m.id)) return false
            vistas.add(m.id)
            return true
        })
        .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))
}

/**
 * Marca duplicada por copiar e colar (C2): a primeira é a oficial; nas outras a
 * marca sai e elas viram item do operador (o aviso ganha id de seção comum).
 * Devolve se mexeu em algum objeto.
 */
export function tirarMarcasRepetidas(itens: ProjectShowRef[], novoId: () => string): boolean {
    const vistas = new Set<string>()
    let mudou = false
    for (const item of itens) {
        const marca = marcaDe(item)
        if (!marca) continue
        if (!vistas.has(marca)) {
            vistas.add(marca)
            continue
        }
        const { sirvoMusica: _m, sirvoFalta: _f, ...resto } = item.data
        item.data = resto
        if (item.type === "section" && item.id.startsWith(PREFIXO_AVISO_MUSICA)) item.id = novoId()
        mudou = true
    }
    return mudou
}

export type ResultadoFamilia = { itens: ProjectShowRef[]; mudouCampos: boolean }

/**
 * Põe as músicas do bloco na família (cabeçalho + o que vem embaixo):
 * - Saiu: sai só item COM a marca; se estiver em uso (ponteiro), fica.
 * - Tipo mudou (aviso ↔ show): troca o objeto no mesmo lugar (em uso, espera).
 * - Ordem: as marcadas trocam entre si nas posições que já ocupam.
 * - Entrou: depois da última marcada; sem nenhuma, logo depois do cabeçalho.
 * - Item do operador nunca se move.
 * Devolve a MESMA lista quando nada muda de lugar.
 */
export function musicasNaFamilia(itens: ProjectShowRef[], musicas: MusicaDoSirvo[] | null | undefined, ctx: ContextoMusicas, emUso: (item: ProjectShowRef) => boolean = () => false): ResultadoFamilia {
    const desejados = musicasDoBloco(musicas).map((m) => desejadoDe(m, ctx))
    const querido = new Map(desejados.map((d) => [d.rmId, d]))
    let mudouCampos = false

    // o que fica: marcadas que o Sirvo ainda quer (ou em uso)
    const lista: ProjectShowRef[] = []
    const fica = new Set<ProjectShowRef>()
    for (const item of itens) {
        const marca = marcaDe(item)
        if (marca && !querido.has(marca) && !emUso(item)) continue // saiu
        lista.push(item)
        if (marca && querido.has(marca)) fica.add(item)
    }

    // a posição de cada marcada que fica, na ordem da lista
    const slots = lista.map((item, i) => (fica.has(item) ? i : -1)).filter((i) => i >= 0)
    const porMarca = new Map<string, ProjectShowRef>()
    for (const i of slots) porMarca.set(marcaDe(lista[i])!, lista[i])

    // o objeto certo para cada música (reaproveita o que bate; troca o que mudou de tipo)
    const objetos = desejados.map((d) => {
        const atual = porMarca.get(d.rmId)
        if (atual && bate(atual, d)) {
            if (d.tipo === "aviso" && atual.name !== d.nome) {
                atual.name = d.nome
                mudouCampos = true
            }
            return atual
        }
        if (atual && emUso(atual)) return atual // em uso: troca depois
        return itemDe(d)
    })

    // ordem: os primeiros ocupam as posições que já eram de música; o resto entra depois da última
    const nova = [...lista]
    slots.forEach((pos, k) => (nova[pos] = objetos[k]))
    const resto = objetos.slice(slots.length)
    if (resto.length) {
        const depoisDe = slots.length ? slots[slots.length - 1] : 0
        nova.splice(depoisDe + 1, 0, ...resto)
    }

    const mesma = nova.length === itens.length && nova.every((x, i) => x === itens[i])
    return { itens: mesma ? itens : nova, mudouCampos }
}

/** a sequência de marcas da família difere da lista do Sirvo? (para a faixa dizer "músicas do X mudaram") */
export function musicasDiferem(itens: ProjectShowRef[], musicas: MusicaDoSirvo[] | null | undefined): boolean {
    const atuais = itens.map(marcaDe).filter((m): m is string => !!m)
    const querem = musicasDoBloco(musicas).map((m) => m.id)
    return atuais.join("\n") !== querem.join("\n")
}

// ---------------------------------------------------------------- música nova: o rascunho

/** minúsculo, sem acento, sem pontuação — a mesma regra do `private.normaliza_titulo` do Sirvo */
export function normalizarTitulo(t: string | null | undefined): string {
    return (t || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

// "Refrão:" só vira grupo com nome de grupo conhecido: "Senhor: tu és" é letra
const GRUPO_COM_DOIS_PONTOS = /^((?:verso|refr[aã]o|coro|ponte|pr[eé][- ]?refr[aã]o|intro(?:du[cç][aã]o)?|final|tag|interl[uú]dio|chorus|verse|bridge|pre[- ]?chorus)(?:\s*\d+)?)\s*:\s*(.*)$/i

/**
 * A letra colada no Sirvo em slides: linha em branco separa slides; `[Refrão]`
 * ou `Refrão:` no começo de um bloco dá o nome do grupo. A MESMA regra do Sirvo
 * (src/lib/musicas.ts, `slidesDaLetra`).
 */
export function slidesDaLetra(letra: string | null | undefined): { grupo: string | null; linhas: string[] }[] {
    if (!letra) return []
    return String(letra)
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .map((bloco) => {
            const linhas = bloco
                .split("\n")
                .map((l) => texto(l, 300).trim())
                .filter(Boolean)
            let grupo: string | null = null
            if (linhas.length) {
                const m = /^\[([^\]]{1,30})\]\s*(.*)$/.exec(linhas[0]) ?? GRUPO_COM_DOIS_PONTOS.exec(linhas[0])
                if (m) {
                    grupo = m[1].trim()
                    if (m[2].trim()) linhas[0] = m[2].trim()
                    else linhas.shift()
                }
            }
            return { grupo, linhas }
        })
        .filter((s) => s.linhas.length > 0)
        .flatMap(quebrarEstrofe)
        .slice(0, 100)
}

/**
 * Estrofe longa vira slides de LINHAS_POR_SLIDE linhas (o LED da Aliança cabe 2).
 * Estrofe curta (até MAX_LINHAS_ESTROFE) que quem colou separou com linha em
 * branco fica como está. O nome do grupo vai só no primeiro pedaço.
 * A MESMA regra do Sirvo (src/lib/musicas.ts).
 */
export const LINHAS_POR_SLIDE = 2
export const MAX_LINHAS_ESTROFE = 4
function quebrarEstrofe(s: { grupo: string | null; linhas: string[] }): { grupo: string | null; linhas: string[] }[] {
    if (s.linhas.length <= MAX_LINHAS_ESTROFE) return [s]
    const out: { grupo: string | null; linhas: string[] }[] = []
    for (let i = 0; i < s.linhas.length; i += LINHAS_POR_SLIDE) out.push({ grupo: i === 0 ? s.grupo : null, linhas: s.linhas.slice(i, i + LINHAS_POR_SLIDE) })
    return out
}

/** grupo da letra → grupo global do FreeShow (cor e atalho do grupo); null fica só com o nome */
export function grupoGlobal(grupo: string | null): string | undefined {
    const g = normalizarTitulo(grupo).replace(/\s*\d+$/, "")
    if (/^(verso|verse)$/.test(g)) return "verse"
    if (/^(refrao|coro|chorus)$/.test(g)) return "chorus"
    if (/^(pre refrao|prerefrao|pre chorus|prechorus)$/.test(g)) return "pre_chorus"
    if (/^(ponte|bridge)$/.test(g)) return "bridge"
    if (/^(intro|introducao)$/.test(g)) return "intro"
    if (/^(final|outro)$/.test(g)) return "outro"
    if (/^tag$/.test(g)) return "tag"
    return undefined
}

/**
 * O rascunho de uma música nova a partir da letra (o objeto do show, puro).
 * Categoria "Novas do Sirvo": enquanto estiver lá é rascunho, e no projeto
 * aparece só o aviso — nunca vai direto para a saída. O operador revisa e muda
 * a categoria; aí o aviso vira a música no mesmo lugar.
 */
export function rascunhoDaLetra(nome: string, letra: string | null | undefined, criado: number, estilo: string) {
    const slidesDaMusica = slidesDaLetra(letra)
    const slides: { [id: string]: any } = {}
    const ordem: { id: string }[] = []
    slidesDaMusica.forEach((s, i) => {
        const id = `s${i + 1}`
        slides[id] = {
            group: s.grupo || (i === 0 ? "Verso" : ""),
            color: null,
            globalGroup: grupoGlobal(s.grupo || (i === 0 ? "Verso" : null)),
            settings: {},
            notes: "",
            items: [{ style: estilo, align: "", lines: s.linhas.map((l) => ({ align: "", text: [{ value: l, style: "" }] })) }]
        }
        ordem.push({ id })
    })
    return {
        name: texto(nome) || "Música nova",
        category: CATEGORIA_NOVAS,
        settings: { activeLayout: "default", template: "default" },
        timestamps: { created: criado, modified: null, used: null },
        quickAccess: {},
        meta: {},
        slides,
        layouts: { default: { name: texto(nome) || "Música nova", notes: "Rascunho criado a partir da letra colada no Sirvo. Revise e mude de categoria.", slides: ordem } },
        media: {}
    }
}

// ---------------------------------------------------------------- "é esta?"

export type PerguntaEEsta = { rmId: string; nome: string; showId: string; showNome: string }

/**
 * Música nova do Sirvo ainda sem show (ou só com o rascunho) e uma música da
 * biblioteca com o MESMO nome normalizado, que não é rascunho: o Show pergunta
 * "é esta?". Uma pergunta por linha; só a primeira candidata.
 */
export function perguntasEEsta(musicas: MusicaDoSirvo[], shows: { [id: string]: { name?: string; category?: string | null; private?: boolean } | undefined }, categoriasMusica: Set<string>, ligacoes: { [rmId: string]: string }, dispensadas: Set<string> = new Set()): PerguntaEEsta[] {
    const porNome = new Map<string, string>()
    for (const [id, s] of Object.entries(shows || {})) {
        if (!s?.name || s.private || s.category === CATEGORIA_NOVAS || !categoriasMusica.has(s.category || "")) continue
        const chave = normalizarTitulo(s.name)
        if (chave && !porNome.has(chave)) porNome.set(chave, id)
    }
    const perguntas: PerguntaEEsta[] = []
    for (const m of musicas) {
        if (m.show_id || ligacoes[m.id] || dispensadas.has(m.id)) continue
        const showId = porNome.get(normalizarTitulo(m.nome))
        if (!showId) continue
        perguntas.push({ rmId: m.id, nome: m.nome, showId, showNome: shows[showId]?.name || "" })
    }
    return perguntas
}
