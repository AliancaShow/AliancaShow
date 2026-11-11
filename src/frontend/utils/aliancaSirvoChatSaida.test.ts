import { describe, expect, it } from "vitest"
import { aoRetrato, aoRev, estadoInicial, limparTexto, nomeDoAutor, normalizarMensagens, trechoDaCitacao, type MensagemChat } from "./aliancaSirvoChatLogica"
import { adicionar, aoResposta, aoRetratoSaida, aoTempo, bolhasDoCulto, CONFERIR_ATE_MS, decidirResposta, descartar, dicaDeIdentidade, ENVIADA_ATE_MS, nomeDaChave, normalizarOperador, novoItem, precisaDeRelogio, proximoParaEnviar, rotuloDoEstado, tentarDeNovo, validarEnvio } from "./aliancaSirvoChatSaida"

const msg = (id: string, body = "oi", extra: Partial<MensagemChat> = {}): MensagemChat => ({ id, criada_em: "2026-11-09T22:00:00Z", autor: "Ana", body, audio_ms: null, transcricao_status: null, resposta: null, ...extra })
const minha = (id: string, clienteId: string, extra: Partial<MensagemChat> = {}) => msg(id, "ok", { autor: "Sala de vídeo", autor_tipo: "chave", minha: true, cliente_id: clienteId, ...extra })
const item = (clienteId: string, agora = 1000, texto = "ok") => novoItem({ clienteId, cultoId: "c1", texto, citacao: null, operador: null, agora })
const retrato = (assinatura: string, mensagens: any[], extra: object = {}) => ({ ligado: true, motivo: null, assinatura, mudado_em: null, mensagens, ...extra })

describe("validarEnvio", () => {
    it("recusa vazio e só espaço", () => {
        expect(validarEnvio("")).toEqual({ ok: false, motivo: "vazio" })
        expect(validarEnvio("  \n\t ")).toEqual({ ok: false, motivo: "vazio" })
        expect(validarEnvio(undefined)).toEqual({ ok: false, motivo: "vazio" })
    })
    it("apara as pontas e mantém a quebra de linha do Shift+Enter", () => {
        expect(validarEnvio("  pode soltar\n\n\n\nagora  ")).toEqual({ ok: true, texto: "pode soltar\n\nagora" })
    })
    it("1000 caracteres passa, 1001 não (conta pontos de código, não pares)", () => {
        expect(validarEnvio("a".repeat(1000)).ok).toBe(true)
        expect(validarEnvio("a".repeat(1001))).toEqual({ ok: false, motivo: "longo" })
        expect(validarEnvio("😀".repeat(1000)).ok).toBe(true)
    })
    it("tira caracteres de controle e de inversão", () => {
        const r = validarEnvio("oi" + String.fromCharCode(0x202e) + "x" + String.fromCharCode(0))
        expect(r).toEqual({ ok: true, texto: "oix" })
    })
})

describe("normalizarOperador", () => {
    it("vazio vira null, espaços se juntam, corta em 40", () => {
        expect(normalizarOperador("   ")).toBeNull()
        expect(normalizarOperador(null)).toBeNull()
        expect(normalizarOperador("  Pedro   Silva ")).toBe("Pedro Silva")
        expect(Array.from(normalizarOperador("x".repeat(60)) as string)).toHaveLength(40)
    })
})

