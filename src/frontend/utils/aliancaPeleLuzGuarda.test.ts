// Pele Luz das pecas de entrada (C4, cabine 18/nov). Guarda estatica: os inputs/Material*.svelte estao no fecho da janela de SAIDA e nao
// podem mudar; a troca de pele e CSS escopado (.luz-pele sob body[data-tema="luz"]) na janela principal. Aqui se prova que
//   1) nenhum arquivo do fecho da saida adota a classe do escopo,
//   2) todo o CSS da pele mora sob body[data-tema="luz"] .luz-pele e so usa tokens --luz-* (nada de cor ou raio solto),
//   3) os tokens novos existem no bloco de variaveis do tema,
//   4) as cascas da janela principal (Configuracoes, propriedades do Editar, popups) adotam o escopo.
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"
// @ts-ignore modulo .mjs sem tipos
import { fecho } from "../../../scripts/prova-culto/ancora.mjs"
import { seletoresDe } from "./aliancaTemaNaoVazaGuarda.test"

const RAIZ = join(__dirname, "..", "..", "..")
const lerArq = (rel: string): string | null => {
    try {
        return readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")
    } catch {
        return null
    }
}
const css = lerArq("public/global.css") as string
const INI = "/* ===== C4 (cabine 18/nov)"
const blocoC4 = css.slice(css.indexOf(INI), css.indexOf("/* LUZ:FIM */"))

describe("C4: a janela de saida nao adota a pele", () => {
    const doFecho: Set<string> = fecho("src/frontend/MainOutput.svelte", lerArq)
    it("o fecho existe e traz os Material* que a saida usa", () => {
        expect(doFecho.size).toBeGreaterThan(300)
        expect([...doFecho].some((f) => f.includes("inputs/MaterialButton.svelte"))).toBe(true)
    })
    it("nenhum arquivo do fecho cita .luz-pele (o escopo so e posto nas cascas da janela principal)", () => {
        const citam = [...doFecho].filter((f) => (lerArq(f) || "").includes("luz-pele"))
        expect(citam).toEqual([])
    })
    it("as cascas que adotam o escopo ficam FORA do fecho", () => {
        for (const f of ["src/frontend/components/main/AliancaCorpoPagina.svelte", "src/frontend/components/main/AliancaEditarFerramentas.svelte", "src/frontend/components/main/Popup.svelte"]) {
            expect(doFecho.has(f), f).toBe(false)
            expect(lerArq(f), f).toContain("luz-pele")
        }
    })
})

describe("C4: o CSS da pele", () => {
    it("o bloco existe", () => {
        expect(blocoC4.length).toBeGreaterThan(2000)
    })
    it("todo seletor comeca por body[data-tema=\"luz\"] (a saida nunca recebe o atributo)", () => {
        for (const s of seletoresDe(blocoC4)) expect(s.startsWith('body[data-tema="luz"]'), s).toBe(true)
    })
    it("so tokens: nenhuma cor (hex, rgb, rgba, hsl, nome) nem px de raio solto nas declaracoes", () => {
        const decl = blocoC4.replace(/\/\*[\s\S]*?\*\//g, "")
        expect(decl.match(/#[0-9a-fA-F]{3,8}\b/g) || []).toEqual([])
        expect(decl.match(/\b(rgba?|hsla?)\(/g) || []).toEqual([])
        const raios = [...decl.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())
        for (const r of raios) expect(/var\(--luz-/.test(r) || r === "0" || r === "50%", `border-radius: ${r}`).toBe(true)
    })
    it("os tokens novos existem no bloco de variaveis do tema", () => {
        for (const t of ["--luz-raio-campo", "--luz-raio-acao", "--luz-halo-foco", "--luz-campo-h", "--luz-botao-h"]) expect(css, t).toContain(t + ":")
    })
    it("todo var(--luz-x) usado esta definido", () => {
        const usados = new Set([...blocoC4.matchAll(/var\((--luz-[a-z0-9-]+)/g)].map((m) => m[1]))
        for (const t of usados) expect(css.includes(t + ":"), t).toBe(true)
    })
})
