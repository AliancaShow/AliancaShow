import { writable } from "svelte/store"
import { tela } from "./aliancaTela"
import { chegadaZeraBiblioteca, type TipoDaBiblioteca } from "./aliancaBibliotecaLogica"

// Os stores da aba Biblioteca do Preparar (FV-B), num módulo leve: o `aliancaAbasEditor` importa daqui sem puxar a gaveta,
// o histórico etc. Os efeitos estão em aliancaBiblioteca.ts. Tudo em memória (nada vai para o disco).

export type AbaLateral = "culto" | "biblioteca"

/** qual aba da coluna esquerda está na tela (só existe no Preparar; o Culto não tem abas) */
export const abaLateral = writable<AbaLateral>("culto")
export const buscaDaBiblioteca = writable("")
export const tipoDaBiblioteca = writable<TipoDaBiblioteca>("musicas")
export const soSemLetraNaBiblioteca = writable(false)

let iniciado = false

/**
 * Chamada pelo componente da barra (só a janela principal monta). Quando o modo deixa de ser Preparar, por qualquer
 * caminho (inclusive pelo editor, onde a barra nem está montada), a lateral volta para "Culto" e a busca limpa.
 * Idempotente. NÃO é chamada no nível do módulo: a janela de saída também importa os stores e não roda `startupMain`.
 */
export function iniciarEstadoDaBiblioteca() {
    if (iniciado) return
    iniciado = true
    let anterior: "mostrar" | "editar" | null = null
    tela.subscribe((t) => {
        const zera = chegadaZeraBiblioteca(anterior, t)
        if (t !== "pagina") anterior = t
        if (!zera) return
        abaLateral.set("culto")
        buscaDaBiblioteca.set("")
        tipoDaBiblioteca.set("musicas")
        soSemLetraNaBiblioteca.set(false)
    })
}
