// Segmentado Mostrar | Editar (leiaute v2): qual aba aparece acesa. A fonte e o `modoAlianca`, a MESMA que o teclado obedece
// (`tecladoPodeMexerNaSaida`): o indicador nunca pode estar aceso diferente do teclado. Se a pagina em tela discorda do modo (estado cruzado,
// declarado em P3: duplo clique no slide, QuickSearch, desfazer...), a aba segue o modo e o segmentado ganha um contorno de alerta.
export type Marcado = "mostrar" | "editar" | null

export function marcadoDoSegmentado(pagina: string, modo: string): { marcado: Marcado; cruzado: boolean } {
    if (pagina !== "show" && pagina !== "edit") return { marcado: null, cruzado: false }
    const marcado: Marcado = modo === "preparar" ? "editar" : "mostrar"
    const daPagina: Marcado = pagina === "edit" ? "editar" : "mostrar"
    return { marcado, cruzado: marcado !== daPagina }
}
