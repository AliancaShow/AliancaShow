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
