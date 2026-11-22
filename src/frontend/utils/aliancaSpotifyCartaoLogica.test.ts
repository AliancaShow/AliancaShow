import { describe, expect, it } from "vitest"
import { alternarMudoSpotify, escParaOSpotify, largurasDoCartaoSpotify, passosDoParar, prenderVolumeSpotify, spotifyMudo, spotifyNaCamadaAudio, VOLUME_MAXIMO_SPOTIFY, VOLUME_PADRAO_SPOTIFY, type ImpedimentosDoEsc } from "./aliancaSpotifyCartaoLogica"

describe("volume do Spotify", () => {
    it("teto 1,0 (mixer do Windows), piso 0, lixo vira 0", () => {
        expect(VOLUME_MAXIMO_SPOTIFY).toBe(1)
        expect(prenderVolumeSpotify(1.25)).toBe(1)
        expect(prenderVolumeSpotify(-0.2)).toBe(0)
        expect(prenderVolumeSpotify(NaN)).toBe(0)
        expect(prenderVolumeSpotify(0.42)).toBe(0.42)
    })
    it("mudo = volume 0 (ou sem valor)", () => {
        expect(spotifyMudo(0)).toBe(true)
        expect(spotifyMudo(undefined)).toBe(true)
        expect(spotifyMudo(0.01)).toBe(false)
    })
})

describe("alternarMudoSpotify", () => {
    it("com som: vai a 0 e guarda o de antes", () => {
        expect(alternarMudoSpotify(0.6, null)).toEqual({ volume: 0, guardado: 0.6 })
    })
    it("mudo: volta ao guardado e esquece", () => {
        expect(alternarMudoSpotify(0, 0.6)).toEqual({ volume: 0.6, guardado: null })
    })
    it("mudo sem guardado (abriu em 0): volta ao padrao, nunca fica preso em 0", () => {
        expect(alternarMudoSpotify(0, null)).toEqual({ volume: VOLUME_PADRAO_SPOTIFY, guardado: null })
        expect(alternarMudoSpotify(0, 0)).toEqual({ volume: VOLUME_PADRAO_SPOTIFY, guardado: null })
    })
    it("volume arrastado para cima depois do mudo: o proximo clique silencia o NOVO valor", () => {
        expect(alternarMudoSpotify(0.3, 0.9)).toEqual({ volume: 0, guardado: 0.3 })
    })
    it("guardado acima do teto e preso a 1,0", () => {
        expect(alternarMudoSpotify(0, 5).volume).toBe(1)
    })
})

describe("passosDoParar (4b)", () => {
    it("tocando: pausa e volta ao inicio, nessa ordem", () => {
        expect(passosDoParar(true)).toEqual(["pause", "inicio"])
    })
    it("pausado: so volta ao inicio (nao manda pausa a toa)", () => {
        expect(passosDoParar(false)).toEqual(["inicio"])
    })
})

describe("D9: Spotify na camada Audio", () => {
    it("acende so tocando e so na pagina Mostrar (fora dela o estado e velho)", () => {
        expect(spotifyNaCamadaAudio("show", { isPlaying: true })).toBe(true)
        expect(spotifyNaCamadaAudio("show", { isPlaying: false })).toBe(false)
        expect(spotifyNaCamadaAudio("show", null)).toBe(false)
        expect(spotifyNaCamadaAudio("edit", { isPlaying: true })).toBe(false)
    })
    const livre: ImpedimentosDoEsc = { travada: false, recusaDestino: false, popup: false, selecionadoNaoBiblia: false, editandoItens: false, palcoComItens: false, menuAberto: false }
    it("Esc para o Spotify quando nada barra", () => {
        expect(escParaOSpotify(livre)).toBe(true)
    })
    it("Esc NAO para o Spotify com qualquer uma das guardas do clearAll", () => {
        for (const k of Object.keys(livre) as (keyof ImpedimentosDoEsc)[]) expect(escParaOSpotify({ ...livre, [k]: true })).toBe(false)
    })
})

describe("largura interna do cartao (board C2: linha 2 = barra + crossfade fixo + mudo 24 + volume 40)", () => {
    it("coluna de 300: barra ~185 px e o nome ainda cabe com o Parar na linha 1", () => {
        const l = largurasDoCartaoSpotify(300)
        expect(l.util).toBe(286)
        expect(l.barra).toBeGreaterThanOrEqual(150)
        expect(l.barra).toBeLessThanOrEqual(190)
        expect(l.nome).toBeGreaterThanOrEqual(100)
    })
    it("mais largo: so a barra e o nome crescem (botoes, mudo e volume fixos)", () => {
        const a = largurasDoCartaoSpotify(300)
        const b = largurasDoCartaoSpotify(420)
        expect(b.barra - a.barra).toBe(120)
        expect(b.nome - a.nome).toBe(120)
    })
})
