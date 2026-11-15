import { derived, get } from "svelte/store"
import { currentWindow, modoAlianca, special, theme, themes } from "../stores"
import { atributosDoTema, FAMILIA_TEXTO, FAMILIA_TITULO, type AtributosDoTema } from "./aliancaTemaLogica"

// ----- AliançaShow · FV-A: escreve data-tema e data-fonte no <body> da janela principal -----
//
// O CSS do laranja e das fontes do Preparar só casa sob esses atributos (public/global.css, bloco FV). Só a janela
// PRINCIPAL os escreve: saída, miniatura e exportação nunca rodam startupMain, então ficam exatamente como eram.
// `special.aliancaVisual === false` (sem tela) desliga tudo em tempo real.
//
// A fonte espera o arquivo carregar antes de o atributo entrar, para o texto não saltar de largura. Se o operador sair do
// Preparar antes, o atributo NÃO entra: depois do await o estado é recalculado (e há um contador de geração).

let iniciado = false
let geracao = 0

const estadoAtual = (): AtributosDoTema => atributosDoTema({ id: get(theme), tema: get(themes)?.[get(theme)], modo: get(modoAlianca), desligado: get(special)?.aliancaVisual === false })

function definir(body: HTMLElement, nome: "tema" | "fonte", valor: string | null) {
    if (valor) {
        if (body.dataset[nome] !== valor) body.dataset[nome] = valor
    } else if (nome in body.dataset) delete body.dataset[nome]
}

function carregarFontes(): Promise<void> {
    const doc: any = typeof document !== "undefined" ? document : null
    if (!doc?.fonts?.load) return Promise.resolve()
    const carga = Promise.all([doc.fonts.load(`400 12px "${FAMILIA_TEXTO}"`), doc.fonts.load(`600 12px "${FAMILIA_TITULO}"`)]).then(() => {})
    const teto = new Promise<void>((r) => setTimeout(r, 400))
    return Promise.race([carga, teto]).catch(() => {})
}

export function aplicarTemaAlianca() {
    const body = typeof document !== "undefined" ? document.body : null
    if (!body) return
    const atributos = estadoAtual()
    definir(body, "tema", atributos.tema)
    if (!atributos.fonte) {
        geracao++
        definir(body, "fonte", null)
        return
    }
    if (body.dataset.fonte === "prep") return
    const minha = ++geracao
    carregarFontes().then(() => {
        if (minha !== geracao) return
        // recalcula: o operador pode ter voltado ao Culto (ou trocado de tema) durante a espera
        if (estadoAtual().fonte === "prep") definir(body, "fonte", "prep")
    })
}

/** Chamada no COMEÇO de `startupMain` (só a janela principal passa por lá). Nunca assina nada no nível do módulo. */
export function iniciarTemaAlianca() {
    if (get(currentWindow)) return // saída, pdf e afins: nada
    if (iniciado) return
    iniciado = true
    derived([theme, themes, modoAlianca, special], ([a, b, c, d]) => [a, b, c, d]).subscribe(() => {
        try {
            aplicarTemaAlianca()
        } catch (erro) {
            console.error("Visual: falha ao aplicar o tema", erro)
        }
    })
}

/** Só para testes. */
export function _reiniciarTemaAlianca() {
    iniciado = false
    geracao = 0
}
