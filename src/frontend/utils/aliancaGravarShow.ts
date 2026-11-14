import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { showsCache } from "../stores"
import { clone } from "../components/helpers/array"
import { rastreioDeSalvos } from "./aliancaShowsSalvos"

// ----- AliançaShow · Preparar: música nova vai pro disco na hora -----
//
// O show criado pelos popups ("Várias músicas", "Nova música", "Colar letra") vivia só em memória até o
// Ctrl+S ou o autosave de 15 min. O observador da pasta de shows recarrega a lista a partir do disco: música
// que não estava lá sumia, e o item do culto ficava órfão. Aqui o show é gravado sozinho (um arquivo, sem o
// save() geral, que manda todos os stores).

/** ids gravados por este caminho: servem pra apagar o arquivo se o usuário desfizer a criação */
const gravadosNaHora = new Set<string>()

/** grava o show que está no cache agora */
export function gravarNoDisco(id: string) {
    const show = get(showsCache)[id]
    if (!show) return
    gravadosNaHora.add(id)
    sendMain(Main.SAVE_SHOW_FILE, { id, show: clone(show) })
    rastreioDeSalvos.gravadoAgora(id, get(showsCache) as any)
}

/** desfez a criação: se o arquivo foi gravado aqui, tira do disco */
export function apagarDoDiscoSeGravado(id: string, nome: string) {
    if (!gravadosNaHora.has(id)) return
    sendMain(Main.SAVE_SHOW_FILE, { id, apagarNome: nome })
}

/** refazer a criação (Ctrl+Shift+Z): grava de novo */
export function regravarSeGravado(id: string) {
    if (gravadosNaHora.has(id)) gravarNoDisco(id)
}
