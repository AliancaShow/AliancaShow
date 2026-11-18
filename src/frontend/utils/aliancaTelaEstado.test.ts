import { readFileSync } from "node:fs"
import { join } from "node:path"
import { get } from "svelte/store"
import { describe, expect, it } from "vitest"
import { aliancaTela, normalizarTelaSalva, TELA_PADRAO } from "./aliancaTelaEstado"

const ler = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8")

describe("aliancaTela: ida e volta (salvar -> disco -> carregar)", () => {
    it("o que se grava volta igual (JSON no meio, como o settings.json)", () => {
        aliancaTela.set({ esq: 320, dir: 400, bib: 180 })
        const gravado = JSON.parse(JSON.stringify({ aliancaTela: get(aliancaTela) }))
        expect(normalizarTelaSalva(gravado.aliancaTela)).toEqual({ esq: 320, dir: 400, bib: 180 })
    })
    it("sem a chave, lixo ou parcial: o padrao 280/330/260 completa", () => {
        for (const ruim of [undefined, null, "x", 5, [], [1, 2, 3], {}, { esq: "300" }, { esq: NaN, dir: Infinity }]) expect(normalizarTelaSalva(ruim)).toEqual(TELA_PADRAO)
        expect(normalizarTelaSalva({ dir: 400.4 })).toEqual({ esq: 280, dir: 400, bib: 260 })
    })
})

describe("a chave aliancaTela esta em todos os lugares que o tsc exige", () => {
    it("SaveListSettings (types/Save.ts), defaults do electron e a lista de save/update", () => {
        expect(ler("types/Save.ts")).toMatch(/\| "aliancaTela"/)
        expect(ler("electron/data/defaults.ts")).toMatch(/aliancaTela: \{ esq: 280, dir: 330, bib: 260 \}/)
        expect(ler("frontend/utils/save.ts")).toMatch(/aliancaTela: get\(aliancaTela\)/)
        expect(ler("frontend/utils/updateSettings.ts")).toMatch(/aliancaTela: \(v: any\) => aliancaTela\.set\(normalizarTelaSalva\(v\)\)/)
    })
})
