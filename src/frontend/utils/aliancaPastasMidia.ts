import { get } from "svelte/store"
import { uid } from "uid"
import type { AliancaPasta } from "../../types/Show"
import { history } from "../components/helpers/history"
import { media, mediaTags } from "../stores"
import { newToast } from "./common"
import { marcados } from "./aliancaGavetaEstado"
import { chaveDe, remover } from "./aliancaGavetaLogica"
import { mediaTagsComuns, membros, pastaParaConfigurar, pastas } from "./aliancaPastasMidiaEstado"
import { PASTA_NOVA, PASTA_RAIZ, PASTA_SIRVO, capturar, idDaAba, listarPastas, moverTags, type EstadoDePastas } from "./aliancaPastasMidiaLogica"

// ----- AliançaShow · Preparar, fatia 7: as pastas de mídia (etiquetas) -----
// Tudo que muda passa por UMA ação de histórico (MEDIA_PASTA) que guarda o antes e o depois só dos campos tocados.

export { mediaTagsComuns, membros, pastaParaConfigurar, pastas }

type Midia = NonNullable<EstadoDePastas["midia"]>

function registrar(antes: EstadoDePastas, depois: EstadoDePastas) {
    history({ id: "MEDIA_PASTA", oldData: antes, newData: depois, location: { page: "drawer" } })
}
const instantaneo = (ids: string[], caminhos: string[]) => capturar({ mediaTags: get(mediaTags), media: get(media) }, ids, caminhos)

function nomeLivre(base: string): string {
    const usados = new Set(listarPastas(get(mediaTags)).map((p) => (p.tag.name || "").toLowerCase()))
    if (!usados.has(base.toLowerCase())) return base
    let n = 2
    while (usados.has(`${base} ${n}`.toLowerCase())) n++
    return `${base} ${n}`
}

export function criarPasta(nome = "Nova pasta"): string {
    const id = uid()
    const antes = instantaneo([id], [])
    registrar(antes, { mediaTags: { [id]: { name: nomeLivre(nome.trim() || "Nova pasta"), color: "", aliancaPasta: { ...PASTA_NOVA } } } })
    pastaParaConfigurar.set(id)
    return id
}

export function renomearPasta(id: string, nome: string) {
    const tag = get(mediaTags)[id]
    const novo = nome.trim()
    if (!tag?.aliancaPasta || !novo || novo === tag.name) return
    registrar(instantaneo([id], []), { mediaTags: { [id]: { ...tag, name: novo } } })
}

export function mudarComportamento(id: string, parcial: Partial<AliancaPasta>) {
    const tag = get(mediaTags)[id]
    if (!tag?.aliancaPasta) return
    registrar(instantaneo([id], []), { mediaTags: { [id]: { ...tag, aliancaPasta: { ...tag.aliancaPasta, ...parcial } } } })
}

/** nunca apaga arquivo: as mídias voltam para a raiz. UMA entrada no histórico, que repõe a definição e as etiquetas de cada mídia */
export function apagarPasta(id: string) {
    if (!get(mediaTags)[id]?.aliancaPasta) return
    const caminhos = get(membros)[id] || []
    const antes = instantaneo([id], caminhos)
    const m = get(media)
    const midia: Midia = {}
    for (const c of caminhos) midia[c] = { tags: moverTags(m[c]?.tags, get(mediaTags), null) }
    registrar(antes, { mediaTags: { [id]: null }, midia })
}

/** move mídias e áudios (caminhos) para a pasta, ou para a raiz (`null`); só troca a etiqueta-pasta */
export function moverParaPasta(caminhos: string[], pastaId: string | null): number {
    const unicos = Array.from(new Set(caminhos.filter(Boolean)))
    if (!unicos.length) return 0
    const t = get(mediaTags)
    if (pastaId && !t[pastaId]?.aliancaPasta) return 0
    const m = get(media)
    const midia: Midia = {}
    for (const c of unicos) midia[c] = { tags: moverTags(m[c]?.tags, t, pastaId) }
    registrar(instantaneo([], unicos), { midia })
    return unicos.length
}

