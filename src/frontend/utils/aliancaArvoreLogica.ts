// Leiaute v2, biblioteca: a arvore unica (uma pasta aberta). Pura: quais pastas existem e como sanear dado salvo antigo.
// Nao tem no (e portanto nao tem lugar no novo): metronomo, efeitos, videos online, mixer, playlists e microfones (pergunta 12 do plano).
import type { DrawerTabIds } from "../../types/Tabs"

export type NoDaArvore = { id: DrawerTabIds; nome: string }

/** Ordem e nomes: as seis do prototipo, mais Funcoes e Calendario (resposta P7). Cameras e NDI entram como filhos de Midia (MediaTabs). */
export const NOS: NoDaArvore[] = [
    { id: "shows", nome: "Shows" },
    { id: "media", nome: "Mídia" },
    { id: "audio", nome: "Áudio" },
    { id: "scripture", nome: "Bíblia" },
    { id: "overlays", nome: "Sobreposições" },
    { id: "templates", nome: "Modelos" },
    { id: "functions", nome: "Funções" },
    { id: "calendar", nome: "Calendário" }
]

export const temNo = (id: string | null | undefined): boolean => !!id && NOS.some((n) => n.id === id)

/** Dado salvo antigo (aba sem no, ou sub-aba que nao existe mais): na carga vira `shows` / `all`, sem faixa. */
export function sanearNaCarga(aba: string | null | undefined): DrawerTabIds {
    return temNo(aba) ? (aba as DrawerTabIds) : "shows"
}

/** Em uso (depois da carga): escrita apontando para aba sem no e falha ALTA; devolve o ultimo no valido para a arvore voltar. */
export function decidirEscrita(nova: string | null | undefined, ultimoValido: DrawerTabIds): { ok: true; aba: DrawerTabIds } | { ok: false; voltarPara: DrawerTabIds; nome: string } {
    return temNo(nova) ? { ok: true, aba: nova as DrawerTabIds } : { ok: false, voltarPara: ultimoValido, nome: String(nova) }
}
