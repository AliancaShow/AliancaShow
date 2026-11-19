// ----- AliançaShow · cabine-5 (André, 19/nov): a biblioteca de mídia -----
//
// A mídia NUNCA é copiada: a biblioteca é a lista de caminhos marcados com a etiqueta reservada BIB em `media[caminho].tags`.
// Morar em `tags` (e não num campo novo) faz o Ctrl+Z vir de graça: o histórico MEDIA_PASTA já guarda e repõe `tags`.
// A categoria é a pasta-etiqueta da F7 (`mediaTags` com `aliancaPasta`). A raiz "Mídia" = na biblioteca e sem categoria.
// As pastas do disco (`mediaFolders`) saem da árvore; cada uma vira categoria UMA vez (migração), marcada na própria etiqueta.
// Só a conta mora aqui (sem stores, sem tela), para testar.
import type { AliancaPasta } from "../../types/Show"

/** a etiqueta reservada que diz "está na biblioteca". Nunca existe em `mediaTags`: não aparece em ManageTags nem é pasta */
export const BIB = "alianca:bib"

export type TagsDeMidia = { [id: string]: any }
export type PastaDoDisco = { id: string; name?: string; path?: string; mediaType?: string; default?: boolean }

export const naBiblioteca = (tags: string[] | undefined) => !!tags?.includes(BIB)
export const comBiblioteca = (tags: string[] | undefined) => (naBiblioteca(tags) ? [...(tags || [])] : [...(tags || []), BIB])
export const semBiblioteca = (tags: string[] | undefined) => (tags || []).filter((t) => t !== BIB)

const ehPasta = (tag: any) => !!tag?.aliancaPasta

/** o mesmo arquivo pode estar no `media` com "/" ou "\" (e maiúsculas diferentes no Windows): compara normalizado */
export const normalizar = (c: string) => c.replace(/\\/g, "/").toLowerCase()
/** a chave que o `media` já usa para esse arquivo, ou o próprio caminho */
export function chaveNoMedia(media: { [c: string]: any }, caminho: string, indice?: Map<string, string>): string {
    if (media?.[caminho]) return caminho
    const idx = indice || indiceDoMedia(media)
    return idx.get(normalizar(caminho)) || caminho
}
export function indiceDoMedia(media: { [c: string]: any }): Map<string, string> {
    const m = new Map<string, string>()
    for (const c of Object.keys(media || {})) if (!m.has(normalizar(c))) m.set(normalizar(c), c)
    return m
}
/** a categoria (id) da mídia, ou null */
export function categoriaDe(tags: string[] | undefined, mediaTags: TagsDeMidia): string | null {
    for (const id of tags || []) if (ehPasta(mediaTags?.[id])) return id
    return null
}

/** os caminhos da raiz: na biblioteca e sem categoria */
export function caminhosDaRaiz(media: { [caminho: string]: any }, mediaTags: TagsDeMidia): string[] {
    return Object.entries(media || {})
        .filter(([, m]) => naBiblioteca(m?.tags) && !categoriaDe(m?.tags, mediaTags))
        .map(([c]) => c)
}

/** todos os caminhos da biblioteca (Ctrl+K) */
export const caminhosDaBiblioteca = (media: { [caminho: string]: any }) =>
    Object.entries(media || {})
        .filter(([, m]) => naBiblioteca(m?.tags))
        .map(([c]) => c)

// ---------------------------------------------------------------- tirar da biblioteca

/** as etiquetas depois de tirar da biblioteca: sai a BIB e a categoria; as etiquetas comuns ficam */
export function tagsAoTirar(tags: string[] | undefined, mediaTags: TagsDeMidia): string[] {
    return semBiblioteca(tags).filter((id) => !ehPasta(mediaTags?.[id]))
}

/** as etiquetas ao importar para a categoria (ou para a raiz, null): entra a BIB, a categoria vira a pedida, as comuns ficam */
export function tagsAoImportar(tags: string[] | undefined, mediaTags: TagsDeMidia, categoria: string | null): string[] {
    const comuns = semBiblioteca(tags).filter((id) => !ehPasta(mediaTags?.[id]))
    return categoria ? [...comuns, categoria, BIB] : [...comuns, BIB]
}

// ---------------------------------------------------------------- migração das pastas do disco

/** decisão do André (19/nov): fundos/backgrounds juntos em "Backgrounds" */
export const NOME_BACKGROUNDS = "Backgrounds"
const FUNDO: AliancaPasta = { fim: "repetir", camada: "fundo" }
const FRENTE: AliancaPasta = { fim: "parar", camada: "frente" }

const TRADUZ: { [k: string]: string } = { "category.pictures": "Imagens", "category.videos": "Vídeos" }
export const nomeDaPasta = (p: PastaDoDisco) => TRADUZ[p.name || ""] || p.name || "Pasta"

