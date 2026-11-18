import type { ProjectShowRef } from "../../types/Projects"
import { ABAS_DO_EDITOR, abasEscondidasNoEditor, posicaoDeEntradaNoCulto } from "./aliancaGavetaLogica"
import { categoriasDeMusica } from "./aliancaSemLetraLogica"
import { posicaoNoBloco } from "./aliancaTiradosLogica"

// ----- AliançaShow · Preparar, fatia FV-B: aba Biblioteca, "+ Novo" e "✎ Editar" (só a conta; os efeitos estão em aliancaBiblioteca.ts) -----

export type TipoDaBiblioteca = "musicas" | "apresentacoes"

export type LinhaDaBiblioteca = { id: string; nome: string; categoria: string | null; semLetra: boolean }

type EntradaDoIndice = { name?: string; category?: string | null; private?: boolean } | undefined | null
type Categorias = { [id: string]: { icon?: string | null; isArchive?: boolean } | undefined } | null | undefined

/**
 * O que a aba Biblioteca lista. Músicas = categoria de ícone `song`; Apresentações = TODO o resto (inclusive show sem
 * categoria ou com categoria que não existe mais). Ficam de fora: show privado, categoria arquivada (Bíblia,
 * "Converted") e categoria que o perfil não pode ver (`acesso[categoria] === "none"`). Ordem por nome (pt, sem acento/caixa).
 */
export function listarBiblioteca(e: { shows: { [id: string]: EntradaDoIndice } | null | undefined; categorias: Categorias; acesso: { [categoria: string]: string | undefined } | null | undefined; tipo: TipoDaBiblioteca; soSemLetra?: boolean; ehSemLetraDe: (id: string) => boolean }): LinhaDaBiblioteca[] {
    const musicas = categoriasDeMusica(e.categorias as Parameters<typeof categoriasDeMusica>[0])
    const acesso = e.acesso || {}
    const saida: LinhaDaBiblioteca[] = []
    for (const [id, s] of Object.entries(e.shows || {})) {
        if (!s || s.private) continue
        const cat = s.category || ""
        if (e.categorias?.[cat]?.isArchive) continue
        if (acesso[cat] === "none") continue
        const ehMusica = musicas.has(cat)
        if ((e.tipo === "musicas") !== ehMusica) continue
        const semLetra = ehMusica && e.ehSemLetraDe(id)
        if (e.soSemLetra && !semLetra) continue
        saida.push({ id, nome: s.name || "", categoria: s.category || null, semLetra })
    }
    return saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt", { sensitivity: "base" }) || a.id.localeCompare(b.id))
}

/** os números dos chips (vão no `title`; só o de alerta mostra número) */
export function resumoDaBiblioteca(e: Omit<Parameters<typeof listarBiblioteca>[0], "tipo" | "soSemLetra">): { musicas: number; apresentacoes: number; semLetra: number } {
    const musicas = listarBiblioteca({ ...e, tipo: "musicas" })
    return { musicas: musicas.length, apresentacoes: listarBiblioteca({ ...e, tipo: "apresentacoes" }).length, semLetra: musicas.filter((m) => m.semLetra).length }
}

/** os ids de show que estão no culto aberto (vazio se for modelo ou não houver culto) */
export function idsNoCulto(projetos: { [id: string]: { shows?: { id: string; type?: string }[] } | undefined } | null | undefined, projetoAtivo: string | null | undefined, ehModelo: boolean): Set<string> {
    if (ehModelo || !projetoAtivo) return new Set()
    const lista = projetos?.[projetoAtivo]?.shows || []
    return new Set(lista.filter((i) => i && i.type === "show").map((i) => i.id))
}

/** o segundo toque na mesma chave em menos de `esperaMs` é repetido (duplo clique no "+") */
export function toqueRepetido(ultimo: { chave: string; em: number } | null | undefined, chave: string, agora: number, esperaMs = 500): boolean {
    return !!ultimo && ultimo.chave === chave && agora - ultimo.em < esperaMs
}

/** o que o editor recebe ao abrir o show pelo "✎ Editar": o último slide, se era este show; senão o 0 */
export function edicaoDoShow(atual: { showId?: string; slide?: number | null } | null | undefined, showId: string): { type: "show"; slide: number; items: never[]; showId: string } {
    const slide = atual?.showId === showId && typeof atual.slide === "number" && atual.slide >= 0 ? atual.slide : 0
    return { type: "show", slide, items: [], showId }
}

// ---------------------------------------------------------------- volta ao Culto

/**
 * Na passagem Preparar -> Culto: se o show aberto NÃO é item do culto, devolve o índice do item para onde voltar (o
 * último item do culto em que o operador esteve, senão o primeiro show do culto). `null` = não mexe em nada
 * (show já está no culto, nada aberto, sem culto ou culto sem show). Assim o "->" sempre segue o roteiro.
 */
