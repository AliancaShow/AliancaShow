// 1a, D6: o modo foco saiu. Nenhuma porta (atalho, menu Visualizar, busca, lista de atalhos, menu nativo) liga o modo foco, e
// nada em `src/frontend` o liga por codigo. A definicao `focus_mode` de contextMenus.ts e o corpo de `focus_mode` em menuClick.ts
// ficam (o corpo so DESLIGA um foco que ja estivesse ligado); os outros usos de `focusMode` ficam (fatia 7 do roteiro geral).
//
// O QUE ESTA GUARDA NAO COBRE: um `focusMode.set(true)` montado por texto (`focusMode["set"](true)`) ou uma variavel intermediaria.
import { execFileSync } from "child_process"
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")

/** linhas (sem comentario de linha) de `src` que ligam o modo foco */
export function ligaModoFoco(src: string): { linha: number; texto: string }[] {
    return src
        .split("\n")
        .map((texto, i) => ({ linha: i + 1, texto }))
        .filter(({ texto }) => !/^\s*\/\//.test(texto) && (/\bfocusMode\.set\(\s*true\s*\)/.test(texto) || /\bfocusMode\.set\(\s*!/.test(texto) || /\bfocusMode\.update\(/.test(texto)))
}

function arquivosDoFrontend(): string[] {
    const saida = execFileSync("git", ["ls-files", "src/frontend"], { cwd: RAIZ, encoding: "utf8" })
    return saida.split("\n").filter((f) => /\.(ts|svelte)$/.test(f) && !/\.test\.ts$/.test(f))
}

describe("modo foco: as portas (D6)", () => {
    it("nada em src/frontend liga o modo foco", () => {
        const achados: string[] = []
        for (const rel of arquivosDoFrontend()) for (const a of ligaModoFoco(ler(rel))) achados.push(`${rel}:${a.linha}: ${a.texto.trim()}`)
        expect(achados).toEqual([])
    })
    it("shortcuts.ts nao tem focus_mode", () => {
        expect(ler("src/frontend/utils/shortcuts.ts")).not.toContain("focus_mode")
    })
    it("contextMenus.ts: sem layout da barra de menus (fatia 4) e a definicao de focus_mode continua", () => {
        const src = ler("src/frontend/components/context/contextMenus.ts")
        // a barra de menus saiu: nenhum layout view/file/edit/help e, portanto, nenhum que pudesse listar focus_mode
        for (const l of ["view", "file", "help"]) expect(src, l).not.toMatch(new RegExp(`^\\s*${l}:\\s*\\[`, "m"))
        expect(src).not.toMatch(/^\s*edit:\s*\["undo"/m)
        expect(src).toMatch(/^\s*focus_mode:\s*\{/m)
    })
    it("menuClick.ts: focus_mode so desliga", () => {
        const src = ler("src/frontend/components/context/menuClick.ts")
        const i = src.indexOf("    focus_mode: () => {")
        expect(i).toBeGreaterThan(0)
        const corpo = src.slice(i, src.indexOf("    fullscreen:", i))
        expect(corpo).toContain("focusMode.set(false)")
        expect(corpo).not.toMatch(/focusMode\.set\(\s*(true|!)/)
        expect(corpo).not.toContain("activePage.set")
        expect(corpo).not.toContain("activeShow.set")
    })
    it("Spotlight (Ctrl+K): as acoes do app nao tem focus_mode", () => {
        expect(ler("src/frontend/utils/aliancaSpotlightLogica.ts")).not.toContain("focus_mode")
    })
    it("popups/Shortcuts.svelte sem actions.focus_mode", () => {
        expect(ler("src/frontend/components/main/popups/Shortcuts.svelte")).not.toContain("actions.focus_mode")
    })
    it("menu nativo sem focus_mode", () => {
        expect(ler("src/electron/utils/menuTemplate.ts")).not.toContain("focus_mode")
    })
    it("a guarda morde: set(true), set(!x) e update reprovam", () => {
        expect(ligaModoFoco("focusMode.set(true)")).toHaveLength(1)
        expect(ligaModoFoco("focusMode.set(!get(focusMode))")).toHaveLength(1)
        expect(ligaModoFoco("focusMode.update((a) => !a)")).toHaveLength(1)
        expect(ligaModoFoco("focusMode.set(false)")).toHaveLength(0)
        expect(ligaModoFoco("// focusMode.set(true)")).toHaveLength(0)
    })
})
