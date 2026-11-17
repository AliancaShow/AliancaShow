// 1a, D10: a busca (Ctrl+G / F8) no Preparar por LISTA BRANCA de tipos e de ids. Puro: nao importa store.
// No Preparar nada vai ao ar: acao personalizada que roda macro, popup que cria saida ou que automatiza, vista da grade, tradução,
// transicao, "bible" (openScripture com play) ficam bloqueados com aviso. O que e de PREPARACAO (novo slide, inserir grupo, edicao de
// texto, os "novo...") volta por id explicito. Um id novo que nao esteja classificado reprova a guarda estatica
// (aliancaQuickSearchLogica.test.ts), que le o texto de quicksearch.ts.

/** tipos (chaves de `triggerActions`) que nenhum corpo escreve em `outputs` (corpos em quicksearch.ts) */
export const TIPOS_LIVRES_NO_PREPARAR = ["drawer_submenu", "project", "show", "media", "overlay", "stage_layout", "settings", "settings_output", "settings_styles", "settings_profiles", "settings_connection", "faq", "add_item_edit", "add_item_stage", "audio_playlist"]

/** tipos que se decidem pelo id (e pelo dado) */
export const TIPOS_POR_ID = ["custom_actions", "popups", "context_menu", "main_page"]

/** tipos negados por inteiro */
export const TIPOS_NEGADOS_NO_PREPARAR: Record<string, string> = {
    action: "roda acao (pode mandar ao ar)",
    bible: "openScripture com play (quicksearch.ts, tipo bible)"
}

/** acoes personalizadas permitidas (ids de showActions/editActions) */
export const ACOES_PERMITIDAS_NO_PREPARAR: Record<string, string> = {
    slide: "novo slide: menuClick newSlide so cria slide no show aberto",
    textedit: "alterna edicao de texto (editMode)"
}

export const ACOES_NEGADAS_NO_PREPARAR: Record<string, string> = {
    layout: "novo arranjo: arranjo fica fora do Preparar nesta pilha",
    groups: "abre aba de ferramenta ou troca a vista da grade",
    metadata: "abre aba de ferramenta",
    recording: "abre aba de gravacao",
    notes: "abre aba de ferramenta",
    next_timer: "popup de temporizador de slide",
    translate: "popup de traducao",
    grid: "vista da grade",
    list: "vista da grade",
    lyrics: "vista da grade",
    simple: "vista da grade"
}

export const POPUPS_PERMITIDOS_NO_PREPARAR: Record<string, string> = {
    show: "novo show",
    project: "novo projeto",
    category: "nova categoria",
    overlay: "nova sobreposicao",
    effect: "novo efeito",
    template: "novo modelo",
    timer: "novo cronometro",
    variable: "nova variavel",
    audio_stream: "novo stream de audio"
}

export const POPUPS_NEGADOS_NO_PREPARAR: Record<string, string> = {
    output: "cria saida: createOutput escreve em outputs (OutputsTabs.svelte)",
    style: "cria estilo de saida: configuracao da cabine, Configuracoes ja abre no Preparar",
    profile: "cria perfil: configuracao da cabine",
    action: "nova macro: automacao que pode rodar ao vivo",
    edit_event: "novo evento ou acao agendada: roda sozinha no horario",
    manage_groups: "gerenciar",
    manage_metadata: "gerenciar",
    manage_dynamic_values: "gerenciar",
    manage_icons: "gerenciar",
    manage_colors: "gerenciar",
    manage_emitters: "gerenciar emissores (saida de sinal)",
    transition: "transicao global: muda o proximo corte no telao",
    error_log: "abre o registro de erros"
}

export const CONTEXT_MENU_PERMITIDOS = ["save", "import_more", "export_more", "history", "shortcuts", "about", "fullscreen"]

