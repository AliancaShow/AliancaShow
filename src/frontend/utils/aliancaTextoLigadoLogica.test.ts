import { describe, expect, it } from "vitest"
import { NENHUM, avisoDoModelo, estiloDaForma, gruposLigados, indiceDaLetra, idDoCronometro, lerLigacao, linhasLigadas, todasAsOpcoes } from "./aliancaTextoLigadoLogica"

const caixa = (...valores: (string | [string, string])[]) => ({ lines: [{ align: "text-align:left;", text: valores.map((v) => (Array.isArray(v) ? { value: v[0], style: v[1] } : { value: v, style: "font-size:80px;" })) }] })
const opcoes = todasAsOpcoes(gruposLigados({ emModelo: true, cronometros: ["Pregação"] }))
const achar = (id: string) => opcoes.find((o) => o.id === id)!

describe("gruposLigados", () => {
    it("Bíblia só em modelo; cronômetros com o id do FreeShow", () => {
        expect(gruposLigados({ emModelo: false }).map((g) => g.id)).toEqual(["slide", "relogio", "midia", "projeto"])
        const g = gruposLigados({ emModelo: true, cronometros: ["Pregação final", " "] })
        expect(g.map((x) => x.id)).toEqual(["slide", "biblia", "relogio", "cronometros", "midia", "projeto"])
        expect(g.find((x) => x.id === "cronometros")!.opcoes).toEqual([expect.objectContaining({ rotulo: "Pregação final", partes: ["{timer_pregação_final}"] })])
        expect(idDoCronometro(" Culto da noite ")).toBe("timer_culto_da_noite")
    })
    it("todo código é um valor dinâmico entre chaves", () => {
        for (const o of opcoes) for (const p of o.partes) expect(p).toMatch(/\{[a-z0-9_ãçõéáíú]+\}/)
    })
})

describe("lerLigacao", () => {
    it("texto escrito ou vazio = nenhum", () => {
        expect(lerLigacao(caixa("Bem-vindos"), opcoes)).toEqual({ tipo: "nenhum" })
        expect(lerLigacao(caixa(""), opcoes)).toEqual({ tipo: "nenhum" })
        expect(lerLigacao(null, opcoes)).toEqual({ tipo: "nenhum" })
    })
    it("reconhece a opção, inclusive o versículo com número do modelo padrão do FreeShow", () => {
        expect(lerLigacao(caixa("{scripture_reference}"), opcoes)).toMatchObject({ tipo: "opcao", opcao: { id: "biblia_referencia" } })
        expect(lerLigacao(caixa("{scripture_number} ", "{scripture_text}"), opcoes)).toMatchObject({ tipo: "opcao", opcao: { id: "biblia_versiculo_numero" } })
        expect(lerLigacao(caixa("{time_hours}:{time_minutes}"), opcoes)).toMatchObject({ tipo: "opcao", opcao: { id: "hora" } })
    })
    it("texto fixo + valor, ou duas linhas com valores = misto (não mexe sem pedir)", () => {
        expect(lerLigacao(caixa("Hoje: {time_hours}"), opcoes)).toEqual({ tipo: "misto", texto: "Hoje: {time_hours}" })
        const duas = { lines: [{ text: [{ value: "{scripture_name}" }] }, { text: [{ value: "{scripture_reference}" }] }] }
        expect(lerLigacao(duas, opcoes).tipo).toBe("misto")
    })
    it("referência em cima e versão embaixo (modelo Bíblia do FreeShow) é uma opção; cada linha guarda o próprio estilo", () => {
        const padrao = {
            lines: [
                { align: "a", text: [{ value: "{scripture_reference}", style: "font-size:55px;" }] },
                { align: "a", text: [{ value: "{scripture_name}", style: "font-size:40px;" }] }
            ]
        }
        expect(lerLigacao(padrao, opcoes)).toMatchObject({ tipo: "opcao", opcao: { id: "biblia_referencia_versao" } })
        expect(linhasLigadas(padrao, achar("biblia_referencia_versao"))).toEqual(padrao.lines)
    })
})

