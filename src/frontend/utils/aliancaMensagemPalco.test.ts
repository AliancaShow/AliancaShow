import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"
import { LIMITE_MENSAGEM, MINUTOS_PADRAO, mensagemViva, minutosValidos, prepararMensagem } from "./aliancaMensagemPalcoLogica"

const mocks = vi.hoisted(() => ({ motivo: "", chamadas: [] as any[], resposta: { ok: true, dados: { id: "m1", texto: "oi", ate: "2026-11-18T22:00:00Z" } } as any, cultoId: "evt-1" }))
vi.mock("./aliancaSirvo", async () => {
    const { writable } = await import("svelte/store")
    return {
        sirvo: writable({ cultoId: "evt-1" }),
        porQueNaoConduz: () => mocks.motivo,
        pedirAoSirvo: async (funcao: string, args: any) => {
            mocks.chamadas.push({ funcao, args })
            return mocks.resposta
        }
    }
})

describe("prepararMensagem", () => {
    it("recusa vazio e so espacos", () => {
        expect(prepararMensagem("").ok).toBe(false)
        expect(prepararMensagem("   \n ").ok).toBe(false)
    })
    it("limpa quebra de linha e espaco duplicado", () => {
        expect(prepararMensagem("  Pastor,\n5  min  ")).toEqual({ ok: true, texto: "Pastor, 5 min" })
    })
    it("120 passa, 121 nao", () => {
        expect(prepararMensagem("a".repeat(LIMITE_MENSAGEM)).ok).toBe(true)
        expect(prepararMensagem("a".repeat(LIMITE_MENSAGEM + 1)).ok).toBe(false)
    })
    it("minutos de 1 a 60, inteiros", () => {
        expect(MINUTOS_PADRAO).toBe(3)
        expect([0, 1, 60, 61, 2.5].map(minutosValidos)).toEqual([false, true, true, false, false])
    })
})

describe("mensagemViva", () => {
    const msg = { id: "1", texto: "oi", ate: "2026-11-18T20:00:00Z" }
    it("viva enquanto o ate nao passou", () => {
        expect(mensagemViva(msg, Date.parse("2026-11-18T19:59:59Z"))?.texto).toBe("oi")
        expect(mensagemViva(msg, Date.parse("2026-11-18T20:00:00Z"))).toBeNull()
        expect(mensagemViva(null, 0)).toBeNull()
        expect(mensagemViva({ ...msg, ate: "lixo" }, 0)).toBeNull()
    })
})

describe("enviarMensagemPalco / limparMensagemPalco", () => {
    beforeEach(() => {
        mocks.motivo = ""
        mocks.chamadas.length = 0
        mocks.resposta = { ok: true, dados: {} }
    })
    it("sem chave que conduz: acende a falha alta e NAO chama o Sirvo", async () => {
        const { falhas } = await import("./aliancaFalha")
        falhas.set([])
        mocks.motivo = "Esta chave só lê o roteiro."
        const { enviarMensagemPalco } = await import("./aliancaMensagemPalco")
        const r = await enviarMensagemPalco("oi")
        expect(r).toEqual({ ok: false, mensagem: "Esta chave só lê o roteiro." })
        expect(mocks.chamadas).toEqual([])
        const f = get(falhas)
        expect(f.length).toBe(1)
        expect(f[0].origem).toBe("mensagem-palco")
        expect(f[0].mensagem).toContain("Sirvo: mensagem pro palco ainda não ligada")
    })
    it("com conduz: chama show_enviar_mensagem_palco com culto, texto e 3 minutos", async () => {
        const { enviarMensagemPalco } = await import("./aliancaMensagemPalco")
        const r = await enviarMensagemPalco("  Pastor, 5 min  ")
        expect(r).toEqual({ ok: true })
        expect(mocks.chamadas).toEqual([{ funcao: "show_enviar_mensagem_palco", args: { p_event: "evt-1", p_texto: "Pastor, 5 min", p_minutos: 3 } }])
    })
    it("texto invalido nem chega ao Sirvo", async () => {
        const { enviarMensagemPalco } = await import("./aliancaMensagemPalco")
        expect((await enviarMensagemPalco("   ")).ok).toBe(false)
        expect(mocks.chamadas).toEqual([])
    })
    it("recusa do Sirvo volta como mensagem, sem falha alta", async () => {
        const { falhas } = await import("./aliancaFalha")
        falhas.set([])
        mocks.resposta = { ok: false, mensagem: "O Sirvo não aceitou." }
        const { enviarMensagemPalco } = await import("./aliancaMensagemPalco")
        expect(await enviarMensagemPalco("oi")).toEqual({ ok: false, mensagem: "O Sirvo não aceitou." })
        expect(get(falhas)).toEqual([])
    })
    it("limpar chama show_limpar_mensagem_palco so com o culto", async () => {
        const { limparMensagemPalco } = await import("./aliancaMensagemPalco")
        await limparMensagemPalco()
        expect(mocks.chamadas).toEqual([{ funcao: "show_limpar_mensagem_palco", args: { p_event: "evt-1" } }])
    })
})

describe("as duas funcoes estao na lista de escrita do main e no tipo", () => {
    const raiz = join(__dirname, "..", "..")
    it("electron/sirvo/sirvo.ts (ESCRITA) e FuncaoDeEscrita", () => {
        const main = readFileSync(join(raiz, "electron/sirvo/sirvo.ts"), "utf8")
        const tipo = readFileSync(join(raiz, "frontend/utils/aliancaSirvo.ts"), "utf8")
        for (const f of ["show_enviar_mensagem_palco", "show_limpar_mensagem_palco"]) {
            const linha = main.split(String.fromCharCode(10)).find((l) => l.trimStart().startsWith("const ESCRITA = ")) || ""
            expect(linha, f).toContain(`"${f}"`)
            expect(tipo, f).toContain(`"${f}"`)
        }
    })
})