/** paginas que a busca pode abrir no Preparar (activePage); o resto de `main_page` ou so abre aba da gaveta ou e negado */
export const PAGINAS_DA_BUSCA_NO_PREPARAR = ["show", "edit", "stage", "settings"]
/** ids de `main_page` que so abrem uma aba da gaveta (openDrawer) ou a lista de projetos: nunca escrevem em activePage com pagina fora da lista */
export const ABAS_DA_GAVETA_NA_BUSCA = ["shows", "media", "audio", "overlays", "templates", "scripture", "calendar", "functions", "projects"]

const so = (data: any, chave: string): boolean => !!data && typeof data === "object" && Object.keys(data).length === 1 && chave in data

function acaoPersonalizada(id: string, data: any): boolean {
    // grupo global: o id e do usuario, a FORMA do dado e que vale (data so com `globalGroup`)
    if (so(data, "globalGroup")) return true
    if (id === "slide") return data?.menuClick === "newSlide"
    if (id === "textedit") return !data || (typeof data === "object" && Object.keys(data).length === 0)
    return false
}

export function permitidoNoPreparar(tipo: string, id: string, data?: any): boolean {
    if (TIPOS_LIVRES_NO_PREPARAR.includes(tipo)) return true
    if (tipo === "custom_actions") return acaoPersonalizada(id, data)
    if (tipo === "popups") return Object.prototype.hasOwnProperty.call(POPUPS_PERMITIDOS_NO_PREPARAR, id)
    if (tipo === "context_menu") return CONTEXT_MENU_PERMITIDOS.includes(id)
    if (tipo === "main_page") return PAGINAS_DA_BUSCA_NO_PREPARAR.includes(id) || ABAS_DA_GAVETA_NA_BUSCA.includes(id)
    return false
}

export function textoDoBloqueio(tipo: string, id: string): string {
    if (tipo === "main_page" && id === "draw") return "Desenhar e Bíblia em tela cheia ficam no Culto."
    return "Use no Culto: isso não roda no Preparar."
}

// ---------------------------------------------------------------- extratores da guarda estatica (aceitam texto injetado)

function ate(src: string, abre: number, a: string, f: string): string {
    let n = 0
    for (let i = abre; i < src.length; i++) {
        if (src[i] === a) n++
        else if (src[i] === f && --n === 0) return src.slice(abre, i + 1)
    }
    return src.slice(abre)
}

const semComentarioDeLinha = (src: string) =>
    src
        .split("\n")
        .map((l) => (/^\s*\/\//.test(l) ? "" : l))
        .join("\n")

/** chaves de `const triggerActions = { ... }` (linhas `    chave: `) */
export function chavesDeTriggerActions(src: string): string[] {
    const limpo = semComentarioDeLinha(src)
    const i = limpo.indexOf("const triggerActions = {")
    if (i < 0) throw new Error("const triggerActions nao encontrado em quicksearch.ts")
    const corpo = ate(limpo, i + "const triggerActions = ".length, "{", "}")
    return [...corpo.matchAll(/^ {4}([a-z_]+): /gm)].map((m) => m[1])
}

function corpoDaLista(src: string, nome: string): string {
    const limpo = semComentarioDeLinha(src)
    const i = limpo.indexOf(`const ${nome} = [`)
    if (i < 0) throw new Error(`const ${nome} nao encontrado em quicksearch.ts`)
    return ate(limpo, i + `const ${nome} = `.length, "[", "]")
}

/** ids (`id: "..."` no inicio de cada item) de uma lista de quicksearch.ts */
export function idsDaLista(src: string, nome: string): string[] {
    return [...corpoDaLista(src, nome).matchAll(/^\s*\{\s*id:\s*"([^"]+)"/gm)].map((m) => m[1])
}

/** valores de `menuClick: "..."` dentro de uma lista */
export function menuClicksDaLista(src: string, nome: string): string[] {
    return [...corpoDaLista(src, nome).matchAll(/menuClick:\s*"([^"]+)"/g)].map((m) => m[1])
}
