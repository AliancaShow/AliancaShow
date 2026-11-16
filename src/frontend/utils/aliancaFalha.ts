// Falha ALTA (fatia R2): quando algo que o leiaute promete nao se cumpre, o codigo chama `falhaAlta(origem, erro)` em vez de engolir o erro.
// Acende a faixa de falha da janela principal (components/main/FaixaDeFalha.svelte), escreve no console e deixa rastro em disco.
// NUNCA lanca, NUNCA escreve em `outputs` e nunca mexe em nada da tela: so registra.
//
// Importa SO `svelte/store` (este arquivo entra no grafo da janela de saida) e nada assina store no nivel do modulo.
import { writable } from "svelte/store"

export type Falha = { origem: string; mensagem: string; vezes: number; primeiraEm: number }

export const falhas = writable<Falha[]>([])

type Registro = (f: { origem: string; mensagem: string; pilha: string }) => void
let registro: Registro | null = null
const contagem = new Map<string, number>()
const registradas = new Set<string>()

/** injeta o rastro em disco (startup.ts, janela principal). Na janela de saida nao ha registro: so console. */
export function configurarRegistroDeFalha(fn: Registro): void {
    registro = fn
}

export function falhaAlta(origem: string, erro: unknown): void {
    try {
        let mensagem: string
        try {
            mensagem = String((erro as any)?.message ?? erro)
        } catch (e) {
            // catch interno de falhaAlta: nao pode lancar
            mensagem = "(mensagem ilegivel)"
        }
        const vezes = (contagem.get(origem) ?? 0) + 1
        contagem.set(origem, vezes)
        if (vezes <= 20 || vezes % 100 === 0) {
            try {
                console.error("[AliancaShow] FALHA em " + origem + ":", erro)
            } catch (e) {
                // catch interno de falhaAlta: nao pode lancar
            }
        }
        falhas.update((lista) => {
            const i = lista.findIndex((f) => f.origem === origem)
            if (i < 0) return [...lista, { origem, mensagem, vezes: 1, primeiraEm: Date.now() }]
            const novo = lista.slice()
            novo[i] = { ...novo[i], vezes: novo[i].vezes + 1 }
            return novo
        })
        // so marca como registrada quando ha registro: falha anterior ao startup ainda deixa rastro na proxima vez
        if (registro && !registradas.has(origem)) {
            registradas.add(origem)
            try {
                let pilha = ""
                try {
                    pilha = String((erro as any)?.stack ?? "")
                } catch (e) {
                    // catch interno de falhaAlta: nao pode lancar
                }
                registro({ origem, mensagem, pilha })
            } catch (e) {
                // catch interno de falhaAlta: nao pode lancar
                console.error("[AliancaShow] falhaAlta nao registrou", e)
            }
        }
    } catch (e) {
        // catch interno de falhaAlta: nao pode lancar
        try {
            console.error("[AliancaShow] falhaAlta nao registrou", e)
        } catch (_) {
            // catch interno de falhaAlta: nao pode lancar
        }
    }
}

/** so testes */
export function _zerarFalhas(): void {
    falhas.set([])
    contagem.clear()
    registradas.clear()
    registro = null
}
