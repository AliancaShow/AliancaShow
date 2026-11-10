import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { aplicarRespostaDevolver, aplicarRespostaTirar, avancarDispensas, CARENCIA_MS, DESCARTE_MS, desfazer, desistir, dispensasDaRemocao, GUARDA_DEVOLVER_MS, limparPeloRoteiro, marcarFalha, marcasDispensadas, marcasVoltaram, paraDevolver, paraTirar, proximaCarencia, responderLote, resumirDispensas, textoDispensas, type Dispensa } from "./aliancaSirvoDispensas"
import { idDoAviso, linhasDoRoteiro, type MusicaDoSirvo } from "./aliancaSirvoMusicas"

const EV = "ev1"
const T0 = 1_700_000_000_000
const mus = (id: string, show_id: string | null, ordem: number, nome: string): MusicaDoSirvo => ({ id, show_id, nome, ordem })
const roteiro = [
    { id: "louvor", musicas: [mus("r1", "oceanos", 0, "Oceanos"), mus("r2", "terra", 1, "Terra"), mus("r3", null, 2, "Nova")] },
    { id: "palavra", musicas: [mus("r4", "sangue", 0, "Sangue")] }
]
const linhas = linhasDoRoteiro(roteiro)
const vivas = new Set(linhas.keys())

const marcado = (show: string, rmId: string): ProjectShowRef => ({ id: show, type: "show", data: { sirvoMusica: rmId } })
const aviso = (rmId: string): ProjectShowRef => ({ id: idDoAviso(rmId), type: "section", name: "⚠ Falta criar: Nova", data: { sirvoMusica: rmId, sirvoFalta: true } })
const doOperador = (id: string): ProjectShowRef => ({ id, type: "show" })
const ctx = (extra: Partial<{ eventId: string; agora: number; lote: string; conduz: boolean }> = {}) => ({ eventId: EV, agora: T0, lote: "L1", conduz: true, ...extra })

const disp = (rmId: string, envio: Dispensa["envio"], extra: Partial<Dispensa> = {}): Dispensa => ({ rmId, eventId: EV, blocoId: "louvor", nome: rmId.toUpperCase(), em: T0, envio, lote: "L1", ...extra })
const envios = (lista: Dispensa[]) => Object.fromEntries(lista.map((d) => [d.rmId, d.envio]))

describe("dispensasDaRemocao: o que o operador tirou numa ação só", () => {
    it("uma música só: aguardando, com o nome e o bloco do roteiro", () => {
        const r = dispensasDaRemocao([marcado("oceanos", "r1")], linhas, [], ctx())
        expect(r).toEqual([{ rmId: "r1", eventId: EV, blocoId: "louvor", nome: "Oceanos", em: T0, envio: "aguardando", lote: "L1" }])
    })

    it("item do operador (sem marca) e marca de linha que já saiu do Sirvo não contam", () => {
        expect(dispensasDaRemocao([doOperador("x"), marcado("velha", "r_morta")], linhas, [], ctx())).toEqual([])
    })

    it("o aviso cinza é dispensa LOCAL, nunca vai ao Sirvo (mesmo sozinho, mesmo conduzindo)", () => {
        expect(envios(dispensasDaRemocao([aviso("r3")], linhas, [], ctx()))).toEqual({ r3: "local" })
    })

    it("duas ou mais músicas na mesma ação: confirmar (conduz) ou local (não conduz)", () => {
        expect(envios(dispensasDaRemocao([marcado("oceanos", "r1"), marcado("terra", "r2")], linhas, [], ctx()))).toEqual({ r1: "confirmar", r2: "confirmar" })
        expect(envios(dispensasDaRemocao([marcado("oceanos", "r1"), marcado("terra", "r2")], linhas, [], ctx({ conduz: false })))).toEqual({ r1: "local", r2: "local" })
    })

    it("música + aviso na mesma ação: a música é uma só (aguardando); o aviso é local", () => {
        expect(envios(dispensasDaRemocao([marcado("oceanos", "r1"), aviso("r3")], linhas, [], ctx()))).toEqual({ r3: "local", r1: "aguardando" })
    })

    it("uma música sem conduzir também espera a carência (dá para desfazer); vira local depois", () => {
        const r = dispensasDaRemocao([marcado("oceanos", "r1")], linhas, [], ctx({ conduz: false }))
        expect(envios(r)).toEqual({ r1: "aguardando" })
        expect(envios(avancarDispensas(r, T0 + CARENCIA_MS, false))).toEqual({ r1: "local" })
    })

    it("linha que já tem dispensa não ganha outra; a mesma marca duas vezes conta uma", () => {
        expect(dispensasDaRemocao([marcado("oceanos", "r1")], linhas, [disp("r1", "local")], ctx())).toEqual([])
        expect(dispensasDaRemocao([marcado("oceanos", "r1"), marcado("copia", "r1")], linhas, [], ctx()).map((d) => d.rmId)).toEqual(["r1"])
    })
})

