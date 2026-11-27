// AliancaShow (cabine 26/nov, "modo Lista com mais colunas"): tamanho e datas do arquivo de cada midia, lidos do disco uma vez por
// sessao (FILE_INFO, o mesmo stat que o FreeShow ja expoe) e guardados num store. A biblioteca por categorias nao guarda quando a midia
// entrou no programa; a data de criacao do arquivo no computador (quando ele chegou aqui: copiado, baixado) e o que mais se aproxima.
import { writable } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"

export type InfoDeArquivo = { tamanho: number; criado: number; modificado: number }

/** caminho -> info (null: arquivo nao encontrado) */
export const infoDeMidia = writable<{ [caminho: string]: InfoDeArquivo | null }>({})

const pedidos = new Map<string, Promise<void>>()
let lote: { [caminho: string]: InfoDeArquivo | null } = {}
let timer: ReturnType<typeof setTimeout> | undefined
// varias respostas juntas viram UMA atualizacao do store (uma pasta de 500 videos nao redesenha a lista 500 vezes)
function gravar(caminho: string, info: InfoDeArquivo | null) {
    lote[caminho] = info
    if (timer) return
    timer = setTimeout(() => {
        const novos = lote
        lote = {}
        timer = undefined
        infoDeMidia.update((a) => ({ ...a, ...novos }))
    }, 60)
}

export function infoDoStat(stat: any): InfoDeArquivo | null {
    if (!stat || typeof stat !== "object") return null
    const criado = Number(stat.birthtimeMs) || Number(stat.ctimeMs) || 0
    return { tamanho: Number(stat.size) || 0, criado, modificado: Number(stat.mtimeMs) || criado }
}

export function pedirInfo(caminho: string): Promise<void> {
    if (!caminho) return Promise.resolve()
    const ja = pedidos.get(caminho)
    if (ja) return ja
    const p = requestMain(Main.FILE_INFO, caminho)
        .then((r: any) => gravar(caminho, infoDoStat(r?.stat)))
        .catch(() => gravar(caminho, null))
    pedidos.set(caminho, p)
    return p
}

/** pede todos e espera o store receber (para ordenar por data uma pasta inteira) */
export async function pedirVarios(caminhos: string[]): Promise<void> {
    await Promise.all(caminhos.map(pedirInfo))
    await new Promise((r) => setTimeout(r, 80))
}

export function formatarTamanho(bytes: number): string {
    if (!bytes || bytes < 0) return ""
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB"
    if (bytes < 1024 * 1024 * 1024) {
        const mb = bytes / (1024 * 1024)
        return (mb < 10 ? mb.toFixed(1).replace(".", ",") : Math.round(mb).toString()) + " MB"
    }
    return (bytes / (1024 * 1024 * 1024)).toFixed(1).replace(".", ",") + " GB"
}

export function formatarData(ms: number): string {
    if (!ms) return ""
    const d = new Date(ms)
    const dois = (n: number) => String(n).padStart(2, "0")
    return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** ordem por data de chegada: mais novo primeiro (ou o contrario); sem data vai para o fim */
export function compararPorData(a: number, b: number, maisNovoPrimeiro = true): number {
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    return maisNovoPrimeiro ? b - a : a - b
}