describe("caixa de saída: ciclo de uma resposta", () => {
    it("enviando → ok → enviada; o retrato com o cliente_id tira a bolha (sem duplicar)", () => {
        let c = adicionar([], item("k1"))
        expect(proximoParaEnviar(c, null)?.clienteId).toBe("k1")
        c = aoResposta(c, "k1", { ok: true, dados: { repetida: false } }, 2000)
        expect(c[0].estado).toBe("enviada")
        expect(proximoParaEnviar(c, null)).toBeNull()
        const doRetrato = [msg("a"), minha("m1", "k1")]
        expect(bolhasDoCulto(c, "c1", doRetrato)).toEqual([])
        expect(aoRetratoSaida(c, doRetrato)).toEqual([])
    })
    it("não adiciona o mesmo cliente_id duas vezes", () => {
        const c = adicionar([], item("k1"))
        expect(adicionar(c, item("k1", 5000, "outro texto"))).toBe(c)
    })
    it("só um em voo por vez: com algo em voo, nada mais sai", () => {
        const c = adicionar(adicionar([], item("k1")), item("k2"))
        expect(proximoParaEnviar(c, "k1")).toBeNull()
        expect(proximoParaEnviar(c, null)?.clienteId).toBe("k1")
    })
    it("a fila anda na ordem de escrita", () => {
        let c = adicionar(adicionar([], item("k1")), item("k2"))
        c = aoResposta(c, "k1", { ok: true }, 2000)
        expect(proximoParaEnviar(c, null)?.clienteId).toBe("k2")
    })
    it("bolhas só do culto atual e na ordem", () => {
        const outro = novoItem({ clienteId: "z", cultoId: "c2", texto: "x", citacao: null, operador: null, agora: 1 })
        const c = adicionar(adicionar(adicionar([], item("k1")), outro), item("k2"))
        expect(bolhasDoCulto(c, "c1", []).map((i) => i.clienteId)).toEqual(["k1", "k2"])
        expect(bolhasDoCulto(c, null, [])).toEqual([])
    })
    it("resposta tardia de quem não está mais em 'enviando' não muda nada", () => {
        let c = adicionar([], item("k1"))
        c = aoResposta(c, "k1", { ok: true }, 2000)
        expect(aoResposta(c, "k1", { ok: false, codigo: "rede", mensagem: "x" }, 3000)).toBe(c)
        expect(aoResposta(c, "inexistente", { ok: true }, 3000)).toBe(c)
    })
})

describe("decidirResposta: o que vira o quê", () => {
    it("rede e 5xx = conferindo (pode ter chegado)", () => {
        expect(decidirResposta({ ok: false, codigo: "rede", mensagem: "Não sei se o Sirvo recebeu — conferindo…" }).estado).toBe("conferindo")
        expect(decidirResposta({ ok: false, codigo: "erro", mensagem: "Sirvo respondeu 502." }).estado).toBe("conferindo")
    })
    it("frase do Sirvo = recusada, com a frase", () => {
        const d = decidirResposta({ ok: false, codigo: "erro", mensagem: "Mensagens demais desta chave. Espere um pouco." })
        expect(d).toEqual({ estado: "recusada", erro: "Mensagens demais desta chave. Espere um pouco." })
        expect(decidirResposta({ ok: false, codigo: "erro", mensagem: "Sirvo respondeu 400." }).estado).toBe("recusada")
    })
    it("chave inválida = recusada, nunca tenta sozinho", () => {
        expect(decidirResposta({ ok: false, codigo: "chave_invalida", mensagem: "" }).estado).toBe("recusada")
        expect(decidirResposta({ ok: false, codigo: "sem_chave", mensagem: "" }).estado).toBe("recusada")
    })
    it("a frase recusada é limpa (texto hostil)", () => {
        const d = decidirResposta({ ok: false, codigo: "erro", mensagem: "<b>oi</b>" + String.fromCharCode(0x202e) })
        expect(d.erro).toBe("<b>oi</b>") // vira texto na tela (Svelte escapa); aqui só sai o controle
    })
})

