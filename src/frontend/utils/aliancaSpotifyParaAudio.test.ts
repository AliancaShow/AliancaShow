import { describe, expect, it, vi } from "vitest"

vi.mock("../audio/audioFading", () => ({ clearAudio: vi.fn() }))
vi.mock("../components/output/preview/SpotifyManager", () => ({ spotifyState: { subscribe: vi.fn() } }))

import { deveLimparAudio } from "./aliancaSpotifyParaAudio"

describe("Spotify para o audio de arquivo", () => {
    const tocando = [{ paused: false }]
    it("so a subida do Spotify (parado -> tocando) com audio tocando limpa", () => {
        expect(deveLimparAudio(false, true, tocando)).toBe(true)
        expect(deveLimparAudio(true, true, tocando)).toBe(false)
        expect(deveLimparAudio(true, false, tocando)).toBe(false)
    })
    it("o estado de quando o programa abre e so a base", () => {
        expect(deveLimparAudio(null, true, tocando)).toBe(false)
    })
    it("sem audio tocando, ou so microfone, nao limpa", () => {
        expect(deveLimparAudio(false, true, [])).toBe(false)
        expect(deveLimparAudio(false, true, [{ paused: true }])).toBe(false)
        expect(deveLimparAudio(false, true, [{ paused: false, isMic: true }])).toBe(false)
    })
})