/** ajuste próprio de fim/camada. `null` = "seguir a pasta" (apaga o ajuste) */
export function ajusteProprio(caminhos: string[], campos: { aliancaFim?: "repetir" | "parar" | null; videoType?: "background" | "foreground" | null }) {
    const unicos = Array.from(new Set(caminhos.filter(Boolean)))
    if (!unicos.length) return
    const midia: Midia = {}
    for (const c of unicos) {
        const o: { [k: string]: any } = {}
        if ("aliancaFim" in campos) {
            o.aliancaFim = campos.aliancaFim
            // o `loop` antigo do FreeShow mandaria mais que o ajuste novo: quem escolhe "seguir a pasta" também o solta
            if (campos.aliancaFim === null) o.loop = null
        }
        if ("videoType" in campos) o.videoType = campos.videoType
        midia[c] = o
    }
    registrar(instantaneo([], unicos), { midia })
}

const temAjuste = (m: any) => !!(m?.aliancaFim || m?.videoType || typeof m?.loop === "boolean")

/** quantas mídias da pasta têm ajuste próprio */
export function quantasComAjuste(id: string): number {
    const m = get(media)
    return (get(membros)[id] || []).filter((c) => temAjuste(m[c])).length
}

export function voltarTodasPraPasta(id: string) {
    const m = get(media)
    const caminhos = (get(membros)[id] || []).filter((c) => temAjuste(m[c]))
    if (!caminhos.length) return
    const midia: Midia = {}
    for (const c of caminhos) midia[c] = { aliancaFim: null, videoType: null, loop: null }
    registrar(instantaneo([], caminhos), { midia })
}

/**
 * Os caminhos que o menu de contexto vale: se o card clicado esta marcado (F6), todos os marcados do tipo dele (video/foto ou audio);
 * senao, so os selecionados.
 */
export function alvosDoMenu(selecionados: { path?: string; id?: string }[], so: "video" | "midia" = "midia"): string[] {
    const caminhos = selecionados.map((a) => a.path || a.id || "").filter(Boolean)
    const marcadas = get(marcados).filter((m) => m.tipo === "media" || m.tipo === "audio")
    let todos = caminhos
    if (marcadas.some((m) => caminhos.includes(m.chave))) todos = Array.from(new Set([...caminhos, ...marcadas.map((m) => m.chave)]))
    if (so === "video") todos = todos.filter((c) => /\.(mp4|mov|mkv|avi|webm|m4v|mpg|mpeg|wmv|ogv|flv|3gp|ts|mts|m2ts)$/i.test(c))
    return todos
}

/**
 * O que um arrasto (ou o menu "Mover para") move: se o card tocado está marcado (F6), TODOS os marcados de mídia e áudio
 * (e tira-os das marcações); senão, só os arrastados.
 */
export function moverArrastados(arrastados: { path?: string; id?: string }[], destino: string): boolean {
    if (destino === PASTA_SIRVO) {
        newToast("a pasta Do Sirvo é só para ver")
        return false
    }
    const pastaId = destino === PASTA_RAIZ ? null : idDaAba(destino)
    if (destino !== PASTA_RAIZ && !pastaId) return false

    const caminhos = arrastados.map((a) => a.path || a.id || "").filter(Boolean)
    const marcadas = get(marcados).filter((m) => m.tipo === "media" || m.tipo === "audio")
    const tocouMarcado = marcadas.some((m) => caminhos.includes(m.chave))
    let todos = caminhos
    if (tocouMarcado) {
        todos = Array.from(new Set([...caminhos, ...marcadas.map((m) => m.chave)]))
        marcados.update((l) => remover(l, marcadas.map(chaveDe)))
    }
    const n = moverParaPasta(todos, pastaId)
    if (n) newToast(`${n} ${n === 1 ? "mídia movida" : "mídias movidas"} para ${pastaId ? get(mediaTags)[pastaId]?.name || "a pasta" : "Mídias"}`)
    return n > 0
}
