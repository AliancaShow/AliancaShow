import type { ProjectShowRef } from "../../types/Projects"

// ----- AliançaShow · Preparar, fatia 6: a gaveta serve para PEGAR (marcar em vez de tocar) -----
//
// Só a conta, sem store (quem liga aos stores é aliancaGaveta.ts).
//
// Uma marcação é um item da gaveta que o operador separou para levar ao culto. Ela mora numa lista própria
// (NÃO na `selected` do FreeShow, que some a qualquer clique fora e ao redimensionar a gaveta).

export type TipoMarcado = "show" | "media" | "audio" | "scripture"

export type Marcado = {
    tipo: TipoMarcado
    /** a identidade dentro do tipo: id do show, caminho do arquivo, referência da Bíblia */
    chave: string
    /** no formato que o SelectElem/drop espera (mídia: {name,path,type,contentProvider}; áudio: {path,name}; show: {id}; Bíblia: o conteúdo já resolvido) */
    dado: any
}

export const MAX_MARCADOS = 100

/** a chave única na lista: o mesmo caminho pode ser mídia e áudio, então o tipo entra */
export const chaveUnica = (tipo: TipoMarcado, chave: string): string => `${tipo}:${chave}`
export const chaveDe = (m: Pick<Marcado, "tipo" | "chave">): string => chaveUnica(m.tipo, m.chave)

/** o tipo de um arquivo vem da EXTENSÃO, nunca da aba onde ele estava (a grade de mídia pode ter áudio). `ppt` não marca (a importação converte em slides). */
export function tipoDoArquivo(tipoDaExtensao: string): "media" | "audio" | null {
    if (tipoDaExtensao === "audio") return "audio"
    if (tipoDaExtensao === "ppt") return null
    return "media"
}

/** `aba|livro|capítulos|versos` (a seleção viva da Bíblia), com o subverso (`3_2`) dentro dos versos */
export function chaveDaBiblia(aba: string, livro: string | number, capitulos: (string | number)[], versos: (string | number)[][]): string {
    const vs = (versos || []).map((v) => (Array.isArray(v) ? v.map(String).join(",") : String(v))).join(";")
    return `${aba}|${livro}|${(capitulos || []).map(String).join(",")}|${vs}`
}

export type Resultado = { lista: Marcado[]; efeito: "marcou" | "desmarcou" | "ja" | "cheio" }

export const indiceDe = (lista: Marcado[], tipo: TipoMarcado, chave: string) => lista.findIndex((m) => m.tipo === tipo && m.chave === chave)
export const estaMarcado = (lista: Marcado[], tipo: TipoMarcado, chave: string) => indiceDe(lista, tipo, chave) >= 0

/** marca se não está, desmarca se está */
export function alternar(lista: Marcado[], m: Marcado, max = MAX_MARCADOS): Resultado {
    const i = indiceDe(lista, m.tipo, m.chave)
    if (i >= 0) return { lista: lista.filter((_, j) => j !== i), efeito: "desmarcou" }
    if (lista.length >= max) return { lista, efeito: "cheio" }
    return { lista: [...lista, m], efeito: "marcou" }
}

/** deixa marcado (idempotente): nunca duplica nem desmarca */
export function garantir(lista: Marcado[], m: Marcado, max = MAX_MARCADOS): Resultado {
    if (indiceDe(lista, m.tipo, m.chave) >= 0) return { lista, efeito: "ja" }
    if (lista.length >= max) return { lista, efeito: "cheio" }
    return { lista: [...lista, m], efeito: "marcou" }
}

/** tira da lista os itens com essas chaves únicas */
export function remover(lista: Marcado[], chaves: Iterable<string>): Marcado[] {
    const fora = new Set(chaves)
    return lista.filter((m) => !fora.has(chaveDe(m)))
}

export const porTipo = (lista: Marcado[], tipo: TipoMarcado): Marcado[] => lista.filter((m) => m.tipo === tipo)

/** as fotos marcadas (mídia que é imagem) */
export const fotos = (lista: Marcado[]): Marcado[] => lista.filter((m) => m.tipo === "media" && m.dado?.type === "image")

/** a quantidade de cada tipo, para o rótulo do contador */
export function contagem(lista: Marcado[]): { total: number; fotos: number; midias: number; audios: number; shows: number; biblia: number } {
    return { total: lista.length, fotos: fotos(lista).length, midias: porTipo(lista, "media").length, audios: porTipo(lista, "audio").length, shows: porTipo(lista, "show").length, biblia: porTipo(lista, "scripture").length }
}