/**
 * A categoria de destino de uma pasta do disco (decisão do André, 19/nov):
 * - nome com "fundo"/"background" -> "Backgrounds" (fundo, repete; mudo)
 * - tipo "background" -> categoria com o nome da pasta, fundo/repete
 * - sem tipo ou "foreground" -> categoria com o nome da pasta, frente/para no fim (com som, como tocava)
 */
export function destinoDaPasta(p: PastaDoDisco): { nome: string; comportamento: AliancaPasta } {
    const nome = nomeDaPasta(p)
    if (/fundo|background/i.test(nome)) return { nome: NOME_BACKGROUNDS, comportamento: { ...FUNDO } }
    if (p.mediaType === "background") return { nome, comportamento: { ...FUNDO } }
    return { nome, comportamento: { ...FRENTE } }
}

/** a categoria (id) já existente com esse nome (sem diferenciar maiúsculas), ou null */
export function categoriaPeloNome(mediaTags: TagsDeMidia, nome: string): string | null {
    const alvo = nome.trim().toLowerCase()
    for (const [id, tag] of Object.entries(mediaTags || {})) if (ehPasta(tag) && (tag.name || "").trim().toLowerCase() === alvo) return id
    return null
}

/** a pasta do disco já virou categoria? (a marca fica na etiqueta da categoria: `aliancaDeDisco: [ids]`) */
export function pastaJaMigrada(mediaTags: TagsDeMidia, pastaId: string): boolean {
    return Object.values(mediaTags || {}).some((t: any) => ehPasta(t) && Array.isArray(t.aliancaDeDisco) && t.aliancaDeDisco.includes(pastaId))
}

const VIDEO_OU_IMAGEM = /\.(mp4|mov|mkv|avi|webm|m4v|mpg|mpeg|wmv|ogv|flv|3gp|ts|mts|m2ts|jpg|jpeg|png|gif|webp|bmp|svg|tif|tiff|jfif|avif|heic)$/i
export const ehVideoOuImagem = (c: string) => VIDEO_OU_IMAGEM.test(c)

export type PlanoDeMigracao = {
    /** etiquetas a criar ou atualizar (id -> etiqueta inteira) */
    mediaTags: { [id: string]: any }
    /** caminho -> tags novas */
    midia: { [caminho: string]: string[] }
    /** pastas que viraram categoria neste plano */
    migradas: string[]
}

/**
 * O plano da migração de UMA pasta do disco, dados os arquivos achados nela (recursivo; subpastas achatadas — decisão do André).
 * Mídia que JÁ tem categoria não muda de categoria (só entra na biblioteca). Pasta sem vídeo/imagem não cria categoria, mas fica marcada.
 * `novoId` cria o id de uma categoria nova.
 */
export function planejarPasta(pasta: PastaDoDisco, arquivos: string[], estado: { media: { [c: string]: any }; mediaTags: TagsDeMidia }, novoId: () => string, plano?: PlanoDeMigracao): PlanoDeMigracao {
    const p: PlanoDeMigracao = plano || { mediaTags: {}, midia: {}, migradas: [] }
    const tags = { ...(estado.mediaTags || {}), ...p.mediaTags }
    const midias = arquivos.filter(ehVideoOuImagem)
    p.migradas.push(pasta.id)

    const { nome, comportamento } = destinoDaPasta(pasta)
    let catId = categoriaPeloNome(tags, nome)
    if (!catId && midias.length) {
        catId = novoId()
        p.mediaTags[catId] = { name: nome, color: "", aliancaPasta: comportamento, aliancaDeDisco: [] }
    }
    // a marca "já migrada" vai na categoria de destino; pasta vazia marca na categoria se ela já existe, senão não marca (relê na próxima vez)
    if (catId) {
        const atual = p.mediaTags[catId] || { ...tags[catId] }
        p.mediaTags[catId] = { ...atual, aliancaDeDisco: Array.from(new Set([...(atual.aliancaDeDisco || []), pasta.id])) }
    }

    const indice = indiceDoMedia(estado.media)
    for (const solto of midias) {
        const c = chaveNoMedia(estado.media, solto, indice)
        // ja esta na biblioteca (importada antes): o André ja decidiu o lugar dela, a migracao nao mexe
        if (!p.midia[c] && naBiblioteca(estado.media?.[c]?.tags)) continue
        const antes = p.midia[c] || estado.media?.[c]?.tags
        const jaTemCategoria = categoriaDe(antes, { ...tags, ...p.mediaTags })
        p.midia[c] = jaTemCategoria || !catId ? comBiblioteca(antes) : tagsAoImportar(antes, { ...tags, ...p.mediaTags }, catId)
    }
    return p
}
