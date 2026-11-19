// Rodada da cabine 18/nov, C3: a tarja do "so retorno" que ocupa o lugar do cabecalho "NO AR" (32 px sempre). Pura (sem store, sem DOM).
// A recusa do modo NAO abre mais toast de canto: aparece na propria tarja, que pisca 0,9 s e fica invertida por 5 s.

export const TARJA_ALTURA = 32
export const RECUSA_MS = 5000
export const PISCA_MS = 900

export type EstadoDaTarja = "desligado" | "ligado" | "recusa"

/** o que a tarja mostra: desligado = o cabecalho de sempre; ligado = laranja; recusa (so com o modo ligado) = invertida com o que nao foi ao ar */
export function estadoDaTarja(soRetorno: boolean, recusa: boolean): EstadoDaTarja {
    if (!soRetorno) return "desligado"
    return recusa ? "recusa" : "ligado"
}

/** "Só retorno: só letra vai para o retorno — desligue o modo para mandar mídia" -> "mídia" (so o que foi recusado; sem o padrao, "item") */
export function oQueNaoFoiAoAr(mensagem: string | null | undefined): string {
    const m = /mandar (.+)$/.exec(String(mensagem ?? "").trim())
    return m ? m[1] : "item"
}

/** houve recusa nova desde a ultima olhada? (o contador de `so-retorno-recusa` so cresce) */
export const recusaNova = (vezes: number, vistas: number): boolean => vezes > vistas

/** a recusa e sincrona com o clique: uma tentativa gravada ha mais que isto nao e a desta recusa */
export const JANELA_TENTATIVA_MS = 1500
export type Tentativa = { nome: string; em: number }

/**
 * O que a tarja escreve depois de "Não foi ao ar:". Ordem: (1) o NOME da tentativa gravada no clique (so se recente); (2) com a PRIMEIRA recusa da sessao
 * (`vezes <= 1`) a mensagem ainda e a desta recusa, entao o tipo dela vale; (3) senao "item": nunca o tipo de uma recusa antiga (revisao do PR #40, achado 1).
 */
export function nomeDaRecusa(t: Tentativa | null | undefined, agora: number, vezes: number, mensagem: string | null | undefined): string {
    if (t && t.nome && agora - t.em >= 0 && agora - t.em <= JANELA_TENTATIVA_MS) return t.nome
    return vezes <= 1 ? oQueNaoFoiAoAr(mensagem) : "item"
}

/** o contador de partida de uma tarja que acaba de montar: recusas que ja existiam nao piscam de novo (achado 2) */
export function vezesJaVistas(lista: { origem: string; vezes: number }[] | null | undefined, origem = "so-retorno-recusa"): number {
    return (lista || []).find((f) => f.origem === origem)?.vezes ?? 0
}

export type AlvoComRotulo = { closest(seletor: string): AlvoComRotulo | null; getAttribute?(n: string): string | null; innerText?: string | null; textContent?: string | null }

/** o nome do que foi clicado: `data-nome` do ancestral, senao a 1a linha do texto do `.context` (so nas regioes de Mostrar). "" = sem nome. */
export function nomeDoClique(alvo: AlvoComRotulo): string {
    const marcado = alvo.closest("[data-nome]")?.getAttribute?.("data-nome")
    if (marcado && marcado.trim()) return marcado.trim().slice(0, 60)
    const ctx = alvo.closest('[data-regiao="centro"] .context, [data-regiao="roteiro"] .context, [data-regiao="biblioteca"] .context')
    const linha = String(ctx?.innerText ?? ctx?.textContent ?? "")
        .split(/\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 1)
    return linha ? linha.slice(0, 60) : ""
}
