// Efeitos de leiaute da janela principal que dependem da `tela` (fatia 2; era `iniciarLayoutAlianca` em aliancaLayoutEstado.ts).
// Nada aqui assina store no nivel do modulo (a janela de saida tambem roda este grafo): so `iniciarTelaAlianca()`, chamada uma vez na janela
// principal (mesmo cuidado de aliancaTema.ts).
import { derived, get } from "svelte/store"
import { activePage, currentWindow, drawerTabsData } from "../stores"
import { falhaAlta } from "./aliancaFalha"
import { sanearAbaMidia } from "./aliancaDrawerTabsLogica"
import { pastas } from "./aliancaPastasMidiaEstado"
import { tela } from "./aliancaTela"

let iniciado = false

/**
 * Atributos `data-tela` e `data-pagina` no body (ganchos de CSS) e o saneamento da pasta de midia aberta ao chegar em Mostrar (Editar pode ter
 * apagado a pasta que Mostrar tinha aberta). So a janela principal.
 */
export function iniciarTelaAlianca() {
    if (get(currentWindow)) return
    if (iniciado) return
    iniciado = true
    derived([tela, activePage], ([a, b]) => [a, b]).subscribe(([t, pagina]) => {
        try {
            const body = document.body
            body.setAttribute("data-tela", String(t))
            body.setAttribute("data-pagina", String(pagina))
            if (t === "mostrar") {
                const atual = get(drawerTabsData)
                const novo = sanearAbaMidia(
                    atual,
                    get(pastas).map((p: any) => p.id)
                )
                if (novo !== atual) drawerTabsData.set(novo)
            }
        } catch (erro) {
            falhaAlta("atributos-do-body", erro)
        }
    })
}

/** So para testes. */
export function _reiniciarTelaEfeitos() {
    iniciado = false
}
