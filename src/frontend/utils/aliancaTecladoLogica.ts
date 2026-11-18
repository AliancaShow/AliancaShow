// Revisao da fatia 2, achado 2 (DECISAO PROVISORIA do coordenador, o Andre confirma no PR): o teclado da SAIDA (setas, PageUp/PageDown do passador do
// pastor, Espaco, F1-F5, Esc) fica vivo em Mostrar E nas paginas do menu (Configuracoes, Telas, Ferramentas), como era na fatia 1. So em Editar ele
// morre. Em qualquer tela, com o foco num campo de texto a tecla e do campo (nao vai para a saida).
export type TelaDoTeclado = "mostrar" | "editar" | "pagina"

/** true = a tecla pode mexer na saida (nao e ignorada) */
export function tecladoVivo(tela: TelaDoTeclado, alvoEhCampoDeTexto: boolean): boolean {
    if (tela === "editar") return false
    if (tela === "pagina" && alvoEhCampoDeTexto) return false
    return true
}
