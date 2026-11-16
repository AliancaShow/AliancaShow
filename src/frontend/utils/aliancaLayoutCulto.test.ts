import { beforeEach, describe, expect, it } from "vitest"
import { _reiniciarLayoutCulto, configurarLayoutCulto, layoutAtivo, layoutNovo, valorDaChave } from "./aliancaLayoutCulto"

let carregado = true
let especial: any = {}
beforeEach(() => {
    _reiniciarLayoutCulto()
    carregado = true
    especial = {}
    configurarLayoutCulto({ especial: () => especial, carregado: () => carregado })
})

describe("aliancaLayoutCulto", () => {
    it("ausente = novo; classico = classico; qualquer outro valor = novo", () => {
        expect(valorDaChave({})).toBe("novo")
        expect(valorDaChave(undefined)).toBe("novo")
        expect(valorDaChave({ aliancaLayoutCulto: "classico" })).toBe("classico")
        for (const v of ["Classico", "", null, 1, "novo", "clássico"]) expect(valorDaChave({ aliancaLayoutCulto: v })).toBe("novo")
        expect(layoutNovo()).toBe(true)
    })
    it("classico desliga o novo", () => {
        especial = { aliancaLayoutCulto: "classico" }
        expect(layoutNovo()).toBe(false)
        expect(layoutAtivo()).toBe("classico")
    })
    it("congela na primeira chamada depois de loaded: mudar special depois nao muda o valor", () => {
        expect(layoutNovo()).toBe(true)
        especial = { aliancaLayoutCulto: "classico" }
        expect(layoutNovo()).toBe(true)
        expect(layoutAtivo()).toBe("novo")
    })
    it("antes de loaded devolve true SEM congelar", () => {
        carregado = false
        especial = { aliancaLayoutCulto: "classico" }
        expect(layoutNovo()).toBe(true)
        carregado = true
        expect(layoutNovo()).toBe(false)
    })
    it("sem fontes configuradas devolve true (a janela de saida roda o mesmo grafo)", () => {
        _reiniciarLayoutCulto()
        expect(layoutNovo()).toBe(true)
    })
})
