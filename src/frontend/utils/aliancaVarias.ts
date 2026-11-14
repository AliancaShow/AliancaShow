import { get, writable } from "svelte/store"
import { uid } from "uid"
import type { ProjectShowRef } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { convertText } from "../converters/txt"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { loadShows } from "../components/helpers/setShow"
import { activeProject, activeShow, categories, drawerTabsData, editingProjectTemplate, projects, shows, showsCache } from "../stores"
import { newToast } from "./common"
import { translateText } from "./language"
import { moverPonteirosAoInserir } from "./aliancaTirados"
import { PREFIXO_RASCUNHO, CATEGORIA_NOVAS } from "./aliancaSirvoMusicas"
import { posicaoDeEntrada, type MusicaDoCatalogo } from "./aliancaLista"
import { linhasPorSlideDoModo, prepararLetraColada, type AcordeNaLinha, type ModoDeDivisao, type OpcoesDoPreparo } from "./aliancaLetra"
import { categoriasDeMusica } from "./aliancaSemLetraLogica"

// ----- AliançaShow · Preparar, fatia 4: o que os dois popups fazem nos stores -----
//
// A conta mora em aliancaLista.ts / aliancaLetra.ts. Aqui: o catálogo, criar músicas vazias, pôr no culto,
// preencher uma música "sem letra" com letra colada e o rascunho (o texto colado sobrevive ao fechar o popup).

// ---------------------------------------------------------------- rascunhos

export type RascunhoDaLetra = { texto: string; nome: string; cantor: string; modo: ModoDeDivisao; n: number; manter: number[] }

/** o texto da lista colada na janela "Adicionar várias" — fechar com Esc/clique fora não perde nada */
export const rascunhoVarias = writable<string>("")
/** por "nova" ou pelo id do show a preencher */
export const rascunhosLetra = writable<{ [chave: string]: RascunhoDaLetra }>({})
/** a última divisão escolhida (volta pré-selecionada) */
export const ultimaDivisao = writable<{ modo: ModoDeDivisao; n: number }>({ modo: "paragrafo", n: 2 })

export function limparRascunhoDaLetra(chave: string) {
    rascunhosLetra.update((a) => {
        const nova = { ...a }
        delete nova[chave]
        return nova
    })
}

// ---------------------------------------------------------------- catálogo e projeto

/** as músicas da biblioteca que podem casar com a lista: música (ícone `song`), não privada, fora das "Novas do Sirvo" */
// os parâmetros só existem pra o componente depender dos stores (`catalogoDaBiblioteca($shows, $categories)` refaz a conta quando mudam)
export function catalogoDaBiblioteca(_shows?: unknown, _categories?: unknown): MusicaDoCatalogo[] {
    const musicas = categoriasDeMusica(get(categories))
    return Object.entries(get(shows))
        .filter(([id, s]) => s?.name && !s.private && s.category !== CATEGORIA_NOVAS && !id.startsWith(PREFIXO_RASCUNHO) && musicas.has(s.category || ""))
        .map(([id, s]) => ({ id, nome: s.name, categoria: nomeDaCategoria(get(categories)[s.category || ""]?.name), usadoEm: (s.timestamps as any)?.used ?? null }))
}

/** as categorias de fábrica vêm como chave de tradução ("category.song") */
export function nomeDaCategoria(nome: string | undefined): string {
    if (!nome) return ""
    return nome.startsWith("category.") ? translateText(nome) : nome
}

/** o projeto aberto aceita item novo? (não é modelo; devolve null se não) */
export function projetoAberto(_projects?: unknown, _ativo?: unknown, _template?: unknown): { id: string; shows: ProjectShowRef[] } | null {
    if (get(editingProjectTemplate)) return null
    const id = get(activeProject)
    const p = id ? get(projects)[id] : null
    return id && p ? { id, shows: p.shows || [] } : null
}

/** a categoria das músicas novas: a da gaveta (se for de música), senão "song", senão a primeira de música */
export function categoriaDeMusicaNova(): string | null {
    const todas = get(categories)
    const musicas = categoriasDeMusica(todas)
    const ativa = get(drawerTabsData).shows?.activeSubTab
    if (ativa && musicas.has(ativa)) return ativa
    if (musicas.has("song")) return "song"
    const primeira = [...musicas].find((id) => id !== CATEGORIA_NOVAS)
    return primeira || null
}

