// Segmentado Mostrar | Editar (leiaute v2): qual aba aparece acesa. A fonte e a `tela` (derivada de `activePage`), a MESMA que o teclado obedece
// (`tecladoLivre`): o indicador nunca pode estar aceso diferente do teclado. Fatia 2: nao existe mais "estado cruzado" (pagina e modo
// discordando) porque so existe a pagina. Em paginas do menu (Configuracoes, Monitor de retorno, Desenho) nenhuma aba acende.
export type Marcado = "mostrar" | "editar" | null

export function marcadoDoSegmentado(tela: string): Marcado {
    return tela === "mostrar" ? "mostrar" : tela === "editar" ? "editar" : null
}
