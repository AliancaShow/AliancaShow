// Revisao da fatia 2, achado 2 (DECISAO PROVISORIA do coordenador, o Andre confirma no PR): o teclado da SAIDA (setas, PageUp/PageDown do passador do
// pastor, Espaco, F1-F5, Esc) fica vivo em Mostrar E nas paginas do menu (Configuracoes, Telas, Ferramentas), como era na fatia 1. Em qualquer tela,
// com o foco num campo de texto a tecla e do campo (nao vai para a saida).
// Fatia 3 (decisao do Andre, plano 7/P2): em Editar o teclado da saida obedece SO ao Esc (limpa o telao, com a trava de 700 ms da fatia 2).
// Setas, Espaco, PageUp/PageDown e F1-F5 seguem mortos em Editar: la elas mexem no texto e nos itens do slide.
export type TelaDoTeclado = "mostrar" | "editar" | "pagina"

/** true = a tecla pode mexer na saida (nao e ignorada). `tecla` e o `e.key`; sem ela, a pergunta e "o teclado em geral" (Esc nao conta). */
export function tecladoVivo(tela: TelaDoTeclado, alvoEhCampoDeTexto: boolean, tecla?: string): boolean {
    if (tela === "editar") return tecla === "Escape" && !alvoEhCampoDeTexto
    if (tela === "pagina" && alvoEhCampoDeTexto) return false
    return true
}