describe("a carência", () => {
    it("antes de vencer nada muda (a mesma lista); vencida vira fila (conduz) ou local", () => {
        const lista = [disp("r1", "aguardando")]
        expect(avancarDispensas(lista, T0 + CARENCIA_MS - 1, true)).toBe(lista)
        expect(envios(avancarDispensas(lista, T0 + CARENCIA_MS, true))).toEqual({ r1: "fila" })
        expect(envios(avancarDispensas(lista, T0 + CARENCIA_MS, false))).toEqual({ r1: "local" })
    })

    it("confirmar não anda com o tempo: espera o operador", () => {
        const lista = [disp("r1", "confirmar"), disp("r2", "confirmar")]
        expect(avancarDispensas(lista, T0 + 10 * CARENCIA_MS, true)).toBe(lista)
    })

    it("a chave deixou de conduzir com algo na fila: vira local (ninguém mais vai mandar)", () => {
        expect(envios(avancarDispensas([disp("r1", "fila", { falhou: true })], T0, false))).toEqual({ r1: "local" })
    })

    it("proximaCarencia: a mais cedo das que esperam; null sem nenhuma", () => {
        expect(proximaCarencia([disp("r1", "aguardando", { em: T0 + 1000 }), disp("r2", "aguardando", { em: T0 }), disp("r3", "local")])).toBe(T0 + CARENCIA_MS)
        expect(proximaCarencia([disp("r3", "local"), disp("r4", "fila")])).toBeNull()
    })
})

describe("a marca voltou ao projeto (colar depois do Ctrl+X, Ctrl+Z)", () => {
    const no = (...marcas: string[]) => new Set(marcas)

    it("na carência: a dispensa cai e nada é mandado", () => {
        const r = marcasVoltaram([disp("r1", "aguardando")], EV, no("r1"), true)
        expect(r).toEqual({ lista: [], tirarMarca: [] })
    })

    it("confirmar, fila (até a que falhou) e local: caem também", () => {
        const r = marcasVoltaram([disp("r1", "confirmar"), disp("r2", "fila", { falhou: true }), disp("r3", "local"), disp("r4", "local")], EV, no("r1", "r2", "r3"), true)
        expect(envios(r.lista)).toEqual({ r4: "local" })
        expect(r.tirarMarca).toEqual([])
    })

    it("enviada + conduz: vira devolver (o Sirvo recebe a linha de volta)", () => {
        const r = marcasVoltaram([disp("r1", "enviada", { sumiuEm: T0 })], EV, no("r1"), true)
        expect(r.lista).toEqual([{ ...disp("r1", "devolver", { sumiuEm: T0 }), falhou: false }])
        expect(r.tirarMarca).toEqual([])
    })

    it("enviada sem conduzir: a marca sai do item (vira do operador) e a dispensa cai", () => {
        const r = marcasVoltaram([disp("r1", "enviada")], EV, no("r1"), false)
        expect(r).toEqual({ lista: [], tirarMarca: ["r1"] })
    })

    it("fila com o pedido EM VOO (Ctrl+Z no meio do envio): pode ter chegado — vira devolver; sem conduzir, perde a marca", () => {
        const lista = [disp("r1", "fila"), disp("r2", "fila")]
        const r = marcasVoltaram(lista, EV, no("r1", "r2"), true, no("r1"))
        expect(envios(r.lista)).toEqual({ r1: "devolver" })
        expect(marcasVoltaram(lista, EV, no("r1"), false, no("r1"))).toEqual({ lista: [disp("r2", "fila")], tirarMarca: ["r1"] })
        // a resposta do tirar que chega depois só mexe em quem ainda está na fila
        expect(envios(aplicarRespostaTirar(r.lista, ["r1", "r2"], { tiradas: ["r1", "r2"] }))).toEqual({ r1: "devolver" })
    })

    it("devolver já é a resposta à volta: fica esperando o Sirvo", () => {
        const lista = [disp("r1", "devolver")]
        expect(marcasVoltaram(lista, EV, no("r1"), true).lista).toBe(lista)
    })

    it("marca ausente, ou dispensa de outro culto: a mesma lista", () => {
        const lista = [disp("r1", "aguardando"), disp("r2", "local", { eventId: "outro" })]
        expect(marcasVoltaram(lista, EV, no("r2"), true).lista).toBe(lista)
        expect(marcasVoltaram(lista, EV, no(), true).lista).toBe(lista)
    })
})

