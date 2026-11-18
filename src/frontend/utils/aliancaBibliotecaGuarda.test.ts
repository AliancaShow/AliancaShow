import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guardas PERMANENTES da FV-B (a prova de "o Culto não muda" contra a base é o scripts/fvb-guarda.mjs, portão do PR).
//   a  os módulos novos não assinam store no nível do módulo (a janela de saída também importa a árvore de stores);
//   b  nenhum arquivo da janela de saída importa o que a FV-B criou;
//   c  todo token da FV-A usado nos .svelte novos tem fallback (tema próprio e janela de saída não têm o atributo);
//   d  nenhum seletor `:global(` dos .svelte novos começa solto: tem de começar por classe do próprio componente.

const FRONT = join(__dirname, "..")
const ler = (rel: string) => readFileSync(join(FRONT, rel), "utf8").replace(/\r\n/g, "\n")

const MODULOS = ["utils/aliancaBiblioteca.ts", "utils/aliancaBibliotecaEstado.ts", "utils/aliancaBibliotecaLogica.ts"]
const SVELTES = ["components/main/AliancaNovo.svelte"]

function arquivos(dir: string): string[] {
    const saida: string[] = []
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome)
        if (statSync(p).isDirectory()) saida.push(...arquivos(p))
        else if (/\.(svelte|ts)$/.test(nome)) saida.push(p)
    }
    return saida
}

describe("a: sem assinatura de store no nível do módulo", () => {
    for (const m of MODULOS) {
        it(m, () => {
            const linhas = ler(m).split("\n")
            const soltas = linhas.map((l, i) => ({ l, i: i + 1 })).filter(({ l }) => /\.subscribe\(/.test(l) && !/^\s{4,}/.test(l))
            expect(soltas, `assinatura no nível do módulo: ${soltas.map((s) => s.i).join(",")}`).toEqual([])
        })
    }
    it("o reset do estado está numa função exportada (chamada pelo componente), não solta", () => {
        const t = ler("utils/aliancaBibliotecaEstado.ts")
        expect(t).toMatch(/export function iniciarEstadoDaBiblioteca\(\)/)
        expect(t.indexOf("modoAlianca.subscribe")).toBeGreaterThan(t.indexOf("export function iniciarEstadoDaBiblioteca"))
    })
})

describe("b: a janela de saída não importa a FV-B", () => {
    const saida = [join(FRONT, "MainOutput.svelte"), ...arquivos(join(FRONT, "components/output"))].filter((p) => {
        try {
            return statSync(p).isFile()
        } catch {
            return false
        }
    })
    it("tem arquivos para olhar", () => expect(saida.length).toBeGreaterThan(3))
    it("nenhum importa AliancaAbasLaterais, AliancaBiblioteca, AliancaNovo nem aliancaBiblioteca*", () => {
        for (const p of saida) {
            const t = readFileSync(p, "utf8")
            expect(t, p).not.toMatch(/Alianca(AbasLaterais|Biblioteca|Novo)\.svelte|aliancaBiblioteca/)
        }
    })
})

describe("c: tokens da FV-A com fallback nos .svelte novos", () => {
    const tokens = ["live-opacity", "live", "sel-wash", "sel-line", "conteudo-acento", "modo-culto-texto", "modo-culto", "modo-prep-texto", "modo-prep-brilho0", "modo-prep-brilho", "modo-prep", "prep-rgb", "prep", "aviso", "sobre-acento"]
    for (const s of SVELTES) {
        it(s, () => {
            const t = ler(s)
            const re = new RegExp(`var\\(--(${tokens.join("|")})\\s*([,)])`, "g")
            let m
            let n = 0
            while ((m = re.exec(t))) {
                n++
                expect(m[2], `${s}: --${m[1]} sem fallback`).toBe(",")
            }
            expect(n).toBeGreaterThanOrEqual(0)
        })
    }
})

describe("d: :global( só depois de classe do próprio componente", () => {
    for (const s of SVELTES) {
        it(s, () => {
            const estilo = (ler(s).split("<style>")[1] || "").replace(/\/\*[\s\S]*?\*\//g, "")
            const seletores = estilo.match(/[^{}]+(?=\{)/g) || []
            for (const sel of seletores.filter((x) => x.includes(":global("))) expect(sel.trim(), `seletor solto: ${sel.trim()}`).toMatch(/^\.[a-zA-Z]/)
        })
    }
})
