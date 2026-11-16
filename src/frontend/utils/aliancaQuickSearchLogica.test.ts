// 1a, D10 + Q10: lista branca da busca no Preparar e a guarda estatica que le o texto de quicksearch.ts.
//
// O QUE ESTA GUARDA NAO COBRE: itens de lista montados fora das tres listas (showActions, editActions, popups) e entradas escritas em
// mais de uma linha (o extrator le o `id:` que abre a linha do item).
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"
import { ABAS_DA_GAVETA_NA_BUSCA, ACOES_NEGADAS_NO_PREPARAR, ACOES_PERMITIDAS_NO_PREPARAR, CONTEXT_MENU_PERMITIDOS, chavesDeTriggerActions, idsDaLista, menuClicksDaLista, PAGINAS_DA_BUSCA_NO_PREPARAR, permitidoNoPreparar, POPUPS_NEGADOS_NO_PREPARAR, POPUPS_PERMITIDOS_NO_PREPARAR, textoDoBloqueio, TIPOS_LIVRES_NO_PREPARAR, TIPOS_NEGADOS_NO_PREPARAR, TIPOS_POR_ID } from "./aliancaQuickSearchLogica"

const RAIZ = join(__dirname, "..", "..", "..")
const QS = readFileSync(join(RAIZ, "src/frontend/components/quicksearch/quicksearch.ts"), "utf8").replace(/\r\n/g, "\n")

/** a guarda estatica: devolve a lista de problemas do texto de quicksearch.ts */
export function problemasDaBusca(src: string, popupsNegados: Record<string, string> = POPUPS_NEGADOS_NO_PREPARAR): string[] {
    const erros: string[] = []
    const tipos = chavesDeTriggerActions(src)
    const destinos = [TIPOS_LIVRES_NO_PREPARAR, TIPOS_POR_ID, Object.keys(TIPOS_NEGADOS_NO_PREPARAR)]
    for (const t of tipos) {
        const n = destinos.filter((d) => d.includes(t)).length
        if (n !== 1) erros.push(`tipo sem destino unico: ${t} (em ${n} listas)`)
    }
    for (const d of destinos) for (const t of d) if (!tipos.includes(t)) erros.push(`lista cita tipo que nao existe em triggerActions: ${t}`)

    const acoes = [...idsDaLista(src, "showActions"), ...idsDaLista(src, "editActions")]
    for (const id of acoes) {
        const n = Number(id in ACOES_PERMITIDAS_NO_PREPARAR) + Number(id in ACOES_NEGADAS_NO_PREPARAR)
        if (n !== 1) erros.push(`acao nao classificada: ${id}`)
    }
    for (const id of [...Object.keys(ACOES_PERMITIDAS_NO_PREPARAR), ...Object.keys(ACOES_NEGADAS_NO_PREPARAR)]) if (!acoes.includes(id)) erros.push(`lista de acoes cita id que nao existe: ${id}`)

    const popups = idsDaLista(src, "popups")
    for (const id of popups) {
        const n = Number(id in POPUPS_PERMITIDOS_NO_PREPARAR) + Number(id in popupsNegados)
        if (n !== 1) erros.push(`popup nao classificado: ${id}`)
    }
    for (const id of [...Object.keys(POPUPS_PERMITIDOS_NO_PREPARAR), ...Object.keys(popupsNegados)]) if (!popups.includes(id)) erros.push(`lista de popups cita id que nao existe: ${id}`)

    for (const nome of ["showActions", "editActions"]) for (const m of menuClicksDaLista(src, nome)) if (m !== "newSlide") erros.push(`menuClick diferente de newSlide em ${nome}: ${m}`)
    if (!/data:\s*\{\s*globalGroup\s*\}/.test(src)) erros.push("getShowActions nao monta mais os grupos com data: { globalGroup }")
    return erros
}

describe("busca no Preparar: guarda estatica (Q10)", () => {
    it("o texto real de quicksearch.ts nao tem problema", () => {
        expect(problemasDaBusca(QS)).toEqual([])
    })
    it("mutacao: tipo novo em triggerActions reprova", () => {
        const m = QS.replace("const triggerActions = {", "const triggerActions = {\n    nova_coisa: () => {},")
        expect(problemasDaBusca(m).join("|")).toContain("tipo sem destino unico: nova_coisa")
    })
    it("mutacao: popup novo sem classificacao reprova", () => {
        const m = QS.replace("const popups = [", 'const popups = [\n    { id: "nova", name: "x" },')
        expect(problemasDaBusca(m).join("|")).toContain("popup nao classificado: nova")
    })
    it("mutacao: acao nova com menuClick diferente reprova (id e menuClick)", () => {
        const m = QS.replace("const showActions = [", 'const showActions = [\n    { id: "apagar", data: { menuClick: "delete" } },')
        const r = problemasDaBusca(m).join("|")
        expect(r).toContain("acao nao classificada: apagar")
        expect(r).toContain("menuClick diferente de newSlide em showActions: delete")
    })
    it("mutacao: tirar output de POPUPS_NEGADOS reprova", () => {
        const copia = { ...POPUPS_NEGADOS_NO_PREPARAR } as Record<string, string>
        delete copia.output
        expect(problemasDaBusca(QS, copia)).toContain("popup nao classificado: output")
    })
    it("os extratores enxergam as listas reais", () => {
        expect(chavesDeTriggerActions(QS)).toContain("custom_actions")
        expect(idsDaLista(QS, "showActions")).toContain("slide")
        expect(idsDaLista(QS, "popups")).toContain("output")
        expect(menuClicksDaLista(QS, "showActions")).toEqual(["newSlide"])
    })
})