describe("linhasLigadas", () => {
    it("a caixa inteira vira o valor e guarda alinhamento e estilo", () => {
        const l = linhasLigadas(caixa(["Bem-vindos", "font-size:60px;color:#ff0;"], "x"), achar("biblia_referencia"))
        expect(l).toEqual([{ align: "text-align:left;", text: [{ value: "{scripture_reference}", style: "font-size:60px;color:#ff0;" }] }])
    })
    it("versículo com número reaproveita o estilo do número que já existia", () => {
        const antes = caixa(["{scripture_number} ", "font-size:40px;"], ["{scripture_text}", "font-size:80px;"])
        expect(linhasLigadas(antes, achar("biblia_versiculo_numero"))[0].text).toEqual([
            { value: "{scripture_number} ", style: "font-size:40px;" },
            { value: "{scripture_text}", style: "font-size:80px;" }
        ])
    })
    it("Nenhum esvazia a caixa e guarda o estilo; ida e volta é reconhecida", () => {
        expect(linhasLigadas(caixa("{slide_text_next}"), NENHUM)).toEqual([{ align: "text-align:left;", text: [{ value: "", style: "font-size:80px;" }] }])
        for (const o of opcoes) expect(lerLigacao({ lines: linhasLigadas(caixa("a"), o) }, opcoes)).toMatchObject({ tipo: "opcao", opcao: { id: o.id } })
    })
})

describe("avisoDoModelo", () => {
    const fundo = { type: "media" }
    const forma = { style: "background-color:red;", lines: [{ text: [{ value: "" }] }] }
    it("fora de modelo: nada", () => {
        expect(avisoDoModelo({ emModelo: false, itens: [caixa("{time_hours}")], indice: 0 })).toBeNull()
    })
    it("música: caixa ligada antes da letra não leva aviso; a LETRA leva info", () => {
        const itens = [fundo, caixa("{time_hours}"), caixa("Letra")]
        expect(avisoDoModelo({ emModelo: true, itens, indice: 1 })).toBeNull()
        expect(avisoDoModelo({ emModelo: true, itens, indice: 2 })?.nivel).toBe("info")
    })
    it("música: sem caixa livre, a letra cai na forma ou na ligada = alerta", () => {
        expect(avisoDoModelo({ emModelo: true, itens: [forma, caixa("{time_hours}")], indice: 0 })?.nivel).toBe("alerta")
        expect(avisoDoModelo({ emModelo: true, itens: [forma, caixa("{time_hours}")], indice: 1 })).toBeNull()
        expect(avisoDoModelo({ emModelo: true, itens: [caixa("{time_hours}")], indice: 0 })?.nivel).toBe("alerta")
        expect(avisoDoModelo({ emModelo: true, itens: [forma, caixa("Letra")], indice: 0 })).toBeNull()
    })
    it("Bíblia: caixa sem valor fica vazia (info); com valor, nada", () => {
        const itens = [caixa("{scripture_text}"), caixa("Fixo")]
        expect(avisoDoModelo({ emModelo: true, itens, indice: 1 })?.nivel).toBe("info")
        expect(avisoDoModelo({ emModelo: true, itens, indice: 0 })).toBeNull()
        expect(avisoDoModelo({ emModelo: true, itens: [caixa("x")], indice: 0, modoBiblia: true })?.nivel).toBe("info")
    })
})

describe("estiloDaForma", () => {
    it("retângulo e círculo com fundo", () => {
        expect(estiloDaForma("retangulo")["background-color"]).toBeTruthy()
        expect(estiloDaForma("circulo")["border-radius"]).toBe("50%")
    })
})

describe("indiceDaLetra", () => {
    it("livre > forma > ligada, empate pela ordem; Bíblia e fora de modelo: nenhuma", () => {
        const itens = [{ type: "media" }, caixa("{time_hours}"), caixa("Letra")]
        expect(indiceDaLetra({ emModelo: true, itens })).toBe(2)
        const forma = { style: "background-color:red;", lines: [{ text: [{ value: "" }] }] }
        expect(indiceDaLetra({ emModelo: true, itens: [forma, caixa("{time_hours}"), caixa("")] })).toBe(2)
        expect(indiceDaLetra({ emModelo: true, itens: [caixa("{time_hours}"), forma] })).toBe(1)
        expect(indiceDaLetra({ emModelo: true, itens: [caixa("{time_hours}"), caixa("{slide_text_next}")] })).toBe(0)
        expect(indiceDaLetra({ emModelo: false, itens })).toBe(-1)
        expect(indiceDaLetra({ emModelo: true, itens: [caixa("{scripture_text}"), caixa("x")] })).toBe(-1)
        expect(indiceDaLetra({ emModelo: true, itens, modoBiblia: true })).toBe(-1)
    })
})
