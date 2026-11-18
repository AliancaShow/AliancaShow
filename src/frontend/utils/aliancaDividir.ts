import { writable } from "svelte/store"
import { activeShow, selected } from "../stores"
import { tela } from "./aliancaTela"

// AliançaShow · Preparar F5: qual show está na vista "Dividir" (tesoura entre linhas). null = a grade de sempre.
export const dividirAberto = writable<string | null>(null)

let atual: string | null = null
dividirAberto.subscribe((v) => (atual = v))

/** abre a vista (e solta a seleção da grade: com a vista aberta não há slide selecionado) */
export function abrirDividir(showId: string) {
    selected.set({ id: null, data: [] })
    dividirAberto.set(showId)
}

export function fecharDividir() {
    dividirAberto.set(null)
}

// trocar de show, ou ir pro Culto, fecha a vista
activeShow.subscribe((s) => {
    if (atual && s?.id !== atual) dividirAberto.set(null)
})
tela.subscribe((t) => {
    if (atual && t === "mostrar") dividirAberto.set(null)
})
