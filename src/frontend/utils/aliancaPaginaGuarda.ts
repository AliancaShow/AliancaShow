// Leiaute v2: a guarda das paginas e da TELA. Importa SO `svelte/store` e aliancaFalha (este arquivo entra no grafo da janela de saida) e nada assina store.
// Na janela PRINCIPAL so `show`, `edit`, `settings`, `stage` e `draw` tem lugar na tela. Qualquer outro valor (scripture, calendar, reflow ou um
// valor novo que o upstream acrescente a TopViews) NAO e escrito: a tela fica onde estava, sem piscar, e a faixa de falha acende com o nome da
// pagina ate o operador dispensar. Nao existe "voltar para show". Fora da janela principal devolve o valor sem olhar.
//
// Fatia 2 ("uma regra so"): `activePage` e fachada. Cada pagina pertence a uma CLASSE de tela (mostrar | editar | pagina). Escrever uma pagina
// que NAO muda a classe (show->show, settings->stage) passa. Escrever uma que muda a classe so passa PELA PORTA (`pelaPorta`, chamada por
// `trocarTela` em aliancaTela.ts); de fora da porta e um pedido recusado, a tela fica onde estava e a faixa acende (`troca-de-tela-recusada`).
import { get } from "svelte/store"
import type { Writable } from "svelte/store"
import { falhaAlta } from "./aliancaFalha"

export const PAGINAS_COM_LUGAR: readonly string[] = ["show", "edit", "settings", "stage", "draw"]

export type ClasseDaTela = "mostrar" | "editar" | "pagina"

/** a classe da tela de uma pagina; null para pagina sem lugar */
export function classeDaPagina(pagina: string): ClasseDaTela | null {
    if (pagina === "show") return "mostrar"
    if (pagina === "edit") return "editar"
    if (pagina === "settings" || pagina === "stage" || pagina === "draw") return "pagina"
    return null
}

let portaAberta = false
/** roda `fn` com a porta aberta: so `trocarTela` chama. Sincrono e sem reentrada que deixe a porta aberta. */
export function pelaPorta<R>(fn: () => R): R {
    const antes = portaAberta
    portaAberta = true
    try {
        return fn()
    } finally {
        portaAberta = antes
    }
}

export function guardarPagina<T extends string>(base: Writable<T>, ehJanelaPrincipal: () => boolean): Writable<T> {
    // devolve o motivo da recusa (ou null se vale)
    const motivo = (atual: T, v: T): "sem-lugar" | "troca" | null => {
        if (!ehJanelaPrincipal()) return null
        if (!PAGINAS_COM_LUGAR.includes(v)) return "sem-lugar"
        if (!portaAberta && classeDaPagina(atual) !== classeDaPagina(v)) return "troca"
        return null
    }
    const recusar = (m: "sem-lugar" | "troca", atual: T, v: T) => {
        if (m === "sem-lugar") falhaAlta("pagina-sem-lugar", v)
        else falhaAlta("troca-de-tela-recusada", `${atual} -> ${v}`)
    }
    return {
        subscribe: base.subscribe,
        set(v: T) {
            const atual = get(base)
            const m = motivo(atual, v)
            if (m) recusar(m, atual, v)
            else base.set(v)
        },
        update(fn: (atual: T) => T) {
            base.update((atual) => {
                const novo = fn(atual)
                const m = motivo(atual, novo)
                if (!m) return novo
                recusar(m, atual, novo)
                return atual
            })
        }
    }
}
