// 1b, decisao 12 do dono: as teclas 1 a 6 (troca de pagina) saem. Guarda estatica: nada de `menus[`, nada de `activePage.set(menu`, os textos
// sem "[N]" nem "(tecla 2)", e o que FICA (`numberKeys` no Preview toca slide N) continua la.
//
// O QUE ESTA GUARDA NAO COBRE: um atalho de pagina escrito por outro caminho (a guarda de escritores, aliancaMolduraEscritores.test.ts, pega
// qualquer activePage.set novo); o comportamento em tempo de execucao (T-1b-4, CDP).
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")

export function problemasDasTeclas(t: { shortcuts: string; preview: string; topButton: string; showHeader: string; popupShortcuts: string }): string[] {
    const erros: string[] = []
    if (/\bmenus\[/.test(t.shortcuts) || /const menus\b/.test(t.shortcuts)) erros.push("shortcuts.ts: a tabela `menus` das teclas 1 a 6 voltou")
    if (/activePage\.set\(menu\b/.test(t.shortcuts)) erros.push("shortcuts.ts: activePage.set(menu...) voltou")
    if (!/numberKeys/.test(t.preview)) erros.push("Preview.svelte: `numberKeys` (tocar o slide N) sumiu, e ele FICA")
    if (/\[\$\{keys/.test(t.topButton) || /const keys\b/.test(t.topButton)) erros.push("TopButton.svelte: o ` [N]` do titulo voltou")
    if (/tecla 2/.test(t.showHeader)) erros.push("ShowHeader.svelte: '(tecla 2)' voltou")
    if (/change_tab/.test(t.popupShortcuts)) erros.push("popups/Shortcuts.svelte: 'actions.change_tab' voltou")
    return erros
}

const REAL = {
    shortcuts: ler("src/frontend/utils/shortcuts.ts"),
    preview: ler("src/frontend/components/output/preview/Preview.svelte"),
    topButton: ler("src/frontend/components/inputs/TopButton.svelte"),
    showHeader: ler("src/frontend/components/show/ShowHeader.svelte"),
    popupShortcuts: ler("src/frontend/components/main/popups/Shortcuts.svelte")
}

describe("teclas 1 a 6 saem (1b, decisao 12)", () => {
    it("o codigo esta limpo", () => expect(problemasDasTeclas(REAL)).toEqual([]))
    it("o `import type` de shortcuts.ts nao carrega mais TopViews", () => expect(REAL.shortcuts).not.toMatch(/import type \{[^}]*TopViews/))
    describe("mutacoes (texto injetado)", () => {
        it("a tabela menus volta", () => expect(problemasDasTeclas({ ...REAL, shortcuts: REAL.shortcuts + '\nconst menus = ["show"]' }).join()).toContain("menus"))
        it("activePage.set(menu) volta", () => expect(problemasDasTeclas({ ...REAL, shortcuts: REAL.shortcuts + "\nactivePage.set(menu)" }).join()).toContain("activePage.set(menu"))
        it("o [N] do titulo volta", () => expect(problemasDasTeclas({ ...REAL, topButton: REAL.topButton + "\n`${keys[id]}`".replace("`${keys", "[${keys") }).join()).toContain("TopButton"))
        it("(tecla 2) volta", () => expect(problemasDasTeclas({ ...REAL, showHeader: REAL.showHeader + " (tecla 2)" }).join()).toContain("tecla 2"))
        it("change_tab volta", () => expect(problemasDasTeclas({ ...REAL, popupShortcuts: REAL.popupShortcuts + ' "actions.change_tab": "num"' }).join()).toContain("change_tab"))
        it("numberKeys some do Preview", () => expect(problemasDasTeclas({ ...REAL, preview: REAL.preview.replace(/numberKeys/g, "x") }).join()).toContain("numberKeys"))
    })
})