describe("o roteiro novo chegou", () => {
    it("linha viva: nada muda (a mesma lista)", () => {
        const lista = [disp("r1", "aguardando"), disp("r2", "enviada"), disp("r3", "local")]
        expect(limparPeloRoteiro(lista, EV, vivas, T0)).toBe(lista)
    })

    it("a linha saiu do Sirvo: o que não foi enviado cai (nada a mandar)", () => {
        const lista = [disp("x1", "aguardando"), disp("x2", "confirmar"), disp("x3", "fila"), disp("x4", "local"), disp("r1", "local")]
        expect(envios(limparPeloRoteiro(lista, EV, vivas, T0))).toEqual({ r1: "local" })
    })

    it("enviada: ganha o relógio quando a linha some, e só cai depois da guarda (o Ctrl+Z tardio)", () => {
        const um = limparPeloRoteiro([disp("x1", "enviada")], EV, vivas, T0 + 1000)
        expect(um).toEqual([disp("x1", "enviada", { sumiuEm: T0 + 1000 })])
        expect(limparPeloRoteiro(um, EV, vivas, T0 + 1000 + GUARDA_DEVOLVER_MS)).toBe(um)
        expect(limparPeloRoteiro(um, EV, vivas, T0 + 1000 + GUARDA_DEVOLVER_MS + 1)).toEqual([])
    })

    it("a linha voltou ao roteiro (o Sirvo devolveu): o relógio sai e o registro segue", () => {
        const r = limparPeloRoteiro([disp("r1", "enviada", { sumiuEm: T0 })], EV, vivas, T0 + 5000)
        expect(r).toEqual([disp("r1", "enviada")])
        expect(r[0]).not.toHaveProperty("sumiuEm")
    })

    it("devolver fica mesmo com a linha fora (o Sirvo ainda não respondeu)", () => {
        const lista = [disp("x1", "devolver", { sumiuEm: T0 })]
        expect(limparPeloRoteiro(lista, EV, vivas, T0 + 2 * GUARDA_DEVOLVER_MS)).toBe(lista)
    })

    it("dispensa de outro culto não é tocada; velha demais cai (de qualquer culto)", () => {
        const lista = [disp("q1", "local", { eventId: "outro" }), disp("q2", "enviada", { eventId: "outro", em: T0 - DESCARTE_MS - 1 }), disp("r1", "local", { em: T0 - DESCARTE_MS - 1 })]
        expect(limparPeloRoteiro(lista, EV, vivas, T0)).toEqual([disp("q1", "local", { eventId: "outro" })])
    })
})