export function itemParaVoltar(e: { aberto: { id?: string; type?: string } | null | undefined; itens: { id: string; type?: string }[] | null | undefined; ultimo: { index: number; id: string } | null | undefined }): number | null {
    const itens = e.itens || []
    if (!e.aberto?.id || (e.aberto.type !== undefined && e.aberto.type !== "show")) return null
    if (itens.some((i) => i && i.type === "show" && i.id === e.aberto!.id)) return null
    if (e.ultimo && itens[e.ultimo.index]?.id === e.ultimo.id && itens[e.ultimo.index]?.type === "show") return e.ultimo.index
    const primeiro = itens.findIndex((i) => i && i.type === "show")
    return primeiro >= 0 ? primeiro : null
}

// ---------------------------------------------------------------- "+ Novo"

export type ComandoNovo = "musica" | "varias" | "apresentacao" | "importar"
export type ItemDoMenuNovo = { id: ComandoNovo; rotulo: string } | "separador"

/** a lista do menu como dado. Nada de "Pregação" nem "Tema" (não existem), nem "Apresentação de fotos" (o Juntar da gaveta é o caminho) */
export function itensDoMenuNovo(): ItemDoMenuNovo[] {
    return [{ id: "musica", rotulo: "Música (colar letra)" }, { id: "varias", rotulo: "Várias músicas" }, "separador", { id: "apresentacao", rotulo: "Apresentação em branco" }, "separador", { id: "importar", rotulo: "Importar arquivo" }]
}

// ---------------------------------------------------------------- "+" da linha

/** põe o show no fim do culto (antes do rodapé do Sirvo, se houver). Devolve a lista nova e a posição; `jaEstava` = o show já tinha item no culto */
export function inserirShowNoFim(vivos: ProjectShowRef[], showId: string): { lista: ProjectShowRef[]; pos: number; jaEstava: boolean } {
    const pos = posicaoDeEntradaNoCulto("fim", vivos.length, null, posicaoNoBloco(vivos, null))
    const novo = { id: showId, type: "show" } as ProjectShowRef
    return { lista: [...vivos.slice(0, pos), novo, ...vivos.slice(pos)], pos, jaEstava: vivos.some((v) => v && v.type === "show" && v.id === showId) }
}

// ---------------------------------------------------------------- a gaveta na aba Biblioteca

/**
 * As abas da gaveta que ficam escondidas. Só no Preparar. Na aba Biblioteca (e só na página "show": `naBiblioteca` já vem
 * com isso) a gaveta oferece só Mídia, Áudio e Bíblia, como no editor. Fora da Biblioteca vale a regra do editor, sem mudança.
 */
export function abasEscondidasNaBiblioteca(todas: string[], ctx: { preparar: boolean; naBiblioteca: boolean; noEditor: boolean; tipoEditado: string | null | undefined }): string[] {
    if (!ctx.preparar) return []
    if (ctx.naBiblioteca && !ctx.noEditor) return todas.filter((id) => !ABAS_DO_EDITOR.includes(id))
    return abasEscondidasNoEditor(todas, ctx)
}

// ---------------------------------------------------------------- textos

export function textoVazio(e: { tipo: TipoDaBiblioteca; filtrando: boolean }): string {
    if (e.filtrando) return "Nada encontrado."
    return e.tipo === "musicas" ? "Nenhuma música ainda." : "Nenhuma apresentação ainda."
}

/** a razão de o "✎ Editar" não valer (null = vale) */
export function motivoSemEditar(e: { carregado: boolean; bloqueado: boolean; acesso: { global?: string; [categoria: string]: string | undefined } | null | undefined; categoria: string | null | undefined }): string | null {
    if (!e.carregado) return "O show ainda está carregando"
    if (e.bloqueado) return "Show bloqueado para edição"
    const a = e.acesso || {}
    if (a.global === "read" || a[e.categoria || ""] === "read") return "O perfil só pode ler este show"
    return null
}

/**
 * A biblioteca (busca, aba, filtros) so volta ao inicio quando se CHEGA em Mostrar vindo de Editar. Ir de Mostrar a uma pagina do menu e voltar
 * nao zera o que o operador digitou. `anteriorNaoPagina` e a ultima tela que nao era pagina do menu (ou null na primeira chegada).
 */
export function chegadaZeraBiblioteca(anteriorNaoPagina: "mostrar" | "editar" | null, agora: "mostrar" | "editar" | "pagina"): boolean {
    return agora === "mostrar" && anteriorNaoPagina !== "mostrar"
}
