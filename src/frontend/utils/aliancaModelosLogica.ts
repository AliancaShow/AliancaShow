// Modelos dentro do Editar (desenho C, "Sim, Modelos no Editar" 24/nov): a lista da esquerda no modo MODELOS.
// So conta e filtra; quem grava (criar, renomear, mudar categoria) usa o history do FreeShow (Ctrl+Z desfaz). Sem stores aqui.

export const TODOS = "todos"
export const SEM_CATEGORIA = "sem_categoria"

type Modelo = { name?: string; category?: string | null; settings?: { mode?: string } | null; isDefault?: boolean }
type Categoria = { name?: string; isArchive?: boolean; default?: boolean }
type Mapa<T> = { [id: string]: T }

export type ModeloDaLista = { id: string; nome: string; categoria: string }
export type CategoriaDaLista = { id: string; nome: string; total: number; fixa: boolean }

const normal = (s: string) =>
    String(s || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[.,/#!?$%^&*;:{}=\-_`~()]/g, "")
        .trim()

/** modelo de texto puro (settings.mode = "text") nao aparece, como na gaveta do FreeShow */
const visivel = (m: Modelo | null | undefined) => !!m && m.settings?.mode !== "text"

/** a categoria de verdade do modelo: a que existe e nao esta arquivada; senao "sem categoria" */
export function categoriaDe(m: Modelo, categorias: Mapa<Categoria>): string {
    const c = m?.category || ""
    return c && categorias[c] ? c : SEM_CATEGORIA
}

/** nome mostrado de uma categoria: as do FreeShow vem como chave de traducao ("category.scripture") */
export function nomeDaCategoria(c: Categoria | undefined, traduzir: (chave: string) => string = (x) => x): string {
    const n = String(c?.name || "")
    if (!n) return "Sem nome"
    if (n === "category.scripture") return "Bíblia"
    return /^[a-z_]+\.[a-z_]+$/.test(n) ? traduzir(n) || n : n
}

/** Todos, as categorias (as que o usuario criou e as do FreeShow, em ordem alfabetica, sem as arquivadas) e "Sem categoria" (so se houver) */
export function categoriasDaLista(modelos: Mapa<Modelo>, categorias: Mapa<Categoria>, traduzir?: (chave: string) => string): CategoriaDaLista[] {
    const lista = Object.values(modelos || {}).filter(visivel)
    const ativas = Object.entries(categorias || {}).filter(([, c]) => !c?.isArchive)
    const conta = (id: string) => lista.filter((m) => categoriaDe(m, categorias) === id).length
    const arquivadas = new Set(
        Object.entries(categorias || {})
            .filter(([, c]) => c?.isArchive)
            .map(([id]) => id)
    )
    const fora = lista.filter((m) => !arquivadas.has(m.category || "")).length
    const cats = ativas.map(([id, c]) => ({ id, nome: nomeDaCategoria(c, traduzir), total: conta(id), fixa: !!c?.default })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    const sem = conta(SEM_CATEGORIA)
    return [{ id: TODOS, nome: "Todos", total: fora, fixa: true }, ...cats, ...(sem ? [{ id: SEM_CATEGORIA, nome: "Sem categoria", total: sem, fixa: true }] : [])]
}

/** os modelos da categoria escolhida que batem com a busca (nome sem acento), em ordem alfabetica */
export function modelosDaLista(modelos: Mapa<Modelo>, categorias: Mapa<Categoria>, filtro: { categoria: string; busca?: string }): ModeloDaLista[] {
    const busca = normal(filtro.busca || "")
    const arquivadas = new Set(
        Object.entries(categorias || {})
            .filter(([, c]) => c?.isArchive)
            .map(([id]) => id)
    )
    return Object.entries(modelos || {})
        .filter(([, m]) => visivel(m))
        .map(([id, m]) => ({ id, nome: String(m.name || "").trim() || "Modelo sem nome", categoria: categoriaDe(m, categorias), arquivado: arquivadas.has(m.category || "") }))
        .filter((m) => (filtro.categoria === TODOS ? !m.arquivado : m.categoria === filtro.categoria))
        .filter((m) => !busca || normal(m.nome).includes(busca))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map(({ id, nome, categoria }) => ({ id, nome, categoria }))
}

/** a categoria em que um modelo NOVO nasce: a escolhida na lista (Todos / Sem categoria = nenhuma) */
export function categoriaDoNovo(escolhida: string, categorias: Mapa<Categoria>): string | null {
    return escolhida !== TODOS && escolhida !== SEM_CATEGORIA && categorias?.[escolhida] ? escolhida : null
}

/** nome livre para um novo item ("Novo modelo", "Novo modelo 2", ...) */
export function nomeLivre(base: string, usados: string[]): string {
    const ja = new Set(usados.map((n) => normal(n)))
    if (!ja.has(normal(base))) return base
    let i = 2
    while (ja.has(normal(`${base} ${i}`))) i++
    return `${base} ${i}`
}

/** busca de musica para "Aplicar numa musica…": nome sem acento, as que comecam com a busca primeiro; no maximo `limite` */
export function musicasDaBusca(shows: Mapa<{ name?: string; private?: boolean }>, busca: string, limite = 40): { id: string; nome: string }[] {
    const b = normal(busca)
    const todas = Object.entries(shows || {})
        .filter(([, s]) => !!s && !s.private)
        .map(([id, s]) => ({ id, nome: String(s.name || "").trim() || "Sem nome" }))
    const achadas = b ? todas.filter((s) => normal(s.nome).includes(b)) : todas
    return achadas
        .sort((x, y) => {
            const a = b && normal(x.nome).startsWith(b) ? 0 : 1
            const c = b && normal(y.nome).startsWith(b) ? 0 : 1
            return a - c || x.nome.localeCompare(y.nome, "pt-BR")
        })
        .slice(0, limite)
}

/**
 * "aplicar cola, nao liga" (André 24/nov): ao abrir uma musica, o FreeShow reaplicava o modelo dela toda vez (editar o modelo mudava todas as
 * musicas). Agora so cola quando o modelo escolhido (o da musica ou o da categoria) e outro que o ja colado. Sem modelo: como o FreeShow fazia.
 */
export function deveColarModelo(escolhido: string, colado: string | null | undefined): boolean {
    if (!escolhido) return true
    return escolhido !== (colado || "")
}
