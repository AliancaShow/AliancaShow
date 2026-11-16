// Q6 (fatia R): o leiaute "classico" nao existe mais, e nada pode trazer ele de volta (decisao do dono, 16/nov).
// Varre SO os arquivos versionados (git ls-files; nunca uma pasta solta, entao gravacoes locais nao entram).
// Uma linha que bate com um padrao so passa se { arquivo, linha } estiver em PERMITIDAS, com o texto exato da linha (sem espacos nas pontas).
// Crescer PERMITIDAS aparece no diff.
import { execFileSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")
const ESTE = "src/frontend/utils/aliancaSemClassicoGuarda.test.ts"

const PADROES: { nome: string; re: RegExp }[] = [
    { nome: "classico", re: /cl[aá]ssico/i },
    { nome: "layoutNovo(", re: /\blayoutNovo\s*\(/ },
    { nome: "layoutAtivo", re: /\blayoutAtivo\b/ },
    { nome: "aliancaLayoutCulto", re: /aliancaLayoutCulto/ },
    { nome: "FS_LAYOUT", re: /FS_LAYOUT/ },
    { nome: "data-layout", re: /data-layout/ },
    { nome: "dataset.layout", re: /dataset\.layout/ }
]

const NAO_PODEM_EXISTIR = ["scripts/classico-guarda.mjs", "scripts/classico.lock.json", "scripts/prova-culto/esperado-classico.json", "src/frontend/utils/aliancaLayoutCulto.ts"]

/** as unicas linhas que podem ter a palavra: a recusa (Q4, Q5) e os testes dela */
export const PERMITIDAS: { arquivo: string; linha: string }[] = [
    // o nome do proprio teste na linha do npm script
    { arquivo: "package.json", linha: '"test:layout": "node --test scripts/prova-culto/comparar.test.mjs scripts/prova-culto/ancora.test.mjs && node scripts/prova-culto/ancora.mjs && vitest run --config config/testing/vitest.config.ts src/frontend/utils/aliancaProvaCultoGuarda.test.ts src/frontend/utils/aliancaSemClassicoGuarda.test.ts src/frontend/utils/aliancaFalhaGuarda.test.ts src/frontend/utils/aliancaEscritaAtrasadaGuarda.test.ts src/frontend/utils/aliancaGavetaAutoabrir.test.ts",' },
    { arquivo: "scripts/prova-culto/rodar.mjs", linha: 'if (process.env.FS_LAYOUT !== undefined) { console.error("o leiaute classico nao existe mais: tire FS_LAYOUT do ambiente"); process.exit(2) }' },
    { arquivo: "scripts/prova-culto/restaurar.sh", linha: 'if [ "${FS_LAYOUT+definida}" = "definida" ]; then echo "o leiaute classico nao existe mais: tire FS_LAYOUT do ambiente" >&2; exit 2; fi' },
    { arquivo: "scripts/prova-culto/comparar.mjs", linha: 'console.error("gravacao do leiaute classico: nao existe mais")' },
    { arquivo: "scripts/prova-culto/comparar.test.mjs", linha: 'const r = comparar_mjs(BASELINE, BASELINE, "--classico")' },
    { arquivo: "scripts/prova-culto/comparar.test.mjs", linha: "assert.match(r.stderr, /flag desconhecida: --classico/)" },
    { arquivo: "scripts/prova-culto/comparar.test.mjs", linha: 'g.cabecalho.layout = "classico"' },
    { arquivo: "scripts/prova-culto/comparar.test.mjs", linha: 'test("Q5: gravacao com leiaute diferente de novo sai com 2", () => {' }
]

const git = (...args: string[]) => execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })

function arquivosVersionados(): string[] {
    return git("ls-files")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((f) => f !== ESTE)
        .filter((f) => {
            if (f === "package.json" || f === "scripts/prova-culto/comparar.test.mjs") return true
            if (f.startsWith("src/frontend/")) return /\.(ts|svelte)$/.test(f) && !f.endsWith(".test.ts")
            if (f.startsWith("scripts/")) return /\.(mjs|js|sh|json)$/.test(f)
            return false
        })
        .filter((f) => existsSync(join(RAIZ, f)))
}

export function achar(arquivos: string[], ler: (f: string) => string, permitidas = PERMITIDAS) {
    const achados: string[] = []
    for (const f of arquivos) {
        ler(f)
            .split(/\r?\n/)
            .forEach((texto, i) => {
                const linha = texto.trim()
                for (const p of PADROES) {
                    if (!p.re.test(linha)) continue
                    if (permitidas.some((x) => x.arquivo === f && x.linha === linha)) continue
                    achados.push(`${f}:${i + 1} [${p.nome}] ${linha.slice(0, 120)}`)
                }
            })
    }
    return achados
}

describe("sem leiaute classico (Q6)", () => {
    it("nenhum arquivo versionado cita o classico fora da lista permitida", () => {
        const arquivos = arquivosVersionados()
        expect(arquivos.length).toBeGreaterThan(100) // a varredura achou o repositorio
        expect(achar(arquivos, (f) => readFileSync(join(RAIZ, f), "utf8"))).toEqual([])
    })
    it("os arquivos do classico nao existem (nem como arquivo novo ainda nao commitado)", () => {
        for (const f of NAO_PODEM_EXISTIR) expect(existsSync(join(RAIZ, f)), f).toBe(false)
    })
    it("cada linha permitida existe de verdade no arquivo dela (lista sem sobra)", () => {
        for (const p of PERMITIDAS) {
            const linhas = readFileSync(join(RAIZ, p.arquivo), "utf8")
                .split(/\r?\n/)
                .map((l) => l.trim())
            expect(linhas, `${p.arquivo}: ${p.linha}`).toContain(p.linha)
        }
    })
    it("a varredura morde: texto proibido em memoria e achado, e a linha permitida so vale no arquivo certo", () => {
        const ruim = { "a.ts": "// classico", "b.ts": 'body.setAttribute("data-layout", "x")', "c.ts": "import { layoutNovo } from './x'; layoutNovo()" }
        expect(achar(Object.keys(ruim), (f) => (ruim as any)[f]).length).toBe(3)
        const p = PERMITIDAS.find((x) => x.arquivo.endsWith("rodar.mjs"))!
        expect(achar([p.arquivo], () => p.linha)).toEqual([])
        expect(achar(["outro.mjs"], () => p.linha).length).toBeGreaterThan(0)
        expect(achar([p.arquivo], () => p.linha + " ").length).toBe(0) // espaco na ponta nao conta
        expect(achar([p.arquivo], () => p.linha.replace("nao", "não")).length).toBeGreaterThan(0)
    })
})
