// 1b, D8: a SEGUNDA CAMADA na origem. Mesmo que a guarda de paginas (aliancaMoldura.ts) esteja desligada, as 9 portas de Desenhar e Biblia que
// mandam algo ao telao comecam por `if (gavetaNaoToca()) return` (a regra unica de aliancaModo.ts: no Preparar nada vai ao ar).
// `draw/Paint.svelte` fica de fora de proposito: roda DENTRO da janela de saida (components/output/Output.svelte) e nao pode mudar.
//
// O QUE ESTA GUARDA NAO COBRE: o corpo depois da primeira instrucao (so a primeira linha e conferida), e porta nova de escrita que alguem
// acrescente nesses arquivos: por isso tambem conta quantas escritas ha (drawSettings.update, drawTool.set) em DrawSettings e DrawTabs.
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")

const GUARDA = "if (gavetaNaoToca()) return"

export const PORTAS: { arquivo: string; abre: string; nome: string }[] = [
    { arquivo: "src/frontend/components/bible/BiblePage.svelte", abre: "function sendToOutput() {", nome: "BiblePage sendToOutput" },
    { arquivo: "src/frontend/components/draw/Slide.svelte", abre: "function onMouseMove(e: any) {", nome: "Slide onMouseMove" },
    { arquivo: "src/frontend/components/draw/Slide.svelte", abre: "const wheel = (e: any) => {", nome: "Slide wheel" },
    { arquivo: "src/frontend/components/draw/Slide.svelte", abre: "on:mouseup={() => {", nome: "Slide on:mouseup (svelte:window)" },
    { arquivo: "src/frontend/components/draw/DrawTabs.svelte", abre: "function keydown(e: KeyboardEvent) {", nome: "DrawTabs keydown" },
    { arquivo: "src/frontend/components/draw/DrawTabs.svelte", abre: "on:click={() => {", nome: "DrawTabs on:click" },
    { arquivo: "src/frontend/components/draw/DrawSettings.svelte", abre: "const update = (value: any, key: string) => {", nome: "DrawSettings update" },
    { arquivo: "src/frontend/components/draw/DrawSettings.svelte", abre: "function reset() {", nome: "DrawSettings reset" },
    { arquivo: "src/frontend/components/draw/DrawSettings.svelte", abre: "function adddMissingSettings() {", nome: "DrawSettings adddMissingSettings" }
]

/** quantas escritas cada arquivo tem (uma porta nova de escrita precisa de linha nova em PORTAS) */
export const ESCRITAS: { arquivo: string; re: RegExp; n: number }[] = [
    { arquivo: "src/frontend/components/draw/DrawSettings.svelte", re: /drawSettings\.update\(/g, n: 3 },
    { arquivo: "src/frontend/components/draw/DrawTabs.svelte", re: /drawTool\.set\(/g, n: 2 },
    { arquivo: "src/frontend/components/bible/BiblePage.svelte", re: /playScripture\(\)/g, n: 1 }
]

export function problemasDaSegundaCamada(textos: Record<string, string>): string[] {
    const erros: string[] = []
    for (const p of PORTAS) {
        const src = textos[p.arquivo]
        if (src === undefined) {
            erros.push(`${p.nome}: arquivo nao existe (${p.arquivo})`)
            continue
        }
        const partes = src.split(p.abre)
        if (partes.length !== 2) {
            erros.push(`${p.nome}: o texto "${p.abre}" aparece ${partes.length - 1}x (esperado 1)`)
            continue
        }
        const primeira = partes[1]
            .split("\n")
            .slice(1)
            .map((l) => l.trim())
            .find((l) => l !== "")
        if (primeira !== GUARDA) erros.push(`${p.nome}: a primeira instrucao nao e "${GUARDA}" (achei: ${primeira})`)
    }
    for (const e of ESCRITAS) {
        const n = (textos[e.arquivo]?.match(e.re) || []).length
        if (n !== e.n) erros.push(`${e.arquivo}: ${e.re} aparece ${n}x (esperado ${e.n}); escrita nova precisa entrar em PORTAS`)
    }
    return erros
}

const REAL: Record<string, string> = {}
for (const arq of new Set([...PORTAS.map((p) => p.arquivo), ...ESCRITAS.map((e) => e.arquivo)])) REAL[arq] = ler(arq)

describe("segunda camada na origem (D8)", () => {
    it("sao 9 portas e todas comecam por gavetaNaoToca", () => {
        expect(PORTAS).toHaveLength(9)
        expect(problemasDaSegundaCamada(REAL)).toEqual([])
    })
    it("draw/Paint.svelte nao foi tocado (roda dentro da saida)", () => {
        expect(ler("src/frontend/components/draw/Paint.svelte")).not.toContain("gavetaNaoToca")
    })
    it("os arquivos importam gavetaNaoToca de aliancaModo", () => {
        for (const arq of new Set(PORTAS.map((p) => p.arquivo))) expect(REAL[arq], arq).toMatch(/import \{ gavetaNaoToca \} from "..\/..\/utils\/aliancaModo"/)
    })
    describe("mutacoes (texto injetado)", () => {
        it("tirar a guarda de BiblePage reprova", () => {
            const t = { ...REAL, [PORTAS[0].arquivo]: REAL[PORTAS[0].arquivo].replace(`        ${GUARDA}\n`, "") }
            expect(problemasDaSegundaCamada(t).join()).toContain("BiblePage sendToOutput")
        })
        it("guarda que nao e a primeira instrucao reprova", () => {
            const a = "src/frontend/components/draw/Slide.svelte"
            const t = { ...REAL, [a]: REAL[a].replace(`function onMouseMove(e: any) {\n        ${GUARDA}\n`, `function onMouseMove(e: any) {\n        let x = 1\n        ${GUARDA}\n`) }
            expect(problemasDaSegundaCamada(t).join()).toContain("Slide onMouseMove")
        })
        it("escrita nova em DrawSettings reprova", () => {
            const a = "src/frontend/components/draw/DrawSettings.svelte"
            expect(problemasDaSegundaCamada({ ...REAL, [a]: REAL[a] + "\ndrawSettings.update((a) => a)" }).join()).toContain("escrita nova")
        })
    })
})
