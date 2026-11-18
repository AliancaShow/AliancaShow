// Fatia 2: as duas travas de gesto ligadas na janela principal (a conta e de aliancaToqueLogica.ts). Chamada uma vez por `AliancaTela`.
// Nada aqui escreve em `outputs`. Fora da janela principal nao e chamada (a janela de saida nao monta `AliancaTela`).
import { get } from "svelte/store"
import { activeEdit, activePopup, contextActive, quickSearchActive, selected, topContextActive } from "../stores"
import { dividirAberto } from "./aliancaDividir"
import { falhaAlta } from "./aliancaFalha"
import { listaAberta } from "./aliancaGavetaEstado"
import { arAutorizado } from "./aliancaGavetaToque"
import { emEditar, tela } from "./aliancaTela"
import { chaveDoClique, criarEscSeguro, criarRepeticao, escEngolidoPorRepeticao } from "./aliancaToqueLogica"

const esc = criarEscSeguro()
const repeticao = criarRepeticao<Element>()

/** Os popovers do leiaute chamam isto quando um Esc os FECHA (menu do app, pilulas, bloco, seletor). */
export function escFechou(): void {
    esc.fechou(performance.now())
}

/** o campo de texto com foco (um Esc o tira do foco) */
function campoComFoco(): boolean {
    const a = document.activeElement as HTMLElement | null
    if (!a || a === document.body) return false
    return a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)
}

/**
 * O menu "+ Caixa" (ItemAddMenu) fecha no proprio Esc, mas nao pode importar esta trava (a janela de saida importa o ItemAddMenu): a trava o ve no DOM.
 * Ele sai do DOM so depois do fade de fechar, entao no instante deste Esc ele ainda esta la.
 */
const menuDeItensAberto = (): boolean => !!document.querySelector?.('[data-acao="editar-adicionar-item"] .addMenu')

/** algo que ESTE Esc vai fechar ou desselecionar (olhado ANTES dos outros ouvintes) */
function algoParaFechar(): boolean {
    // em Editar o Esc tambem desseleciona a caixa do slide (imagem, forma, caixa arrastada): `clearAll` o sabe, a trava tambem tem de saber
    return !!(get(activePopup) || get(quickSearchActive) || get(contextActive) || get(topContextActive) || get(selected)?.id || campoComFoco() || (emEditar() && (get(activeEdit)?.items?.length || menuDeItensAberto())))
}

/**
 * Em Editar, a vista Dividir e a lista das marcacoes fecham com Esc. O Esc dessas vistas nao pode ser o mesmo que limpa o telao (`clearAll` nao as conhece):
 * um toque = uma coisa. So quando nada mais esta aberto que o Esc fecharia antes (popup, menu, busca, selecao, campo com foco).
 */
function vistaDeEditarParaFechar(): "dividir" | "lista" | null {
    if (!emEditar() || get(activePopup) || get(quickSearchActive) || get(contextActive) || get(topContextActive) || get(selected)?.id || campoComFoco()) return null
    if (get(dividirAberto)) return "dividir"
    if (get(listaAberta)) return "lista"
    return null
}

function aoEsc(e: KeyboardEvent) {
    try {
        if (e.key !== "Escape") return
        const agora = performance.now()
        if (escEngolidoPorRepeticao(e) || esc.segura(agora)) {
            // dentro da espera (ou tecla segurada): o Esc nao faz NADA (nem limpa o telao, nem fecha outra coisa)
            e.preventDefault()
            e.stopImmediatePropagation()
            e.stopPropagation()
            return
        }
        const vista = vistaDeEditarParaFechar()
        if (vista) {
            // fecha aqui mesmo e engole este Esc: o Preview nao chega a agendar o `clearAll`; o proximo espera os 700 ms
            if (vista === "dividir") dividirAberto.set(null)
            else listaAberta.set(false)
            esc.fechou(agora)
            e.preventDefault()
            e.stopImmediatePropagation()
            e.stopPropagation()
            return
        }
        if (algoParaFechar()) esc.fechou(agora)
    } catch (erro) {
        falhaAlta("esc-seguro", erro)
    }
}

/**
 * onde um duplo clique nao faz nada em Mostrar: um .context do centro (a grade de slides), da biblioteca e do roteiro (fatia 6: o duplo clique do FreeShow
 * que mandava ao ar ou punha no roteiro some; o clique so seleciona e ir ao ar e ▶, Ctrl+Enter ou o botao direito).
 */
const ITEM_DO_CENTRO = '[data-regiao="centro"] .context, [data-regiao="biblioteca"] .context, [data-regiao="roteiro"] .context'
/** campos de texto continuam recebendo o duplo clique (selecionar palavra, renomear) */
const CAMPO = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]'

const ponto = (e: MouseEvent) => ({ x: e.clientX, y: e.clientY })

/**
 * O mousedown de um item que seleciona sozinho (versiculo) pergunta antes: se o clique que vem em seguida vai ser engolido, a selecao nao anda,
 * senao a lista mostraria um item e o telao ficaria no outro (revisao da fatia 2, achado 4). Nao registra nada.
 */
export function cliqueVaiSerEngolido(e: MouseEvent): boolean {
    try {
        if (get(tela) !== "mostrar") return false
        const alvo = e.target instanceof Element ? e.target : null
        const chave = alvo ? chaveDoClique(alvo) : null
        return !!chave && repeticao.vaiEngolir(chave, performance.now(), ponto(e))
    } catch (erro) {
        falhaAlta("clique-repetido", erro)
        return false
    }
}

function aoClique(e: MouseEvent) {
    try {
        // so em Mostrar: em Editar o duplo clique e gesto de editar (marcar, renomear)
        if (get(tela) !== "mostrar") return
        // o clique sintetico do "Mostrar agora" e um gesto deliberado (a repeticao dele e engolida em aliancaGavetaToque, nao aqui)
        if (arAutorizado()) return
        const alvo = e.target instanceof Element ? e.target : null
        if (!alvo) return
        // duplo clique no slide de Mostrar: NAO faz nada (decisao do Andre: "gente clica 2x e o video dispara 2x"). Na biblioteca e no roteiro (fatia 6) vale
        // a mesma regra; fora o duplo clique, o clique repetido (< 400 ms no mesmo item) tambem e engolido.
        if (e.type === "dblclick") {
            if (!alvo.closest(ITEM_DO_CENTRO) || alvo.closest(CAMPO)) return
            e.preventDefault()
            e.stopImmediatePropagation()
            e.stopPropagation()
            return
        }
        // a chave e o clicavel mais interno (botao, slide, versiculo...), nao o conteiner; controles de transporte ficam de fora
        const chave = chaveDoClique(alvo)
        if (!chave) return
        if (repeticao.engole(chave, performance.now(), ponto(e))) {
            e.preventDefault()
            e.stopImmediatePropagation()
            e.stopPropagation()
        }
    } catch (erro) {
        falhaAlta("clique-repetido", erro)
    }
}

let ligado = false
export function ligarTravasDeToque(): () => void {
    if (ligado || typeof window === "undefined") return () => {}
    ligado = true
    window.addEventListener("keydown", aoEsc, true)
    window.addEventListener("click", aoClique, true)
    window.addEventListener("dblclick", aoClique, true)
    return () => {
        ligado = false
        window.removeEventListener("keydown", aoEsc, true)
        window.removeEventListener("click", aoClique, true)
        window.removeEventListener("dblclick", aoClique, true)
    }
}
