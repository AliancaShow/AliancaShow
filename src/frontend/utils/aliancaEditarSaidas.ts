// Leiaute v2, fatia 3 (conta pura): quais saidas o "Mandar so para" do botao direito lista. So tela de verdade (ligada); o monitor de retorno e a chave
// ficam fora (decisao 5: o retorno e um MODO ao lado da mensagem pro palco, fatia 8, nao um item do menu).
export type SaidaCandidata = { id: string; name?: string; enabled?: boolean; stageOutput?: boolean; isKeyOutput?: boolean }

export function saidasParaMandar(saidas: SaidaCandidata[]): { id: string; nome: string }[] {
    const validas = (saidas || []).filter((s) => s && s.enabled === true && !s.stageOutput && !s.isKeyOutput)
    return validas.map((s, i) => ({ id: s.id, nome: (s.name || "").trim() || `Saída ${i + 1}` }))
}

/** "Mandar so para" so faz sentido com duas ou mais telas: com uma so seria o mesmo que "Mandar pro ar" */
export function mostrarMandarSo(saidas: { id: string }[]): boolean {
    return saidas.length >= 2
}

/**
 * Para que saidas um envio de slide vai: a tela pedida (o "Mandar so para"), senao as telas ligadas ao slide (`bind_to`), senao todas as ativas.
 * E a mesma regra de `setOutput`/`updateOut`; ela e repetida aqui para o "mandar de novo" so tocar nas saidas que o envio tocou.
 */
export function destinosDoEnvio(e: { saidas?: string[]; bindings?: string[] | null; ativas: string[] }): string[] {
    if (e.saidas?.length) return e.saidas
    return e.bindings && e.bindings.length ? e.bindings : e.ativas
}

/** dessas saidas, as que ja estavam NESTE slide (mesmo show, layout e posicao): so elas ganham foto nova */
export function jaMostramOSlide(saidas: { id: string; slide?: { id?: string; layout?: string; index?: number } | null }[], showId: string, layout: string, index: number): string[] {
    return saidas.filter((o) => o.slide?.id === showId && o.slide.layout === layout && o.slide.index === index).map((o) => o.id)
}
