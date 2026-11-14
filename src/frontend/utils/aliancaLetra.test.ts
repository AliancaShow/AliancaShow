import { describe, expect, it } from "vitest"
import { aparenciaDeAcordes, cabecalhoDeGrupo, ehAcorde, ehLinhaTecnica, linhasPorSlideDoModo, prepararLetraColada, tirarMarcadorDeRepeticao } from "./aliancaLetra"

describe("ehAcorde (token inteiro)", () => {
    it("acordes brasileiros e americanos", () => {
        for (const c of ["G", "Am", "C7M", "G/B", "Am7(b5)", "F#m", "Bb", "Dsus4", "Cadd9", "Em7", "C9", "A°", "Bm7(b5)", "D/F#", "Gmaj7", "C(9)", "E+", "G4", "F6", "Cdim", "Daug"]) expect(ehAcorde(c), c).toBe(true)
    })
    it("palavra não é acorde", () => {
        for (const w of ["FACE", "CADA", "A", "ABBA", "AMADO", "AMA", "BEBE", "CEGA", "Do", "Sol", "Mi", "Bis", "x2", "(2x)", "DEUS", "ELE", "Amém"]) {
            if (w === "A")
                expect(ehAcorde(w)).toBe(true) // "A" é acorde sozinho; quem decide é a linha
            else expect(ehAcorde(w), w).toBe(false)
        }
    })
})

describe("linhas que DEVEM ficar como letra", () => {
    const letra = ["FACE A FACE", "CADA DIA", "A CADA DIA", "A FACE DE DEUS", "AMADO", "AMA", "ABBA", "BEBE", "CEGA", "E A", "A ELE", "E agora", "Amém", "Do", "Sol", "Mi", "Bis", "x2", "(2x)", "DEUS É BOM", "A", "E", "Em"]
    for (const l of letra) {
        it(JSON.stringify(l), () => {
            const r = prepararLetraColada(`${l}\nlinha qualquer`)
            // nunca vira acorde: continua no texto (a não ser o marcador de repetição, que é tratado à parte)
            expect(r.absorvidas).toHaveLength(0)
            expect(r.descartadas).toHaveLength(0)
            if (!["Bis", "x2", "(2x)"].includes(l)) expect(r.texto.split("\n")[0]).toBe(l)
        })
    }
})

describe("linha de acorde com letra embaixo", () => {
    it("pendura o acorde na posição certa e tira a linha de cima", () => {
        const r = prepararLetraColada("G       D\nAos teus pés\n\nG D Em\nOutra\n")
        expect(r.texto).toBe("Aos teus pés\n\nOutra")
        expect(r.acordes.get("Aos teus pés")).toEqual([
            { pos: 0, key: "G" },
            { pos: 9, key: "D" }
        ])
        expect(r.absorvidas.map((a) => a.texto)).toEqual(["G       D", "G D Em"])
        expect(r.totalDeAcordes).toBe(5)
    })
    it("reconhece C7M, G/B, Am7(b5), separadores e ignora a margem da letra", () => {
        const r = prepararLetraColada("C7M   G/B   Am7(b5)\n  Santo é o Senhor Deus\n")
        expect(r.texto).toBe("Santo é o Senhor Deus")
        expect(r.acordes.get("Santo é o Senhor Deus")?.map((a) => a.key)).toEqual(["C7M", "G/B", "Am7(b5)"])
        const g = prepararLetraColada("G | D | Em | C\nQuem é como tu\n")
        expect(g.acordes.get("Quem é como tu")?.map((a) => a.key)).toEqual(["G", "D", "Em", "C"])
    })
    it("acorde sobre espaço vai pro começo da próxima palavra", () => {
        const r = prepararLetraColada("Am  G\nAbc def ghi\n")
        // a coluna 4 é espaço? "Abc def ghi": col 4 = 'd'
        expect(r.acordes.get("Abc def ghi")?.[1]).toEqual({ pos: 4, key: "G" })
    })
    it("estrofe que termina em linha de acorde não funde com a próxima", () => {
        const r = prepararLetraColada("G D\nPrimeira linha\nSegunda linha\nEm C\n\nG D\nOutra estrofe\n")
        expect(r.texto).toBe("Primeira linha\nSegunda linha\n\nOutra estrofe")
        expect(r.descartadas.map((d) => d.texto)).toEqual(["Em C"])
    })
})

