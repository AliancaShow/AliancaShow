// Roteiro enxuto (26/nov, pedido do André): os avisos de música do Sirvo ("✎ Rascunho: X — revise em Novas do Sirvo", "⚠ Falta criar: X",
// "⚠ Falta no PC: X") são gravados como `section` com data.sirvoFalta (aliancaSirvoMusicas.itemDe). Na lista eles viram uma linha comum
// dentro do bloco, com o nome da música e uma marca; a explicação vai para a dica ao passar o mouse. Só leitura: o item gravado não muda.

import { idDoRascunho } from "./aliancaSirvoMusicas"

export type TipoAviso = "rascunho" | "falta_criar" | "falta_pc"
export type AvisoDoRoteiro = { tipo: TipoAviso; nome: string; marca: string; dica: string }

type ItemLike = { type?: string; name?: string; data?: any } | null | undefined

export const ehAvisoDeMusica = (item: ItemLike): boolean => !!item && item.type === "section" && !!item.data?.sirvoFalta

const DICAS: Record<TipoAviso, string> = {
    rascunho: "Rascunho: a letra veio do Sirvo e ainda não foi revisada. Clique para revisar no Editar.",
    falta_criar: "Falta criar: esta música do Sirvo ainda não existe na biblioteca.",
    falta_pc: "Falta no PC: a música existe no Sirvo, mas não neste computador."
}

export function avisoDoRoteiro(item: ItemLike): AvisoDoRoteiro | null {
    if (!ehAvisoDeMusica(item)) return null
    const n = String(item!.name || "").trim()
    let m = n.match(/^✎\s*Rascunho:\s*(.*?)\s*—\s*revise em .*$/)
    if (m) return { tipo: "rascunho", nome: m[1] || "música", marca: "✎", dica: DICAS.rascunho }
    m = n.match(/^⚠\s*Falta no PC:\s*(.*)$/)
    if (m) return { tipo: "falta_pc", nome: m[1] || "música", marca: "⚠", dica: DICAS.falta_pc }
    m = n.match(/^⚠\s*Falta criar:\s*(.*)$/)
    if (m) return { tipo: "falta_criar", nome: m[1] || "música", marca: "⚠", dica: DICAS.falta_criar }
    return { tipo: "falta_criar", nome: n || "música", marca: "⚠", dica: DICAS.falta_criar }
}

/** o show-rascunho que o aviso representa (o id fixo que a montagem do Sirvo cria: idDoRascunho da linha); null se nao for rascunho */
export function showDoRascunho(item: ItemLike): string | null {
    const a = avisoDoRoteiro(item)
    const rm = item?.data?.sirvoMusica
    if (!a || a.tipo !== "rascunho" || typeof rm !== "string" || !rm) return null
    return idDoRascunho(rm)
}

export function contarAvisos(itens: ItemLike[]): { rascunhos: number; faltas: number } {
    let rascunhos = 0
    let faltas = 0
    for (const it of itens || []) {
        const a = avisoDoRoteiro(it)
        if (!a) continue
        if (a.tipo === "rascunho") rascunhos++
        else faltas++
    }
    return { rascunhos, faltas }
}
