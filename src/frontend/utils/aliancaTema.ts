import { get } from "svelte/store"
import { currentWindow } from "../stores"

// ----- AliançaShow · leiaute v2: escreve data-tema="luz" no <body> da janela principal -----
//
// O CSS do tema Luz de Projeção (public/global.css, bloco LUZ) só casa sob `body[data-tema="luz"]`. Só a janela PRINCIPAL escreve o atributo:
// saída, miniatura e exportação nunca rodam startupMain, então ficam exatamente como eram. Uma aparência só (escuro): não há tema claro,
// interruptor de desfoque nem flag; o tema do FreeShow e `special.aliancaVisual` deixaram de valer.

let iniciado = false

export function aplicarTemaAlianca() {
    const body = typeof document !== "undefined" ? document.body : null
    if (!body) return
    if (body.dataset.tema !== "luz") body.dataset.tema = "luz"
}

/** Chamada no COMEÇO de `startupMain` (só a janela principal passa por lá). Nada assina store no nível do módulo. */
export function iniciarTemaAlianca() {
    if (get(currentWindow)) return // saída, pdf e afins: nada
    if (iniciado) return
    iniciado = true
    try {
        aplicarTemaAlianca()
    } catch (erro) {
        console.error("Visual: falha ao aplicar o tema", erro)
    }
}

/** Só para testes. */
export function _reiniciarTemaAlianca() {
    iniciado = false
}