/**
 * Os itens do projeto no MESMO formato do drop (dropActions.ts, `project`): mídia {name,id:path,type},
 * áudio {id:path,name,type:"audio"}, show {id}. A Bíblia não entra aqui: vira um show novo antes (aliancaGaveta.ts).
 */
export function paraItensDoProjeto(lista: Marcado[], semExtensao: (nome: string) => string = (n) => n): ProjectShowRef[] {
    const itens: ProjectShowRef[] = []
    for (const m of lista) {
        if (m.tipo === "show") itens.push({ id: m.dado?.id ?? m.chave, type: "show" } as ProjectShowRef)
        else if (m.tipo === "media") itens.push({ id: m.dado?.path ?? m.chave, name: semExtensao(m.dado?.name || ""), type: m.dado?.type } as ProjectShowRef)
        else if (m.tipo === "audio") itens.push({ id: m.dado?.path ?? m.chave, name: semExtensao(m.dado?.name || ""), type: "audio" } as ProjectShowRef)
    }
    return itens
}

/** do arrasto: os marcados do mesmo tipo (e do mesmo grupo de drop) do item arrastado; os outros ficam marcados */
export function cargaDoArrasto(lista: Marcado[], arrastado: { tipo: TipoMarcado; chave: string }): { carga: Marcado[]; ficam: Marcado[] } | null {
    if (indiceDe(lista, arrastado.tipo, arrastado.chave) < 0) return null
    const carga = lista.filter((m) => m.tipo === arrastado.tipo)
    return { carga, ficam: lista.filter((m) => m.tipo !== arrastado.tipo) }
}

/** o aviso quando o arrasto leva só um tipo: "só 3 foram; 2 áudios continuam marcados" */
export function avisoDoQueFicou(carga: Marcado[], ficam: Marcado[]): string {
    if (!ficam.length) return ""
    const f = contagem(ficam)
    const partes: string[] = []
    if (f.midias) partes.push(`${f.midias} ${f.midias === 1 ? "mídia" : "mídias"}`)
    if (f.audios) partes.push(`${f.audios} ${f.audios === 1 ? "áudio" : "áudios"}`)
    if (f.shows) partes.push(`${f.shows} ${f.shows === 1 ? "show" : "shows"}`)
    if (f.biblia) partes.push(`${f.biblia} ${f.biblia === 1 ? "versículo" : "versículos"}`)
    const foi = carga.length === 1 ? "só 1 foi" : `só ${carga.length} foram`
    return `${foi}; ${partes.join(" e ")} ${f.total === 1 ? "continua marcado" : "continuam marcados"}`
}

/** a posição de entrada do "Pôr no culto": "depois" do último selecionado (sem referência: no fim) */
export function posicaoDeEntradaNoCulto(onde: "depois" | "fim", total: number, ultimo: number | null | undefined, noFim: number): number {
    if (onde === "fim") return Math.max(0, Math.min(noFim, total))
    if (typeof ultimo === "number" && ultimo >= 0 && ultimo < total) return ultimo + 1
    return Math.max(0, Math.min(noFim, total))
}

// ---------------------------------------------------------------- o editor mostra só o que vira conteúdo do slide

/** as abas da gaveta que ficam no editor de um show: Mídia, Áudio e Bíblia */
export const ABAS_DO_EDITOR = ["media", "audio", "scripture"]

/**
 * As abas escondidas no editor. Só no Preparar, na página de edição, e só quando o que se edita é um SHOW
 * (tema, overlay, efeito etc. escolhem o que editar pela aba: sem filtro).
 */
export function abasEscondidasNoEditor(todas: string[], ctx: { preparar: boolean; noEditor: boolean; tipoEditado: string | null | undefined }): string[] {
    if (!ctx.preparar || !ctx.noEditor) return []
    if (ctx.tipoEditado && ctx.tipoEditado !== "show") return []
    return todas.filter((id) => !ABAS_DO_EDITOR.includes(id))
}

/** a aba que vale ao entrar no editor: a ativa, se não está escondida; senão Mídia */
export function abaAoEntrarNoEditor(ativa: string, escondidas: string[]): string {
    return escondidas.includes(ativa) ? "media" : ativa
}
