// Visual (cabine 6, V1): guardas estaticas.
//  1) nada do Visual entra no fecho da janela de saida (a fatia V1 e livre: nenhum arquivo do fecho importa os arquivos novos);
//  2) no codigo Alianca, so o aplicador escreve template/templateScripture de estilo e stageOutput por causa do Visual;
//  3) o aplicador nao passa pelo historico (Ctrl+Z nao desfaz o Visual).
import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"
// @ts-ignore modulo .mjs sem tipos
import { fecho } from "../../../scripts/prova-culto/ancora.mjs"

const RAIZ = join(__dirname, "..", "..", "..")
const lerArq = (rel: string): string | null => {
    try {
        return readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")
    } catch {
        return null
    }
}

const NOVOS = ["src/frontend/utils/aliancaVisualLogica.ts", "src/frontend/utils/aliancaVisualAplicador.ts", "src/frontend/components/settings/AliancaVisual.svelte", "src/frontend/components/main/AliancaTelaoPilula.svelte", "src/frontend/components/main/AliancaOrigemModelo.svelte", "src/frontend/utils/aliancaTelaoPartida.ts"]

describe("Visual fora do fecho da janela de saida", () => {
    const doFecho: Set<string> = fecho("src/frontend/MainOutput.svelte", lerArq)
    it("o fecho existe", () => expect(doFecho.size).toBeGreaterThan(300))
    for (const f of NOVOS) it(`${f} nao entra no fecho`, () => expect(doFecho.has(f)).toBe(false))
})

describe("so o aplicador escreve os campos do Visual", () => {
    const dir = join(RAIZ, "src", "frontend")
    const arquivos: string[] = []
    const andar = (d: string) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name)
            if (e.isDirectory()) andar(p)
            else if (/^[Aa]lianca.*\.(ts|svelte)$/.test(e.name) && !e.name.endsWith(".test.ts")) arquivos.push(p)
        }
    }
    andar(dir)
    it("acha os arquivos Alianca", () => expect(arquivos.length).toBeGreaterThan(50))
    it("nenhum outro escreve .template/.templateScripture de estilo nem .stageOutput", () => {
        const escreve = /\.(template|templateScripture(_\d)?|stageOutput)\s*=(?!=)|\[e\.campo\]\s*=(?!=)/
        const semComentario = (t: string) =>
            t
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/<!--[\s\S]*?-->/g, "")
                .replace(/^\s*\/\/.*$/gm, "")
        const quem = arquivos.filter((p) => escreve.test(semComentario(readFileSync(p, "utf8")))).map((p) => p.replace(/\\/g, "/").split("/src/frontend/")[1])
        // 25/nov ("aprovo papeis-saida"): o "Esta tela mostra" (Slides/Retorno) liga e desliga o retorno de uma tela; o Visual so TROCA o modelo de quem ja e retorno
        expect(quem).toEqual(["utils/aliancaPapelDaSaida.ts", "utils/aliancaVisualAplicador.ts"])
    })
    it("o aplicador nao usa history", () => {
        const t = lerArq("src/frontend/utils/aliancaVisualAplicador.ts") as string
        expect(t).not.toMatch(/import\s*\{[^}]*\bhistory\b[^}]*\}\s*from/)
        expect(t).not.toMatch(/\bhistory\(/)
    })
})
