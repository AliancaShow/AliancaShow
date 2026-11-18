// Prova "tema nao vaza" (parte estatica): todo seletor do bloco LUZ de public/global.css comeca por body[data-tema="luz"],
// e so utils/aliancaTema.ts escreve data-tema. A saida nunca recebe o atributo, entao nada do bloco existe la.
import { execFileSync } from "child_process"
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")

function blocoLuz(): string {
    const css = readFileSync(join(RAIZ, "public", "global.css"), "utf8")
    const i = css.indexOf("/* LUZ:INICIO */")
    const f = css.indexOf("/* LUZ:FIM */")
    expect(i).toBeGreaterThan(-1)
    expect(f).toBeGreaterThan(i)
    return css.slice(i, f)
}

/** Seletores de regras de primeiro nivel (fora de @font-face e @keyframes). */
export function seletoresDe(css: string): string[] {
    const sem = css.replace(/\/\*[\s\S]*?\*\//g, "")
    const saida: string[] = []
    let nivel = 0
    let atual = ""
    let dentroAt = 0
    for (const c of sem) {
        if (c === "{") {
            if (nivel === 0) {
                const sel = atual.trim()
                if (sel.startsWith("@")) dentroAt = 1
                else saida.push(...sel.split(",").map((s) => s.trim()))
            }
            nivel++
            atual = ""
        } else if (c === "}") {
            nivel--
            if (nivel === 0) dentroAt = 0
            atual = ""
        } else if (nivel === 0 || (dentroAt && nivel === 0)) atual += c
    }
    return saida.filter(Boolean)
}

describe("tema nao vaza", () => {
    it("todo seletor do bloco LUZ comeca por body[data-tema=\"luz\"]", () => {
        const seletores = seletoresDe(blocoLuz())
        expect(seletores.length).toBeGreaterThan(0)
        for (const s of seletores) expect(s.startsWith('body[data-tema="luz"]'), s).toBe(true)
    })

    it("o guarda morde: um seletor solto e pego", () => {
        expect(seletoresDe('body[data-tema="luz"] a { color: red }\n.solto { color: red }').filter((s) => !s.startsWith('body[data-tema="luz"]'))).toEqual([".solto"])
    })

    it("so aliancaTema.ts escreve data-tema", () => {
        const achados = execFileSync("git", ["grep", "-nE", "dataset[.]tema|data-tema[ ]*=|setAttribute.{1,3}data-tema", "--", "src/frontend"], { cwd: RAIZ, encoding: "utf8" }).split("\n").filter(Boolean)
        const fora = achados.filter((l) => !l.includes("aliancaTema.ts") && !l.includes(".test.ts") && !l.includes("aliancaTemaLogica"))
        expect(fora).toEqual([])
    })
})
