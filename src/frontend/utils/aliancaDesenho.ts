// Ferramentas da saida (pagina `draw`) em Editar: antes eram INERTES e calaram (cada botao fazia `if (gavetaNaoToca()) return`, e a regra `tela != mostrar` matava ate a pagina draw aberta pelo menu: a regra certa e `emEditar()`). A regra de
// que em Editar nada mexe no telao continua; o que muda e que a recusa agora e ALTA (faixa de falha) e o menu do app nem abre a pagina.
import { falhaAlta } from "./aliancaFalha"
import { emEditar } from "./aliancaTela"

export const MOTIVO_DESENHO = "As ferramentas da saída (desenhar, zoom, foco) não abrem em Editar. Volte para Mostrar."

/** true = em Editar: recusa e acende a faixa. Chamado pela entrada do menu e por cada botao de components/draw. */
export function desenhoBloqueado(): boolean {
    if (!emEditar()) return false
    falhaAlta("desenho-no-preparar", MOTIVO_DESENHO)
    return true
}
