// Fatia 8b: toda janela de automacao/desvio aberta (`iniciarAutomacao()` / `suspenderDesvio()`) e fechada num `finally`. Uma janela esquecida
// deixaria o modo "so retorno" valendo pela metade para sempre (o contador `desvio` nunca voltaria a zero).
import { readdirSync, readFileSync, statSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..")
const arquivos = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
        const p = join(d, n)
        if (statSync(p).isDirectory()) return arquivos(p)
        return /\.(ts|svelte)$/.test(n) && !/\.test\./.test(n) ? [p] : []
    })

describe("guarda: a janela de automacao nunca fica presa", () => {
    it("cada `iniciarAutomacao()` / `suspenderDesvio()` vem logo antes de `try {` e o arquivo fecha a janela (`solta`/`volta`) num finally", () => {
        let total = 0
        for (const f of arquivos(RAIZ)) {
            if (f.endsWith("aliancaSoRetorno.ts")) continue // a definicao
            const txt = readFileSync(f, "utf8").replace(/\r\n/g, "\n")
            const linhas = txt.split("\n")
            let abertas = 0
            linhas.forEach((l, i) => {
                if (!/=.*\b(iniciarAutomacao|suspenderDesvio)\(\)/.test(l)) return
                abertas++
                total++
                const seguinte = /try \{/.test(l) || /try \{/.test(linhas[i + 1] || "")
                expect(seguinte, `${f}:${i + 1}: janela aberta sem \`try {\` logo abaixo`).toBe(true)
            })
            if (abertas) expect((txt.match(/finally \{\n\s*(solta\?\.|volta)\(\)/g) || []).length, `${f}: falta fechar a janela no finally`).toBeGreaterThanOrEqual(abertas)
        }
        expect(total).toBeGreaterThanOrEqual(9) // clear.ts x2, tick, videoPlayer, timeline x2, OutputHelper x2, shortcuts
    })
})
