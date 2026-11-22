import { describe, expect, it } from "vitest"
import { VigiaDeAjustes, assinaturaDosAjustes } from "./aliancaMidiaSalva"

describe("ajustes de mídia marcam 'não salvo' (22/nov)", () => {
    it("a primeira leitura é a base: o que veio do disco não é alteração", () => {
        const v = new VigiaDeAjustes()
        expect(v.mudou({ "C:/a.png": { fit: "cover" } })).toBe(false)
        expect(v.mudou({ "C:/a.png": { fit: "cover" } })).toBe(false)
    })

    it("mudar encaixe, filtro, espelhar ou volume é alteração", () => {
        const v = new VigiaDeAjustes()
        v.mudou({ "C:/a.png": { tags: ["alianca:bib"] } })
        expect(v.mudou({ "C:/a.png": { tags: ["alianca:bib"], fit: "contain" } })).toBe(true)
        expect(v.mudou({ "C:/a.png": { tags: ["alianca:bib"], fit: "contain", filter: "blur(2px)" } })).toBe(true)
        expect(v.mudou({ "C:/a.png": { tags: ["alianca:bib"], fit: "contain", filter: "blur(2px)", flipped: true } })).toBe(true)
        expect(v.mudou({ "C:/a.png": { tags: ["alianca:bib"], fit: "contain", filter: "blur(2px)", flipped: true, volume: 40 } })).toBe(true)
    })

    it("tirar um ajuste (Redefinir) também é alteração", () => {
        const v = new VigiaDeAjustes()
        v.mudou({ "C:/a.png": { fit: "cover" } })
        expect(v.mudou({ "C:/a.png": {} })).toBe(true)
    })

    it("o cache que o app escreve ao navegar (info, creationTime…) não é alteração", () => {
        const v = new VigiaDeAjustes()
        v.mudou({ "C:/a.mp4": { fit: "cover" } })
        expect(v.mudou({ "C:/a.mp4": { fit: "cover", info: { codecs: ["avc1"] }, creationTime: 5 } })).toBe(false)
        expect(v.mudou({ "C:/a.mp4": { fit: "cover", info: { codecs: ["avc1"] }, creationTime: 5 }, "C:/b.png": { creationTime: 7 } })).toBe(false)
    })

    it("a ordem das chaves não conta", () => {
        expect(assinaturaDosAjustes({ b: { y: 1, x: 2 }, a: { z: 1 } })).toBe(assinaturaDosAjustes({ a: { z: 1 }, b: { x: 2, y: 1 } }))
    })
})
