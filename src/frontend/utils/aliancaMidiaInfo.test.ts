import { describe, expect, it, vi } from "vitest"

vi.mock("../IPC/main", () => ({ requestMain: vi.fn() }))

import { compararPorData, formatarData, formatarTamanho, infoDoStat } from "./aliancaMidiaInfo"

describe("aliancaMidiaInfo", () => {
    it("formata tamanho em KB, MB e GB", () => {
        expect(formatarTamanho(0)).toBe("")
        expect(formatarTamanho(300)).toBe("1 KB")
        expect(formatarTamanho(512 * 1024)).toBe("512 KB")
        expect(formatarTamanho(5.25 * 1024 * 1024)).toBe("5,3 MB")
        expect(formatarTamanho(248 * 1024 * 1024)).toBe("248 MB")
        expect(formatarTamanho(2.5 * 1024 * 1024 * 1024)).toBe("2,5 GB")
    })

    it("formata data como dd/mm/aaaa", () => {
        expect(formatarData(0)).toBe("")
        expect(formatarData(new Date(2026, 10, 5, 14, 0).getTime())).toBe("05/11/2026")
    })

    it("le tamanho e datas do stat (sem birthtime usa ctime)", () => {
        expect(infoDoStat(null)).toBeNull()
        expect(infoDoStat({ size: 10, birthtimeMs: 5, mtimeMs: 9 })).toEqual({ tamanho: 10, criado: 5, modificado: 9 })
        expect(infoDoStat({ size: 10, birthtimeMs: 0, ctimeMs: 7 })).toEqual({ tamanho: 10, criado: 7, modificado: 7 })
    })

    it("ordena por data com os sem data no fim", () => {
        const datas = [0, 10, 30, 20]
        expect([...datas].sort((a, b) => compararPorData(a, b))).toEqual([30, 20, 10, 0])
        expect([...datas].sort((a, b) => compararPorData(a, b, false))).toEqual([10, 20, 30, 0])
    })
})
