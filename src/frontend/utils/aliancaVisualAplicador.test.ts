// Visual (V1): o aplicador falando com as lojas de verdade e com o rascunho de Configuracoes (a logica pura esta em aliancaVisualLogica.test.ts).
import { get } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"

const efeitos = vi.hoisted(() => ({ refreshOut: vi.fn() }))
vi.mock("./language", () => ({ setLanguage: vi.fn() }))
vi.mock("../components/helpers/output", () => ({ refreshOut: efeitos.refreshOut }))
vi.mock("../IPC/main", () => ({ sendMain: vi.fn() }))
vi.mock("./request", () => ({ send: vi.fn() }))
vi.mock("./updateSettings", () => ({ updateThemeValues: vi.fn() }))
vi.mock("./save", async () => {
    const s = await import("../stores")
    return { getSyncedSettings: () => ({ styles: s.styles }) }
})

import { loaded, loadedState, outputs, special, stageShows, styles, templates } from "../stores"
import { alteracoesNaoSalvas, descartarAlteracoes, iniciarRascunho, pararRascunho, tirarFoto } from "./aliancaConfigRascunho"
import { ativarVisual, cancelarPendenciasDoVisual, darEstiloProprio, iniciarVisual, mudarVisual, problemasDoVisual, visualPendente } from "./aliancaVisualAplicador"
import { lerVisuais, type Visual } from "./aliancaVisualLogica"

const padrao: Visual = { id: "pad", nome: "Culto padrão", saidas: { tel: { musica: "slide", biblia: "slide" }, led: { musica: "letraLed", biblia: "slide" } }, retorno: { ret: "palco1" } }
const impulso: Visual = { id: "imp", nome: "Impulso", saidas: { tel: { musica: "slide", biblia: "slide" }, led: { musica: "letraImp", biblia: "versImp" } }, retorno: { ret: "palco2" } }

beforeEach(() => {
    vi.useRealTimers()
    pararRascunho()
    cancelarPendenciasDoVisual()
    templates.set({ letraLed: { name: "Letra LED" }, letraImp: { name: "Letra Impulso" }, versImp: { name: "Versículo Impulso" } } as any)
    stageShows.set({ palco1: { name: "Só texto" }, palco2: { name: "Espelho" } } as any)
    styles.set({ s1: { name: "Telão" }, s2: { name: "LED", template: "letraLed" } } as any)
    outputs.set({
        tel: { name: "Telão", style: "s1", enabled: true },
        led: { name: "Telão LED", style: "s2", enabled: true },
        ret: { name: "Retorno", stageOutput: "palco1", enabled: true }
    } as any)
    special.set({ outra: 1, aliancaVisuais: [padrao, impulso], aliancaVisualAtivo: "pad" })
    tirarFoto()
})

describe("ativar um Visual", () => {
    it("escreve template/templateScripture do estilo e stageOutput do retorno, sem slide no ar = na hora", () => {
        ativarVisual("imp")
        expect(get(special).aliancaVisualAtivo).toBe("imp")
        expect((get(styles) as any).s2).toMatchObject({ template: "letraImp", templateScripture: "versImp" })
        expect((get(styles) as any).s1.template).toBeUndefined()
        expect((get(outputs) as any).ret.stageOutput).toBe("palco2")
        // voltar ao padrão: "slide" limpa o campo
        ativarVisual("pad")
        expect((get(styles) as any).s2.templateScripture).toBeUndefined()
        expect((get(styles) as any).s2.template).toBe("letraLed")
    })
    it("com Configurações aberta: não conta como não salvo e Descartar não desfaz; o que o operador mexeu à mão continua no rascunho", async () => {
        iniciarRascunho()
        special.update((s) => ({ ...s, outra: 2 })) // mexida à mão
        ativarVisual("imp")
        await new Promise((r) => setTimeout(r, 200))
        expect(get(alteracoesNaoSalvas)).toBe(1)
        descartarAlteracoes()
        expect(get(special).outra).toBe(1)
        expect(get(special).aliancaVisualAtivo).toBe("imp")
        expect((get(styles) as any).s2.template).toBe("letraImp")
        expect((get(outputs) as any).ret.stageOutput).toBe("palco2")
        expect(get(alteracoesNaoSalvas)).toBe(0)
    })
    it("Visual que não existe quebra alto e não muda nada", () => {
        ativarVisual("nao-existe")
        expect(get(special).aliancaVisualAtivo).toBe("pad")
    })
})

