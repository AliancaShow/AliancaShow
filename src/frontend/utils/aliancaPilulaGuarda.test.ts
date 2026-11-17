// 1a (regra dura 4.1.1): nada do Preparar escreve em `outputs` nem manda ao telao. So o menu ⋯ chama `toggleOutputs`, e sempre com `state:`.
//
// O QUE ESTA GUARDA NAO COBRE: escrita indireta (uma funcao importada que escreve em `outputs`): isso e da prova da secao H (invariantes.mjs),
// que mede `outputs` e os canais de verdade.
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")
const sem = (src: string) =>
    src
        .split("\n")
        .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
        .join("\n")

const BARRA = ["src/frontend/components/main/PrepararBarra.svelte", "src/frontend/components/main/PrepararPilula.svelte", "src/frontend/components/main/AnteparoDeModo.svelte", "src/frontend/utils/aliancaPilula.ts"]
const PROIBIDO_NA_BARRA = [/\bsetOutput\b/, /\bclear(?!Timeout|Interval)\w*\s*\(/, /\boutputs\.update\(/, /\boutputs\.set\(/, /\btoggleOutputs\b/, /\bsend\(\s*OUTPUT/, /\bsendMain\(/]
const NOVOS_TS = ["src/frontend/utils/aliancaPilula.ts", "src/frontend/utils/aliancaPilulaLogica.ts", "src/frontend/utils/aliancaSaidaMenuLogica.ts"]
const COMPONENTES = [...BARRA.filter((f) => f.endsWith(".svelte")), "src/frontend/components/main/PrepararMenu.svelte"]

export function citacoesProibidas(src: string, padroes: RegExp[]): string[] {
    const s = sem(src)
    return padroes.filter((p) => p.test(s)).map(String)
}

describe("barra do Preparar: nada vai ao ar (1a)", () => {
    it("a barra, a pilula, o anteparo e aliancaPilula.ts nao citam escrita em outputs nem o telao", () => {
        for (const rel of BARRA) expect(citacoesProibidas(ler(rel), PROIBIDO_NA_BARRA), rel).toEqual([])
    })
    it("so PrepararMenu.svelte cita toggleOutputs, e so com state:", () => {
        const menu = sem(ler("src/frontend/components/main/PrepararMenu.svelte"))
        const usos = [...menu.matchAll(/toggleOutputs\(([^)]*)\)/g)].map((m) => m[1])
        expect(usos.length).toBe(2)
        for (const u of usos) expect(u).toMatch(/\{\s*state:\s*(true|false)\s*\}/)
        for (const rel of [...BARRA, "src/frontend/utils/aliancaPilulaLogica.ts", "src/frontend/utils/aliancaSaidaMenuLogica.ts"]) expect(sem(ler(rel)), rel).not.toMatch(/toggleOutputs/)
    })
    it("a pilula so e renderizada quando pilulaVisivel deixa (tudo pronto some com chip pendente)", () => {
        const src = sem(ler("src/frontend/components/main/PrepararPilula.svelte"))
        expect(src.replace(/\s+/g, " ")).toContain('{:else if pilulaVisivel($pilula.pronto, $chips)} <button class="pilula"')
    })
    it("nenhum {@html}", () => {
        for (const rel of COMPONENTES) expect(sem(ler(rel)), rel).not.toContain("{@html")
    })
    it("nenhum .subscribe( fora de funcao nos .ts novos", () => {
        for (const rel of NOVOS_TS)
            expect(
                ler(rel)
                    .split("\n")
                    .filter((l) => /^\S.*\.subscribe\(/.test(l) && !l.startsWith("//")),
                rel
            ).toEqual([])
    })
    it("AnteparoDeModo.svelte: sem markup e sem setTimeout", () => {
        const src = ler("src/frontend/components/main/AnteparoDeModo.svelte")
        const fora = src
            .replace(/<script[\s\S]*?<\/script>/, "")
            .replace(/<style[\s\S]*?<\/style>/, "")
            .trim()
        expect(fora).toBe("")
        expect(sem(src)).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/)
    })
    it("MainLayout.svelte nao importa AliancaFaixa e o arquivo nao existe", () => {
        expect(ler("src/frontend/MainLayout.svelte")).not.toContain("AliancaFaixa")
        expect(existsSync(join(RAIZ, "src/frontend/components/main/AliancaFaixa.svelte"))).toBe(false)
    })
    it("a guarda morde: outputs.update, setOutput, clearAll e toggleOutputs sem state reprovam", () => {
        expect(citacoesProibidas("outputs.update((a) => a)", PROIBIDO_NA_BARRA)).toHaveLength(1)
        expect(citacoesProibidas("setOutput('slide', x)", PROIBIDO_NA_BARRA)).toHaveLength(1)
        expect(citacoesProibidas("clearAll()", PROIBIDO_NA_BARRA)).toHaveLength(1)
        expect(citacoesProibidas("clearTimeout(t)", PROIBIDO_NA_BARRA)).toHaveLength(0)
        expect(citacoesProibidas("// outputs.set(1)", PROIBIDO_NA_BARRA)).toHaveLength(0)
    })
})
