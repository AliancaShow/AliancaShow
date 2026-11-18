import { beforeEach, describe, expect, it, vi } from "vitest"

// a varredura de pasta da busca (Ctrl+K): uma leitura por vez, com validade, e o acento nao esconde o arquivo
const lerPasta = vi.fn()
vi.mock("../../IPC/main", () => ({ requestMain: (...a: any[]) => lerPasta(...a) }))
vi.mock("../../stores", () => ({}))
vi.mock("../../utils/searchFast", () => ({ buildBibleIndex: () => null, fastBibleSearch: () => [] }))
vi.mock("../actions/apiHelper", () => ({ sortByClosestMatch: (l: any[]) => l }))
vi.mock("../drawer/bible/scripture", () => ({ loadJsonBible: async () => null }))
vi.mock("../helpers/media", () => ({ getExtension: (p: string) => p.split(".").pop(), getMediaType: () => "video" }))
vi.mock("./searchHighlight", () => ({ getTextSnippet: () => "" }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../helpers/array", () => ({ sortObjectNumbers: (x: any) => x }))
vi.mock("svelte/store", () => ({ get: () => ({}) }))

import { getMediaResults, VALIDADE_VARREDURA_MS } from "./quicksearchData"

const pasta = { "C:/m/Oração.mp4": { name: "Oração.mp4" } }
let n = 0
const nova = () => `C:/pasta-${++n}` // chave de cache nova a cada teste

beforeEach(() => lerPasta.mockReset())

describe("getMediaResults: varredura de pasta", () => {
    it("buscas seguidas durante a mesma leitura dividem UMA leitura", async () => {
        lerPasta.mockImplementation(() => new Promise((r) => setTimeout(() => r(pasta), 20)))
        const p = nova()
        await Promise.all([getMediaResults("or", [p]), getMediaResults("ora", [p]), getMediaResults("orac", [p])])
        expect(lerPasta).toHaveBeenCalledTimes(1)
    })
    it("depois da validade a pasta e lida de novo (arquivo novo durante o culto aparece)", async () => {
        lerPasta.mockResolvedValue(pasta)
        const p = nova()
        await getMediaResults("or", [p], 1000)
        await getMediaResults("or", [p], 1000 + VALIDADE_VARREDURA_MS - 1)
        expect(lerPasta).toHaveBeenCalledTimes(1)
        await getMediaResults("or", [p], 1000 + VALIDADE_VARREDURA_MS)
        expect(lerPasta).toHaveBeenCalledTimes(2)
    })
    it("leitura que falhou nao fica guardada", async () => {
        lerPasta.mockRejectedValueOnce(new Error("rede")).mockResolvedValue(pasta)
        const p = nova()
        await expect(getMediaResults("or", [p])).rejects.toThrow()
        await Promise.resolve()
        expect((await getMediaResults("or", [p])).length).toBe(1)
    })
    it("'oracao' acha 'Oração.mp4'", async () => {
        lerPasta.mockResolvedValue(pasta)
        expect((await getMediaResults("oracao", [nova()])).map((x: any) => x.name)).toEqual(["Oração.mp4"])
    })
})
