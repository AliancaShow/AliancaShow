// 1a, D2: o chip "Chat" do Preparar le `sirvoChat.naoLidas`. O contador cresce SEM o componente `SirvoChat.svelte` montado: quem o
// faz crescer e `chatAoRev` (chamado pelo ciclo do roteiro) junto com a busca do retrato (requestMain falso).
import { get } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"

const respostas: any[] = []
vi.mock("../IPC/main", () => ({
    requestMain: vi.fn(async () => ({ ok: true, dados: respostas.shift() })),
    sendMain: vi.fn()
}))

import { chatAoRev, sirvoChat, zerarChat } from "./aliancaSirvoChat"

const msg = (id: string) => ({ id, criada_em: "2026-11-09T22:00:00Z", autor: "Ana", body: "oi", audio_ms: null, transcricao_status: null, responde_a: null })
const rev = (assinatura: string) => ({ ligado: true, motivo: null, assinatura, mudado_em: "2026-11-09T21:00:00Z" })
const retrato = (assinatura: string, mensagens: any[]) => ({ ...rev(assinatura), mensagens })
const esvaziar = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe("chat: naoLidas cresce sem componente", () => {
    beforeEach(() => {
        respostas.length = 0
        zerarChat()
    })
    it("o primeiro retrato conta como lido; o seguinte soma as novas", async () => {
        respostas.push(retrato("A", [msg("1")]))
        chatAoRev("c1", rev("A"))
        await esvaziar()
        expect(get(sirvoChat).cultoId).toBe("c1")
        expect(get(sirvoChat).mensagens).toHaveLength(1)
        expect(get(sirvoChat).naoLidas).toBe(0)

        respostas.push(retrato("B", [msg("1"), msg("2"), msg("3")]))
        chatAoRev("c1", rev("B"))
        await esvaziar()
        expect(get(sirvoChat).naoLidas).toBe(2)
    })
    it("culto outro zera: o contador e do culto seguido", async () => {
        respostas.push(retrato("A", [msg("1")]))
        chatAoRev("c1", rev("A"))
        await esvaziar()
        respostas.push(retrato("B", [msg("1"), msg("2")]))
        chatAoRev("c1", rev("B"))
        await esvaziar()
        expect(get(sirvoChat).naoLidas).toBe(1)
        respostas.push(retrato("Z", [msg("9")]))
        chatAoRev("c2", rev("Z"))
        await esvaziar()
        expect(get(sirvoChat).cultoId).toBe("c2")
        expect(get(sirvoChat).naoLidas).toBe(0)
    })
})
