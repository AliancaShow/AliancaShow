// ----- AliançaShow · editor no Preparar (fatia 8a) -----
//
// Logica PURA (sem store, sem DOM): o que o editor mostra/esconde no modo Preparar.
// No Culto cada funcao devolve o que o FreeShow ja fazia, para o editor ficar identico.

export type ModoAlianca = "culto" | "preparar"

/** Quem renderiza o EditTools (painel de estilo) na coluna da direita. Espelha o MainLayout. */
export function editToolsRenderizado(e: { pagina: string; tipoEdicao?: string; showExiste: boolean; focusMode: boolean; editMode: string }): boolean {
    if (e.pagina !== "edit") return false
    const tipo = e.tipoEdicao || "show"
    if (["media", "camera", "audio", "effect"].includes(tipo)) return false
    if (!(tipo === "overlay" || tipo === "template" || e.showExiste)) return false
    if (e.focusMode || (tipo === "show" && e.editMode !== "default")) return false
    return true
}

/**
 * A previa do telao some (display:none, NUNCA desmonta: ela cria os temporizadores de slide no ar)
 * so no Preparar e so quando o EditTools esta mesmo na coluna (senao a coluna ficaria vazia).
 */
export function previaEscondida(e: { modo: ModoAlianca; pagina: string; tipoEdicao?: string; showExiste: boolean; focusMode: boolean; editMode: string }): boolean {
    return e.modo === "preparar" && editToolsRenderizado(e)
}

/** Timeline do slide: ligada de verdade so no Culto. A flag `special.slideTimelineActive` nunca e gravada por aqui. */
export function timelineLigada(flag: boolean | undefined, modo: ModoAlianca): boolean {
    return !!flag && modo !== "preparar"
}

/** Painel de notas do slide: so no Culto. */
export function notasLigadas(flag: boolean | undefined, modo: ModoAlianca): boolean {
    return !!flag && modo !== "preparar"
}

/** Notas visiveis (faixa, icone na miniatura): so no Culto. */
export function notasVisiveis(temNotas: boolean, modo: ModoAlianca): boolean {
    return temNotas && modo !== "preparar"
}

/**
 * Esquerda do editor: lista de "recentes" no lugar dos slides?
 * Original: tem edicao de template/overlay, OU nao ha show aberto e ha historico, OU modo Texto.
 * No Preparar, com um show aberto, o modo Texto continua mostrando os slides.
 */
export function mostrarRecentes(e: { modo: ModoAlianca; editId: string; showAberto: boolean; temHistorico: boolean; editMode: string }): boolean {
    if (e.editId) return true
    if (!e.showAberto && e.temHistorico) return true
    if (e.editMode === "text_edit") return !(e.modo === "preparar" && e.showAberto)
    return false
}

/** Camadas: com 1 item (ou nenhum) abre recolhida; o usuario pode abrir. */
export function camadasAbertasPorPadrao(quantidade: number): boolean {
    return quantidade > 1
}

/** "+ Adicionar" no Preparar: o que fica a vista. O resto vai para "Mais". */
export const ITENS_A_VISTA = ["text", "media", "camera", "clock", "timer"]

type ItemMenu = { id: string; children?: ItemMenu[] }
type GrupoMenu<T extends ItemMenu> = { label?: string; items: T[] }

/**
 * Deriva o menu do Preparar a partir do `slideItems`: Texto, Midia, Camera, Timer e Relogio ficam a vista;
 * tabela, grafico e icone vao para dentro de "Mais". Nao muda o original e nao perde nenhum item.
 */
export function itensDoMenuAdicionar<T extends ItemMenu>(grupos: GrupoMenu<T>[]): GrupoMenu<T>[] {
    const movidos: T[] = []
    const resultado: GrupoMenu<T>[] = []
    for (const g of grupos) {
        const itens: T[] = []
        for (const it of g.items) {
            if (it.id === "more" || ITENS_A_VISTA.includes(it.id)) itens.push(it)
            else movidos.push(it)
        }
        if (itens.length) resultado.push({ ...g, items: itens })
    }
    if (!movidos.length) return resultado
    return resultado.map((g) => ({
        ...g,
        items: g.items.map((it) => (it.id === "more" ? ({ ...it, children: [...movidos, ...(it.children || [])] } as T) : it))
    }))
}

// ----- fatia 8b, passo 0: desfazer AGRUPADO -----

export type EntradaAgrupada = {
    id: "UPDATE"
    location: { page: "edit"; id: "show_key" }
    oldData: { id: string }
    newData: { key: "slides"; data: any; previousData: any }
    time: number
}

/**
 * Uma acao em grupo (colar/"em todos"/reset de varios slides) vira UMA entrada de historico: o estado dos slides antes e depois.
 * Devolve null se nada mudou (nao cria entrada nem limpa o "refazer"). `page: "edit"` para o history nao cair no `deselect()`.
 */
export function entradaAgrupada(showId: string, antes: any, depois: any, time: number): EntradaAgrupada | null {
    if (!showId) return null
    if (JSON.stringify(antes) === JSON.stringify(depois)) return null
    return { id: "UPDATE", location: { page: "edit", id: "show_key" }, oldData: { id: showId }, newData: { key: "slides", data: depois, previousData: antes }, time }
}
