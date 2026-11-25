// Modelos de retorno (André, 25/nov, "aprovo papeis-saida": Telas = onde aparece, Modelos = como fica, Visual = o que vai para onde). O editor de
// retorno do FreeShow (a pagina "stage") sai do menu ⋯ e passa a abrir pela aba "Retorno" de Editar > Modelos; o cabecalho da pagina diz
// "Modelos de retorno" e o Fechar volta para Editar > Modelos. Ele continua sendo a pagina "stage" porque copiar/colar/apagar/"+ item" do
// editor de retorno so funcionam com activePage === "stage".
import { activeStage } from "../stores"
import { modoDoEditar } from "./aliancaEditarEstado"
import { trocarTela } from "./aliancaTela"

/** abre os modelos de retorno (opcional: ja com um modelo aberto) */
export function abrirModelosDeRetorno(id = ""): void {
    if (id) activeStage.set({ id, items: [] })
    trocarTela("stage", "botao-de-pagina")
}

/** volta para Editar > Modelos (os modelos de slides) */
export function abrirModelosDeSlides(): void {
    modoDoEditar.set("modelos")
    trocarTela("edit", "botao-de-pagina")
}
