// Guardas estaticas da fachada por modo (fatia 0b): o disco e SEMPRE o Culto, ninguem mais usa `.culto`, a logica nao importa stores
// e nada assina store no nivel do modulo.
import { readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

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
const TODOS = listar("src/frontend")
// uso de `.culto` dos quatro stores por modo (o proprio stores.ts e a logica pura ficam de fora: la `.culto` e a definicao)
const USO_CULTO = /\b(drawer|drawerTabsData|resized|activeDrawerTab)\.culto\b/
const DEFINICAO = ["src/frontend/stores.ts"]

describe("fachada por modo: quem pode usar `.culto`", () => {
    const permitidos = ["src/frontend/utils/save.ts", "src/frontend/utils/updateSettings.ts", "src/frontend/utils/aliancaLayoutEstado.ts"]
    it("so save.ts, updateSettings.ts e aliancaLayoutEstado.ts (o disco e o saneamento)", () => {
        const quem = TODOS.filter((r) => !DEFINICAO.includes(r) && USO_CULTO.test(ler(r)))
        expect(quem.sort()).toEqual([...permitidos].sort())
    })
    it("save.ts e updateSettings.ts nao tem NENHUMA leitura/escrita desses stores sem `.culto` (o sentido inverso: esquecer uma das 6 linhas)", () => {
        for (const rel of ["src/frontend/utils/save.ts", "src/frontend/utils/updateSettings.ts"]) {
            const t = ler(rel)
            expect(t, rel).not.toMatch(/get\((drawer|drawerTabsData|resized)\)/)
            expect(t, rel).not.toMatch(/\b(drawer|drawerTabsData|resized)\.(set|update)\(/)
        }
        expect(ler("src/frontend/utils/save.ts")).toMatch(/drawer: get\(drawer\.culto\)/)
        expect(ler("src/frontend/utils/save.ts")).toMatch(/drawerTabsData: get\(drawerTabsData\.culto\)/)
        expect(ler("src/frontend/utils/save.ts")).toMatch(/resized: get\(resized\.culto\)/)
        expect(ler("src/frontend/utils/updateSettings.ts")).toMatch(/drawer: \(v: any\) => drawer\.culto\.set\(v\)/)
        expect(ler("src/frontend/utils/updateSettings.ts")).toMatch(/drawerTabsData: \(v: any\) => drawerTabsData\.culto\.set\(v\)/)
        expect(ler("src/frontend/utils/updateSettings.ts")).toMatch(/resized: \(v: any\) => resized\.culto\.set\(v\)/)
    })
    it("o Preparar nao persiste nada: save.ts nao grava chave nova de layout do Preparar", () => {
        expect(ler("src/frontend/utils/save.ts")).not.toMatch(/layoutPreparar|doModo\(/)
    })
})

describe("fachada por modo: logica pura e sem assinatura no nivel do modulo", () => {
    const logica = ["src/frontend/utils/aliancaPorModoLogica.ts", "src/frontend/utils/aliancaDrawerTabsLogica.ts"]
    it("a logica nao importa stores.ts (sem ciclo)", () => {
        for (const rel of logica) expect(ler(rel), rel).not.toMatch(/from\s+["'][^"']*\/stores["']/)
    })
    it("nenhum `.subscribe(` fora de funcao nesses arquivos nem em aliancaLayoutEstado.ts", () => {
        for (const rel of [...logica, "src/frontend/utils/aliancaLayoutEstado.ts"]) {
            const soltas = ler(rel)
                .split("\n")
                .filter((l) => /^\S.*\.subscribe\(/.test(l) && !l.startsWith("//"))
            expect(soltas, rel).toEqual([])
        }
    })
})

describe("estado por modo", () => {
    it("estado por modo: aliancaAbasEditor e Ctrl+T nao tem variavel de modulo compartilhada", () => {
        expect(ler("src/frontend/utils/aliancaAbasEditor.ts")).not.toMatch(/^let anterior/m)
        expect(ler("src/frontend/utils/common.ts")).not.toMatch(/let panelsManuallyClosed/)
    })
})
