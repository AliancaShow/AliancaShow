import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _zerarAvisos, avisar, avisos, dispensarAviso, historicoDeAvisos, receberToast, resolverAviso } from "./aliancaAvisos"
import { INFO_MS } from "./aliancaAvisosLogica"

const tem = (g: string, c: string) => g === "toast" && c === "saved"
const traduzir = (s: string) => (s === "toast.saved" ? "Salvo" : s)

describe("a fila dos avisos (store)", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        _zerarAvisos()
    })
    afterEach(() => {
        _zerarAvisos()
        vi.useRealTimers()
    })

    it("info some sozinho; aviso fica ate o x", () => {
        avisar("oi", "info", "i")
        avisar("cuidado", "aviso", "w")
        vi.advanceTimersByTime(INFO_MS + 600)
        expect(get(avisos).map((a) => a.chave)).toEqual(["w"])
        dispensarAviso(get(avisos)[0].id)
        expect(get(avisos)).toEqual([])
        expect(get(historicoDeAvisos).map((a) => a.chave)).toEqual(["w", "i"])
    })
    it("resolver tira pela chave", () => {
        avisar("offline", "aviso", "midia-offline:x")
        resolverAviso("midia-offline:x")
        expect(get(avisos)).toEqual([])
    })
    it("toda mensagem do newToast aparece: chave traduzida, texto pronto e chave sem texto (mostra a chave)", () => {
        receberToast("toast.saved", traduzir, tem)
        receberToast("Não entrou no roteiro: sem culto", traduzir, tem)
        receberToast("toast.inexistente", traduzir, tem)
        const l = get(avisos)
        expect(l.map((a) => [a.texto.slice(0, 24), a.nivel])).toEqual([
            ["Salvo", "info"],
            ["Não entrou no roteiro: s", "aviso"],
            ["toast.inexistente (mensa", "aviso"]
        ])
    })
})
