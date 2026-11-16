// Guardas permanentes da fundacao de layout (fatia 0a). Estaticas: leem texto, nao rodam o app.
// Valem para TODAS as fatias de layout seguintes (a prova de comportamento em si e `scripts/prova-culto`).
//
// Inventario de motores (D5, conferido na fatia 0): os contadores e eventos sobem em App.svelte (startTimer, checkTimers,
// startEventTimer) e o timer do Sirvo e publicado por utils/aliancaSirvo.ts (publicar -> activeTimers + send(STAGE, ACTIVE_TIMERS)).
// NENHUM depende de uma ABA da gaveta; esconder a aba (por `abasEscondidas`) nao pode mudar isso. Os .ts da pasta components/drawer/
// (timers.ts, interactions.ts, metronome.ts) SAO o motor e podem ser importados; o que nao pode e um .svelte da gaveta.
import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"
// @ts-ignore modulo .mjs sem tipos
import { validarEsperado, validarRuido } from "../../../scripts/prova-culto/compararLogica.mjs"

const RAIZ = join(__dirname, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")

function listar(dir: string, acc: string[] = []): string[] {
    for (const n of readdirSync(join(RAIZ, dir))) {
        const rel = `${dir}/${n}`
        if (statSync(join(RAIZ, rel)).isDirectory()) listar(rel, acc)
        else if (/\.(svelte|ts)$/.test(n) && !/\.test\.ts$/.test(n)) acc.push(rel)
    }
    return acc
}
const importa = (texto: string) => [...texto.matchAll(/(?:import\s+(?:[^'";]*?\s+from\s+)?|import\(\s*|export\s+[^'";]*?\s+from\s+)["']([^"']+)["']/g)].map((m) => m[1])

describe("gancho de IPC da prova (so dev)", () => {
    const ganchos = ["src/frontend/utils/request.ts", "src/frontend/IPC/main.ts"]
    it("__gravarIPC so aparece nos dois arquivos, sempre dentro de import.meta.env.DEV e por globalThis", () => {
        for (const rel of ganchos) {
            const linhas = ler(rel).split("\n")
            const usos = linhas.filter((l) => l.includes("__gravarIPC"))
            expect(usos.length, rel).toBe(1)
            expect(usos[0], rel).toContain("import.meta.env.DEV")
            expect(usos[0], rel).toContain("globalThis")
        }
        for (const rel of listar("src/frontend").filter((r) => !ganchos.includes(r))) expect(ler(rel), rel).not.toContain("__gravarIPC")
    })
    it("em sendMain o gancho vem DEPOIS da guarda de window.api", () => {
        const t = ler("src/frontend/IPC/main.ts")
        const sendMain = t.slice(t.indexOf("export function sendMain<"))
        expect(sendMain.indexOf("if (!window.api) return")).toBeGreaterThan(-1)
        expect(sendMain.indexOf("__gravarIPC")).toBeGreaterThan(sendMain.indexOf("if (!window.api) return"))
    })
})

describe("montagem unica (D2): Projects, LibraryTabs, Preview e Drawer sobem em UM ponto", () => {
    const texto = ler("src/frontend/MainLayout.svelte")
    // pilha de blocos ate cada ocorrencia
    function pilhaEm(alvo: RegExp): string[][] {
        const achados: string[][] = []
        const pilha: string[] = []
        for (const linha of texto.split("\n")) {
            for (const m of linha.matchAll(/\{#(if|key|each|await)\s+([^}]*)\}|\{:else if\s+([^}]*)\}|\{\/(if|key|each|await)\}/g)) {
                if (m[1]) pilha.push(`${m[1]} ${m[2]}`)
                else if (m[3] !== undefined) pilha[pilha.length - 1] = `if ${m[3]}`
                else pilha.pop()
            }
            if (alvo.test(linha)) achados.push([...pilha])
        }
        return achados
    }
    const proibido = (p: string[]) => p.some((b) => /modoAlianca|layoutNovo|aliancaLayout|\$special/.test(b) || (b.startsWith("key ") && !/\$activeProfile/.test(b)))
    it("<Projects aparece uma vez por ramo de pagina (show e scripture), <LibraryTabs, <Preview e o LazyLoad do Drawer uma vez", () => {
        expect(pilhaEm(/<Projects\b/).length).toBe(2)
        expect(pilhaEm(/<LibraryTabs\b/).length).toBe(1)
        expect(pilhaEm(/<Preview\b/).length).toBe(1)
        expect(pilhaEm(/components\/drawer\/Drawer\.svelte/).length).toBe(1)
    })
    it("nenhum deles dentro de {#if ...modo/layout} nem de {#key} que nao seja o perfil", () => {
        for (const re of [/<Projects\b/, /<LibraryTabs\b/, /<Preview\b/, /components\/drawer\/Drawer\.svelte/]) for (const p of pilhaEm(re)) expect(proibido(p), `${re} em ${JSON.stringify(p)}`).toBe(false)
    })
    it("nenhum outro arquivo importa Drawer, LibraryTabs nem Preview", () => {
        const reais = listar("src/frontend")
            .filter((r) => r !== "src/frontend/MainLayout.svelte")
            .filter((r) => importa(ler(r)).some((i) => /output\/preview\/Preview\.svelte$|drawer\/Drawer\.svelte$|main\/LibraryTabs\.svelte$|\/LibraryTabs\.svelte$/.test(i)))
        expect(reais).toEqual([])
    })
})

describe("motores sem dependencia de UI de aba da gaveta (D5/C12)", () => {
    const motores = ["src/frontend/App.svelte", "src/frontend/utils/startup.ts", "src/frontend/components/helpers/timerTick.ts", "src/frontend/utils/aliancaSirvo.ts", "src/frontend/utils/listeners.ts", ...listar("src/frontend/components/actions").filter((r) => r.endsWith(".ts"))]
    it("nenhum importa um .svelte de components/drawer/", () => {
        for (const rel of motores) {
            if (!existsSync(join(RAIZ, rel))) continue
            const ruins = importa(ler(rel)).filter((i) => /drawer\/.*\.svelte$/.test(i))
            expect(ruins, rel).toEqual([])
        }
    })
    it("a lista de motores existe (nada foi renomeado e a regra passou a nao olhar para nada)", () => {
        expect(motores.filter((m) => existsSync(join(RAIZ, m))).length).toBeGreaterThanOrEqual(5)
    })
})

describe("arquivos da prova (scripts/prova-culto)", () => {
    const p = (f: string) => join(RAIZ, "scripts/prova-culto", f)
    it("ruido.json e valido (teto, nada proibido)", () => {
        expect(validarRuido(JSON.parse(readFileSync(p("ruido.json"), "utf8")))).toEqual([])
    })
    it("esperado.json e esperado-classico.json obedecem ao esquema; o do classico exige decisaoDeProduto", () => {
        expect(validarEsperado(JSON.parse(readFileSync(p("esperado.json"), "utf8")), { classico: false })).toEqual([])
        expect(validarEsperado(JSON.parse(readFileSync(p("esperado-classico.json"), "utf8")), { classico: true })).toEqual([])
    })
    it("fatia 0: o classico nao declara nenhuma excecao", () => {
        expect(JSON.parse(readFileSync(p("esperado-classico.json"), "utf8"))).toEqual([])
    })
    it("o baseline esta travado por SHA no lock (mudar o baseline aparece no diff do lock)", () => {
        const lock = JSON.parse(readFileSync(p("baseline.lock.json"), "utf8"))
        expect(Object.keys(lock).length).toBeGreaterThan(0)
        for (const [arquivo, sha] of Object.entries<string>(lock)) {
            const { createHash } = require("crypto")
            expect(
                createHash("sha256")
                    .update(readFileSync(p(`baseline/${arquivo}`)))
                    .digest("hex"),
                arquivo
            ).toBe(sha)
        }
    })
    it("nenhum caminho absoluto de maquina nos arquivos do perfil versionado", () => {
        for (const f of readdirSync(p("perfil/store")).filter((n) => n.endsWith(".json"))) expect(readFileSync(p(`perfil/store/${f}`), "utf8"), f).not.toMatch(/C:[\\/]+Users/)
    })
})

describe("guarda do classico (mecanica na fatia 0: nenhum bloco real)", () => {
    it("o lock existe e esta vazio (os blocos reais nascem nas fatias de Culto)", () => {
        expect(JSON.parse(readFileSync(join(RAIZ, "scripts/classico.lock.json"), "utf8"))).toEqual({})
    })
})
