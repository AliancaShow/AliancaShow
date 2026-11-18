import { describe, expect, it, vi } from "vitest"

vi.mock("../components/helpers/array", () => ({ sortByName: (a: any[]) => [...a].sort((x, y) => String(x.name || "").localeCompare(String(y.name || ""))) }))
import { ABAS, montarArvoreDeCultos } from "./aliancaRoteiroLogica"

const folders = {
    raiz: { name: "Alianca", parent: "/" },
    ano: { name: "2026", parent: "raiz" },
    mes: { name: "11-novembro", parent: "ano" },
    imp: { name: "Impulso", parent: "/" },
    impMes: { name: "11-novembro", parent: "imp" }
}
const projects = {
    p1: { name: "2026-11-16", parent: "mes" },
    p2: { name: "2026-11-22", parent: "impMes" },
    solto: { name: "Avulso", parent: "/" }
}
const base = { folders, projects, sorted: undefined, profile: {} }

describe("montarArvoreDeCultos", () => {
    it("Todos: cabecalho de grupo com o nome da agenda e os projetos sem pasta aberta", () => {
        const t = montarArvoreDeCultos({ ...base, agenda: "todos" })
        const grupos = t.filter((x: any) => x.type === "grupo").map((x: any) => x.name)
        expect(grupos).toContain("Aliança · 11-novembro")
        expect(grupos).toContain("Impulso · 11-novembro")
        expect(t.some((x: any) => x.id === "solto")).toBe(true)
    })
    it("na aba de uma agenda so entra a raiz dela, e projeto solto fica de fora", () => {
        const t = montarArvoreDeCultos({ ...base, agenda: "impulso" })
        expect(t.some((x: any) => x.id === "p2")).toBe(true)
        expect(t.some((x: any) => x.id === "p1" || x.id === "solto")).toBe(false)
    })
    it("pasta apagada ou de perfil sem acesso some", () => {
        const t = montarArvoreDeCultos({ ...base, profile: { imp: "none" }, agenda: "todos" })
        expect(t.some((x: any) => x.id === "p2")).toBe(false)
    })
    it("ABAS tem Todos primeiro", () => expect(ABAS[0].id).toBe("todos"))
})
