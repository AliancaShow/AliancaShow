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
