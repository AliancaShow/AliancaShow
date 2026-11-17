// 1b, D8: a guarda de paginas do Preparar (lista branca, Q14) e a volta ao `show` (decisao 9). So a janela principal assina; a de saida sai
// cedo. Nada aqui escreve em `outputs`. Nao existe modo antigo: o que nao esta previsto quebra ALTO (`falhaAlta`), nunca cai calado.
//
// Sem `.subscribe(` no nivel do modulo (a janela de saida importa o grafo de stores): so dentro de `iniciarMolduraAlianca()`.
import { get, readable, writable } from "svelte/store"
import { activePage, currentWindow, modoAlianca } from "../stores"
import { falhaAlta } from "./aliancaFalha"
import type { TopViews } from "../../types/Tabs"
import { alvoDeVoltar, paginaAnteriorDepois, paginaPermitida, textoDaRecusa } from "./aliancaMolduraLogica"
import { newToast } from "./common"

const anteriorInterno = writable<string | null>(null)
/** de onde o operador veio ao entrar em `stage` ou `settings` no Preparar (so leitura; `voltarDaPagina` usa e zera) */
export const paginaAnterior = readable<string | null>(null, (set) => {
    // a assinatura vive DENTRO da funcao de partida: nada assina no nivel do modulo
    return anteriorInterno.subscribe(set)
})

let iniciado = false
let soltar: (() => void)[] = []
/** a ultima pagina PERMITIDA que passou (o `alvoSeguro` e a origem de `paginaAnterior`) */
let anterior: string = "show"

/** para onde um redirecionamento leva: a ultima pagina permitida, ou `show` */
function alvoSeguro(): TopViews {
    return (paginaPermitida("preparar", anterior) ? anterior : "show") as TopViews
}

/** pagina nao permitida no Preparar: na proxima microtarefa volta a uma pagina segura, avisa, e confere que pegou (Q15) */
function redirecionar(pagina: unknown) {
    queueMicrotask(() => {
        try {
            if (get(modoAlianca) !== "preparar" || get(activePage) !== pagina) return
            activePage.set(alvoSeguro())
            newToast(textoDaRecusa(pagina))
            if (!paginaPermitida("preparar", get(activePage))) falhaAlta("guarda-de-pagina: redirecionamento nao pegou", pagina)
        } catch (erro) {
            falhaAlta("guarda-de-pagina", erro)
        }
    })
}

/**
 * Volta da moldura (Voltar e Pronto, e o Esc): `stage`/`settings` voltam a de onde vieram, o editor volta a `show`, o resto a `show`.
 * Nao salva nada. Zera a lembranca depois de escrever (a escrita passa pela guarda, que lembraria a pagina que sai).
 */
export function voltarDaPagina() {
    const alvo = alvoDeVoltar({ pagina: get(activePage), anterior: get(anteriorInterno) })
    activePage.set(alvo)
    anteriorInterno.set(null)
    if (get(activePage) !== alvo) falhaAlta("voltar-da-pagina: nao voltou", get(activePage))
}

export function iniciarMolduraAlianca() {
    if (get(currentWindow)) return
    if (iniciado) return
    iniciado = true
    let modoVisto: string | null = null
    let primeira = true

    const naPagina = (pagina: string) => {
        try {
            const modo = get(modoAlianca)
            if (modo !== "preparar") {
                anteriorInterno.set(null)
                anterior = pagina
                return
            }
            if (!paginaPermitida("preparar", pagina)) {
                redirecionar(pagina)
                return
            }
            anteriorInterno.set(paginaAnteriorDepois({ modo, de: anterior, para: pagina, atual: get(anteriorInterno) }))
            anterior = pagina
        } catch (erro) {
            falhaAlta("guarda-de-pagina", erro)
        }
    }

    const noModo = (modo: string) => {
        try {
            const veioDoPreparar = modoVisto === "preparar"
            modoVisto = modo
            if (modo === "preparar") {
                queueMicrotask(() => {
                    try {
                        if (get(modoAlianca) !== "preparar") return
                        const pagina = get(activePage)
                        if (!paginaPermitida("preparar", pagina)) redirecionar(pagina)
                    } catch (erro) {
                        falhaAlta("guarda-de-pagina", erro)
                    }
                })
                return
            }
            anteriorInterno.set(null)
            if (!veioDoPreparar) return
            // decisao 9: `stage` e `settings` nao tem volta no Culto. A microtarefa olha o estado DEPOIS das outras escritas da troca de modo.
            queueMicrotask(() => {
                try {
                    if (get(modoAlianca) === "culto" && ["stage", "settings"].includes(get(activePage))) {
                        activePage.set("show")
                        if (get(activePage) !== "show") falhaAlta("decisao-4: nao voltou para show", get(activePage))
                    }
                } catch (erro) {
                    falhaAlta("guarda-de-pagina", erro)
                }
            })
        } catch (erro) {
            falhaAlta("guarda-de-pagina", erro)
        }
    }

    soltar = [
        modoAlianca.subscribe((m) => noModo(String(m))),
        activePage.subscribe((p) => {
            if (primeira) anterior = String(p)
            primeira = false
            naPagina(String(p))
        })
    ]
}

/** So dev (para a prova religar com `iniciarMolduraAlianca()`). Fora de dev nao desliga: e falha alta (Q16). */
export function _pararMolduraAlianca() {
    if (!import.meta.env.DEV) {
        falhaAlta("parar-moldura-fora-de-dev", new Error("_pararMolduraAlianca fora de dev"))
        return
    }
    soltar.forEach((f) => f())
    soltar = []
    iniciado = false
    anteriorInterno.set(null)
}
