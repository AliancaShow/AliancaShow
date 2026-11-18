import { describe, expect, it } from "vitest"
import { estadoDaTarja, oQueNaoFoiAoAr, PISCA_MS, RECUSA_MS, recusaNova, TARJA_ALTURA } from "./aliancaTarjaLogica"
import { motivoDaRecusa } from "./aliancaSoRetornoLogica"

describe("C3: a tarja do so retorno", () => {
    it("tres estados; recusa so existe com o modo ligado", () => {
        expect(estadoDaTarja(false, false)).toBe("desligado")
        expect(estadoDaTarja(false, true)).toBe("desligado")
        expect(estadoDaTarja(true, false)).toBe("ligado")
        expect(estadoDaTarja(true, true)).toBe("recusa")
    })
    it("32 px sempre; recusa de 5 s; pisca de 0,9 s", () => {
        expect([TARJA_ALTURA, RECUSA_MS, PISCA_MS]).toEqual([32, 5000, 900])
    })
    it("o que nao foi ao ar sai da mensagem da recusa", () => {
        for (const o of ["mídia", "PDF", "áudio", "sobreposição", "efeito"]) expect(oQueNaoFoiAoAr(motivoDaRecusa(o))).toBe(o)
        expect(oQueNaoFoiAoAr("outra coisa")).toBe("item")
        expect(oQueNaoFoiAoAr(undefined)).toBe("item")
    })
    it("recusa nova = o contador cresceu", () => {
        expect(recusaNova(1, 0)).toBe(true)
        expect(recusaNova(3, 3)).toBe(false)
    })
})