describe("a fila para o Sirvo", () => {
    it("paraTirar / paraDevolver: só deste culto e do envio certo", () => {
        const lista = [disp("r1", "fila"), disp("r2", "fila", { eventId: "outro" }), disp("r3", "devolver"), disp("r4", "aguardando")]
        expect(paraTirar(lista, EV).map((d) => d.rmId)).toEqual(["r1"])
        expect(paraDevolver(lista, EV).map((d) => d.rmId)).toEqual(["r3"])
    })

    it("show_tirar_musicas: tiradas e ja_estavam viram enviada; a que o Sirvo não citou fica na fila, marcada", () => {
        const lista = [disp("r1", "fila"), disp("r2", "fila", { falhou: true }), disp("r3", "fila"), disp("r4", "local")]
        const r = aplicarRespostaTirar(lista, ["r1", "r2", "r3"], { ok: true, tiradas: ["r1"], ja_estavam: ["r2"] })
        expect(envios(r)).toEqual({ r1: "enviada", r2: "enviada", r3: "fila", r4: "local" })
        expect(r.find((d) => d.rmId === "r2")?.falhou).toBe(false)
        expect(r.find((d) => d.rmId === "r3")?.falhou).toBe(true)
    })

    it("resposta sem lista (ou vazia) não derruba nada: tudo fica na fila", () => {
        const lista = [disp("r1", "fila")]
        expect(envios(aplicarRespostaTirar(lista, ["r1"], null))).toEqual({ r1: "fila" })
        expect(envios(aplicarRespostaTirar(lista, ["r1"], { ok: true, tiradas: "r1" as any }))).toEqual({ r1: "fila" })
    })

    it("marcarFalha: só o envio pedido, só uma vez (a mesma lista quando já estava marcada)", () => {
        const um = marcarFalha([disp("r1", "fila"), disp("r2", "devolver")], ["r1", "r2"], "fila")
        expect(um.map((d) => !!d.falhou)).toEqual([true, false])
        expect(marcarFalha(um, ["r1"], "fila")).toBe(um)
    })

    it("falhou e tentou de novo: idempotente pelo id (o Sirvo diz ja_estava)", () => {
        let lista = marcarFalha([disp("r1", "fila")], ["r1"], "fila")
        lista = aplicarRespostaTirar(lista, ["r1"], { ok: true, tiradas: [], ja_estavam: ["r1"] })
        expect(lista).toEqual([{ ...disp("r1", "enviada"), falhou: false }])
    })

    it("show_devolver_musica: devolvida ou já estava → a dispensa cai; recusada → cai e a marca sai do item", () => {
        const lista = [disp("r1", "devolver"), disp("r2", "local")]
        expect(aplicarRespostaDevolver(lista, "r1", { ok: true, devolvida: true })).toEqual({ lista: [disp("r2", "local")], tirarMarca: false })
        expect(aplicarRespostaDevolver(lista, "r1", { ok: true, ja_estava: true })).toEqual({ lista: [disp("r2", "local")], tirarMarca: false })
        expect(aplicarRespostaDevolver(lista, "r1", { ok: false, motivo: "cheio" })).toEqual({ lista: [disp("r2", "local")], tirarMarca: true })
        expect(aplicarRespostaDevolver(lista, "r2", { ok: true, devolvida: true })).toEqual({ lista, tirarMarca: false })
    })

    it("desistir: a da fila fica só daqui; a de devolver cai e perde a marca", () => {
        const r = desistir([disp("r1", "fila", { falhou: true }), disp("r2", "devolver"), disp("r3", "local")], ["r1", "r2", "r3"])
        expect(envios(r.lista)).toEqual({ r1: "local", r3: "local" })
        expect(r.lista[0].falhou).toBe(false)
        expect(r.tirarMarca).toEqual(["r2"])
    })
})

