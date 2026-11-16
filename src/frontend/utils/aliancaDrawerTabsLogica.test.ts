import { describe, expect, it } from "vitest"
import { comunsDrawerTabs, sanearAbaMidia } from "./aliancaDrawerTabsLogica"

describe("comunsDrawerTabs", () => {
    it("copia tudo do lado escrito menos activeSubTab e aliancaFiltro da midia, que ficam os do outro lado", () => {
        const escrito = { media: { enabled: false, activeSubTab: "pasta:b", aliancaFiltro: ["audio"], openedSubSubTab: { online: "x" } }, shows: { enabled: true, activeSubTab: "c1" } }
        const outro = { media: { enabled: true, activeSubTab: "pasta:a", aliancaFiltro: ["video"] }, shows: { enabled: true, activeSubTab: "all" } }
        const r = comunsDrawerTabs(escrito as any, outro as any)
        expect(r.media).toEqual({ enabled: false, activeSubTab: "pasta:a", aliancaFiltro: ["video"], openedSubSubTab: { online: "x" } })
        expect(r.shows.activeSubTab).toBe("c1")
    })
    it("nunca devolve a mesma referencia (nada compartilhado entre os lados)", () => {
        const escrito = { shows: { enabled: true, activeSubTab: "a" }, media: { enabled: true, activeSubTab: "x" } }
        const r = comunsDrawerTabs(escrito as any, { media: { activeSubTab: "y" } } as any)
        expect(r.shows).not.toBe(escrito.shows)
        expect(r.media).not.toBe(escrito.media)
    })
    it("o outro lado sem campos por modo: o escrito os perde (nao vazam)", () => {
        const r = comunsDrawerTabs({ media: { enabled: true, activeSubTab: "pasta:b", aliancaFiltro: ["audio"] } } as any, { media: { enabled: true } } as any)
        expect(r.media).toEqual({ enabled: true })
    })
    it("escrito sem midia e outro com: a midia do outro fica", () => {
        const r = comunsDrawerTabs({ shows: { enabled: true } } as any, { media: { enabled: true, activeSubTab: "pasta:a" } } as any)
        expect(r.media.activeSubTab).toBe("pasta:a")
    })
})

describe("sanearAbaMidia", () => {
    const dados = (aba: string | null) => ({ media: { enabled: true, activeSubTab: aba } })
    it("pasta apagada volta para all; so a pasta apagada", () => {
        expect(sanearAbaMidia(dados("pasta:morta") as any, ["viva"]).media.activeSubTab).toBe("all")
        expect(sanearAbaMidia(dados("pasta:viva") as any, ["viva"]).media.activeSubTab).toBe("pasta:viva")
    })
    it("raiz, Sirvo, all, favoritos, inputs, online e provedores nao sao tocados; o MESMO objeto volta", () => {
        for (const a of ["pasta:raiz", "pasta:sirvo", "all", "favourites", "inputs", "online", "pexels", null]) {
            const d = dados(a)
            expect(sanearAbaMidia(d as any, [])).toBe(d)
        }
        expect(sanearAbaMidia({} as any, [])).toEqual({})
    })
    it("nao muda a entrada", () => {
        const d = dados("pasta:morta")
        sanearAbaMidia(d as any, [])
        expect(d.media.activeSubTab).toBe("pasta:morta")
    })
})
