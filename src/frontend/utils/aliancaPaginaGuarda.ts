// Leiaute v2: a guarda das paginas. Importa SO `svelte/store` e aliancaFalha (este arquivo entra no grafo da janela de saida) e nada assina store.
// Na janela PRINCIPAL so `show`, `edit`, `settings`, `stage` e `draw` tem lugar na tela. Qualquer outro valor (scripture, calendar, reflow ou um
// valor novo que o upstream acrescente a TopViews) NAO e escrito: a tela fica onde estava, sem piscar, e a faixa de falha acende com o nome da
// pagina ate o operador dispensar. Nao existe "voltar para show". Fora da janela principal devolve o valor sem olhar.
import type { Writable } from "svelte/store"
import { falhaAlta } from "./aliancaFalha"

export const PAGINAS_COM_LUGAR: readonly string[] = ["show", "edit", "settings", "stage", "draw"]

export function guardarPagina<T extends string>(base: Writable<T>, ehJanelaPrincipal: () => boolean): Writable<T> {
    const vale = (v: T) => !ehJanelaPrincipal() || PAGINAS_COM_LUGAR.includes(v)
    return {
        subscribe: base.subscribe,
        set(v: T) {
            if (vale(v)) base.set(v)
            else falhaAlta("pagina-sem-lugar", v)
        },
        update(fn: (atual: T) => T) {
            base.update((atual) => {
                const novo = fn(atual)
                if (vale(novo)) return novo
                falhaAlta("pagina-sem-lugar", novo)
                return atual
            })
        }
    }
}