describe("os botões da faixa", () => {
    it("Desfazer: aguardando, confirmar e local caem sem mais nada; a da fila cai e pede a linha de volta por garantia", () => {
        const r = desfazer([disp("r1", "aguardando"), disp("r2", "confirmar"), disp("r3", "local"), disp("r4", "fila"), disp("r5", "enviada")], ["r1", "r2", "r3", "r4", "r5"])
        expect(envios(r.lista)).toEqual({ r5: "enviada" })
        expect(r.devolverPorGarantia).toEqual(["r4"])
    })

    it("Desfazer de nada: a mesma lista", () => {
        const lista = [disp("r1", "enviada")]
        expect(desfazer(lista, ["r1", "zz"]).lista).toBe(lista)
    })

    it("a pergunta do lote: 'Tirar do Sirvo também' → fila; 'Manter só aqui' → local; outro lote fica", () => {
        const lista = [disp("r1", "confirmar"), disp("r2", "confirmar"), disp("r3", "confirmar", { lote: "L2" })]
        expect(envios(responderLote(lista, "L1", "tirar"))).toEqual({ r1: "fila", r2: "fila", r3: "confirmar" })
        expect(envios(responderLote(lista, "L1", "manter"))).toEqual({ r1: "local", r2: "local", r3: "confirmar" })
        expect(responderLote(lista, "L9", "tirar")).toBe(lista)
    })

    it("resumo: a pergunta do lote vem primeiro; depois a carência, a fila, o local; devolver só quando falhou; enviada não aparece", () => {
        expect(resumirDispensas([disp("r1", "aguardando"), disp("r2", "confirmar"), disp("r3", "confirmar"), disp("r9", "confirmar", { lote: "L2" })], EV)).toEqual({ tipo: "confirmar", lote: "L1", rmIds: ["r2", "r3"], nomes: ["R2", "R3"] })
        expect(resumirDispensas([disp("r1", "aguardando"), disp("r2", "fila")], EV)).toMatchObject({ tipo: "aguardando", rmIds: ["r1"] })
        expect(resumirDispensas([disp("r2", "fila"), disp("r3", "local")], EV)).toMatchObject({ tipo: "fila", rmIds: ["r2"] })
        expect(resumirDispensas([disp("r3", "local")], EV)).toMatchObject({ tipo: "local", rmIds: ["r3"] })
        expect(resumirDispensas([disp("r4", "devolver")], EV)).toEqual({ tipo: "nada" })
        expect(resumirDispensas([disp("r4", "devolver", { falhou: true })], EV)).toMatchObject({ tipo: "devolver", rmIds: ["r4"] })
        expect(resumirDispensas([disp("r5", "enviada"), disp("r6", "local", { eventId: "outro" })], EV)).toEqual({ tipo: "nada" })
    })

    it("textos", () => {
        expect(textoDispensas({ tipo: "nada" })).toBe("")
        expect(textoDispensas({ tipo: "aguardando", rmIds: ["r1"], nomes: ["Oceanos"] })).toBe("Você tirou Oceanos")
        expect(textoDispensas({ tipo: "aguardando", rmIds: ["r1", "r2"], nomes: ["Oceanos", "Terra"] })).toBe("Você tirou Oceanos e Terra")
        expect(textoDispensas({ tipo: "confirmar", lote: "L1", rmIds: ["r1", "r2", "r3"], nomes: ["a", "b", "c"] })).toBe("Você tirou 3 músicas")
        expect(textoDispensas({ tipo: "fila", rmIds: ["r1"], nomes: ["Oceanos"] })).toBe("Você tirou Oceanos — ainda não avisei o Sirvo")
        expect(textoDispensas({ tipo: "local", rmIds: ["r1"], nomes: ["Oceanos"] })).toBe("Você tirou Oceanos — o Sirvo ainda lista")
        expect(textoDispensas({ tipo: "devolver", rmIds: ["r1"], nomes: ["Oceanos"] })).toBe("Oceanos voltou ao projeto — ainda não avisei o Sirvo")
    })

    it("marcasDispensadas: toda dispensa viva deste culto, de qualquer envio", () => {
        expect([...marcasDispensadas([disp("r1", "aguardando"), disp("r2", "enviada"), disp("r3", "local", { eventId: "outro" })], EV)]).toEqual(["r1", "r2"])
    })
})

