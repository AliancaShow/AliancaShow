// Guarda da corrida da fatia 0b: nenhuma escrita ATRASADA (setTimeout, requestAnimationFrame, queueMicrotask, .then) nos quatro stores por
// modo (drawer, drawerTabsData, resized, activeDrawerTab) pode ir pela fachada: o lado tem de ser decidido na hora de agendar
// (`store.doModo(get(modoAlianca))`) e o callback escreve nesse lado. Se o modo mudar entre agendar e disparar, a fachada grava a
// gaveta de um modo no outro (o chip "leva ao Culto" faz activePage = show e logo modo = culto).
//
// O QUE ESTA GUARDA NAO COBRE: escrita depois de `await` (a funcao e sincrona do ponto de vista dos stores nos casos conhecidos; ver
// JUSTIFICADOS) e escrita feita por funcao chamada de dentro do callback (a guarda so le o texto do callback); parenteses dentro de
// texto podem confundir a contagem.
import { execFileSync } from "child_process"
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")

const ESCRITA = /\b(drawer|drawerTabsData|resized|activeDrawerTab)\.(set|update)\(|\$(drawer|drawerTabsData|resized|activeDrawerTab)\s*=[^=]/
const AGENDADORES = ["setTimeout(", "requestAnimationFrame(", "queueMicrotask(", ".then("]

/** texto entre o parentese de abertura em `abre` e o fecho correspondente */
function ate(src: string, abre: number): string {
    let n = 0
    for (let i = abre; i < src.length; i++) {
        if (src[i] === "(") n++
        else if (src[i] === ")" && --n === 0) return src.slice(abre, i + 1)
    }
    return src.slice(abre)
}

/** callbacks atrasados que escrevem num store por modo sem escolher o lado (`doModo(`) */
export function escritasAtrasadasPelaFachada(src: string): { linha: number; trecho: string }[] {
    const sem = src
        .split("\n")
        .map((l) => (/^\s*\/\//.test(l) ? "" : l))
        .join("\n")
    const achados: { linha: number; trecho: string }[] = []
    for (const ag of AGENDADORES) {
        let i = sem.indexOf(ag)
        while (i >= 0) {
            const corpo = ate(sem, i + ag.length - 1)
            if (ESCRITA.test(corpo) && !corpo.includes("doModo(")) achados.push({ linha: sem.slice(0, i).split("\n").length, trecho: corpo.replace(/\s+/g, " ").slice(0, 110) })
            i = sem.indexOf(ag, i + ag.length)
        }
    }
    return achados
}

/**
 * Escritas atrasadas que ficam pela fachada DE PROPOSITO, cada uma com o motivo e o numero exato (mudar o numero aparece no diff).
 */
export const JUSTIFICADOS: Record<string, { quantas: number; motivo: string }> = {
}

const arquivos = () =>
    execFileSync("git", ["ls-files", "src/frontend"], { cwd: RAIZ, encoding: "utf8" })
        .split("\n")
        .filter((f) => /\.(ts|svelte)$/.test(f) && !/\.test\.ts$/.test(f))

describe("escrita atrasada nos stores por modo", () => {
    it("o detector pega a linha antiga do Drawer.svelte e nao pega a corrigida", () => {
        const antiga = `$: if ($activePage === "show" && $drawer.autoclosed) setTimeout(() => drawer.set({ height: $drawer.stored ?? DEFAULT_DRAWER_HEIGHT, stored: null }), 100)`
        expect(escritasAtrasadasPelaFachada(antiga)).toHaveLength(1)
        const nova = `$: if ($activePage === "show" && $drawer.autoclosed) agendarReaberturaDaGaveta(drawer.doModo(get(modoAlianca)), DEFAULT_DRAWER_HEIGHT)`
        expect(escritasAtrasadasPelaFachada(nova)).toHaveLength(0)
        const rafAntigo = `animFrame = requestAnimationFrame(() => {\n  if (x) {\n    drawer.set({ height: 1, stored: null })\n  }\n})`
        expect(escritasAtrasadasPelaFachada(rafAntigo)).toHaveLength(1)
        const rafNovo = `const lado = drawer.doModo(get(modoAlianca))\nanimFrame = requestAnimationFrame(() => {\n  lado.set({ height: 1, stored: null })\n})`
        expect(escritasAtrasadasPelaFachada(rafNovo)).toHaveLength(0)
        expect(escritasAtrasadasPelaFachada(`.then(() => { resized.update((a) => a) })`)).toHaveLength(1)
        expect(escritasAtrasadasPelaFachada(`// setTimeout(() => drawer.set(1), 1)`)).toHaveLength(0)
    })

    it("nenhum arquivo do app escreve atrasado pela fachada, fora dos justificados", () => {
        const sujos: string[] = []
        const contagem: Record<string, number> = {}
        for (const f of arquivos()) {
            const achados = escritasAtrasadasPelaFachada(readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n"))
            if (!achados.length) continue
            contagem[f] = achados.length
            if (!(f in JUSTIFICADOS)) for (const a of achados) sujos.push(`${f}:${a.linha} ${a.trecho}`)
        }
        expect(sujos).toEqual([])
        for (const [f, j] of Object.entries(JUSTIFICADOS)) expect(contagem[f] ?? 0, f).toBe(j.quantas)
    })
})