describe("repetir sem duplicar", () => {
    it("rede → conferindo → 30 s sem retrato → falhou → tentar de novo com o MESMO cliente_id", () => {
        let c = adicionar([], item("k1", 1000))
        c = aoResposta(c, "k1", { ok: false, codigo: "rede", mensagem: "" }, 2000)
        expect(c[0].estado).toBe("conferindo")
        expect(precisaDeRelogio(c)).toBe(true)
        expect(aoTempo(c, 2000 + CONFERIR_ATE_MS - 1)).toBe(c)
        c = aoTempo(c, 2000 + CONFERIR_ATE_MS)
        expect(c[0].estado).toBe("falhou")
        expect(precisaDeRelogio(c)).toBe(false)
        c = tentarDeNovo(c, "k1", 40_000)
        expect(c[0]).toMatchObject({ estado: "enviando", clienteId: "k1", texto: "ok" })
        expect(proximoParaEnviar(c, null)?.clienteId).toBe("k1")
    })
    it("o retrato que chega durante 'conferindo' resolve sem nenhuma segunda tentativa", () => {
        let c = adicionar([], item("k1"))
        c = aoResposta(c, "k1", { ok: false, codigo: "rede", mensagem: "" }, 2000)
        c = aoRetratoSaida(c, [minha("m9", "k1")])
        expect(c).toEqual([])
    })
    it("recusada também tenta de novo (mesmo id) ou descarta", () => {
        let c = adicionar([], item("k1"))
        c = aoResposta(c, "k1", { ok: false, codigo: "erro", mensagem: "Mensagens demais desta chave. Espere um pouco." }, 2000)
        expect(c[0].estado).toBe("recusada")
        expect(rotuloDoEstado(c[0])).toBe("Mensagens demais desta chave. Espere um pouco.")
        expect(tentarDeNovo(c, "k1", 3000)[0].estado).toBe("enviando")
        expect(descartar(c, "k1")).toEqual([])
    })
    it("tentar de novo só vale para falhou/recusada (nunca para o que está enviando ou enviada)", () => {
        const c = adicionar([], item("k1"))
        expect(tentarDeNovo(c, "k1", 5000)).toBe(c)
        const e = aoResposta(c, "k1", { ok: true }, 2000)
        expect(tentarDeNovo(e, "k1", 5000)).toBe(e)
    })
    it("enviada que o retrato nunca trouxe sai depois de 60 s", () => {
        let c = adicionar([], item("k1"))
        c = aoResposta(c, "k1", { ok: true }, 2000)
        expect(aoTempo(c, 2000 + ENVIADA_ATE_MS - 1)).toBe(c)
        expect(aoTempo(c, 2000 + ENVIADA_ATE_MS)).toEqual([])
    })
    it("retrato sem nenhuma mensagem nossa não mexe na caixa", () => {
        const c = adicionar([], item("k1"))
        expect(aoRetratoSaida(c, [msg("a")])).toBe(c)
        // uma mensagem de OUTRA chave com o mesmo cliente_id nunca vem como minha
        expect(aoRetratoSaida(c, [msg("a", "x", { autor_tipo: "chave", cliente_id: "k1" })])).toBe(c)
    })
})

describe("estado: responde, minha e não lidas", () => {
    it("responde vem do show_rev e do retrato", () => {
        const a = aoRev(estadoInicial("c1"), "c1", { ligado: true, motivo: null, assinatura: "A", mudado_em: null, responde: true })
        expect(a.estado.responde).toBe(true)
        const b = aoRev(a.estado, "c1", { ligado: true, motivo: null, assinatura: "A", mudado_em: null })
        expect(b.estado.responde).toBe(false) // Sirvo sem o interruptor / desligado
    })
    it("chat desligado no meio do culto congela e tira o 'responde'", () => {
        let e = aoRev(estadoInicial("c1"), "c1", { ligado: true, motivo: null, assinatura: "A", mudado_em: null, responde: true }).estado
        e = aoRetrato(e, "c1", retrato("A", [msg("1")], { responde: true })).estado
        e = aoRev(e, "c1", { ligado: false, motivo: null, assinatura: null, mudado_em: "2026-11-09T22:42:00Z" }).estado
        expect(e).toMatchObject({ congelado: true, responde: false })
        expect(e.mensagens).toHaveLength(1)
    })
    it("mensagem minha nunca é não lida nem alerta", () => {
        let e = aoRev(estadoInicial("c1"), "c1", { ligado: true, motivo: null, assinatura: "A", mudado_em: null, responde: true }).estado
        e = aoRetrato(e, "c1", retrato("A", [msg("1")], { responde: true })).estado
        const x = aoRetrato(e, "c1", retrato("B", [msg("1"), minha("2", "k1"), msg("3")], { responde: true }))
        expect(x.novas).toBe(1)
        expect(x.estado.naoLidas).toBe(1) // só a "3": a "1" veio no primeiro retrato e a "2" é minha
    })
})

