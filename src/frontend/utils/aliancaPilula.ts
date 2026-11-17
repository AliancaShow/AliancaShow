// 1a, D2: os stores da pilula e dos chips do Preparar, o anteparo de 700 ms e o "abrir o primeiro pendente". A conta e do
// aliancaPilulaLogica.ts. Sem `.subscribe(` no nivel do modulo (a janela de saida importa a arvore de stores).
// Nada aqui escreve em `outputs`: abrir um item e so selecionar (como o clique no item do culto).
import { derived, get } from "svelte/store"
import { tick } from "svelte"
import { loadShows } from "../components/helpers/setShow"
import { swichProjectItem } from "../components/helpers/showActions"
import { activeEdit, activePage, activeProject, activeShow, categories, drawSettings, drawTool, editingProjectTemplate, modoAlianca, paintCache, projects, shows, showsCache, special, textCache } from "../stores"
import { itemPrecisaConferir, marcarConferidoPorIndice } from "./aliancaConferir"
import { abaLateral } from "./aliancaBibliotecaEstado"
import { falhaAlta } from "./aliancaFalha"
import { ultimoDoCulto } from "./aliancaGaveta"
import { chipChat, chipDesenho, chipRoteiro, desenhoAtivo, dicaDaPilula, naoChegou, pilulaClicavel, primeiroPendente, textoDaPilula, ANTEPARO_MS, type Chip } from "./aliancaPilulaLogica"
import { sirvo, sirvoAvisos, sirvoRoteiro } from "./aliancaSirvo"
import { sirvoChat } from "./aliancaSirvoChat"
import { sirvoMaterialEstado } from "./aliancaSirvoMaterial"
import { pendenciasDoCulto } from "./aliancaSemLetra"
import { showEstaSemLetra } from "./aliancaSemLetraLogica"

export { ANTEPARO_MS }

/** a chave de `aliancaConferir.ts` (const CHAVE, nao exportada; um teste confere que continua la) */
export const CHAVE_CONFERIDOS = "aliancaConferidos"

// ---------------------------------------------------------------- a pilula

export const pilula = derived([pendenciasDoCulto, sirvoMaterialEstado], ([$p, $m]) => {
    const n = { conferir: $p.conferir, semLetra: $p.semLetra, naoChegou: naoChegou($m as any) }
    const t = textoDaPilula(n)
    return { ...t, clicavel: pilulaClicavel(n), dica: dicaDaPilula(n, $m as any) }
})

export const chips = derived([sirvoAvisos, sirvoChat, sirvo, drawTool, drawSettings, paintCache], ([$avisos, $chat, $sirvo, $tool, $settings, $paint]): Chip[] => {
    const lista = [chipRoteiro($avisos as any), chipChat($chat as any, $sirvo.cultoId), chipDesenho(desenhoAtivo($tool, $settings, $paint as any))]
    return lista.filter((c): c is Chip => !!c)
})

/** a classe que o botao do item ativo tem dentro da lista do culto (MaterialButton: `class:isActive`), conferida por CDP na 1a */
export const SELETOR_ITEM_ATIVO = ".projectsWrap button.isActive"

/** clique na pilula: abre o 1o item que precisa conferir, ou o 1o sem letra. Sem projeto aberto (ou em template): nada. */
export async function abrirPrimeiroPendente(): Promise<void> {
    try {
        if (get(editingProjectTemplate)) return
        const projetoId = get(activeProject)
        if (!projetoId) return
        const projeto = get(projects)[projetoId]
        const itens = projeto?.shows || []
        const eventId = projeto?.sirvo?.eventId
        const roteiro = get(sirvoRoteiro) as any
        const conferidos = (get(special) as any)?.[CHAVE_CONFERIDOS]
        const [$shows, $categories, $showsCache, $textCache] = [get(shows), get(categories), get(showsCache), get(textCache)]
        const k = primeiroPendente(
            itens.length,
            (i) => itemPrecisaConferir(itens[i], eventId, roteiro, conferidos),
            (i) => (itens[i].type || "show") === "show" && showEstaSemLetra(itens[i].id, $shows, $categories, $showsCache, $textCache)
        )
        if (k === null) return
        const item = itens[k]
        const id = item.id
        // a lista do culto precisa estar a vista (na aba Biblioteca ela fica escondida por CSS)
        if (get(abaLateral) !== "culto") abaLateral.set("culto")
        // o mesmo que ShowButton.svelte (clique no item do projeto)
        ultimoDoCulto.set({ projetoId, index: k, id })
        marcarConferidoPorIndice(k)
        activeShow.set({ id, type: (item.type || "show") as any, index: k } as any)
        if ((item.type || "show") === "show") {
            setTimeout(async () => {
                try {
                    await loadShows([id])
                    if (get(showsCache)[id]) swichProjectItem(k, id)
                } catch (erro) {
                    falhaAlta("pilula-abrir-show", erro)
                }
            })
        }
        if (item.type === "image" || item.type === "video") activeEdit.set({ id, type: "media", items: [] })
        else if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [], showId: id })
        // rolar ate o item aberto (Q12: nao achado = so console.error, a abertura ja aconteceu)
        await tick()
        const ativo = document.querySelector(SELETOR_ITEM_ATIVO) as HTMLElement | null
        if (ativo) ativo.scrollIntoView({ block: "nearest" })
        else console.error("[AliancaShow] pilula: nao achei o item ativo da lista do culto para rolar (" + SELETOR_ITEM_ATIVO + ")")
    } catch (erro) {
        falhaAlta("pilula-abrir-pendente", erro)
    }
}

// ---------------------------------------------------------------- chips e anteparo

let ate = 0
/** o gesto que COMECAR nos proximos ANTEPARO_MS sobre a barra (fora do seletor de modo) e engolido inteiro. Sem store, sem timer. */
export function armarAnteparo(): void {
    ate = performance.now() + ANTEPARO_MS
}
export function anteparoAte(): number {
    return ate
}

/** clique em qualquer chip: arma o anteparo PRIMEIRO, depois a pagina, depois o modo. O chip so le: nao dispensa, nao marca lido, nao abre `draw`. */
export function irAoCulto(): void {
    armarAnteparo()
    activePage.set("show")
    modoAlianca.set("culto")
}
