import { describe, expect, it } from "vitest"
import { camadasDoNoAr, tudoDesabilitado, type EntradaCamadas } from "./aliancaCamadasLogica"

const limpo: EntradaCamadas = { fundoLimpo: true, textoLimpo: true, sobreposicaoLimpa: true, efeitosLimpos: true, audioLimpo: true, tudoLimpo: true, travada: false }

describe("camadasDoNoAr", () => {
    it("tudo limpo: nenhuma camada no ar, todas desabilitadas, na ordem do prototipo", () => {
        const c = camadasDoNoAr(limpo)
        expect(c.map((x) => x.id)).toEqual(["sobre", "texto", "fundo", "audio"])
        expect(c.every((x) => !x.noAr && x.desabilitada)).toBe(true)
        expect(tudoDesabilitado(limpo)).toBe(true)
    })
    it("fundo e texto no ar", () => {
        const c = camadasDoNoAr({ ...limpo, fundoLimpo: false, textoLimpo: false, tudoLimpo: false })
        expect(c.filter((x) => x.noAr).map((x) => x.id)).toEqual(["texto", "fundo"])
    })
    it("efeito sem sobreposicao conta como sobreposicao no ar (F3 limpa os dois)", () => {
        expect(camadasDoNoAr({ ...limpo, efeitosLimpos: false })[0].noAr).toBe(true)
    })
    it("saida travada desabilita tudo", () => {
        const c = camadasDoNoAr({ ...limpo, fundoLimpo: false, travada: true })
        expect(c.every((x) => x.desabilitada)).toBe(true)
        expect(tudoDesabilitado({ ...limpo, tudoLimpo: false, travada: true })).toBe(true)
    })
    it("D9: Spotify tocando acende a camada Audio e habilita F4 e Limpar tudo, mesmo com o resto limpo", () => {
        const e = { ...limpo, spotifyTocando: true }
        const audio = camadasDoNoAr(e).find((x) => x.id === "audio")!
        expect(audio.noAr).toBe(true)
        expect(audio.desabilitada).toBe(false)
        expect(tudoDesabilitado(e)).toBe(false)
        expect(
            camadasDoNoAr(e)
                .filter((x) => x.noAr)
                .map((x) => x.id)
        ).toEqual(["audio"])
    })
    it("D9: Spotify tocando com a saida travada continua desabilitado", () => {
        const e = { ...limpo, spotifyTocando: true, travada: true }
        expect(camadasDoNoAr(e).find((x) => x.id === "audio")!.desabilitada).toBe(true)
        expect(tudoDesabilitado(e)).toBe(true)
    })
})

import { proporcaoDaSaida } from "./aliancaCamadasLogica"
describe("proporcaoDaSaida", () => {
    it("reduz", () => {
        expect(proporcaoDaSaida(1920, 1080)).toBe("16:9")
        expect(proporcaoDaSaida(3840, 1280)).toBe("3:1")
        expect(proporcaoDaSaida(0, 0)).toBe("16:9")
    })
})
