// Leiaute v2, fatia 2 ("uma regra so"): QUEM PODE TROCAR DE TELA e o que a tela decide.
//
// `tela` e derivada de `activePage` (mostrar | editar | pagina) e e a UNICA fonte da regra do teclado e dos gestos: onde antes se lia `modoAlianca`,
// le-se `tela`. Na janela de saida a `tela` e sempre `mostrar` e nada escreve em `activePage`.
//
// `activePage` e fachada (aliancaPaginaGuarda): escrever uma pagina que muda a CLASSE da tela so passa pela PORTA, `trocarTela(destino, gesto)`.
// Quem chama a porta e GESTO do operador, classificado em `GESTOS` (um teste confere cada chamada). Toda chegada em Mostrar (e em Editar) arma o anteparo
// ANTES de escrever (o gesto que comecar nos 700 ms seguintes sobre a barra do topo e engolido: o toque duplo que cairia no botao que acabou de
// aparecer). Efeito colateral e origem remota (API, celular, processo principal, desfazer) NAO chamam a porta: nao trocam a tela.
//
// Sem `.subscribe(` no nivel do modulo (a janela de saida importa a arvore de stores).
import { derived, get } from "svelte/store"
import type { Readable } from "svelte/store"
import type { TopViews } from "../../types/Tabs"
import { activePage, currentWindow } from "../stores"
import { falhaAlta } from "./aliancaFalha"
import { classeDaPagina, pelaPorta, type ClasseDaTela } from "./aliancaPaginaGuarda"
import { ANTEPARO_MS } from "./aliancaPilulaLogica"

export type Tela = ClasseDaTela

/** Os gestos que podem trocar a tela (cada um e uma chamada de `trocarTela` com este nome). Segmentado e "Editar" do botao direito sao os dois
 *  gestos de Mostrar <-> Editar; o resto abre uma pagina do menu, ou volta delas. */
export const GESTOS = [
    "segmentado",
    "botao-direito",
    "menu-app",
    "pilula-sirvo",
    "pilula-telao",
    "chip",
    "biblioteca-editar",
    "botao-de-pagina",
    "popup",
    "spotlight",
    "voltar-de-pagina"
] as const
export type Gesto = (typeof GESTOS)[number]

const ehPrincipal = () => get(currentWindow) === null

/** `tela` da hora. Fora da janela principal: sempre `mostrar`. */
export const tela: Readable<Tela> = derived([activePage, currentWindow], ([$p, $w]) => ($w !== null ? "mostrar" : (classeDaPagina($p as string) ?? "mostrar")))

export function telaAtual(): Tela {
    return get(tela)
}
/** o teclado so mexe na saida em Mostrar */
export const tecladoLivre = (): boolean => telaAtual() === "mostrar"
/** a regra A e D do plano: protege a saida / gesto da biblioteca que nao pode ir ao ar */
export const naoEMostrar = (): boolean => telaAtual() !== "mostrar"
export const emEditar = (): boolean => telaAtual() === "editar"

// ---------------------------------------------------------------- anteparo (chegada em Mostrar)

let ate = 0
/** o gesto que COMECAR nos proximos ANTEPARO_MS sobre a barra (fora do segmentado) e engolido inteiro. Sem store, sem timer. */
export function armarAnteparo(): void {
    ate = performance.now() + ANTEPARO_MS
}
export function anteparoAte(): number {
    return ate
}

// ---------------------------------------------------------------- a porta

/**
 * A unica porta de troca de tela. Retorna true se a pagina pedida e a que ficou. Chegar em Mostrar vindo de outra tela arma o anteparo
 * ANTES de escrever. Fora da janela principal nao faz nada (a saida nunca troca de tela).
 */
export function trocarTela(destino: TopViews, gesto: Gesto): boolean {
    try {
        if (!ehPrincipal()) return false
        const atual = get(activePage)
        const para = classeDaPagina(destino)
        // chegar em Mostrar arma o anteparo (regra do plano); chegar em Editar tambem (o segmentado ja armava nos dois sentidos desde a fatia 1)
        if ((para === "mostrar" || para === "editar") && para !== classeDaPagina(atual as string)) armarAnteparo()
        pelaPorta(() => activePage.set(destino))
        return get(activePage) === destino
    } catch (erro) {
        falhaAlta("trocar-tela:" + gesto, erro)
        return false
    }
}
