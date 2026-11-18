// Modo "so retorno" (fatia 8 / 8b): o estado, os gestos (ligar/desligar) e o PONTO UNICO de desvio que o `setOutput` consulta. A parte pura vive em
// aliancaSoRetornoLogica.ts. Fica ligado ate o operador desligar (sem timer). Nao e persistido: uma sessao nova nasce desligada, e o
// `iniciarSoRetorno` (chamado UMA vez no startupMain) devolve qualquer `settings.output` que uma queda tenha deixado trocado.
// Importa so `svelte/store`, `../stores` e a logica pura: entra no grafo da janela de saida, onde `soRetorno` e sempre `false` (store por janela).
import { get, writable } from "svelte/store"
import { outputs, stageShows } from "../stores"
import { devolverFonte, idDeLeitura, idsDeRetorno, outVazio, porQueNaoLigar, roteamento, slideDoTelao, temMarca, trocarFonte } from "./aliancaSoRetornoLogica"

export const soRetorno = writable(false)

/** o modo esta ligado AGORA? (os caminhos que limpam o telao antes de enviar consultam isto) */
export const soRetornoLigado = (): boolean => get(soRetorno)

export const retornosLigados = () => idsDeRetorno(get(outputs) as any)
export const porQueNaoLigarSoRetorno = () => porQueNaoLigar(retornosLigados())

let desvio = 0
/** executa `fn` SEM desvio: o que nao e envio (ajustes do que ja esta no ar, limpezas parciais) continua falando com o telao */
export function semDesvio<T>(fn: () => T): T {
    desvio++
    try {
        return fn()
    } finally {
        desvio--
    }
}

/** suspende o desvio ate chamar a funcao devolvida (sem quadro extra na pilha: a prova do Culto atribui cada escrita a quem a pediu) */
export function suspenderDesvio(): () => void {
    desvio++
    return () => {
        desvio--
    }
}

/** onde o envio ao ar vai AGORA: `null` = comportamento normal; senao os retornos (lista vazia = descartar, nunca o telao) */
export function destinoDoEnvio(data: unknown): string[] | null {
    const r = roteamento(get(soRetorno), desvio, retornosLigados(), data)
    return r.desvia ? r.ids : null
}

/** de que saida ler "o slide atual" (as setas): no modo, o retorno */
export const saidaDeLeitura = (id: string): string => idDeLeitura(get(soRetorno), retornosLigados(), id)

let tocadas: string[] = []

export function ligarSoRetorno(): { ok: boolean; motivo: string } {
    if (get(soRetorno)) return { ok: true, motivo: "" }
    const motivo = porQueNaoLigarSoRetorno()
    if (motivo) return { ok: false, motivo }
    const ids = retornosLigados()
    const o = get(outputs) as any
    tocadas = ids
    // ORDEM (R1): o modo liga ANTES de trocar a fonte, senao o assinante de recuperacao ve "desligado + marca" e desfaz a troca na hora
    soRetorno.set(true)
    stageShows.update(
        (s) =>
            trocarFonte(
                s as any,
                ids.map((id) => ({ id, layout: o[id].stageOutput }))
            ) as any
    )
    // R3: o retorno segue mostrando o que o telao mostra (nao apaga o monitor do pastor no meio da musica)
    const slide = slideDoTelao(o)
    outputs.update((a: any) => {
        for (const id of ids) if (a[id]) a[id].out = { ...outVazio(), slide: slide ? JSON.parse(JSON.stringify(slide)) : null }
        return a
    })
    return { ok: true, motivo: "" }
}

/** desliga, devolve a fonte do layout e esvazia o `out` INTEIRO dos retornos que o modo tocou (o telao nao e tocado) */
export function desligarSoRetorno() {
    if (!get(soRetorno)) return
    const ids = Array.from(new Set([...tocadas, ...retornosLigados()]))
    soRetorno.set(false)
    tocadas = []
    stageShows.update((s) => devolverFonte(s as any) as any)
    outputs.update((a: any) => {
        for (const id of ids) if (a[id]) a[id].out = outVazio()
        return a
    })
}

let iniciado = false
/**
 * Chamado UMA vez na partida da janela principal (startupMain), nao por componente (R2): (1) devolve o que uma queda com o modo ligado deixou trocado,
 * quando os layouts terminam de carregar; (2) R4: se o retorno some (desabilitado/removido) com o modo ligado, desliga e avisa em `aoDesligarSozinho`.
 */
export function iniciarSoRetorno(aoDesligarSozinho: (motivo: string) => void = () => {}): () => void {
    if (iniciado) return () => {}
    iniciado = true
    const a = stageShows.subscribe((s) => {
        if (!get(soRetorno) && temMarca(s as any)) stageShows.update((x) => devolverFonte(x as any) as any)
    })
    const b = outputs.subscribe((o) => {
        if (get(soRetorno) && !idsDeRetorno(o as any).length) {
            desligarSoRetorno()
            aoDesligarSozinho("O monitor de retorno saiu com o modo só retorno ligado: o modo foi desligado.")
        }
    })
    return () => {
        a()
        b()
        iniciado = false
    }
}