describe("busca no Preparar: decisao", () => {
    it("action e bible negados; tipo desconhecido negado", () => {
        expect(permitidoNoPreparar("action", "x")).toBe(false)
        expect(permitidoNoPreparar("bible", "x", { play: true })).toBe(false)
        expect(permitidoNoPreparar("tipo_que_nao_existe", "x")).toBe(false)
    })
    it("tipos livres passam", () => {
        for (const t of TIPOS_LIVRES_NO_PREPARAR) expect(permitidoNoPreparar(t, "qualquer")).toBe(true)
    })
    it("slide so com menuClick newSlide", () => {
        expect(permitidoNoPreparar("custom_actions", "slide", { menuClick: "newSlide" })).toBe(true)
        expect(permitidoNoPreparar("custom_actions", "slide", { menuClick: "delete" })).toBe(false)
        expect(permitidoNoPreparar("custom_actions", "slide")).toBe(false)
    })
    it("textedit sem dado", () => {
        expect(permitidoNoPreparar("custom_actions", "textedit")).toBe(true)
        expect(permitidoNoPreparar("custom_actions", "textedit", {})).toBe(true)
        expect(permitidoNoPreparar("custom_actions", "textedit", { menuClick: "x" })).toBe(false)
    })
    it("grupo global: so a chave globalGroup", () => {
        expect(permitidoNoPreparar("custom_actions", "g1", { globalGroup: { group: "a" } })).toBe(true)
        expect(permitidoNoPreparar("custom_actions", "g1", { globalGroup: {}, menuClick: "x" })).toBe(false)
    })
    it("acoes negadas", () => {
        for (const id of Object.keys(ACOES_NEGADAS_NO_PREPARAR)) expect(permitidoNoPreparar("custom_actions", id, { toolsTab: "x", popup: "y", view: "z" })).toBe(false)
        expect(permitidoNoPreparar("custom_actions", "layout")).toBe(false)
    })
    it("cada popup permitido e cada negado", () => {
        for (const id of Object.keys(POPUPS_PERMITIDOS_NO_PREPARAR)) expect(permitidoNoPreparar("popups", id)).toBe(true)
        for (const id of Object.keys(POPUPS_NEGADOS_NO_PREPARAR)) expect(permitidoNoPreparar("popups", id)).toBe(false)
        expect(permitidoNoPreparar("popups", "output")).toBe(false)
    })
    it("context_menu: so a lista; focus_mode negado", () => {
        for (const id of CONTEXT_MENU_PERMITIDOS) expect(permitidoNoPreparar("context_menu", id)).toBe(true)
        expect(permitidoNoPreparar("context_menu", "focus_mode")).toBe(false)
        expect(permitidoNoPreparar("context_menu", "quit")).toBe(false)
    })
    it("main_page: paginas da lista e abas da gaveta; draw, reflow e calendar-pagina negados", () => {
        for (const id of PAGINAS_DA_BUSCA_NO_PREPARAR) expect(permitidoNoPreparar("main_page", id)).toBe(true)
        for (const id of ABAS_DA_GAVETA_NA_BUSCA) expect(permitidoNoPreparar("main_page", id)).toBe(true)
        for (const id of ["draw", "reflow"]) expect(permitidoNoPreparar("main_page", id)).toBe(false)
        expect(permitidoNoPreparar("main_page", "settings")).toBe(true)
    })
    it("as abas da gaveta de main_page batem com openDrawer (nunca escrevem outra pagina que `show`)", () => {
        const mainPages = QS.slice(QS.indexOf("const mainPages = ["), QS.indexOf("function getMainPages"))
        const ids = [...mainPages.matchAll(/^\s*\{\s*id:\s*"([^"]+)"/gm)].map((m) => m[1])
        for (const id of ids) {
            const ok = PAGINAS_DA_BUSCA_NO_PREPARAR.includes(id) || ABAS_DA_GAVETA_NA_BUSCA.includes(id)
            expect(ok || id === "draw", id).toBe(true)
        }
        expect(ids).toContain("draw")
    })
    it("textoDoBloqueio", () => {
        expect(textoDoBloqueio("main_page", "draw")).toBe("Desenhar e Bíblia em tela cheia ficam no Culto.")
        expect(textoDoBloqueio("popups", "manage_groups")).toBe("Use no Culto: isso não roda no Preparar.")
    })
})
