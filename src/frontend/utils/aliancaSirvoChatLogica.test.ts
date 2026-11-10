import { describe, expect, it } from "vitest"
import { aoErro, aoRetrato, aoRev, estadoInicial, marcarLidas, resumoDaUltima, textoDaMensagem, textoDoMotivo, type MensagemChat } from "./aliancaSirvoChatLogica"

const msg = (id: string, body = "oi", extra: Partial<MensagemChat> = {}): MensagemChat => ({ id, criada_em: "2026-11-09T22:00:00Z", autor: "Ana", body, audio_ms: null, transcricao_status: null, resposta: null, ...extra })
const rev = (assinatura: string | null, extra: object = {}) => ({ ligado: true, motivo: null, assinatura, mudado_em: "2026-11-09T21:00:00Z", ...extra })
const retrato = (assinatura: string, mensagens: MensagemChat[]) => ({ ...rev(assinatura), mensagens })

describe("aoRev: assinatura → busca", () => {
    it("sem 0084 no Sirvo (sem `chat`) não faz nada", () => {
        const e = estadoInicial("c1")
        expect(aoRev(e, "c1", undefined)).toEqual({ estado: e, buscar: false })
    })
    it("assinatura nova busca; a mesma do retrato na tela não busca", () => {
        const primeiro = aoRev(estadoInicial("c1"), "c1", rev("A"))
        expect(primeiro.buscar).toBe(true)
        let estado = primeiro.estado
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado
        expect(aoRev(estado, "c1", rev("A")).buscar).toBe(false)
        expect(aoRev(estado, "c1", rev("B")).buscar).toBe(true)
    })
    it("guarda a assinatura do RETRATO, não a do rev (mensagem entre as duas chamadas)", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        // o retrato já veio com a mensagem nova (assinatura B)
        estado = aoRetrato(estado, "c1", retrato("B", [msg("1"), msg("2")])).estado
        expect(estado.assinatura).toBe("B")
        expect(aoRev(estado, "c1", rev("B")).buscar).toBe(false)
    })
    it("trocar de culto zera tudo", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado
        const x = aoRev(estado, "c2", rev("A"))
        expect(x.estado.cultoId).toBe("c2")
        expect(x.estado.mensagens).toEqual([])
        expect(x.buscar).toBe(true)
    })
    it("motivo (rascunho) vira estado, sem busca", () => {
        const x = aoRev(estadoInicial("c1"), "c1", rev(null, { motivo: "rascunho" }))
        expect(x.buscar).toBe(false)
        expect(x.estado.ligado).toBe(true)
        expect(x.estado.motivo).toBe("rascunho")
        expect(textoDoMotivo(x.estado.motivo)).toMatch(/escala/)
    })
    it("conversa nunca ligada: nada aparece", () => {
        const x = aoRev(estadoInicial("c1"), "c1", { ligado: false, motivo: null, assinatura: null, mudado_em: null })
        expect(x.estado.ligado).toBe(false)
        expect(x.estado.congelado).toBe(false)
    })
})

describe("admin desliga no meio do culto", () => {
    it("congela com o último retrato e para de buscar", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1"), msg("2")])).estado
        const x = aoRev(estado, "c1", { ligado: false, motivo: null, assinatura: null, mudado_em: "2026-11-09T22:42:00Z" })
        expect(x.buscar).toBe(false)
        expect(x.estado.congelado).toBe(true)
        expect(x.estado.desligadoEm).toBe("2026-11-09T22:42:00Z")
        expect(x.estado.mensagens.map((m) => m.id)).toEqual(["1", "2"])
        // continua congelado nos próximos revs
        expect(aoRev(x.estado, "c1", { ligado: false, motivo: null, assinatura: null, mudado_em: "2026-11-09T22:42:00Z" }).estado).toBe(x.estado)
    })
    it("religar descongela e busca se mudou", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado
        estado = aoRev(estado, "c1", { ligado: false, motivo: null, assinatura: null, mudado_em: "x" }).estado
        const x = aoRev(estado, "c1", rev("B"))
        expect(x.estado.congelado).toBe(false)
        expect(x.buscar).toBe(true)
    })
    it("retrato que volta desligado também congela", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado
        const x = aoRetrato(estado, "c1", { ligado: false, motivo: null, assinatura: null, mudado_em: "y", mensagens: [] })
        expect(x.estado.congelado).toBe(true)
        expect(x.estado.mensagens).toHaveLength(1)
    })
})

