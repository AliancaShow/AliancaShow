import { describe, expect, it } from "vitest"
import { aplicarRecorte, recorteDeShows, decidirEscrita, filtroSemCategoria, FILHOS_FERRAMENTAS, NOS, RAIZES, raizDaAba, raizMostraTudo, sanearNaCarga, sanearSubAba, temNo } from "./aliancaArvoreLogica"

describe("arvore da biblioteca (C6)", () => {
    it("quatro raizes: Shows, Midia, Biblia, Ferramentas", () => {
        expect(RAIZES.map((r) => r.nome)).toEqual(["Shows", "Mídia", "Bíblia", "Ferramentas"])
    })
    it("Ferramentas guarda Modelos, Funcoes, Calendario e Sobreposicoes; Audio mora em Midia", () => {
        expect(FILHOS_FERRAMENTAS.map((f) => f.nome)).toEqual(["Modelos", "Funções", "Calendário", "Sobreposições"])
        expect(raizDaAba("audio")).toBe("media")
        for (const a of ["templates", "functions", "calendar", "overlays"]) expect(raizDaAba(a)).toBe("ferramentas")
        expect(raizDaAba("shows")).toBe("shows")
        expect(raizDaAba("scripture")).toBe("scripture")
    })
    it("tem as abas de antes, sem metronomo e sem timers", () => {
        expect(NOS.map((n) => n.id).sort()).toEqual(["audio", "calendar", "functions", "media", "overlays", "scripture", "shows", "templates"])
        expect(temNo("timers")).toBe(false)
    })
    it("clicar na raiz = tudo: a raiz so fica 'selecionada' na sub-aba all (filho selecionado = so aberta)", () => {
        expect(raizMostraTudo("shows", "shows", "all")).toBe(true)
        expect(raizMostraTudo("shows", "shows", "cat_louvor")).toBe(false)
        expect(raizMostraTudo("media", "media", "pasta:f1")).toBe(false)
        expect(raizMostraTudo("media", "audio", "")).toBe(false)
        expect(raizMostraTudo("ferramentas", "templates", "all")).toBe(false)
    })
    it("na carga, aba sem no vira shows sem reclamar; sub-aba antiga e saneada", () => {
        expect(sanearNaCarga("timers")).toBe("shows")
        expect(sanearNaCarga(undefined)).toBe("shows")
        expect(sanearNaCarga("audio")).toBe("audio")
        expect(sanearSubAba("media", "pasta:raiz")).toBe("all")
        expect(sanearSubAba("overlays", "effects")).toBe("effects")
        expect(sanearSubAba("shows", "unlabeled")).toBe("unlabeled")
        expect(sanearSubAba("media", "pasta:f1")).toBe("pasta:f1")
    })
    it("em uso, escrita sem no e recusada e a arvore volta ao ultimo valido", () => {
        expect(decidirEscrita("effects", "audio")).toEqual({ ok: false, voltarPara: "audio", nome: "effects" })
        expect(decidirEscrita("media", "audio")).toEqual({ ok: true, aba: "media" })
    })
    it("'Sem categoria · N' aparece so com N > 0 (ou filtrando) e so na raiz; some em zero", () => {
        expect(filtroSemCategoria(14, "all")).toEqual({ visivel: true, ativo: false })
        expect(filtroSemCategoria(0, "all")).toEqual({ visivel: false, ativo: false })
        expect(filtroSemCategoria(14, "cat_louvor")).toEqual({ visivel: false, ativo: false })
        expect(filtroSemCategoria(0, "unlabeled")).toEqual({ visivel: true, ativo: true })
    })
})

describe("recorte da lista de Shows pela arvore (C6)", () => {
    const cats = { louvor: {}, avisos: {} }
    const l = (id: string, categoria: string | null) => ({ id, categoria })
    it("raiz = tudo (os chips decidem); filtro Sem categoria e categoria valem nos dois tipos", () => {
        expect(recorteDeShows("all", cats)).toEqual({ tipo: "chips" })
        expect(recorteDeShows("", cats)).toEqual({ tipo: "chips" })
        expect(recorteDeShows("unlabeled", cats)).toEqual({ tipo: "sem-categoria" })
        expect(recorteDeShows("louvor", cats)).toEqual({ tipo: "categoria", id: "louvor" })
        expect(recorteDeShows("some", cats)).toEqual({ tipo: "chips" })
    })
    it("sem categoria inclui a categoria que nao existe mais; categoria filtra pela id", () => {
        const linhas = [l("a", null), l("b", "louvor"), l("c", "apagada")]
        expect(aplicarRecorte(linhas, { tipo: "sem-categoria" }, cats).map((x) => x.id)).toEqual(["a", "c"])
        expect(aplicarRecorte(linhas, { tipo: "categoria", id: "louvor" }, cats).map((x) => x.id)).toEqual(["b"])
        expect(aplicarRecorte(linhas, { tipo: "chips" }, cats)).toEqual(linhas)
    })
})
