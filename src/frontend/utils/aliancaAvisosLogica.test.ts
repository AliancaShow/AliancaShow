import { describe, expect, it } from "vitest"
import { acrescentar, alturaDaLista, alturaSalvaDaLista, arrastarLista, chaveSemTexto, HISTORICO_MAX, INFO_MS, LISTA_LIMITES, LISTA_PADRAO, nivelDaMensagem, noHistorico, principal, textoDaMensagem, tirarChave, tirarId, vencer, type Aviso } from "./aliancaAvisosLogica"

const dic: Record<string, Record<string, string>> = { toast: { saved: "Salvo", saving: "Salvando", midi_no_slide: "Sem slide" }, error: { import: "Erro ao importar" }, output: { state_locked: "Saída travada" } }
const tem = (g: string, c: string) => !!dic[g]?.[c]
const traduzir = (s: string) => s.replace(/([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g, (m, a, b) => dic[a]?.[b] ?? m)

describe("nivel das mensagens do newToast antigo", () => {
    it("erro: chave error.* e textos de falha", () => {
        expect(nivelDaMensagem("error.import")).toBe("erro")
        expect(nivelDaMensagem("Arquivo não encontrado (offline): C:/x.mp4")).toBe("erro")
        expect(nivelDaMensagem("Could not export Canva presentation")).toBe("erro")
        expect(nivelDaMensagem("Error: Sync failed")).toBe("erro")
    })
    it("aviso: recusas e travas", () => {
        expect(nivelDaMensagem("output.state_locked")).toBe("aviso")
        expect(nivelDaMensagem("o telão está congelado: descongele para mandar ao ar")).toBe("aviso")
        expect(nivelDaMensagem("Telão congelado: descongele para mandar pro ar.")).toBe("aviso")
        expect(nivelDaMensagem("Não entrou no roteiro: sem culto")).toBe("aviso")
        expect(nivelDaMensagem("toast.midi_no_slide 3")).toBe("aviso")
        expect(nivelDaMensagem("empty.show")).toBe("aviso")
        expect(nivelDaMensagem("A seleção mudou. Abra o menu de novo.")).toBe("aviso")
    })
    it("info: confirmacoes", () => {
        expect(nivelDaMensagem("toast.saved")).toBe("info")
        expect(nivelDaMensagem('"Cristo Vive" entrou no fim do roteiro')).toBe("info")
        expect(nivelDaMensagem("Copied!")).toBe("info")
        expect(nivelDaMensagem("3 mídias importadas (os arquivos ficam onde estão)")).toBe("info")
    })
})

describe("chave sem texto (falha alta: mostra a chave)", () => {
    it("so olha a chave do comeco", () => {
        expect(chaveSemTexto("toast.nao_existe", tem)).toBe("toast.nao_existe")
        expect(chaveSemTexto("toast.midi_no_slide 3", tem)).toBeNull()
        expect(chaveSemTexto("toast.saved", tem)).toBeNull()
        expect(chaveSemTexto("Arquivo não encontrado: C:/a.mp4", tem)).toBeNull()
        expect(chaveSemTexto("Copied!", tem)).toBeNull()
    })
    it("o texto traz a chave e o defeito, em aviso (fica ate o x)", () => {
        const r = textoDaMensagem("toast.nao_existe", traduzir, tem)
        expect(r.nivel).toBe("aviso")
        expect(r.texto).toContain("toast.nao_existe")
        expect(r.texto).toContain("sem texto")
    })
    it("chave conhecida vira o texto traduzido com o nivel da chave", () => {
        expect(textoDaMensagem("error.import", traduzir, tem)).toEqual({ texto: "Erro ao importar", nivel: "erro" })
        expect(textoDaMensagem("toast.saved", traduzir, tem)).toEqual({ texto: "Salvo", nivel: "info" })
    })
})

describe("fila", () => {
    const um = (l: Aviso[], chave: string, nivel: Aviso["nivel"], id: number, agora = 0) => acrescentar(l, { chave, texto: chave, nivel }, id, agora)

    it("a mesma chave nao empilha: conta as vezes e vai para o fim", () => {
        let l = um([], "a", "aviso", 1)
        l = um(l, "b", "info", 2)
        l = um(l, "a", "aviso", 3, 10)
        expect(l.map((a) => a.chave)).toEqual(["b", "a"])
        expect(l[1].vezes).toBe(2)
        expect(l[1].id).toBe(1)
    })
    it("o par do Toast antigo: toast.saved tira o toast.saving", () => {
        let l = um([], "toast.saving", "info", 1)
        l = um(l, "toast.saved", "info", 2)
        expect(l.map((a) => a.chave)).toEqual(["toast.saved"])
    })
    it("info vence em INFO_MS; aviso e erro ficam", () => {
        let l = um([], "i", "info", 1, 0)
        l = um(l, "w", "aviso", 2, 0)
        l = um(l, "e", "erro", 3, 0)
        expect(vencer(l, INFO_MS - 1)).toBe(l)
        expect(vencer(l, INFO_MS).map((a) => a.chave)).toEqual(["w", "e"])
        expect(vencer(l, 10 * 60 * 1000).map((a) => a.chave)).toEqual(["w", "e"])
    })
    it("o x tira pelo id; resolver tira pela chave", () => {
        const l = um(um([], "a", "aviso", 1), "b", "erro", 2)
        expect(tirarId(l, 1).map((a) => a.chave)).toEqual(["b"])
        expect(tirarChave(l, "b").map((a) => a.chave)).toEqual(["a"])
        expect(tirarChave(l, "zz")).toBe(l)
    })
    it("a linha: erro na frente de tudo; aviso e info pelo mais novo", () => {
        let l = um([], "i", "info", 1, 1)
        l = um(l, "w1", "aviso", 2, 2)
        l = um(l, "w2", "aviso", 3, 3)
        expect(principal(l)).toMatchObject({ aviso: { chave: "w2" }, outros: 2 })
        l = um(l, "dica", "info", 5, 4)
        expect(principal(l).aviso?.chave).toBe("dica")
        expect(principal(vencer(l, 4 + INFO_MS)).aviso?.chave).toBe("w2")
        l = um(l, "e", "erro", 4, 0)
        expect(principal(l).aviso?.chave).toBe("e")
        expect(principal([])).toEqual({ aviso: null, outros: 0 })
    })
    it("historico: o mais novo em cima, sem repetir a mesma chave seguida, no maximo HISTORICO_MAX", () => {
        const a = (chave: string, id: number): Aviso => ({ id, chave, texto: chave, nivel: "info", em: id, vezes: 1 })
        let h: Aviso[] = []
        h = noHistorico(h, a("x", 1))
        h = noHistorico(h, a("x", 2))
        h = noHistorico(h, a("y", 3))
        expect(h.map((v) => v.id)).toEqual([3, 2])
        for (let i = 0; i < 50; i++) h = noHistorico(h, a("k" + i, 10 + i))
        expect(h.length).toBe(HISTORICO_MAX)
        expect(h[0].chave).toBe("k49")
    })
    it("historico: a mesma chave com texto novo (caiu -> voltou) entra como linha nova", () => {
        const a = (texto: string, id: number): Aviso => ({ id, chave: "queda-saida:t", texto, nivel: "erro", em: id, vezes: 1 })
        expect(noHistorico(noHistorico([], a("caiu", 1)), a("voltou", 2)).map((v) => v.texto)).toEqual(["voltou", "caiu"])
    })
})

describe("altura da lista dos ultimos avisos (divisoria gravada)", () => {
    it("o valor gravado: numero vira px nos limites; ausente ou torto = padrao", () => {
        expect(alturaSalvaDaLista(null)).toBe(LISTA_PADRAO)
        expect(alturaSalvaDaLista("")).toBe(LISTA_PADRAO)
        expect(alturaSalvaDaLista("abc")).toBe(LISTA_PADRAO)
        expect(alturaSalvaDaLista("250.6")).toBe(251)
        expect(alturaSalvaDaLista("5")).toBe(LISTA_LIMITES[0])
        expect(alturaSalvaDaLista("9999")).toBe(LISTA_LIMITES[1])
    })
    it("arrastar para cima aumenta, para baixo diminui, preso ao minimo e ao maximo", () => {
        expect(arrastarLista(132, -100, 1080)).toBe(232)
        expect(arrastarLista(132, 100, 1080)).toBe(LISTA_LIMITES[0])
        expect(arrastarLista(132, -2000, 1080)).toBe(LISTA_LIMITES[1])
    })
    it("tela baixa: a lista nunca passa de 45% da altura, e nunca abaixo do minimo", () => {
        expect(arrastarLista(132, -2000, 600)).toBe(270)
        expect(alturaDaLista(480, 600)).toBe(270)
        expect(alturaDaLista(480, 100)).toBe(LISTA_LIMITES[0])
    })
})