describe("a vida de uma dispensa, de ponta a ponta", () => {
    it("tirou uma → carência → fila → enviada → a linha some → Ctrl+Z tardio → devolver → o Sirvo devolveu → cai", () => {
        let lista = dispensasDaRemocao([marcado("oceanos", "r1")], linhas, [], ctx())
        expect(envios(lista)).toEqual({ r1: "aguardando" })

        // a passada de 1 s: a marca não está no projeto, a carência não venceu
        lista = marcasVoltaram(lista, EV, new Set(["r2"]), true).lista
        lista = avancarDispensas(lista, T0 + 1000, true)
        lista = limparPeloRoteiro(lista, EV, vivas, T0 + 1000)
        expect(envios(lista)).toEqual({ r1: "aguardando" })

        // venceu: vai para a fila; o primeiro envio cai (sem rede); o segundo chega
        lista = avancarDispensas(lista, T0 + CARENCIA_MS, true)
        expect(paraTirar(lista, EV).map((d) => d.rmId)).toEqual(["r1"])
        lista = marcarFalha(lista, ["r1"], "fila")
        expect(resumirDispensas(lista, EV).tipo).toBe("fila")
        lista = aplicarRespostaTirar(lista, ["r1"], { ok: true, tiradas: ["r1"], ja_estavam: [] })
        expect(envios(lista)).toEqual({ r1: "enviada" })
        expect(resumirDispensas(lista, EV).tipo).toBe("nada")

        // o roteiro chega sem a linha: o registro fica, com o relógio
        const semR1 = new Set([...vivas].filter((x) => x !== "r1"))
        lista = limparPeloRoteiro(lista, EV, semR1, T0 + 20_000)
        expect(lista[0]).toMatchObject({ envio: "enviada", sumiuEm: T0 + 20_000 })
        expect(marcasDispensadas(lista, EV).has("r1")).toBe(true)

        // Ctrl+Z: a marca voltou ao projeto → devolver; o Sirvo devolve → cai
        lista = marcasVoltaram(lista, EV, new Set(["r1"]), true).lista
        expect(paraDevolver(lista, EV).map((d) => d.rmId)).toEqual(["r1"])
        lista = limparPeloRoteiro(lista, EV, semR1, T0 + 30_000) // ainda sem a linha: fica
        expect(envios(lista)).toEqual({ r1: "devolver" })
        expect(aplicarRespostaDevolver(lista, "r1", { ok: true, devolvida: true }).lista).toEqual([])
    })

    it("tirou duas → pergunta → 'Manter só aqui' → local até a linha sair do roteiro", () => {
        let lista = dispensasDaRemocao([marcado("oceanos", "r1"), marcado("terra", "r2")], linhas, [], ctx())
        expect(resumirDispensas(lista, EV)).toMatchObject({ tipo: "confirmar", lote: "L1" })
        lista = responderLote(lista, "L1", "manter")
        expect(envios(lista)).toEqual({ r1: "local", r2: "local" })
        lista = limparPeloRoteiro(lista, EV, new Set(["r2", "r3", "r4"]), T0 + 60_000)
        expect(envios(lista)).toEqual({ r2: "local" })
    })

    it("colou de volta na carência: cai, e tirar de novo abre outra carência", () => {
        let lista = dispensasDaRemocao([marcado("oceanos", "r1")], linhas, [], ctx())
        lista = marcasVoltaram(lista, EV, new Set(["r1"]), true).lista
        expect(lista).toEqual([])
        lista = dispensasDaRemocao([marcado("oceanos", "r1")], linhas, lista, ctx({ agora: T0 + 5000, lote: "L2" }))
        expect(lista).toMatchObject([{ rmId: "r1", envio: "aguardando", em: T0 + 5000, lote: "L2" }])
    })
})
