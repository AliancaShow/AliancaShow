// Leiaute v2, fatia 4: gestos da JANELA do app (nao da saida) que o menu do app oferece. Moram aqui, e nao no componente do menu, porque a
// guarda da barra (aliancaPilulaGuarda.test.ts) proibe `sendMain(` nos arquivos do topo: nada do topo fala com o processo principal por conta propria.
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"

/** F11 ja fazia isto (utils/shortcuts.ts); o menu do app e a porta com o mouse */
export function alternarTelaCheia() {
    sendMain(Main.FULLSCREEN)
}

/** so em dev: o processo principal ignora o pedido em producao */
export function alternarFerramentasDeDev() {
    sendMain(Main.TOGGLE_DEVTOOLS)
}

export function recarregarJanela() {
    location.reload()
}
