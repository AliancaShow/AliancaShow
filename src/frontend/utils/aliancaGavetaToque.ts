// Leiaute v2, fatia 6: a regra unica da biblioteca. Um clique num item da biblioteca SO SELECIONA (a previa); ir ao ar e o ▶, Ctrl+Enter ou o
// botao direito -> "Mostrar agora". EXCECAO (cabine 18/nov, B1): em Mostrar, o clique simples numa MIDIA (video ou imagem) vai ao ar, como no ProPresenter (`MediaCard`, via `autorizarAr`); show, letra, versiculo e o resto seguem so selecionando.
// A guarda das portas da gaveta (`if (gavetaNaoToca()) return`) vale SEMPRE, em Mostrar e em Editar,
// salvo dentro de `autorizarAr`, que so o ▶ e o "Mostrar agora" abrem (um gesto deliberado do operador, de forma sincrona).
//
// Antes (fatias 1-5) `gavetaNaoToca` morava em `aliancaModo.ts` e valia `tela != mostrar`. Aquele arquivo faz parte do fecho da janela de saida (a ancora o
// vigia) e nao pode mudar sem excecao, entao a regra nova mora aqui, fora do fecho: so a janela principal a importa.
import { falhaAlta } from "./aliancaFalha"
import { naoEMostrar } from "./aliancaTela"

let abertas = 0

/** true: o item da biblioteca NAO toca o telao. So devolve false dentro de `autorizarAr`. */
export function gavetaNaoToca(): boolean {
    return abertas === 0
}

/** quem esta dentro de `autorizarAr` (a trava global de clique repetido, que e outro assunto, nao engole o gesto sintetico) */
export function arAutorizado(): boolean {
    return abertas > 0
}

/** Roda `fn` com a guarda da gaveta levantada. Sincrono: a guarda de cada porta e a PRIMEIRA linha do handler, entao isto basta. Nunca deixa a guarda aberta. */
export function autorizarAr<T>(fn: () => T): T {
    abertas++
    try {
        return fn()
    } finally {
        abertas--
    }
}

/** o clique "marca para levar ao culto" so fora de Mostrar (em Mostrar o clique e so a previa; nada fica marcado e escondido) */
export function podeMarcar(): boolean {
    return naoEMostrar()
}

/**
 * "Mostrar agora": refaz, no mesmo elemento em que o operador clicou com o botao direito, o clique que a biblioteca fazia antes da fatia 6, com a guarda
 * levantada. O alvo e o elemento MAIS INTERNO do clique (a `contextmenu` e capturada), nao o conteiner `.context`: assim passa por todos os handlers do item.
 * Versiculo: o que o antigo "duplo clique" fazia (o clique so previa); os demais: o clique.
 */
export function dispararNoAlvo(alvo: Element | null, tipo: "click" | "dblclick" = "click"): boolean {
    // sem item e defeito de codigo (faixa de falha); o item que SAIU da tela entre o botao direito e o clique (a lista recriou os cartoes: o Sirvo acabou de
    // baixar um arquivo, o roteiro mudou) e situacao normal de culto: so avisa o operador (revisao da fatia 6, achado 10)
    if (!alvo) {
        falhaAlta("mostrar-agora", "o menu nao achou o item em que o botao direito foi dado")
        return false
    }
    // (quem chama avisa o operador: este arquivo nao importa `common`, que arrasta componentes de popup e quebra os testes de logica que o importam)
    if (!(alvo as HTMLElement).isConnected) return false
    autorizarAr(() => alvo.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window, detail: tipo === "dblclick" ? 2 : 1 })))
    return true
}
