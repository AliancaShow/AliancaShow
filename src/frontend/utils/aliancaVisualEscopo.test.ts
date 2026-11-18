import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guardas PERMANENTES da FV-A (a prova de "nada muda sem o atributo" contra a base é o scripts/fv-guarda.mjs, portão do PR).
//   G3  o bloco FV de public/global.css só tem seletores sob os dois atributos (ou @font-face) e não redeclara :root.
//   G5  todo token FV usado em .svelte tem fallback (sem ele, tema próprio e janela de saída perderiam a cor).
//   G6  contraste dos pares que o atributo cria.

const RAIZ = join(__dirname, "../../..")
const css = readFileSync(join(RAIZ, "public/global.css"), "utf8").replace(/\r\n/g, "\n")
const a = css.indexOf("/* FV:INICIO */")
const b = css.indexOf("/* FV:FIM */")
const bloco = css.slice(a + "/* FV:INICIO */".length, b)

/** Pares `seletor { corpo }` do bloco (sem comentários); os @font-face voltam com o seletor "@font-face". */
function regras(texto: string): { seletor: string; corpo: string }[] {
    const sem = texto.replace(/\/\*[\s\S]*?\*\//g, "")
    const r: { seletor: string; corpo: string }[] = []
    const re = /([^{}]+)\{([^{}]*)\}/g
    let m
    while ((m = re.exec(sem))) r.push({ seletor: m[1].trim(), corpo: m[2] })
    return r
}

describe("G3: escopo do bloco FV em global.css", () => {
    it("o bloco existe, uma vez, em ordem", () => {
        expect(a).toBeGreaterThan(0)
        expect(b).toBeGreaterThan(a)
        expect(css.indexOf("/* FV:INICIO */", a + 1)).toBe(-1)
    })

    const todas = regras(bloco)

    it("tem regras", () => expect(todas.length).toBeGreaterThan(5))

    it("todo seletor começa em body[data-tema=padrao], body[data-fonte=prep] ou é @font-face", () => {
        for (const { seletor } of todas) {
            const ok = seletor === "@font-face" || /^body\[data-tema="padrao"\](\s|::|$)/.test(seletor) || /^body\[data-fonte="prep"\](\s|$)/.test(seletor)
            expect(ok, `seletor fora de escopo: ${seletor}`).toBe(true)
        }
    })

    it("nenhum :root, html, * ou body puro redeclarado", () => {
        expect(bloco).not.toMatch(/(^|\n)\s*(:root|html|\*)\s*[,{]/)
        for (const { seletor } of todas) expect(seletor).not.toBe("body")
    })

    it("tokens e custom properties só dentro dos dois atributos", () => {
        for (const { seletor, corpo } of todas) {
            if (/--[a-z]/.test(corpo.replace(/var\(--[a-z-]+\)/g, ""))) expect(seletor === "@font-face" ? false : /^body\[data-(tema="padrao"|fonte="prep")\]/.test(seletor), `declaração de token fora do escopo: ${seletor}`).toBe(true)
        }
    })

    it("os nomes de família são privados (nada de Inter/Space Grotesk soltos)", () => {
        expect(bloco).not.toMatch(/font-family:\s*"(Inter|Space Grotesk)"/)
        expect(bloco).toContain('"AliancaUI Texto"')
        expect(bloco).toContain('"AliancaUI Titulo"')
    })

    it("nada fora do bloco FV mudou de lugar: o resto do arquivo não menciona os atributos", () => {
        const luzI = css.indexOf("/* LUZ:INICIO */")
        const luzF = css.indexOf("/* LUZ:FIM */") + "/* LUZ:FIM */".length
        const semLuz = luzI >= 0 ? css.slice(0, luzI) + css.slice(luzF) : css
        const fora = semLuz.slice(0, a) + semLuz.slice(b)
        expect(fora).not.toMatch(/data-tema|data-fonte|AliancaUI/)
    })
})

function arquivosSvelte(dir: string, saida: string[] = []): string[] {
    for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) arquivosSvelte(p, saida)
        else if (n.endsWith(".svelte")) saida.push(p)
    }
    return saida
}

describe("G5: todo token FV usado em .svelte tem fallback", () => {
    const tokens = ["live-opacity", "live", "sel-wash", "sel-line", "conteudo-acento", "modo-[a-z0-9-]+", "prep-rgb", "prep", "aviso", "sobre-acento"]
    const re = new RegExp(`var\\(\\s*--(?:${tokens.join("|")})\\s*([,)])`, "g")

    it("nenhum `var(--token)` sem vírgula", () => {
        const ruins: string[] = []
        for (const f of arquivosSvelte(join(RAIZ, "src/frontend"))) {
            const t = readFileSync(f, "utf8")
            let m
            re.lastIndex = 0
            while ((m = re.exec(t))) if (m[1] === ")") ruins.push(f.replace(RAIZ, "") + ": " + m[0])
        }
        expect(ruins).toEqual([])
    })

    it("o bloco FV é o único lugar que DEFINE esses tokens", () => {
        const def = new RegExp(`(^|[;{\\s])--(?:${tokens.join("|")})\\s*:`)
        for (const f of arquivosSvelte(join(RAIZ, "src/frontend"))) expect(def.test(readFileSync(f, "utf8")), f).toBe(false)
    })
})

// ---------- G6: contraste (WCAG) só dos pares que o atributo cria ----------
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lum = (hex: string) => {
    const [r, g, b] = rgb(hex).map((v) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (x: string, y: string) => {
    const [l1, l2] = [lum(x), lum(y)].sort((p, q) => q - p)
    return (l1 + 0.05) / (l2 + 0.05)
}

describe("G6: contraste dos pares do laranja", () => {
    const tok = (nome: string) => bloco.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`))![1]
    it("os valores do CSS são os que o teste mede", () => {
        expect(tok("secondary")).toBe("#ff8a4c")
        expect(tok("sobre-acento")).toBe("#1a0d05")
        expect(tok("aviso")).toBe("#ffa94d")
        expect(tok("modo-culto")).toBe("#f21a27")
        expect(tok("modo-culto-texto")).toBe("#f8f8f0")
        expect(tok("modo-prep-texto")).toBe("#1a0d05")
    })
    it("laranja sobre o painel (borda/ícone) >= 3", () => expect(contraste("#ff8a4c", "#141416")).toBeGreaterThanOrEqual(3))
    it("texto escuro sobre o laranja >= 4,5", () => expect(contraste("#1a0d05", "#ff8a4c")).toBeGreaterThanOrEqual(4.5))
    it("texto escuro sobre o selo de aviso >= 4,5", () => {
        expect(contraste("#1c1400", "#ffa94d")).toBeGreaterThanOrEqual(4.5)
        expect(contraste("#1a1200", "#ffa94d")).toBeGreaterThanOrEqual(4.5)
    })
    // o par #f8f8f0 sobre #f21a27 JA existe hoje (--secondary-text sobre --secondary) e mede 3,97. A FV-A nao o piora; fica registrado como achado.
    it("texto claro sobre o vermelho do Culto: mesmo par de hoje, >= 3,9 (texto semi-negrito)", () => expect(contraste("#f8f8f0", "#f21a27")).toBeGreaterThanOrEqual(3.9))
    it("o branco fixo NÃO serve sobre o laranja (por isso --sobre-acento)", () => expect(contraste("#ffffff", "#ff8a4c")).toBeLessThan(3))
})
