// Estado de leiaute que vive FORA dos stores (fatia 0b): o que era variavel solta de modulo e precisa ser por modo, e os atributos do body.
// Nada aqui assina store no nivel do modulo (a janela de saida tambem roda este grafo): so `iniciarLayoutAlianca()`, chamada uma vez
// na janela principal (mesmo cuidado de aliancaTema.ts).
import { derived, get } from "svelte/store"
import { activePage, currentWindow, drawerTabsData, modoAlianca } from "../stores"
import { falhaAlta } from "./aliancaFalha"
import { sanearAbaMidia } from "./aliancaDrawerTabsLogica"
import { pastas } from "./aliancaPastasMidiaEstado"

/** o lado do modo da hora */
export const chaveDoModo = (): "culto" | "preparar" => {
    try {
        return get(modoAlianca) === "preparar" ? "preparar" : "culto"
    } catch (erro) {
        falhaAlta("chave-do-modo", erro)
        return "culto"
    }
}

/** um valor por modo para o que antes era variavel de modulo compartilhada */
export function valorPorModo<T>(inicial: T) {
    const v: { culto: T; preparar: T } = { culto: inicial, preparar: inicial }
    return {
        ler: (): T => v[chaveDoModo()],
        gravar: (x: T) => {
            v[chaveDoModo()] = x
        },
        /** o valor de um lado especifico (so testes) */
        de: (m: "culto" | "preparar") => v[m]
    }
}

/** Ctrl+T ("fechar tudo") lembra se foi o operador que fechou as colunas: por modo */

let iniciado = false

/**
 * Atributos `data-modo` e `data-pagina` no body (ganchos de CSS das proximas fatias) e o saneamento da pasta de midia
 * do Culto ao voltar do Preparar (o Preparar pode ter apagado a pasta que o Culto tinha aberta). So a janela principal.
 */
export function iniciarLayoutAlianca() {
    if (get(currentWindow)) return
    if (iniciado) return
    iniciado = true
    derived([modoAlianca, activePage], ([a, b]) => [a, b]).subscribe(([modo, pagina]) => {
        try {
            const body = document.body
            body.setAttribute("data-modo", String(modo))
            body.setAttribute("data-pagina", String(pagina))
            if (modo === "culto") {
                const atual = get(drawerTabsData.culto)
                const novo = sanearAbaMidia(
                    atual,
                    get(pastas).map((p: any) => p.id)
                )
                if (novo !== atual) drawerTabsData.culto.set(novo)
            }
        } catch (erro) {
            falhaAlta("atributos-do-body", erro)
        }
    })
}

/** So para testes. */
export function _reiniciarLayoutEstado() {
    iniciado = false
}
