import { describe, expect, it } from "vitest"
import { clampPlaybackRate, syncVideoToAudio } from "../components/media/video/videoSync"
import { amostrasDaCurva, avancoDuranteAPausa, easeOut, fatorDaRampa, PASSO_PAUSA_MS, PAUSA_SUAVE_MS, pausaTerminou, progressoDaPausa, saidasComOVideo, velocidadeNaPausa, VELOCIDADE_MINIMA, volumeNaPausa } from "./aliancaPausaSuaveLogica"

describe("curva da pausa suave (D27: 0,7 s fixos, ease-out)", () => {
    it("duracao fixa e piso do Chromium", () => {
        expect(PAUSA_SUAVE_MS).toBe(700)
        expect(VELOCIDADE_MINIMA).toBe(0.0625)
    })
    it("progresso preso entre 0 e 1", () => {
        expect(progressoDaPausa(-5)).toBe(0)
        expect(progressoDaPausa(NaN)).toBe(0)
        expect(progressoDaPausa(350)).toBeCloseTo(0.5)
        expect(progressoDaPausa(5000)).toBe(1)
        expect(pausaTerminou(699)).toBe(false)
        expect(pausaTerminou(700)).toBe(true)
    })
    it("ease-out: comeca rapido, assenta devagar", () => {
        expect(easeOut(0)).toBe(0)
        expect(easeOut(1)).toBe(1)
        expect(easeOut(0.5)).toBeCloseTo(0.875)
        expect(easeOut(0.25) - easeOut(0)).toBeGreaterThan(easeOut(1) - easeOut(0.75))
    })
    it("velocidade: 1 -> 0,0625, sempre caindo, nunca abaixo do piso", () => {
        expect(velocidadeNaPausa(0)).toBe(1)
        expect(velocidadeNaPausa(700)).toBe(VELOCIDADE_MINIMA)
        expect(velocidadeNaPausa(9999)).toBe(VELOCIDADE_MINIMA)
        let antes = 2
        for (let t = 0; t <= 700; t += 5) {
            const v = velocidadeNaPausa(t)
            expect(v).toBeLessThanOrEqual(antes)
            expect(v).toBeGreaterThanOrEqual(VELOCIDADE_MINIMA)
            antes = v
        }
    })
    it("parte da velocidade de antes (video com velocidade propria)", () => {
        expect(velocidadeNaPausa(0, 1.5)).toBe(1.5)
        expect(velocidadeNaPausa(700, 1.5)).toBe(VELOCIDADE_MINIMA)
        expect(fatorDaRampa(0, 1.5)).toBe(1)
        expect(fatorDaRampa(700, 1.5)).toBeCloseTo(VELOCIDADE_MINIMA / 1.5)
        // base invalida cai em 1
        expect(velocidadeNaPausa(0, NaN)).toBe(1)
        expect(velocidadeNaPausa(0, 0)).toBe(1)
    })
    it("volume cai na mesma curva ate 0", () => {
        expect(volumeNaPausa(0, 0.8)).toBeCloseTo(0.8)
        expect(volumeNaPausa(350, 1)).toBeCloseTo(0.125)
        expect(volumeNaPausa(700, 0.8)).toBe(0)
        expect(volumeNaPausa(100, -1)).toBe(0)
        expect(volumeNaPausa(0, 1.25)).toBe(1.25) // ganho acima de 100% acompanha
    })
    it("o video anda ~0,2 s de midia durante a pausa (e nao 0,7)", () => {
        const a = avancoDuranteAPausa()
        expect(a).toBeGreaterThan(0.2)
        expect(a).toBeLessThan(0.23)
    })
    it("amostras da curva (relatorio)", () => {
        const c = amostrasDaCurva(100)
        expect(c).toHaveLength(8)
        expect(c[0]).toEqual({ ms: 0, velocidade: 1, volume: 1 })
        expect(c[7].velocidade).toBe(VELOCIDADE_MINIMA)
        expect(c[7].volume).toBe(0)
    })
})

