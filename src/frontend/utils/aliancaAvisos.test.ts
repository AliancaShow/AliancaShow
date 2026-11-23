import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _zerarAvisos, avisar, avisos, dispensarAviso, historicoDeAvisos, ligarFalhasNosAvisos, receberToast, resolverAviso } from "./aliancaAvisos"
import { _zerarFalhas, falhaAlta } from "./aliancaFalha"
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
    it("aviso fixo (saida fora do ar) nao sai pelo x; resolver tira; o historico guarda cada passo da mesma chave", () => {
        avisar("Telão CAIU", "erro", "queda-saida:t", { fixo: true })
        avisar("Telão FORA DO AR", "erro", "queda-saida:t", { fixo: true, soma: false })
        dispensarAviso(get(avisos)[0].id)
        expect(get(avisos).map((a) => [a.texto, a.fixo, a.vezes])).toEqual([["Telão FORA DO AR", true, 1]])
        avisar("Telão caiu e voltou", "erro", "queda-saida:t", { soma: false })
        expect(get(avisos)[0].fixo).toBeUndefined()
        dispensarAviso(get(avisos)[0].id)
        expect(get(avisos)).toEqual([])
        expect(get(historicoDeAvisos).map((a) => a.texto)).toEqual(["Telão caiu e voltou", "Telão FORA DO AR", "Telão CAIU"])
        // o historico e um {#each} com chave: id repetido quebra a lista
        expect(new Set(get(historicoDeAvisos).map((a) => a.id)).size).toBe(3)
    })

    it("falha alta vira ERRO na linha, com x; as falhas de ANTES de ligar nao se perdem; a mesma origem soma no texto", () => {
        _zerarFalhas()
        falhaAlta("cedo", new Error("antes da linha existir"))
        const desligar = ligarFalhasNosAvisos()
        try {
            expect(get(avisos).map((a) => [a.texto, a.nivel, a.fixo])).toEqual([["Falha interna do AliançaShow: cedo (1×). Avise quem cuida do programa.", "erro", undefined]])
            falhaAlta("cedo", new Error("de novo"))
            falhaAlta("so-retorno-recusa", "fica na tarja do No ar")
            expect(get(avisos).map((a) => [a.texto, a.vezes])).toEqual([["Falha interna do AliançaShow: cedo (2×). Avise quem cuida do programa.", 1]])
            // uma linha so no historico para a mesma falha
            expect(get(historicoDeAvisos).map((a) => a.texto)).toEqual(["Falha interna do AliançaShow: cedo (2×). Avise quem cuida do programa."])
            dispensarAviso(get(avisos)[0].id)
            expect(get(avisos)).toEqual([])
            // depois do x so volta se acontecer de novo
            avisar("outra coisa", "aviso", "w")
            expect(get(avisos).map((a) => a.chave)).toEqual(["w"])
            falhaAlta("cedo", new Error("terceira"))
            expect(get(avisos).find((a) => a.chave === "falha:cedo")?.texto).toContain("(3×)")
        } finally {
            desligar()
            _zerarFalhas()
        }
    })
})

import { describe as d2, it as i2, expect as e2 } from "vitest"
import { avisos as av2, ligarFalhasNosAvisos as lig2, _zerarAvisos as z2 } from "./aliancaAvisos"
import { falhaAlta as fa2 } from "./aliancaFalha"
d2("queda de saida nao vira falha interna duplicada", () => {
    i2("saida-caiu:* fica so no aviso da queda", () => {
        z2()
        const sair = lig2()
        fa2("saida-caiu:Primary", new Error("x"))
        e2(get2().some((a) => a.texto.includes("saida-caiu"))).toBe(false)
        sair()
    })
})
function get2() {
    let v: any[] = []
    av2.subscribe((x) => (v = x))()
    return v
}
