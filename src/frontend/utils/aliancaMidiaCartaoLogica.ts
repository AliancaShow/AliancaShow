// Rodada da cabine 18/nov, C1: o cartao de midia da biblioteca. Pura (sem store, sem DOM): o que o clique faz e como a duracao aparece.

import { CLIQUE_MIDIA_MS } from "./aliancaToqueLogica"

/** o clique repetido no MESMO cartao dentro desta janela e ignorado (decisao do dono: 0,7 s; so o cartao de midia, o resto de Mostrar segue com a trava de 400 ms) */
export const TRAVA_CARTAO_MS = CLIQUE_MIDIA_MS

/** `72` -> `1:12`; `3725` -> `1:02:05`; sem duracao valida -> "" (imagem e video que ainda nao leu nao mostram selo) */
export function formatarDuracao(segundos: number | null | undefined): string {
    if (typeof segundos !== "number" || !Number.isFinite(segundos) || segundos <= 0) return ""
    const total = Math.round(segundos)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const dois = (n: number) => String(n).padStart(2, "0")
    return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`
}

export type AcaoDoClique = "ao-ar" | "reiniciar" | "nada"

/**
 * O que o clique no THUMB faz. Midia ja no ar: video REINICIA (nunca limpa: limpar com um clique foi o acidente de 09/ago do Sirvo); imagem ja no ar nao
 * tem o que reiniciar, entao nao faz nada. Arquivo que sumiu nunca vai ao ar. Fora da trava de 700 ms (quem chama engole o repetido).
 */
export function acaoDoClique(e: { noAr: boolean; falta: boolean; tipo: string }): AcaoDoClique {
    if (e.falta) return "nada"
    if (e.noAr) return e.tipo === "video" ? "reiniciar" : "nada"
    return "ao-ar"
}

/** estados que o cartao desenha (um so vence; a ordem e a prioridade: arquivo sumido > no ar > trava) */
export function estadoDoCartao(e: { falta: boolean; noAr: boolean; trava: boolean }): "falta" | "ar" | "trava" | "repouso" {
    if (e.falta) return "falta"
    if (e.noAr) return "ar"
    if (e.trava) return "trava"
    return "repouso"
}

/** cache de duracao por arquivo: uma leitura por caminho, mesmo com varios cartoes pedindo ao mesmo tempo; no maximo `limite` leituras em curso */
export function criarCacheDeDuracao(ler: (caminho: string) => Promise<number>, limite = 2) {
    const prontos = new Map<string, number>()
    const emCurso = new Map<string, Promise<number>>()
    const fila: (() => void)[] = []
    let rodando = 0
    const proximo = () => {
        while (rodando < limite && fila.length) fila.shift()!()
    }
    return {
        /** o que ja se sabe (0 = ainda nao leu) */
        sabida: (caminho: string): number => prontos.get(caminho) || 0,
        pedir(caminho: string): Promise<number> {
            if (prontos.has(caminho)) return Promise.resolve(prontos.get(caminho)!)
            const feita = emCurso.get(caminho)
            if (feita) return feita
            const p = new Promise<number>((resolve) => {
                fila.push(() => {
                    rodando++
                    ler(caminho)
                        .catch(() => 0)
                        .then((d) => {
                            const v = Number.isFinite(d) && d > 0 ? d : 0
                            // duracao 0 (nao leu) nao entra no cache: o proximo pedido tenta de novo
                            if (v > 0) prontos.set(caminho, v)
                            emCurso.delete(caminho)
                            rodando--
                            resolve(v)
                            proximo()
                        })
                })
                proximo()
            })
            emCurso.set(caminho, p)
            return p
        },
        _lidos: () => prontos.size
    }
}