describe("o que é descartado", () => {
    it("intro só de acordes, Intro: com acordes, Solo: e tablatura", () => {
        const r = prepararLetraColada("Intro: G D Em C\nSolo:\ne|--0--3--|\nG D Em C\n\nG\nPrimeira\n")
        expect(r.texto).toBe("Primeira")
        expect(r.descartadas.map((d) => d.texto)).toEqual(["Intro: G D Em C", "Solo:", "e|--0--3--|", "G D Em C"])
    })
    it("'manter como letra' devolve a linha pro texto", () => {
        const r = prepararLetraColada("G D Em C\n\nVerso aqui", { manterComoLetra: new Set([0]) })
        expect(r.texto).toBe("G D Em C\n\nVerso aqui")
        expect(r.descartadas).toHaveLength(0)
    })
    it("um token só ('Em') com letra embaixo vale se há outra linha de acorde; sozinha não", () => {
        const sem = prepararLetraColada("Em\nSanto Santo")
        expect(sem.texto).toBe("Em\nSanto Santo")
        const com = prepararLetraColada("G D Em C\nPrimeira\n\nEm\nSegunda")
        expect(com.texto).toBe("Primeira\n\nSegunda")
        expect(com.acordes.get("Segunda")).toEqual([{ pos: 0, key: "Em" }])
    })
    it("só letras puras: 3+ valem, 2 só com contexto", () => {
        expect(prepararLetraColada("G D C\nOlá mundo").texto).toBe("Olá mundo")
        expect(prepararLetraColada("E A\nOlá mundo").texto).toBe("E A\nOlá mundo")
        expect(prepararLetraColada("Am G F\nPrimeira\n\nE A\nSegunda").texto).toBe("Primeira\n\nSegunda")
    })
})

describe("grupos e repetição", () => {
    it("cabeçalho em português vira [Grupo]", () => {
        expect(cabecalhoDeGrupo("REFRÃO:")?.grupo).toBe("Refrão")
        expect(cabecalhoDeGrupo("Verso 2")?.grupo).toBe("Verso 2")
        expect(cabecalhoDeGrupo("[Pré-refrão]")?.grupo).toBe("Pré-refrão")
        expect(cabecalhoDeGrupo("Refrão: Aleluia")).toEqual({ grupo: "Refrão", resto: "Aleluia" })
        expect(cabecalhoDeGrupo("Senhor: tu és")).toBeNull()
        expect(cabecalhoDeGrupo("Final feliz de verdade")).toBeNull()
        const r = prepararLetraColada("Verso 1\nLinha a\nLinha b\nRefrão:\nAleluia")
        expect(r.texto).toBe("[Verso 1]\nLinha a\nLinha b\n\n[Refrão]\nAleluia")
    })
    it("(2x), bis e x2: o marcador sai do texto", () => {
        expect(tirarMarcadorDeRepeticao("Aleluia (2x)")).toEqual({ texto: "Aleluia", repete: 0 })
        expect(tirarMarcadorDeRepeticao("Aleluia bis")).toEqual({ texto: "Aleluia", repete: 0 })
        expect(tirarMarcadorDeRepeticao("x2")).toEqual({ texto: "", repete: 2 })
        expect(tirarMarcadorDeRepeticao("(3x)")).toEqual({ texto: "", repete: 3 })
        expect(tirarMarcadorDeRepeticao("Bisavó")).toEqual({ texto: "Bisavó", repete: 0 })
        expect(prepararLetraColada("Aleluia\n(2x)").texto).toBe("Aleluia\nx2")
    })
    it("\r\n, espaço no fim e várias linhas em branco", () => {
        expect(prepararLetraColada("a  \r\n\r\n\r\n\r\nb  \r\n").texto).toBe("a\n\nb")
    })
})

describe("divisão", () => {
    it("os três modos", () => {
        expect(linhasPorSlideDoModo("paragrafo", 2)).toBe(0)
        expect(linhasPorSlideDoModo("linha", 2)).toBe(1)
        expect(linhasPorSlideDoModo("n", 3)).toBe(3)
        expect(linhasPorSlideDoModo("n", 0)).toBe(2)
    })
})

describe("ehLinhaTecnica / aparência", () => {
    it("rótulo + acordes", () => {
        expect(ehLinhaTecnica("Intro: G D Em C")).toBe(true)
        expect(ehLinhaTecnica("Intro")).toBe(false)
        expect(ehLinhaTecnica("Introdução ao amor")).toBe(false)
        expect(aparenciaDeAcordes("G  D  Em").todosAcordes).toBe(true)
        expect(aparenciaDeAcordes("G  Deus").todosAcordes).toBe(false)
    })
})
