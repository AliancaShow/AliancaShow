import { beforeEach, describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"

// Revisao da fatia 3, achados 1 e 2: "mandar de novo" so toca as saidas do envio.
const espia = vi.hoisted(() => ({ avisos: [] as string[], setOutput: 0, refreshOut: 0, ref: [] as any[], bindings: [] as string[] }))
vi.mock("../components/helpers/output", async () => {
    const { outputs } = await import("../stores")
    return {
        getActiveOutputs: () => ["A", "B"],
        // o refreshOut(true, true) real: foto nova em TODAS as saidas ativas
        refreshOut: () => {
            espia.refreshOut++
            outputs.update((a: any) => {
                for (const id of ["A", "B"]) if (a[id].out?.slide?.foto) a[id].out.slide.foto = { ...a[id].out.slide.foto, slide: { v: "novo" } }
                return a
            })
        },
        // o que o setOutput real faz com a foto: mesmo slide reaproveita, senao tira nova (so o necessario para a prova)
        setOutput: (_t: string, data: any, _tg: boolean, outputId: string) => {
            espia.setOutput++
            const ids = outputId ? [outputId] : espia.bindings.length ? espia.bindings : ["A", "B"]
            outputs.update((a: any) => {
                for (const id of ids) a[id].out = { ...a[id].out, slide: { ...data, foto: a[id].out?.slide?.index === data.index ? a[id].out.slide.foto : { slideId: "s" + data.index, ocorrencia: 0, index: data.index, slide: { v: "enviado" } } } }
                return a
            })
        }
    }
})
vi.mock("../components/helpers/showActions", () => ({ updateOut: () => {}, checkActionTrigger: () => {} }))
vi.mock("../components/actions/actions", () => ({ customActionActivation: () => {} }))
vi.mock("./common", () => ({ newToast: (m: string) => espia.avisos.push(m) }))
vi.mock("../components/helpers/setShow", () => ({ loadShows: async () => {} }))
vi.mock("../components/helpers/shows", () => ({ _show: () => ({ layouts: () => ({ ref: () => [espia.ref] }) }) }))
vi.mock("./aliancaFoto", async () => ({
    ...(await import("./aliancaFotoLogica")),
    tirarFoto: (_id: string, _l: string, index: number) => ({ slideId: "s" + index, ocorrencia: 0, index, slide: { v: "novo" } })
}))

import { outLocked, outputs, showsCache } from "../stores"
import { atualizarSlideNoAr, mandarSlideAoAr } from "./aliancaEditarAcoes"

const foto = (i: number, v: string) => ({ slideId: "s" + i, ocorrencia: 0, index: i, slide: { v } })
const noAr = (i: number) => ({ out: { slide: { id: "show", layout: "L", index: i, foto: foto(i, "velho") } } })
const espera = () => new Promise((r) => setTimeout(r, 5))
const fotoDe = (id: string) => (get(outputs) as any)[id].out.slide.foto.slide.v

beforeEach(() => {
    espia.refreshOut = 0
    espia.setOutput = 0
    espia.avisos.length = 0
    espia.bindings = []
    espia.ref = [0, 1, 2].map((i) => ({ id: "s" + i, data: {} }))
    outLocked.set(false)
    showsCache.set({ show: { settings: { activeLayout: "L" } } } as any)
})

describe("Mandar so para: mexe so na saida escolhida (achado 1)", () => {
    it("duas telas no slide 1: mandar so para B refotografa B e deixa o telao (A) na versao velha", async () => {
        outputs.set({ A: noAr(1), B: noAr(1) } as any)
        mandarSlideAoAr("show", 1, "B")
        await espera()
        expect(fotoDe("B")).toBe("novo")
        expect(fotoDe("A")).toBe("velho")
        expect(espia.refreshOut).toBe(0)
    })
    it("telao no 1 (editado), transmissao no 2: reenviar o 2 so para a transmissao nao refotografa o telao", async () => {
        outputs.set({ A: noAr(1), B: noAr(2) } as any)
        mandarSlideAoAr("show", 2, "B")
        await espera()
        expect(fotoDe("A")).toBe("velho")
        expect(fotoDe("B")).toBe("novo")
    })
    it("slide com bind_to: so as telas ligadas ganham foto nova", async () => {
        espia.bindings = ["B"]
        espia.ref = [0, 1, 2].map((i) => ({ id: "s" + i, data: { bindings: ["B"] } }))
        outputs.set({ A: noAr(1), B: noAr(1) } as any)
        mandarSlideAoAr("show", 1)
        await espera()
        expect(fotoDe("B")).toBe("novo")
        expect(fotoDe("A")).toBe("velho")
    })
    it("Mandar pro ar sem destino: todas as telas que ja estavam no slide ganham foto nova", async () => {
        outputs.set({ A: noAr(1), B: noAr(1) } as any)
        mandarSlideAoAr("show", 1)
        await espera()
        expect(fotoDe("A")).toBe("novo")
        expect(fotoDe("B")).toBe("novo")
    })
})

describe("Faixa Mandar pro ar: atualiza so quem mostra o slide (achado 2)", () => {
    it("transmissao no slide 2 (editado), telao no slide 1: o telao NAO pula para o 2", async () => {
        showsCache.set({ show: { settings: { activeLayout: "L" }, slides: { s2: { items: [1, 2] } } } } as any)
        outputs.set({ A: noAr(1), B: noAr(2) } as any)
        expect(atualizarSlideNoAr("show", 2)).toBe(true)
        await espera()
        const a = (get(outputs) as any).A.out.slide
        expect(a.index).toBe(1)
        expect(a.foto.slide.v).toBe("velho")
        expect(fotoDe("B")).toBe("novo")
    })
    it("nenhuma tela mostra o slide: falha alta, nada vai ao ar", async () => {
        outputs.set({ A: noAr(1), B: noAr(1) } as any)
        expect(atualizarSlideNoAr("show", 2)).toBe(false)
        await espera()
        expect((get(outputs) as any).A.out.slide.index).toBe(1)
    })
})

describe("saida travada diz que esta travada (menor 10)", () => {
    it("nao manda nada e avisa com o toast", async () => {
        outLocked.set(true)
        outputs.set({ A: noAr(1), B: noAr(1) } as any)
        expect(mandarSlideAoAr("show", 2)).toBe(false)
        await espera()
        expect(espia.setOutput).toBe(0)
        expect(espia.avisos).toEqual(["Telão congelado: descongele para mandar pro ar."])
    })
})
