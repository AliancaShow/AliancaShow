import { describe, expect, it } from "vitest"
import { saidaDoEditor } from "./aliancaSaidaDoEditorLogica"

describe("editor na proporcao do telao", () => {
    it("a cabine: NDI sem janela vem antes em ordem alfabetica, mas o editor segue o Painel LED", () => {
        const outputs = {
            default: { name: "Painel LED", enabled: true },
            ret: { name: "Retorno", enabled: true, stageOutput: "palco1" },
            ndi1: { name: "NDI-FullScreen", enabled: true, invisible: true },
            ndi2: { name: "NDI-Alpha", enabled: true, invisible: true }
        }
        expect(saidaDoEditor(outputs)).toBe("default")
    })
    it("o retorno (palco) nunca e a saida do editor, mesmo vindo primeiro", () => {
        expect(
            saidaDoEditor({
                ret: { enabled: true, stageOutput: true },
                tel: { enabled: true }
            })
        ).toBe("tel")
    })
    it("saida desligada nao conta", () => {
        expect(saidaDoEditor({ a: { enabled: false }, b: { enabled: true } })).toBe("b")
    })
    it("so saidas de rede: a primeira delas", () => {
        expect(
            saidaDoEditor({
                n1: { enabled: true, invisible: true },
                n2: { enabled: true, invisible: true }
            })
        ).toBe("n1")
    })
    it("nada habilitado: vazio (o FreeShow decide)", () => {
        expect(saidaDoEditor({})).toBe("")
        expect(saidaDoEditor(null)).toBe("")
    })
})