describe("D15: vale no próximo slide", () => {
    const noAr = (slide: any) => outputs.update((a: any) => ({ ...a, led: { ...a.led, out: { slide } } }))
    it("slide no ar: espera; a troca do slide escreve no mesmo instante (dentro do assinante)", () => {
        const parar = iniciarVisualPronto()
        noAr({ id: "show", layout: "l", index: 0 })
        ativarVisual("imp")
        expect((get(styles) as any).s2.template).toBe("letraLed")
        expect(get(visualPendente).saidas).toEqual(new Set(["led"]))
        // Telão não tinha slide: entrou na hora (nada a escrever) e o retorno também
        expect((get(outputs) as any).ret.stageOutput).toBe("palco2")
        noAr({ id: "show", layout: "l", index: 1 })
        expect((get(styles) as any).s2.template).toBe("letraImp")
        expect(get(visualPendente).saidas.size).toBe(0)
        parar()
    })
    it("Descartar cancela a pendência", () => {
        const parar = iniciarVisualPronto()
        noAr({ id: "show", index: 0 })
        ativarVisual("imp")
        expect(cancelarPendenciasDoVisual()).toBeGreaterThan(0)
        noAr({ id: "show", index: 1 })
        expect((get(styles) as any).s2.template).toBe("letraLed")
        parar()
    })
})

describe("estilo dividido", () => {
    it("pedidos diferentes no mesmo estilo: nada é escrito no campo e o problema aparece; dar estilo próprio resolve", () => {
        outputs.update((a: any) => ({ ...a, tel: { ...a.tel, style: "s2" } }))
        ativarVisual("imp")
        expect((get(styles) as any).s2.template).toBe("letraLed")
        expect(get(problemasDoVisual).map((p) => p.tipo)).toContain("estiloDividido")
        const novo = darEstiloProprio("tel")!
        expect((get(outputs) as any).tel.style).toBe(novo)
        expect((get(styles) as any)[novo].name).toBe("Telão")
        expect((get(styles) as any)[novo].template).toBeUndefined()
        expect((get(styles) as any).s2.template).toBe("letraImp")
        expect(get(problemasDoVisual)).toEqual([])
    })
})

describe("mudar uma casa do Visual ativo", () => {
    it("grava a lista e aplica", () => {
        mudarVisual({ ...padrao, saidas: { ...padrao.saidas, tel: { musica: "letraLed", biblia: "slide" } } })
        expect(lerVisuais(get(special)).find((v) => v.id === "pad")!.saidas.tel.musica).toBe("letraLed")
        expect((get(styles) as any).s1.template).toBe("letraLed")
    })
})

describe("migração na partida", () => {
    it("sem lista: cria o Culto padrão lendo os estilos; NÃO escreve em styles nem em outputs", () => {
        special.set({})
        const antes = JSON.stringify([get(styles), get(outputs)])
        const parar = iniciarVisualPronto()
        const l = lerVisuais(get(special))
        expect(l).toHaveLength(1)
        expect(l[0].nome).toBe("Culto padrão")
        expect(l[0].saidas.led.musica).toBe("letraLed")
        expect(get(special).aliancaVisualAtivo).toBe(l[0].id)
        expect(JSON.stringify([get(styles), get(outputs)])).toBe(antes)
        parar()
    })
})

function iniciarVisualPronto() {
    loaded.set(true)
    loadedState.set(["synced_settings"])
    return iniciarVisual()
}