describe("Parar: saidas com o video", () => {
    const outputs = {
        a: { enabled: true, out: { background: { path: "C:/v.mp4" } } },
        b: { enabled: true, out: { background: { path: "C:/outro.mp4" } } },
        c: { enabled: false, out: { background: { path: "C:/v.mp4" } } },
        d: { enabled: true, out: { background: { id: "C:/v.mp4" } } },
        e: { enabled: true, out: { background: null } },
        f: { enabled: true }
    }
    it("so as habilitadas que mostram AQUELE arquivo", () => {
        expect(saidasComOVideo(outputs, "C:/v.mp4")).toEqual(["a", "d"])
        expect(saidasComOVideo(outputs, "")).toEqual([])
        expect(saidasComOVideo(null, "C:/v.mp4")).toEqual([])
    })
})

// Medida da sincronia: o relogio principal desacelera; a saida recebe o estado a cada passo (35 ms + atraso do IPC) e roda o MESMO
// syncVideoToAudio da janela de saida. Compara mandar o multiplicador (`rampa`, o que foi feito) com nao mandar (a saida seguiria a 1x).
function simular(mandarRampa: boolean, atrasoIpcMs = 8) {
    const vid: any = { readyState: 4, seeking: false, currentTime: 10, playbackRate: 1, paused: false }
    let seeks = 0
    let ct = 10
    Object.defineProperty(vid, "currentTime", {
        get: () => ct,
        set: (v: number) => {
            seeks++
            ct = v
        }
    })
    const realNow = performance.now
    let agora = 0
    ;(performance as any).now = () => agora
    let relogio = 10
    let ultimo: number | null = null
    let maiorDiferenca = 0
    const fila: { em: number; tempo: number; fator: number; pausado: boolean }[] = []
    // aquecimento a 1x (o video ja estava tocando)
    for (let t = -500; t < 0; t++) {
        agora = t + 1000
        relogio += 0.001
        ct += 0.001 * vid.playbackRate
    }
    seeks = 0
    syncVideoToAudio(vid, relogio, null)
    ultimo = relogio
    seeks = 0
    try {
        for (let t = 0; t <= PAUSA_SUAVE_MS + 300; t++) {
            agora = t + 1500
            const pausado = t >= PAUSA_SUAVE_MS
            if (!pausado) relogio += velocidadeNaPausa(t) * 0.001
            if (!vid.paused) ct += vid.playbackRate * 0.001
            if (t % PASSO_PAUSA_MS === 0 || pausado) fila.push({ em: t + atrasoIpcMs, tempo: relogio, fator: pausado ? 1 : fatorDaRampa(t), pausado })
            while (fila.length && fila[0].em <= t) {
                const m = fila.shift()!
                if (m.pausado) vid.paused = true
                syncVideoToAudio(vid, m.tempo, ultimo, false, mandarRampa ? m.fator : 1, false)
                ultimo = m.tempo
            }
            if (t < PAUSA_SUAVE_MS) maiorDiferenca = Math.max(maiorDiferenca, Math.abs(ct - relogio))
        }
    } finally {
        ;(performance as any).now = realNow
    }
    return { maiorDiferenca, seeks, finalDiff: Math.abs(ct - relogio) }
}

describe("sincronia das saidas durante a pausa suave (medida)", () => {
    it("mandando a rampa: a saida acompanha (< 1 quadro a 30 fps) e nao da salto no fim", () => {
        const r = simular(true)
        if (process.env.MEDIR_PAUSA) console.log("com rampa", r, "sem rampa", simular(false), amostrasDaCurva(100))
        expect(r.maiorDiferenca).toBeLessThan(0.034)
        expect(r.seeks).toBe(0)
        expect(clampPlaybackRate(VELOCIDADE_MINIMA)).toBe(0.1) // a saida para em 0,1x (o clamp dela); o relogio em 0,0625x
    })
    it("sem mandar a rampa: a saida corre a 1x e volta num salto ao pausar (o que o desenho evita)", () => {
        const r = simular(false)
        expect(r.maiorDiferenca).toBeGreaterThan(0.3)
        expect(r.seeks).toBeGreaterThan(0)
    })
})
