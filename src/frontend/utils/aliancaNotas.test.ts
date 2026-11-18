import { beforeEach, describe, expect, it, vi } from "vitest"

const gravado = vi.hoisted(() => ({ slides: [] as any[], layouts: [] as any[], falhas: [] as any[] }))
vi.mock("../components/helpers/shows", () => ({
    _show: (id: string) => ({
        slides: (ids: string[]) => ({ set: (v: any) => gravado.slides.push([id, ids, v]) }),
        layouts: (l: string) => ({ set: (v: any) => gravado.layouts.push([id, l, v]) })
    })
}))
vi.mock("./aliancaFalha", () => ({ falhaAlta: (...a: any[]) => gravado.falhas.push(a) }))

import { gravarNotaDoShow, gravarNotaDoSlide } from "./aliancaNotas"

beforeEach(() => {
    gravado.slides.length = gravado.layouts.length = gravado.falhas.length = 0
})

describe("notas pelas propriedades de Editar (achado 8)", () => {
    it("nota do slide: grava `notes` no slide do show certo", () => {
        expect(gravarNotaDoSlide("s", "sl1", "", "tocar baixo")).toBe(true)
        expect(gravado.slides).toEqual([["s", ["sl1"], { key: "notes", value: "tocar baixo" }]])
    })
    it("nota do show: grava `notes` no layout ativo", () => {
        expect(gravarNotaDoShow("s", "", "entra no 2o refrao")).toBe(true)
        expect(gravado.layouts).toEqual([["s", "active", { key: "notes", value: "entra no 2o refrao" }]])
    })
    it("texto igual ao atual nao regrava (nao suja o show)", () => {
        gravarNotaDoSlide("s", "sl1", "x", "x")
        gravarNotaDoShow("s", "y", "y")
        expect(gravado.slides.length + gravado.layouts.length).toBe(0)
    })
    it("sem slide ou sem show: falha alta, nada gravado", () => {
        expect(gravarNotaDoSlide("s", "", "", "a")).toBe(false)
        expect(gravarNotaDoShow("", "", "a")).toBe(false)
        expect(gravado.falhas.length).toBe(2)
        expect(gravado.slides.length + gravado.layouts.length).toBe(0)
    })
})
