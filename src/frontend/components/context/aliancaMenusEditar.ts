// Leiaute v2, fatia 3: os itens de menu de contexto de Editar (e "Editar" na linha de show da biblioteca), registrados AQUI e nao em `contextMenus.ts` /
// `menuClick.ts`. Esses dois arquivos fazem parte do fecho de imports da janela de SAIDA (a ancora de `scripts/prova-culto/ancora.mjs` os vigia); como o
// operador so abre menu de contexto na janela principal, os itens novos moram fora do fecho e a saida continua importando exatamente o que importava.
//
// Registro: `ContextMenu.svelte` importa este modulo, que acrescenta os itens e layouts aos mapas de `contextMenus.ts` (a mesma tabela que o menu le).
// `ContextItem.svelte` chama `acaoDeEditar(id)` antes de `menuClick`: se o id e daqui, a acao e esta; senao o fluxo de sempre.
import { get } from "svelte/store"
import { mandarSlideAoAr, prepararEdicaoDoShow } from "../../utils/aliancaEditarAcoes"
import { emEditar, trocarTela } from "../../utils/aliancaTela"
import { activeShow } from "../../stores"
import { contextMenuItems, contextMenuLayouts, type ContextMenuItem } from "./contextMenus"

const ITENS: { [id: string]: ContextMenuItem } = {
    // so em Editar: o botao direito na miniatura do slide. "Mandar so para" lista as telas (o monitor de retorno nao entra: decisao 5)
    alianca_ar: { label: "Mandar pro ar", icon: "play", iconColor: "#f21a27", translate: false },
    alianca_so: { label: "Mandar só para", icon: "play", iconColor: "#f21a27", items: ["LOAD_alianca_so"], translate: false },
    // linha de show da biblioteca: hoje so "Editar" (abre em Editar sem pôr no roteiro); o resto do menu da biblioteca e da fatia 6
    alianca_editar: { label: "Editar", icon: "edit", iconColor: "#97c7ff", translate: false }
}

const BASE_DO_SLIDE = ["slideGroups", "actions", "bind_to", "format", "remove_layers", "slide_transition", "disable", "SEPARATOR", "duplicate", "make_unique", "GROUP_slide_remove"]
const LAYOUTS: { [id: string]: string[] } = {
    // Editar: Mandar pro ar e Mandar so para em cima; o resto do menu do slide continua (grupo, acoes, duplicar, excluir...)
    slideEditar: ["alianca_ar", "alianca_so", "SEPARATOR", ...BASE_DO_SLIDE],
    slideChildEditar: ["alianca_ar", "alianca_so", "SEPARATOR", ...BASE_DO_SLIDE],
    show_drawer: ["alianca_editar"]
}
Object.assign(contextMenuItems, ITENS)
Object.assign(contextMenuLayouts, LAYOUTS)

type Chamada = { id: string; menu: ContextMenuItem; contextElem: HTMLElement | null; sel: { id?: string | null; data: any[] } | null }

const slideDaSelecao = (sel: Chamada["sel"]) => (sel?.id === "slide" ? sel.data?.[0] : null)

const ACOES: { [id: string]: (c: Chamada) => void } = {
    alianca_ar: ({ sel }) => {
        const slide = slideDaSelecao(sel)
        if (!emEditar() || !slide || typeof slide.index !== "number") return
        mandarSlideAoAr(slide.showId || get(activeShow)?.id || "", slide.index)
    },
    alianca_so: ({ sel, menu }) => {
        const slide = slideDaSelecao(sel)
        if (!emEditar() || !slide || typeof slide.index !== "number" || !menu.id) return
        mandarSlideAoAr(slide.showId || get(activeShow)?.id || "", slide.index, menu.id)
    },
    alianca_editar: ({ contextElem }) => {
        const id = contextElem?.closest?.("[data-show]")?.getAttribute("data-show") || ""
        if (!id) return
        prepararEdicaoDoShow(id)
        trocarTela("edit", "botao-direito")
    }
}

/** true = o clique era de um item daqui e foi tratado; false = segue para `menuClick` */
export function acaoDeEditar(chamada: Chamada): boolean {
    const acao = ACOES[chamada.id]
    if (!acao) return false
    acao(chamada)
    return true
}
