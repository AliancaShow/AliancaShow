// Ferramentas da saida (pagina `draw`) em Editar: antes eram INERTES e calaram (cada botao fazia `if (gavetaNaoToca()) return`). A regra de
// que em Editar nada mexe no telao continua; o que muda e que a recusa agora e ALTA (faixa de falha) e o menu do app nem abre a pagina.
import { falhaAlta } from "./aliancaFalha"
import { gavetaNaoToca } from "./aliancaModo"

export const MOTIVO_DESENHO = "As ferramentas da saída (desenhar, zoom, foco) só funcionam em Mostrar. Volte para Mostrar."

/** true = em Editar: recusa e acende a faixa. Chamado pela entrada do menu e por cada botao de components/draw. */
export function desenhoBloqueado(): boolean {
    if (!gavetaNaoToca()) return false
    falhaAlta("desenho-no-preparar", MOTIVO_DESENHO)
    return true
}
