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
// Onde o operador põe um item marcado, ele FICA (decisão de 10/nov): um item
// marcado em qualquer lugar do projeto satisfaz a linha dele no Sirvo, não
// volta para a família e não ganha cópia. A ordem do Sirvo só vale entre as
// marcadas que estão DENTRO da família do bloco. Se a linha sair do Sirvo, o
// item marcado sai de onde estiver, se não estiver em uso. Nada fica trancado.
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

/** a linha do Sirvo que o item representa (`data.sirvoMusica`); null para item do operador */
export const marcaDe = (item: ProjectShowRef | null | undefined): string | null => {
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

/** a marca sai e o item vira do operador (o aviso ganha id de seção comum) */
export function tirarMarca(item: ProjectShowRef, novoId: () => string) {
    const { sirvoMusica: _m, sirvoFalta: _f, ...resto } = item.data
    item.data = resto
    if (item.type === "section" && item.id.startsWith(PREFIXO_AVISO_MUSICA)) item.id = novoId()
}

/**
 * Marca duplicada por copiar e colar (C2): uma só é a oficial; nas outras a
 * marca sai e elas viram item do operador, onde estão. `oficialDe` escolhe a
 * oficial entre as repetidas (a reconciliação prefere a que está na família do
 * bloco que lista a linha); sem ele, ou sem resposta, a primeira da lista.
 * Devolve se mexeu em algum objeto.
 */
export function tirarMarcasRepetidas(itens: ProjectShowRef[], novoId: () => string, oficialDe: (marca: string, repetidos: ProjectShowRef[]) => ProjectShowRef | undefined = () => undefined): boolean {
    const porMarca = new Map<string, ProjectShowRef[]>()
    for (const item of itens) {
        const marca = marcaDe(item)
        if (!marca) continue
        porMarca.set(marca, [...(porMarca.get(marca) || []), item])
    }
    let mudou = false
    for (const [marca, repetidos] of porMarca) {
        if (repetidos.length < 2) continue
        const oficial = oficialDe(marca, repetidos) || repetidos[0]
        for (const item of repetidos) {
            if (item === oficial) continue
            tirarMarca(item, novoId)
            mudou = true
        }
    }
    return mudou
}

/**
 * O item marcado vira o que a linha pede, NO LUGAR: o nome do aviso ajusta no
 * próprio objeto; tipo mudado (aviso ↔ show) troca o objeto, salvo em uso
 * (ponteiro), que espera. Devolve o objeto que fica na posição.
 */
export function ajustarMarcado(item: ProjectShowRef, d: Desejado, emUso: (item: ProjectShowRef) => boolean): { item: ProjectShowRef; mudouCampos: boolean } {
    if (bate(item, d)) {
        if (d.tipo === "aviso" && item.name !== d.nome) {
            item.name = d.nome
            return { item, mudouCampos: true }
        }
        return { item, mudouCampos: false }
    }
    if (emUso(item)) return { item, mudouCampos: false }
    return { item: itemDe(d), mudouCampos: false }
}

export type ResultadoFamilia = { itens: ProjectShowRef[]; mudouCampos: boolean }

export type OpcoesFamilia = {
    /** o item está em uso (ponteiro): não sai nem troca */
    emUso?: (item: ProjectShowRef) => boolean
    /** a linha ainda existe em ALGUM bloco do roteiro (padrão: só as deste bloco) */
    linhaViva?: (rmId: string) => boolean
    /** linhas deste bloco já satisfeitas por um item marcado FORA desta família: não entram aqui */
    foraDaFamilia?: Set<string>
    /** linhas que o operador TIROU do projeto (aliancaSirvoDispensas.ts): não entram, e o item delas, se voltar, fica onde está */
    dispensadas?: Set<string>
}

/**
 * Põe as músicas do bloco na família (cabeçalho + o que vem embaixo):
 * - Saiu do Sirvo: sai só item COM a marca; se estiver em uso (ponteiro), fica.
 *   Marcada de OUTRO bloco (o operador trouxe para cá) fica, como item dele.
 * - Tipo mudou (aviso ↔ show): troca o objeto no mesmo lugar (em uso, espera).
 * - Ordem: as marcadas deste bloco trocam entre si nas posições que já ocupam.
 * - Entrou: depois da última marcada; sem nenhuma, logo depois do cabeçalho.
 *   Linha já satisfeita por um item marcado fora da família não entra.
 * - Item do operador nunca se move.
 * Devolve a MESMA lista quando nada muda de lugar.
 */
export function musicasNaFamilia(itens: ProjectShowRef[], musicas: MusicaDoSirvo[] | null | undefined, ctx: ContextoMusicas, opcoes: OpcoesFamilia = {}): ResultadoFamilia {
    const emUso = opcoes.emUso || (() => false)
    const dispensadas = opcoes.dispensadas || new Set<string>()
    const fora = new Set([...(opcoes.foraDaFamilia || []), ...dispensadas])
    const desejados = musicasDoBloco(musicas)
        .map((m) => desejadoDe(m, ctx))
        .filter((d) => !fora.has(d.rmId))
    const querido = new Map(desejados.map((d) => [d.rmId, d]))
    const linhaViva = opcoes.linhaViva || ((rmId: string) => querido.has(rmId))
    let mudouCampos = false

    // o que fica: marcadas que o Sirvo ainda quer em algum bloco (ou em uso);
    // a dispensada que voltou (Ctrl+Z) fica onde está, como item do operador
    const lista: ProjectShowRef[] = []
    const fica = new Set<ProjectShowRef>()
    for (const item of itens) {
        const marca = marcaDe(item)
        if (marca && !linhaViva(marca) && !emUso(item) && !dispensadas.has(marca)) continue // saiu do Sirvo
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
        if (!atual) return itemDe(d)
        const r = ajustarMarcado(atual, d, emUso)
        if (r.mudouCampos) mudouCampos = true
        return r.item
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

/**
 * A sequência de marcas da família difere da lista do Sirvo? (para a faixa
 * dizer "músicas do X mudaram"). O que o operador levou para fora da família
 * (`foraDaFamilia`), o que ele trouxe de outro bloco (`deOutroBloco`) e o que
 * ele tirou do projeto (`dispensadas`) não contam: ficam onde estão.
 */
export function musicasDiferem(itens: ProjectShowRef[], musicas: MusicaDoSirvo[] | null | undefined, opcoes: { foraDaFamilia?: Set<string>; deOutroBloco?: (rmId: string) => boolean; dispensadas?: Set<string> } = {}): boolean {
    const dispensadas = opcoes.dispensadas || new Set<string>()
    const fora = new Set([...(opcoes.foraDaFamilia || []), ...dispensadas])
    const deOutro = opcoes.deOutroBloco || (() => false)
    const atuais = itens.map(marcaDe).filter((m): m is string => !!m && !deOutro(m) && !dispensadas.has(m))
    const querem = musicasDoBloco(musicas)
        .map((m) => m.id)
        .filter((id) => !fora.has(id))
    return atuais.join("\n") !== querem.join("\n")
}

/** linha do Sirvo → bloco que a lista (e a própria linha), para a conta do projeto */
export function linhasDoRoteiro(blocos: { id: string; musicas?: MusicaDoSirvo[] | null }[]): Map<string, { blocoId: string; musica: MusicaDoSirvo }> {
    const linhas = new Map<string, { blocoId: string; musica: MusicaDoSirvo }>()
    for (const b of blocos) for (const m of musicasDoBloco(b.musicas)) if (!linhas.has(m.id)) linhas.set(m.id, { blocoId: b.id, musica: m })
    return linhas
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

const TAG_COLCHETE = /^\[([^\]]{1,30})\]\s*(.*)$/
/** "[Refrão]" ou "Refrão:" (só com nome de grupo conhecido): [nome, resto da linha] */
const tagDeGrupo = (linha: string) => TAG_COLCHETE.exec(linha) ?? GRUPO_COM_DOIS_PONTOS.exec(linha)

export type SlideDaLetra = { grupo: string | null; linhas: string[] }
/** `continua`: pedaço de uma estrofe partida pela quebra automática (no rascunho vira slide-filho) */
export type SlideDaLetraComContinuacao = SlideDaLetra & { continua: boolean }

/**
 * A letra colada no Sirvo em slides: linha em branco separa slides; `[Refrão]`
 * ou `Refrão:` abre um slide com o nome do grupo — no começo do bloco ou no
 * meio dele (a tag nunca é letra). A MESMA regra do Sirvo (src/lib/musicas.ts,
 * `slidesDaLetra`). A forma de saída é espelhada no Sirvo: não muda.
 */
export function slidesDaLetra(letra: string | null | undefined): SlideDaLetra[] {
    return slidesDaLetraComContinuacao(letra).map(({ grupo, linhas }) => ({ grupo, linhas }))
}

/** o mesmo, dizendo qual slide é continuação da estrofe anterior (para o rascunho) */
export function slidesDaLetraComContinuacao(letra: string | null | undefined): SlideDaLetraComContinuacao[] {
    if (!letra) return []
    const estrofes: SlideDaLetra[] = []
    for (const bloco of String(letra)
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)) {
        let atual: SlideDaLetra | null = null
        for (const bruta of bloco.split("\n")) {
            const linha = texto(bruta, 300).trim()
            if (!linha) continue
            const tag = tagDeGrupo(linha)
            if (tag) {
                atual = { grupo: tag[1].trim(), linhas: [] }
                estrofes.push(atual)
                if (tag[2].trim()) atual.linhas.push(tag[2].trim())
                continue
            }
            if (!atual) {
                atual = { grupo: null, linhas: [] }
                estrofes.push(atual)
            }
            atual.linhas.push(linha)
        }
    }
    return estrofes
        .filter((s) => s.linhas.length > 0)
        .flatMap(quebrarEstrofe)
        .slice(0, 100)
}

/**
 * Estrofe longa vira slides de LINHAS_POR_SLIDE linhas (o LED da Aliança cabe 2).
 * Estrofe curta (até MAX_LINHAS_ESTROFE) que quem colou separou com linha em
 * branco fica como está. O nome do grupo vai só no primeiro pedaço; os outros
 * são continuação.
 * A MESMA regra do Sirvo (src/lib/musicas.ts).
 */
export const LINHAS_POR_SLIDE = 2
export const MAX_LINHAS_ESTROFE = 4
function quebrarEstrofe(s: SlideDaLetra): SlideDaLetraComContinuacao[] {
    if (s.linhas.length <= MAX_LINHAS_ESTROFE) return [{ ...s, continua: false }]
    const out: SlideDaLetraComContinuacao[] = []
    for (let i = 0; i < s.linhas.length; i += LINHAS_POR_SLIDE) out.push({ grupo: i === 0 ? s.grupo : null, linhas: s.linhas.slice(i, i + LINHAS_POR_SLIDE), continua: i > 0 })
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
 *
 * Estrofe partida pela quebra automática vira UM grupo, como o FreeShow faz:
 * o primeiro pedaço é o slide-pai (no layout) e os outros são filhos dele
 * (`children`, grupo nulo, fora do layout).
 */
export function rascunhoDaLetra(nome: string, letra: string | null | undefined, criado: number, estilo: string) {
    const slidesDaMusica = slidesDaLetraComContinuacao(letra)
    const slides: { [id: string]: any } = {}
    const ordem: { id: string }[] = []
    let pai: string | null = null
    slidesDaMusica.forEach((s, i) => {
        const id = `s${i + 1}`
        const items = [{ style: estilo, align: "", lines: s.linhas.map((l) => ({ align: "", text: [{ value: l, style: "" }] })) }]
        if (s.continua && pai) {
            slides[id] = { group: null, color: null, settings: {}, notes: "", items }
            slides[pai].children = [...(slides[pai].children || []), id]
            return
        }
        slides[id] = {
            group: s.grupo || (i === 0 ? "Verso" : ""),
            color: null,
            globalGroup: grupoGlobal(s.grupo || (i === 0 ? "Verso" : null)),
            settings: {},
            notes: "",
            items
        }
        ordem.push({ id })
        pai = id
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

/** hash curto da letra (cyrb53, em hex): a memória de "já criei o rascunho desta letra" */
export function hashDaLetra(letra: string | null | undefined): string {
    const t = String(letra || "")
    let h1 = 0xdeadbeef
    let h2 = 0x41c6ce57
    for (let i = 0; i < t.length; i++) {
        const c = t.charCodeAt(i)
        h1 = Math.imul(h1 ^ c, 2654435761)
        h2 = Math.imul(h2 ^ c, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return `l53_${t.length}_${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}`
}

export type EstadoDoRascunho = {
    /** o show `sn_<linha>` existe na biblioteca deste PC */
    existe: boolean
    /** ainda está na categoria "Novas do Sirvo" */
    aindaRascunho: boolean
    /** o operador mexeu nele (timestamps.modified existe e difere do created) */
    mexido: boolean
}

/**
 * O que fazer com o rascunho de uma música nova (com letra, sem show), dada a
 * memória do hash da letra com que ele foi criado (`hashGuardado`):
 * - não existe: criar — salvo se já foi criado para ESTA letra (o operador
 *   apagou; não ressuscita). A letra mudou no Sirvo: nasce de novo.
 * - existe, ainda em "Novas do Sirvo", sem mexer, e a letra mudou: reescrever.
 * - existe e a memória não tem o hash (criado por um Show antigo), ou o
 *   operador já mexeu / aprovou: adotar — guardar o hash e não tocar.
 */
export function acaoDoRascunho(estado: EstadoDoRascunho, hashGuardado: string | undefined, hashAtual: string): "criar" | "reescrever" | "adotar" | "nada" {
    if (!estado.existe) return hashGuardado === hashAtual ? "nada" : "criar"
    if (hashGuardado === hashAtual) return "nada"
    if (hashGuardado !== undefined && estado.aindaRascunho && !estado.mexido) return "reescrever"
    return "adotar"
}

// ---------------------------------------------------------------- "é esta?"

/**
 * As ligações "é esta?" que ainda valem: a que aponta para um show que não
 * existe mais (apagado) é ignorada, e a linha volta a rascunho / pergunta.
 */
export function ligacoesVivas(ligacoes: { [rmId: string]: string } | null | undefined, existe: (showId: string) => boolean): { [rmId: string]: string } {
    const vivas: { [rmId: string]: string } = {}
    for (const [rmId, showId] of Object.entries(ligacoes || {})) if (rmId && typeof showId === "string" && showId && existe(showId)) vivas[rmId] = showId
    return vivas
}

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