// ---------------------------------------------------------------- criar músicas vazias (e pôr no culto)

export type ItemConfirmado = { nome: string; cantor: string } & ({ showId: string } | { showId?: undefined })

/** um show vazio, só com o nome (e o cantor), na categoria de música — como `CreateShow` faz, mas sem slides */
export function showVazio(nome: string, cantor: string): Show {
    const show = new ShowObj(false, categoriaDeMusicaNova()) as unknown as Show
    show.name = checkName(nome)
    show.meta = { title: nome, ...(cantor ? { artist: cantor } : {}) }
    return show
}

/**
 * Confirma a lista: cria os vazios (uma entrada `SHOWS` do histórico, SEM `replace`: o Ctrl+Z apaga de verdade)
 * e põe tudo no culto (outra entrada, de projeto). Não abre nenhum show. Devolve o resumo.
 */
export function confirmarVarias(itens: ItemConfirmado[], onde: "fim" | "depois"): { colocadas: number; criadas: number; foraDoCulto: boolean } {
    const projeto = projetoAberto()
    const projetoDoUsuario = projeto && !!get(projects)[projeto.id]
    const aCriar: { id: string; show: Show }[] = []
    const ids: string[] = []
    for (const it of itens) {
        if (it.showId) {
            ids.push(it.showId)
            continue
        }
        const id = uid()
        aCriar.push({ id, show: showVazio(it.nome, it.cantor) })
        ids.push(id)
    }
    if (aCriar.length) history({ id: "SHOWS", newData: { data: aCriar, semLimpar: true }, location: { page: "show" } })

    if (!projeto || !projetoDoUsuario) {
        newToast(`${aCriar.length} ${aCriar.length === 1 ? "música criada" : "músicas criadas"} na biblioteca`)
        return { colocadas: 0, criadas: aCriar.length, foraDoCulto: true }
    }

    const pos = posicaoDeEntrada(projeto.shows.length, onde, get(activeShow)?.index)
    const novos: ProjectShowRef[] = ids.map((id) => ({ id, type: "show" }) as ProjectShowRef)
    const lista = [...projeto.shows.slice(0, pos), ...novos, ...projeto.shows.slice(pos)]

    // o que está no ar e o item aberto apontam por POSIÇÃO: quem vem depois da inserção anda junto (F3)
    moverPonteirosAoInserir(projeto.id, pos, novos.length)
    const aberto = get(activeShow)
    if (aberto && typeof aberto.index === "number" && aberto.index >= pos) activeShow.set({ ...aberto, index: aberto.index + novos.length })

    history({ id: "UPDATE", newData: { key: "shows", data: lista }, oldData: { id: projeto.id }, location: { page: "show", id: "project_key" } })
    newToast(`${novos.length} ${novos.length === 1 ? "música entrou" : "músicas entraram"}${aCriar.length ? ` · ${aCriar.length} sem letra, esperando` : ""}`)
    return { colocadas: novos.length, criadas: aCriar.length, foraDoCulto: false }
}

// ---------------------------------------------------------------- colar letra

export type PreviaDaLetra = {
    slides: { grupo: string; texto: string }[]
    acordesReconhecidos: number
    absorvidas: { indice: number; texto: string }[]
    descartadas: { indice: number; texto: string }[]
    /** o show montado (o que será gravado) */
    show: Show | null
}

/** o grupo vem como chave interna ("verse", "chorus"): mostra o nome traduzido */
const nomeDoGrupo = (g: string | null | undefined): string => {
    if (!g) return ""
    const t = translateText("groups." + g)
    return t && !t.startsWith("groups.") ? t : g
}

const textoDoSlide = (slide: any): string =>
    (slide?.items || [])
        .flatMap((i: any) => i?.lines || [])
        .map((l: any) => (l?.text || []).map((t: any) => t?.value || "").join(""))
        .join("\n")