describe("texto hostil e exibição", () => {
    it("limparTexto tira controle e bidi, junta espaços, corta no limite", () => {
        expect(limparTexto("a" + String.fromCharCode(0x202e) + "b\u0007​c", 10)).toBe("abc")
        expect(limparTexto("a   b\n c", 10)).toBe("a b c")
        expect(limparTexto("abcdef", 3)).toBe("abc")
        expect(limparTexto(42, 10)).toBe("")
    })
    it("normalizarMensagens recusa sem id, repete id e id estranho; HTML fica como texto", () => {
        const r = normalizarMensagens([{ id: "a", body: "<img src=x onerror=alert(1)>", autor: "<b>Ana</b>" }, { id: "a", body: "repetida" }, { body: "sem id" }, { id: "../x" }, null, "texto"])
        expect(r).toHaveLength(1)
        expect(r[0].body).toBe("<img src=x onerror=alert(1)>")
        expect(r[0].autor).toBe("<b>Ana</b>") // texto: o Svelte escapa na tela
    })
    it("autor_tipo desconhecido vira pessoa; minha só com true exato", () => {
        const [m] = normalizarMensagens([{ id: "a", autor_tipo: "admin", minha: "true", autor: "X" }])
        expect(m).toMatchObject({ autor_tipo: "pessoa", minha: false })
    })
    it("nomeDoAutor: pessoa, chave, chave com operador, sem repetir o operador", () => {
        expect(nomeDoAutor({ autor: "Ana", autor_tipo: "pessoa", operador: null })).toBe("Ana")
        expect(nomeDoAutor({ autor: "", autor_tipo: "pessoa", operador: null })).toBe("Alguém")
        expect(nomeDoAutor({ autor: "Sala de vídeo", autor_tipo: "chave", operador: null })).toBe("Sala de vídeo")
        expect(nomeDoAutor({ autor: "Sala de vídeo", autor_tipo: "chave", operador: "Pedro" })).toBe("Sala de vídeo · Pedro")
        expect(nomeDoAutor({ autor: "Sala de vídeo · Pedro", autor_tipo: "chave", operador: "Pedro" })).toBe("Sala de vídeo · Pedro")
        // o operador nunca aparece sozinho, nem se disser ser uma pessoa
        expect(nomeDoAutor({ autor: "Sala de vídeo", autor_tipo: "chave", operador: "Pastor Ana" })).toBe("Sala de vídeo · Pastor Ana")
    })
    it("trecho da citação: uma linha, até 80 caracteres, áudio com transcrição", () => {
        const longa = msg("1", "x ".repeat(100))
        const t = trechoDaCitacao(longa)
        expect(t.autor).toBe("Ana")
        expect(Array.from(t.trecho).length).toBeLessThanOrEqual(81)
        expect(trechoDaCitacao(msg("2", "linha 1\nlinha 2")).trecho).toBe("linha 1 linha 2")
    })
    it("dica de identidade e nome da chave aprendido", () => {
        expect(dicaDeIdentidade("Sala de vídeo", "Pedro")).toBe("você está como Sala de vídeo · Pedro")
        expect(dicaDeIdentidade("", "  ")).toBe("você está como Sala de vídeo")
        expect(nomeDaChave([msg("1")])).toBe("Sala de vídeo")
        expect(nomeDaChave([minha("2", "k", { autor: "Régia 2", operador: "Pedro" })])).toBe("Régia 2")
        expect(nomeDaChave([minha("2", "k", { autor: "Régia 2 · Pedro", operador: "Pedro" })])).toBe("Régia 2")
    })
    it("rótulos dos estados", () => {
        expect(rotuloDoEstado({ estado: "enviando", erro: "" })).toBe("enviando…")
        expect(rotuloDoEstado({ estado: "conferindo", erro: "" })).toBe("conferindo…")
        expect(rotuloDoEstado({ estado: "enviada", erro: "" })).toBe("enviada")
    })
})
