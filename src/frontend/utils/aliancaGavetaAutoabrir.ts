// Reabertura atrasada da gaveta fechada sozinha pelo editor (Drawer.svelte). Logica pura, sem importar stores.ts.
//
// Por que existe: a escrita atrasada tem de ir para o LADO (Culto ou Preparar) que era o da hora de AGENDAR, nunca para o que estiver
// valendo quando o timer disparar. `drawer` e uma fachada que segue `modoAlianca`: se o modo mudar nos 100 ms de espera (o chip que
// "leva ao Culto" faz activePage = show e logo modo = culto), escrever pela fachada gravava a gaveta do Preparar no Culto.
// Quem chama decide o lado: `agendarReaberturaDaGaveta(drawer.doModo(get(modoAlianca)), ...)`.
import { get, type Writable } from "svelte/store"

export type Gaveta = { height: number; stored: null | number; autoclosed?: boolean }

export const ESPERA_REABRIR_MS = 100

export function agendarReaberturaDaGaveta(lado: Writable<Gaveta>, alturaPadrao: number, agendar: (f: () => void, ms: number) => unknown = (f, ms) => setTimeout(f, ms)) {
    agendar(() => lado.set({ height: get(lado).stored ?? alturaPadrao, stored: null }), ESPERA_REABRIR_MS)
}
