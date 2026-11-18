// Leiaute v2, fatia 4: gestos da JANELA do app (nao da saida) que o menu do app oferece. Moram aqui, e nao no componente do menu, porque a
// guarda da barra (aliancaPilulaGuarda.test.ts) proibe `sendMain(` nos arquivos do topo: nada do topo fala com o processo principal por conta propria.
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { redo, undo } from "../components/helpers/history"
import { refreshListBoxes } from "../stores"
import { emEditar } from "./aliancaTela"
import { save } from "./save"

/** Ctrl+S: o menu do app e a porta com o mouse (fechar a janela ja salva sozinho) */
export function salvarAgora() {
    save()
}

// as caixas de edicao rapida da lista so redesenham quando elas mesmas mudam: depois de desfazer/refazer o texto tem que voltar (igual a utils/shortcuts.ts)
function atualizarCaixasDaLista() {
    if (emEditar()) setTimeout(() => refreshListBoxes.set(9999), 40)
}
/** Ctrl+Z */
export function desfazerAgora() {
    undo()
    atualizarCaixasDaLista()
}
/** Ctrl+Y / Ctrl+Shift+Z */
export function refazerAgora() {
    redo()
    atualizarCaixasDaLista()
}

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
