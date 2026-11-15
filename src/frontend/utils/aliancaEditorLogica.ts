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

// ----- fatia 8b: painel agrupado (a vista / Mais / Avancado) e alvo do rodape -----

export type Grupo = "vista" | "mais" | "avancado"
/** `true` = a secao inteira; `string[]` = so estes inputs (ver `idDoInput`). */
export type RegraGrupo = Record<string, true | string[]>
export type MapaGrupos = { vista: RegraGrupo; mais: RegraGrupo; avancado: RegraGrupo; rotulos: Record<string, string> }
type InputBruto = { id: string; key?: string }
type SecoesBrutas = Record<string, { inputs: InputBruto[][] }>

/** Identidade de um input dentro da secao (a mesma que o EditValues usa no `changed`). */
export const idDoInput = (i: InputBruto): string => i.id + (i.key || "")

const ROTULO_PARTIDA = "Mistura e espelho"

/**
 * O que fica a vista, em "Mais" e em "Avancado" no painel do Preparar. So reorganiza: nenhum input some.
 * Tipos sem mapa fino (timer, relogio, camera...) devolvem null e o painel continua como no Culto.
 * Secao ou input que nao esta no mapa (novo no upstream) cai em "avancado": nunca desaparece.
 */
export function mapaDeGrupos(origem: "box" | "item", tipo: string, secoes: SecoesBrutas): MapaGrupos | null {
    let base: MapaGrupos
    if (origem === "item") {
        base = { vista: { position: true }, mais: { default: true }, avancado: { transform: true, border: true, shadow: true, backdrop_filters: true, CSS: true }, rotulos: { "mais:default": "Fundo da caixa", "avancado:shadow": "Sombra da caixa" } }
    } else if (tipo === "text") {
        base = { vista: { default: true, align: true }, mais: { text: true, lines: true, list: true, outline: true, shadow: true, chords: true }, avancado: { scrolling: true, special: true, CSS: true }, rotulos: { "mais:shadow": "Sombra do texto" } }
    } else if (tipo === "media") {
        base = {
            vista: { default: ["src", "fit", "muted", "loop", "speed"] },
            mais: {},
            avancado: { default: ["blend", "flipped", "flippedY"], cropping: true, filters: true },
            rotulos: { "avancado:default": ROTULO_PARTIDA }
        }
    } else return null

    const mapa: MapaGrupos = { vista: { ...base.vista }, mais: { ...base.mais }, avancado: { ...base.avancado }, rotulos: { ...base.rotulos } }
    const grupos: Grupo[] = ["vista", "mais", "avancado"]
    for (const [id, secao] of Object.entries(secoes || {})) {
        const todos = (secao.inputs || []).flat().map(idDoInput)
        const citados = new Set<string>()
        let inteira = false
        for (const g of grupos) {
            const r = mapa[g][id]
            if (r === true) inteira = true
            else if (Array.isArray(r)) r.forEach((x) => citados.add(x))
        }
        if (inteira) continue
        if (!citados.size) {
            mapa.avancado[id] = true // secao desconhecida
            continue
        }
        const sobra = todos.filter((x) => !citados.has(x))
        if (!sobra.length) continue
        const atual = mapa.avancado[id]
        mapa.avancado[id] = [...(Array.isArray(atual) ? atual : []), ...sobra]
        if (!mapa.rotulos["avancado:" + id]) mapa.rotulos["avancado:" + id] = ROTULO_PARTIDA
    }
    return mapa
}

export type SecaoDoGrupo = { id: string; ids: string[] | null; rotulo?: string }

/** As secoes de um grupo, na ordem em que a lista `secoes` as traz. `ids` so vem preenchido quando a secao e partida. */
export function secoesDoGrupo(mapa: MapaGrupos, grupo: Grupo, secoes: SecoesBrutas): SecaoDoGrupo[] {
    const resultado: SecaoDoGrupo[] = []
    for (const id of Object.keys(secoes || {})) {
        const r = mapa[grupo][id]
        if (!r) continue
        const rotulo = mapa.rotulos[grupo + ":" + id]
        if (r === true) resultado.push({ id, ids: null, rotulo })
        else {
            const existentes = new Set((secoes[id].inputs || []).flat().map(idDoInput))
            const ids = r.filter((x) => existentes.has(x))
            if (ids.length) resultado.push({ id, ids, rotulo })
        }
    }
    return resultado
}

/** Grupo em que um input cai. Sem mapa (tipo sem agrupamento): tudo a vista. */
export function grupoDoInput(mapa: MapaGrupos | null, secaoId: string, inputId: string): Grupo {
    if (!mapa) return "vista"
    for (const g of ["vista", "mais", "avancado"] as Grupo[]) {
        const r = mapa[g][secaoId]
        if (r === true || (Array.isArray(r) && r.includes(inputId))) return g
    }
    return "avancado"
}

/** O grupo tem alguma secao (ou parte de secao) a mostrar? Grupo vazio nao desenha cabecalho. */
export function secaoTemAlgoNoGrupo(mapa: MapaGrupos, grupo: Grupo, secoes: SecoesBrutas): boolean {
    return secoesDoGrupo(mapa, grupo, secoes).length > 0
}

/** Linhas de inputs so com os ids pedidos; linha que fica vazia some. */
export function linhasFiltradas<T extends InputBruto>(linhas: T[][], ids: string[] | null): T[][] {
    if (!ids) return linhas
    return linhas.map((l) => l.filter((i) => ids.includes(idDoInput(i)))).filter((l) => l.length > 0)
}

export type AlvoRodape = "text" | "item" | "slide"

/**
 * O que o rodape de copiar/colar/redefinir do Preparar atinge. Com camada escolhida: o texto (ou a caixa, em template modo item).
 * Sem escolha: o estilo do slide, mas so num show (a copia do slide le o show ABERTO; em template/overlay gravaria no lugar errado).
 */
export function alvoDoRodape(e: { escolhidos: number; templateTextMode: boolean; templateItemMode: boolean; slideRemovido: boolean; tipo?: "show" | "template" | "overlay" }): AlvoRodape {
    if (e.escolhidos > 0) return e.templateItemMode ? "item" : "text"
    if ((e.tipo || "show") === "show" && !e.slideRemovido) return "slide"
    return e.templateItemMode ? "item" : "text"
}
