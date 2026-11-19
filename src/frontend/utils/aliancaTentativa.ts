// Rodada da cabine 18/nov, C3 + revisao do PR #40 (achado 1): a "ultima tentativa de mandar ao ar", gravada NA JANELA PRINCIPAL no ponto do clique.
// A recusa do modo "so retorno" (`falhaAlta("so-retorno-recusa")`) guarda so a mensagem da PRIMEIRA recusa da sessao, e quem a pede (`setOutput`) nao sabe o
// nome do item; a tarja casa "o contador subiu" com a tentativa que o clique deixou aqui (a recusa e sincrona). Nao toca o fecho da saida.
// Importa so `svelte/store`: nao entra no grafo da janela de saida.
import { get, writable } from "svelte/store"
import { nomeDoClique, type Tentativa } from "./aliancaTarjaLogica"

export const tentativa = writable<Tentativa | null>(null)

/** o clique/tecla que vai tentar mandar `nome` ao ar acabou de acontecer */
export function registrarTentativa(nome: string, agora = Date.now()): void {
    const n = String(nome || "").trim()
    if (n) tentativa.set({ nome: n, em: agora })
}

/** a tarja leu a tentativa: ela nao vale para a proxima recusa */
export function consumirTentativa(): Tentativa | null {
    const t = get(tentativa)
    tentativa.set(null)
    return t
}

/** clique em qualquer item de Mostrar deixa o nome dele (`[data-nome]`, ou o 1o texto do `.context`); o MediaCard grava o nome certo em seguida e vence */
export function ligarTentativas(): () => void {
    if (typeof window === "undefined") return () => {}
    const aoClique = (e: MouseEvent) => {
        try {
            const alvo = e.target instanceof Element ? e.target : null
            const n = alvo ? nomeDoClique(alvo as any) : ""
            if (n) registrarTentativa(n)
        } catch (erro) {
            // so um rotulo: nunca atrapalha o clique
        }
    }
    window.addEventListener("click", aoClique, true)
    return () => window.removeEventListener("click", aoClique, true)
}
