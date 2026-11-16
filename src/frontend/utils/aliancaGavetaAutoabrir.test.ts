// Corrida da fatia 0b (achada na 0c): a reabertura atrasada da gaveta escrevia pela fachada, no lado do modo VALENDO quando o timer
// disparava. Chip "leva ao Culto" = activePage show e logo modo culto; 100 ms depois a gaveta do Preparar era gravada no Culto.
import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { agendarReaberturaDaGaveta, ESPERA_REABRIR_MS, type Gaveta } from "./aliancaGavetaAutoabrir"
import { criarPorModo } from "./aliancaPorModoLogica"
import type { Modo } from "./aliancaPorModoLogica"

const copiar = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const PADRAO = 300

// o Culto como na fixture do perfil de prova: aberto em 420, sem nada guardado. O Preparar nasce da semente (copia) e e fechado sozinho.
function montar() {
    const modo = writable<Modo>("preparar")
    const culto = writable<Gaveta>({ height: 420, stored: null })
    const drawer = criarPorModo<Gaveta>({ culto, modo: () => modo, copiar })
    const assina = drawer.subscribe(() => {}) // a fachada so liga o lado com assinante (na tela, o Drawer assina)
    drawer.set({ height: 40, stored: 420, autoclosed: true }) // gaveta do Preparar fechada sozinha pelo editor
    return { modo, culto, drawer, preparar: drawer.doModo("preparar"), parar: assina }
}

describe("reabertura atrasada da gaveta: o lado e o da hora de agendar", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("sem troca de modo: o Preparar reabre em stored e o Culto nao muda", () => {
        const { modo, drawer, culto, preparar, parar } = montar()
        agendarReaberturaDaGaveta(drawer.doModo(get(modo)), PADRAO)
        vi.advanceTimersByTime(ESPERA_REABRIR_MS)
        expect(get(preparar)).toEqual({ height: 420, stored: null })
        expect(get(culto)).toEqual({ height: 420, stored: null })
        parar()
    })

    it("MODO MUDA nos 100 ms (chip leva ao Culto): o Culto continua em 420 e o Preparar e que reabre", () => {
        const { modo, drawer, culto, preparar, parar } = montar()
        agendarReaberturaDaGaveta(drawer.doModo(get(modo)), PADRAO)
        modo.set("culto")
        vi.advanceTimersByTime(ESPERA_REABRIR_MS)
        expect(get(culto)).toEqual({ height: 420, stored: null })
        expect(get(preparar)).toEqual({ height: 420, stored: null })
        parar()
    })

    it("a premissa da corrida: escrever pela FACHADA no disparo (a linha antiga) grava no lado do modo valendo", () => {
        const { modo, drawer, culto, parar } = montar()
        // a linha antiga: setTimeout(() => drawer.set({ height: $drawer.stored ?? DEFAULT, stored: null }), 100)
        setTimeout(() => drawer.set({ height: get(drawer).stored ?? PADRAO, stored: null }), ESPERA_REABRIR_MS)
        modo.set("culto")
        vi.advanceTimersByTime(ESPERA_REABRIR_MS)
        expect(get(culto)).toEqual({ height: PADRAO, stored: null }) // o Culto (420) virou 300: o defeito
        parar()
    })

    it("sem stored, a altura padrao (como antes)", () => {
        const { modo, drawer, preparar, parar } = montar()
        drawer.set({ height: 40, stored: null, autoclosed: true })
        agendarReaberturaDaGaveta(drawer.doModo(get(modo)), PADRAO)
        vi.advanceTimersByTime(ESPERA_REABRIR_MS)
        expect(get(preparar)).toEqual({ height: PADRAO, stored: null })
        parar()
    })
})