/** pendura os acordes (por texto da linha) nos slides recém-convertidos */
export function pendurarAcordes(slides: { [id: string]: any }, acordes: Map<string, AcordeNaLinha[]>): number {
    let n = 0
    const jaFoi = new Set<string>()
    for (const slide of Object.values(slides || {})) {
        for (const item of slide?.items || []) {
            for (const linha of item?.lines || []) {
                const texto = (linha?.text || [])
                    .map((t: any) => t?.value || "")
                    .join("")
                    .trim()
                const lista = acordes.get(texto)
                if (!lista || !lista.length) continue
                linha.chords = lista.map((c) => ({ id: uid(5), pos: Math.min(c.pos, texto.length), key: c.key }))
                if (!jaFoi.has(texto)) n += lista.length
                jaFoi.add(texto)
            }
        }
    }
    return n
}

/** converte a letra colada em show (sem gravar) e monta a prévia */
export function montarLetra(bruto: string, modo: ModoDeDivisao, n: number, opcoes: OpcoesDoPreparo & { nome?: string; category?: string | null } = {}): PreviaDaLetra {
    const preparada = prepararLetraColada(bruto, opcoes)
    if (!preparada.texto.trim()) return { slides: [], acordesReconhecidos: 0, absorvidas: preparada.absorvidas, descartadas: preparada.descartadas, show: null }
    const { show } = convertText({ name: opcoes.nome || "x", category: opcoes.category ?? null, text: preparada.texto, noFormatting: true, returnData: true, linhasPorSlide: linhasPorSlideDoModo(modo, n), semAcordesEmCima: true }) as { id: string; show: Show }
    const acordes = pendurarAcordes(show.slides as any, preparada.acordes)
    const layout = (show.layouts as any)[(show.settings as any).activeLayout]?.slides || []
    const slides: { grupo: string; texto: string }[] = []
    for (const ref of layout) {
        const s: any = (show.slides as any)[ref.id]
        if (!s) continue
        slides.push({ grupo: nomeDoGrupo(s.group), texto: textoDoSlide(s) })
        // a estrofe partida (A cada N linhas, Cada linha) vira slide-filho: conta como slide
        for (const c of s.children || []) slides.push({ grupo: "", texto: textoDoSlide((show.slides as any)[c]) })
    }
    return { slides, acordesReconhecidos: acordes, absorvidas: preparada.absorvidas, descartadas: preparada.descartadas, show }
}

/**
 * Preenche a música "sem letra": troca os slides e o layout ativo, mantém nome, cantor, categoria, datas e configurações.
 * Uma entrada `SHOWS` com `replace` (o desfazer repõe o show antigo inteiro, sem fechar o show aberto).
 */
export async function preencherLetra(showId: string, previa: PreviaDaLetra): Promise<boolean> {
    if (!previa.show) return false
    await loadShows([showId])
    const velho: any = get(showsCache)[showId]
    if (!velho) return false
    const layoutId: string = velho.settings?.activeLayout || Object.keys(velho.layouts || {})[0]
    const novoLayoutId: string = (previa.show.settings as any).activeLayout
    const layoutNovo = (previa.show.layouts as any)[novoLayoutId]
    const novo: any = clone(velho)
    novo.slides = clone(previa.show.slides)
    novo.layouts = { ...(novo.layouts || {}), [layoutId]: { ...(novo.layouts?.[layoutId] || { name: layoutNovo?.name || "", notes: "" }), slides: clone(layoutNovo?.slides || []) } }
    novo.timestamps = { ...(velho.timestamps || {}), modified: Date.now() }
    history({ id: "SHOWS", newData: { data: [{ id: showId, show: novo }], replace: true, semLimpar: true }, location: { page: "show" } })
    return true
}

/** "Nova música": cria o show com a letra na biblioteca (sem entrar no culto) e abre só na biblioteca */
export function criarMusicaComLetra(nome: string, cantor: string, previa: PreviaDaLetra): string | null {
    if (!previa.show) return null
    const id = uid()
    const show: any = previa.show
    show.name = checkName(nome)
    show.category = categoriaDeMusicaNova()
    show.meta = { title: nome, ...(cantor ? { artist: cantor } : {}) }
    show.timestamps = { ...(show.timestamps || {}), created: Date.now(), modified: Date.now() }
    history({ id: "SHOWS", newData: { data: [{ id, show }], semLimpar: true }, location: { page: "show" } })
    activeShow.set({ id, type: "show" })
    return id
}