describe("aoRetrato: não lidas sem cursor", () => {
    it("o primeiro retrato conta tudo como lido", () => {
        const { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        const x = aoRetrato(estado, "c1", retrato("A", [msg("1"), msg("2")]))
        expect(x.estado.naoLidas).toBe(0)
        expect(x.novas).toBe(0)
    })
    it("o que chega depois alerta; tocar no painel zera", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado
        const x = aoRetrato(estado, "c1", retrato("B", [msg("1"), msg("2"), msg("3")]))
        expect(x.novas).toBe(2)
        expect(x.estado.naoLidas).toBe(2)
        expect(marcarLidas(x.estado).naoLidas).toBe(0)
    })
    it("apagada some da tela e sai da conta de não lidas", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado
        estado = aoRetrato(estado, "c1", retrato("B", [msg("1"), msg("2")])).estado
        expect(estado.naoLidas).toBe(1)
        const x = aoRetrato(estado, "c1", retrato("C", [msg("1")]))
        expect(x.estado.mensagens.map((m) => m.id)).toEqual(["1"])
        expect(x.estado.naoLidas).toBe(0)
        expect(x.novas).toBe(0)
    })
    it("transcrição que chega depois atualiza o texto sem alertar de novo", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado
        const audio = msg("2", "", { audio_ms: 12000, transcricao_status: "pendente" })
        let x = aoRetrato(estado, "c1", retrato("B", [msg("1"), audio]))
        expect(x.novas).toBe(1)
        expect(textoDaMensagem(x.estado.mensagens[1])).toBe("🎤 0:12 — transcrevendo…")
        estado = marcarLidas(x.estado)
        x = aoRetrato(estado, "c1", retrato("C", [msg("1"), { ...audio, body: "pode soltar o vídeo", transcricao_status: "pronta" }]))
        expect(x.novas).toBe(0)
        expect(x.estado.naoLidas).toBe(0)
        expect(textoDaMensagem(x.estado.mensagens[1])).toBe("🎤 0:12 — pode soltar o vídeo")
    })
    it("retrato de outro culto (trocaram no meio) é descartado", () => {
        const { estado } = aoRev(estadoInicial("c2"), "c2", rev("A"))
        expect(aoRetrato(estado, "c1", retrato("A", [msg("1")])).estado).toBe(estado)
    })
    it("resposta estranha não quebra", () => {
        const { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        expect(aoRetrato(estado, "c1", null).estado).toBe(estado)
        const x = aoRetrato(estado, "c1", { ...rev("A"), mensagens: [null, { id: 3 }, msg("ok")] })
        expect(x.estado.mensagens.map((m) => m.id)).toEqual(["ok"])
    })
})

describe("erro e texto", () => {
    it("erro fica só no estado do chat e some no próximo retrato bom", () => {
        let { estado } = aoRev(estadoInicial("c1"), "c1", rev("A"))
        estado = aoErro(estado, "c1", "Sirvo respondeu 500.")
        expect(estado.erro).toBe("Sirvo respondeu 500.")
        // a assinatura não andou: o próximo rev tenta de novo
        expect(aoRev(estado, "c1", rev("A")).buscar).toBe(true)
        expect(aoRetrato(estado, "c1", retrato("A", [])).estado.erro).toBe("")
    })
    it("áudio sem transcrição e resumo do recolhido", () => {
        expect(textoDaMensagem(msg("1", "", { audio_ms: 65000, transcricao_status: "falhou" }))).toBe("🎤 1:05 — áudio sem transcrição — ouça no celular")
        expect(resumoDaUltima([msg("1", "a"), msg("2", "pode  soltar\no vídeo")])).toBe("Ana: pode soltar o vídeo")
        expect(resumoDaUltima([])).toBe("")
    })
})
