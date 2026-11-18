// Leiaute v2, biblioteca: a arvore unica (uma raiz aberta por vez). Pura: quais raizes e filhos existem e como sanear dado salvo antigo.
// Rodada da cabine 18/nov (C6): 4 RAIZES — Shows, Midia, Biblia, Ferramentas. Clicar na raiz = "tudo" daquela raiz; os filhos vem direto embaixo.
// Os ids de aba do FreeShow continuam (os paineis de conteudo sao os mesmos): Audio mora em Midia, Modelos/Funcoes/Calendario/Sobreposicoes em Ferramentas.
// Nao tem no (e portanto nao tem lugar no novo): metronomo, efeitos, mixer-como-raiz, playlists e microfones (pergunta 12 do plano).
import type { DrawerTabIds } from "../../types/Tabs"

export type NoDaArvore = { id: DrawerTabIds; nome: string }
export type RaizId = "shows" | "media" | "scripture" | "ferramentas"
export type Raiz = { id: RaizId; nome: string; abre: DrawerTabIds }

/** as 4 raizes, na ordem da arvore; `abre` e a aba que a raiz seleciona ao ser clicada (em Ferramentas, o 1o filho: nao ha "tudo") */
export const RAIZES: Raiz[] = [
    { id: "shows", nome: "Shows", abre: "shows" },
    { id: "media", nome: "Mídia", abre: "media" },
    { id: "scripture", nome: "Bíblia", abre: "scripture" },
    { id: "ferramentas", nome: "Ferramentas", abre: "templates" }
]

/** filhos que sao OUTRA aba do FreeShow (o resto dos filhos sao sub-abas da propria aba: pastas, categorias, versoes) */
export const FILHOS_FERRAMENTAS: NoDaArvore[] = [
    { id: "templates", nome: "Modelos" },
    { id: "functions", nome: "Funções" },
    { id: "calendar", nome: "Calendário" },
    { id: "overlays", nome: "Sobreposições" }
]
export const FILHOS_MIDIA: NoDaArvore[] = [{ id: "audio", nome: "Áudio" }]

/** Todas as abas que ainda tem lugar na arvore (a raiz de cada uma esta em `raizDaAba`). */
export const NOS: NoDaArvore[] = [{ id: "shows", nome: "Shows" }, { id: "media", nome: "Mídia" }, ...FILHOS_MIDIA, { id: "scripture", nome: "Bíblia" }, ...FILHOS_FERRAMENTAS]

export const temNo = (id: string | null | undefined): boolean => !!id && NOS.some((n) => n.id === id)

/** a raiz em que a aba mora (a raiz fica ABERTA enquanto a aba, ou um filho dela, esta selecionada) */
export function raizDaAba(aba: string | null | undefined): RaizId {
    if (aba === "media" || aba === "audio") return "media"
    if (aba === "scripture") return "scripture"
    if (aba === "templates" || aba === "functions" || aba === "calendar" || aba === "overlays") return "ferramentas"
    return "shows"
}

/** a raiz esta "mostrando tudo" (fundo claro na propria raiz): a aba dela esta aberta na sub-aba "all" (Biblia e Ferramentas nao tem "tudo": nunca) */
export function raizMostraTudo(raiz: RaizId, aba: string, subAba: string | null | undefined): boolean {
    if (raiz === "shows") return aba === "shows" && (!subAba || subAba === "all" || subAba === "unlabeled")
    if (raiz === "media") return aba === "media" && (!subAba || subAba === "all")
    return false
}

/** Dado salvo antigo (aba sem no, ou sub-aba que nao existe mais): na carga vira `shows` / `all`, sem faixa. */
export function sanearNaCarga(aba: string | null | undefined): DrawerTabIds {
    return temNo(aba) ? (aba as DrawerTabIds) : "shows"
}

/**
 * Sub-aba salva de antes da C6: "Mídias" (a pasta-raiz, `pasta:raiz`) virou o proprio "tudo" de Midia; (Sobreposicoes continua com as sub-abas dela quando aberta).
 * `unlabeled` (Sem etiqueta) continua valendo: agora e o filtro "Sem categoria" do cabecalho da lista. O resto passa como esta.
 */
export function sanearSubAba(aba: string, sub: string | null | undefined): string {
    if (!sub) return sub ?? ""
    if (aba === "media" && sub === "pasta:raiz") return "all"
    if (aba === "templates" && sub === "unlabeled") return "all"
    return sub
}

/** Em uso (depois da carga): escrita apontando para aba sem no e falha ALTA; devolve o ultimo no valido para a arvore voltar. */
export function decidirEscrita(nova: string | null | undefined, ultimoValido: DrawerTabIds): { ok: true; aba: DrawerTabIds } | { ok: false; voltarPara: DrawerTabIds; nome: string } {
    return temNo(nova) ? { ok: true, aba: nova as DrawerTabIds } : { ok: false, voltarPara: ultimoValido, nome: String(nova) }
}

/** o filtro "Sem categoria · N" do cabecalho da lista: so com a raiz selecionada (tudo) ou ja filtrando, e SO enquanto houver algum (some em zero) */
export function filtroSemCategoria(n: number, subAba: string | null | undefined): { visivel: boolean; ativo: boolean } {
    const ativo = subAba === "unlabeled"
    const emTudo = !subAba || subAba === "all" || ativo
    return { visivel: emTudo && (n > 0 || ativo), ativo }
}

/**
 * Qual recorte da lista de Shows a sub-aba da arvore pede: "all" (a raiz) = o que os chips de tipo dizem; "unlabeled" (filtro Sem categoria) ou uma categoria
 * = esse recorte nos DOIS tipos (a categoria ja decide se e musica ou apresentacao; os chips nao podem esconde-la).
 */
export function recorteDeShows(subAba: string | null | undefined, categorias: { [id: string]: unknown } | null | undefined): { tipo: "chips" } | { tipo: "sem-categoria" } | { tipo: "categoria"; id: string } {
    if (subAba === "unlabeled") return { tipo: "sem-categoria" }
    if (subAba && subAba !== "all" && categorias && categorias[subAba]) return { tipo: "categoria", id: subAba }
    return { tipo: "chips" }
}

/** o recorte aplicado a uma lista (de um tipo ou dos dois) */
export function aplicarRecorte<T extends { categoria: string | null }>(linhas: T[], r: ReturnType<typeof recorteDeShows>, categorias: { [id: string]: unknown } | null | undefined): T[] {
    if (r.tipo === "sem-categoria") return linhas.filter((l) => !l.categoria || !categorias?.[l.categoria])
    if (r.tipo === "categoria") return linhas.filter((l) => l.categoria === r.id)
    return linhas
}
