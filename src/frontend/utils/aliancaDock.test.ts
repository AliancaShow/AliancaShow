import { describe, expect, it } from "vitest"
import { estiloDock } from "./aliancaDock"

describe("estiloDock (fatia 9)", () => {
    it("acopla a barra no rodape, sem sombra, com tokens Luz, tudo com !important", () => {
        const e = estiloDock("left")
        expect(e).toContain("position: sticky !important")
        expect(e).toContain("bottom: 0 !important")
        expect(e).toContain("background-color: var(--luz-painel-opaco)")
        expect(e).toContain("box-shadow: none !important")
        expect(
            e
                .split(";")
                .filter(Boolean)
                .every((d) => d.trim().endsWith("!important"))
        ).toBe(true)
    })
    it("o lado decide o alinhamento", () => {
        expect(estiloDock("left")).toContain("align-self: flex-start")
        expect(estiloDock("right")).toContain("align-self: flex-end")
    })
})
