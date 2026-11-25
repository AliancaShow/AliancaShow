import { describe, expect, it } from "vitest"
import { saidaDoEditor, telaPrincipal } from "./aliancaSaidaDoEditorLogica"

describe("a tela principal (editor, No ar e faixa)", () => {
    const cabine = {
        default: { name: "Painel LED", enabled: true },
        ret: { name: "Retorno", enabled: true, stageOutput: "palco1" },
        ndi1: { name: "NDI-FullScreen", enabled: true, invisible: true },
        ndi2: { name: "NDI-Alpha", enabled: true, invisible: true }
    }
    it("a cabine: NDI sem janela vem antes em ordem alfabetica, mas o editor segue o Painel LED", () => {
        expect(saidaDoEditor(cabine)).toBe("default")
    })
    it("o retorno nunca e a principal, mesmo vindo primeiro na lista (o caso de 25/nov)", () => {
        expect(telaPrincipal({ ret: { enabled: true, stageOutput: "palco1" }, tel: { enabled: true } })).toBe("tel")
    })
    it("a escolhida em Telas vence, se estiver ligada e for de slides", () => {
        expect(telaPrincipal(cabine, "ndi2")).toBe("ndi2")
        expect(telaPrincipal(cabine, "ret")).toBe("default")
        expect(telaPrincipal({ a: { enabled: true }, b: { enabled: false } }, "b")).toBe("a")
        expect(telaPrincipal(cabine, "sumiu")).toBe("default")
    })
    it("saida desligada nao conta", () => {
        expect(telaPrincipal({ a: { enabled: false }, b: { enabled: true } })).toBe("b")
    })
    it("so saidas de rede: a primeira delas", () => {
        expect(telaPrincipal({ n1: { enabled: true, invisible: true }, n2: { enabled: true, invisible: true } })).toBe("n1")
    })
    it("nada de slides ligado: vazio", () => {
        expect(telaPrincipal({})).toBe("")
        expect(telaPrincipal(null)).toBe("")
        expect(telaPrincipal({ r: { enabled: true, stageOutput: "x" } })).toBe("")
    })
})
