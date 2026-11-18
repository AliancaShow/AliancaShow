import { describe, expect, it } from "vitest"
import { mostrarMandarSo, saidasDoEnvio, saidasParaMandar } from "./aliancaEditarSaidas"
import { FAIXA_DEFASADO, avisoAoVivo, contagemDeSlides, faixaDefasada, empurrarAvulso, editDoItemDoRoteiro, tipoDeEdicaoDesconhecido, estaNoRoteiro, itemEmEdicao, opcoesDoSeletor, MAX_AVULSOS, notaDoCentro, saidasQueMostram, selosDoShow, situacaoDoSlide, tirarAvulso, type ItemEditavel } from "./aliancaEditarLogica"

const ref = [{ id: "a" }, { id: "b" }, { id: "c" }]
const slides = (itemsB: any[] = [1]) => ({ a: { items: [0] }, b: { items: itemsB }, c: { items: [2] } })
const foto = (slideId: string, itens: any[], extra: any = {}) => ({ slideId, slide: { items: itens }, ...extra })

describe("selos NO AR / EDITADO (a foto manda)", () => {
    it("slide no ar igual a foto: NO AR, nao editado", () => {
        const s = selosDoShow({ showId: "s", layout: "L", ref, slides: slides(), noAr: [{ id: "s", layout: "L", index: 1, foto: foto("b", [1]) }] })
        expect(s).toEqual({ 1: { noAr: true, editado: false } })
    })
    it("itens diferentes da foto: EDITADO", () => {
        const s = selosDoShow({ showId: "s", layout: "L", ref, slides: slides([1, 2]), noAr: [{ id: "s", layout: "L", index: 1, foto: foto("b", [1]) }] })
        expect(s[1]).toEqual({ noAr: true, editado: true })
    })
    it("ajuste do slide (settings) tambem conta: o telao congela a cor/fundo do slide junto", () => {
        const vivos = { ...slides(), b: { items: [1], settings: { color: "#f00" } } }
        const s = selosDoShow({ showId: "s", layout: "L", ref, slides: vivos, noAr: [{ id: "s", layout: "L", index: 1, foto: foto("b", [1]) }] })
        expect(s[1].editado).toBe(true)
    })
    it("o layout andou: a posicao e a do slide da foto, nao a do indice antigo", () => {
        const novoRef = [{ id: "x" }, { id: "a" }, { id: "b" }]
        const s = selosDoShow({ showId: "s", layout: "L", ref: novoRef, slides: { x: { items: [] }, a: { items: [0] }, b: { items: [1] } }, noAr: [{ id: "s", layout: "L", index: 1, foto: foto("b", [1], { ocorrencia: 0 }) }] })
        expect(Object.keys(s)).toEqual(["2"])
    })
    it("outro show ou outro layout no ar: nada", () => {
        expect(
            selosDoShow({
                showId: "s",
                layout: "L",
                ref,
                slides: slides(),
                noAr: [
                    { id: "z", layout: "L", index: 1 },
                    { id: "s", layout: "M", index: 1 }
                ]
            })
        ).toEqual({})
    })
    it("sem foto (a saida le ao vivo): NO AR e nunca EDITADO", () => {
        const s = selosDoShow({ showId: "s", layout: "L", ref, slides: slides([9]), noAr: [{ id: "s", layout: "L", index: 2 }] })
        expect(s).toEqual({ 2: { noAr: true, editado: false } })
    })
    it("foto cujo slide sumiu do layout: sem selo", () => {
        const s = selosDoShow({ showId: "s", layout: "L", ref, slides: slides(), noAr: [{ id: "s", layout: "L", index: 1, foto: foto("zzz", [1], { ocorrencia: 0 }) }] })
        expect(s).toEqual({})
    })
    it("duas saidas no mesmo slide: basta uma defasada para avisar", () => {
        const s = selosDoShow({
            showId: "s",
            layout: "L",
            ref,
            slides: slides([1, 2]),
            noAr: [
                { id: "s", layout: "L", index: 1, foto: foto("b", [1, 2]) },
                { id: "s", layout: "L", index: 1, foto: foto("b", [1]) }
            ]
        })
        expect(s[1].editado).toBe(true)
    })
})

describe("situacao, nota e faixa", () => {
    const selos = { 1: { noAr: true as const, editado: false }, 2: { noAr: true as const, editado: true } }
    it("livre, no ar e defasado", () => {
        expect(situacaoDoSlide(selos, 0)).toBe("livre")
        expect(situacaoDoSlide(selos, 1)).toBe("no-ar")
        expect(situacaoDoSlide(selos, 2)).toBe("defasado")
        expect(situacaoDoSlide(selos, null)).toBe("livre")
    })
    it("a nota some quando a faixa aparece", () => {
        expect(notaDoCentro("defasado")).toBe("")
        expect(notaDoCentro("no-ar")).toContain("está no ar")
        expect(notaDoCentro("livre")).toContain("Salva sozinho")
    })
})

describe("o que muda no telao na hora (decisao 6)", () => {
    it("sobreposicao, efeito e fundo no ar avisam; o que nao esta no ar nao", () => {
        expect(avisoAoVivo({ tipo: "overlay", id: "o1", noAr: [{ overlays: ["o1"] }] })).toContain("na hora")
        expect(avisoAoVivo({ tipo: "overlay", id: "o2", noAr: [{ overlays: ["o1"] }] })).toBe("")
        expect(avisoAoVivo({ tipo: "effect", id: "e1", noAr: [{ effects: ["e1"] }] })).toContain("na hora")
        expect(avisoAoVivo({ tipo: "media", id: "/a.mp4", noAr: [{ background: { path: "/a.mp4" } }] })).toContain("na hora")
        expect(avisoAoVivo({ tipo: "media", id: "/b.mp4", noAr: [{ background: { path: "/a.mp4" } }] })).toBe("")
    })
    it("show nunca avisa 'na hora': a foto o congela", () => {
        expect(avisoAoVivo({ tipo: "show", id: "s", noAr: [{ overlays: ["s"] }] })).toBe("")
        expect(avisoAoVivo({ noAr: [] })).toBe("")
    })
})

describe("o item em edicao e os avulsos", () => {
    const item = (id: string): ItemEditavel => ({ chave: "show:" + id, tipo: "show", id, nome: id })
    it("o ultimo vai para a frente, repetido nao duplica, guarda 5", () => {
        let l: ItemEditavel[] = []
        for (const id of ["a", "b", "c", "d", "e", "f"]) l = empurrarAvulso(l, item(id))
        expect(l.map((i) => i.id)).toEqual(["f", "e", "d", "c", "b"])
        expect(l).toHaveLength(MAX_AVULSOS)
        expect(empurrarAvulso(l, item("c")).map((i) => i.id)).toEqual(["c", "f", "e", "d", "b"])
        expect(tirarAvulso(l, "show:e").map((i) => i.id)).toEqual(["f", "d", "c", "b"])
    })
    it("so show esta 'no roteiro'", () => {
        expect(
            estaNoRoteiro(
                [
                    { id: "a", type: "show" },
                    { id: "m", type: "video" }
                ],
                "show",
                "a"
            )
        ).toBe(true)
        expect(estaNoRoteiro([{ id: "a" }], "show", "a")).toBe(true)
        expect(estaNoRoteiro([{ id: "m", type: "video" }], "media", "m")).toBe(true)
        expect(estaNoRoteiro([{ id: "m", type: "image" }], "media", "m")).toBe(true)
        expect(estaNoRoteiro([{ id: "x.mp3", type: "audio" }], "audio", "x.mp3")).toBe(true)
        expect(estaNoRoteiro([{ id: "p", type: "pdf" }], "media", "p")).toBe(false)
        expect(estaNoRoteiro([], "show", "a")).toBe(false)
    })
    it("itemEmEdicao: show pelo show aberto (reserva: o showId do editor); os outros pelo id", () => {
        const nomeDe = (t: string, id: string) => `${t}/${id}`
        expect(itemEmEdicao({ edit: { showId: "s1" }, show: { id: "s2", type: "show" }, nomeDe })).toMatchObject({ chave: "show:s2", nome: "show/s2" })
        expect(itemEmEdicao({ edit: { showId: "s1" }, show: { id: "m", type: "video" }, nomeDe })).toMatchObject({ chave: "show:s1" })
        expect(itemEmEdicao({ edit: {}, show: { id: "s2" }, nomeDe })?.id).toBe("s2")
        expect(itemEmEdicao({ edit: { type: "overlay", id: "o" }, show: { id: "s2" }, nomeDe })).toMatchObject({ tipo: "overlay", id: "o" })
        expect(itemEmEdicao({ edit: {}, show: { id: "m", type: "video" }, nomeDe })).toBeNull()
        expect(itemEmEdicao({ edit: null, show: null, nomeDe })).toBeNull()
    })
    it("contagem", () => {
        expect(contagemDeSlides(1)).toBe("1 slide")
        expect(contagemDeSlides(6)).toBe("6 slides")
    })
})

describe("saidas do 'Mandar so para'", () => {
    it("so tela ligada; retorno (palco) e chave ficam fora", () => {
        const l = saidasParaMandar([
            { id: "1", name: "Telão", enabled: true },
            { id: "2", name: "", enabled: true },
            { id: "3", name: "Retorno", enabled: true, stageOutput: true },
            { id: "4", name: "Chave", enabled: true, isKeyOutput: true },
            { id: "5", name: "Desligada", enabled: false }
        ])
        expect(l).toEqual([
            { id: "1", nome: "Telão" },
            { id: "2", nome: "Saída 2" }
        ])
    })
    it("com uma tela so o item nao aparece", () => {
        expect(mostrarMandarSo([{ id: "1" }])).toBe(false)
        expect(mostrarMandarSo([{ id: "1" }, { id: "2" }])).toBe(true)
    })
})

describe("saidasQueMostram: quem a faixa 'Mandar pro ar' atualiza", () => {
    const L = (saida: string, index: number, v: any[]) => ({ saida, slide: { id: "s", layout: "L", index, foto: foto(["a", "b", "c"][index], v) } as any })
    it("so a saida que esta NESTE slide; a que esta em outro nao entra", () => {
        const r = saidasQueMostram({ showId: "s", layout: "L", ref, slides: slides([1, 2]), posicao: 1, saidas: [L("telao", 0, [0]), L("transmissao", 1, [1])] })
        expect(r).toEqual([{ saida: "transmissao", editado: true }])
    })
    it("duas saidas no mesmo slide: as duas, cada uma com o seu estado", () => {
        const r = saidasQueMostram({ showId: "s", layout: "L", ref, slides: slides([1, 2]), posicao: 1, saidas: [L("telao", 1, [1, 2]), L("transmissao", 1, [1])] })
        expect(r).toEqual([
            { saida: "telao", editado: false },
            { saida: "transmissao", editado: true }
        ])
    })
    it("outro show/layout ou saida limpa: nada", () => {
        expect(
            saidasQueMostram({
                showId: "s",
                layout: "L",
                ref,
                slides: slides(),
                posicao: 1,
                saidas: [
                    { saida: "x", slide: { id: "z", layout: "L", index: 1 } },
                    { saida: "y", slide: null }
                ]
            })
        ).toEqual([])
    })
})

describe("faixaDefasada: nomeia a tela defasada", () => {
    it("sem nomes (uma tela so): o texto de sempre", () => expect(faixaDefasada([])).toBe(FAIXA_DEFASADO))
    it("uma tela", () => expect(faixaDefasada(["Transmissão"])).toBe("Transmissão ainda mostra a versão anterior. Ela só troca quando você mandar pro ar de novo."))
    it("duas telas", () => expect(faixaDefasada(["Telão", "Transmissão"])).toContain("Telão e Transmissão ainda mostram"))
})

describe("opcoesDoSeletor: chaves unicas (achado 6)", () => {
    const nomeDe = (_t: string, id: string, salvo: string) => salvo || id
    const av = (tipo: any, id: string): ItemEditavel => ({ chave: `${tipo}:${id}`, tipo, id, nome: id })
    const unicas = (l: { chave: string }[]) => new Set(l.map((o) => o.chave)).size === l.length
    it("midia do roteiro entra em 'No roteiro' e nao se repete como avulso", () => {
        const l = opcoesDoSeletor({
            roteiro: [
                { id: "a", type: "show" },
                { id: "v.mp4", type: "video" }
            ],
            avulsos: [av("media", "v.mp4")],
            atualChave: "media:v.mp4",
            nomeDe
        })
        expect(l.map((o) => [o.secao, o.chaveItem, o.marcado])).toEqual([
            ["No roteiro", "show:a", false],
            ["No roteiro", "media:v.mp4", true]
        ])
        expect(unicas(l)).toBe(true)
    })
    it("o mesmo show duas vezes no roteiro: chaves distintas e so a posicao ativa leva o visto", () => {
        const l = opcoesDoSeletor({ roteiro: [{ id: "a" }, { id: "b" }, { id: "a" }], avulsos: [], atualChave: "show:a", indiceAtivo: 2, nomeDe })
        expect(unicas(l)).toBe(true)
        expect(l.map((o) => o.marcado)).toEqual([false, false, true])
    })
    it("sem posicao ativa: a primeira linha com o item leva o visto", () => {
        const l = opcoesDoSeletor({ roteiro: [{ id: "a" }, { id: "a" }], avulsos: [], atualChave: "show:a", nomeDe })
        expect(l.map((o) => o.marcado)).toEqual([true, false])
    })
    it("show aberto pela biblioteca e depois posto no roteiro: some dos avulsos", () => {
        const l = opcoesDoSeletor({ roteiro: [{ id: "a" }], avulsos: [av("show", "a"), av("show", "z")], atualChave: "show:z", nomeDe })
        expect(l.map((o) => o.chave)).toEqual(["roteiro:0", "avulso:show:z"])
        expect(l[1].marcado).toBe(true)
    })
    it("bloco e PDF do roteiro nao viram opcao", () => {
        expect(
            opcoesDoSeletor({
                roteiro: [
                    { id: "s", type: "section" },
                    { id: "p", type: "pdf" }
                ],
                avulsos: [],
                atualChave: null,
                nomeDe
            })
        ).toEqual([])
    })
})

describe("modelo e camera no ar avisam 'na hora' (achado 7)", () => {
    it("modelo que o telao usa avisa; outro modelo nao", () => {
        expect(avisoAoVivo({ tipo: "template", id: "t1", noAr: [{ templates: ["t1"] }] })).toContain("na hora")
        expect(avisoAoVivo({ tipo: "template", id: "t2", noAr: [{ templates: ["t1"] }, { templates: [] }] })).toBe("")
    })
    it("camera no fundo avisa pelo id; outra camera nao", () => {
        expect(avisoAoVivo({ tipo: "camera", id: "cam1", noAr: [{ background: { id: "cam1" } }] })).toContain("na hora")
        expect(avisoAoVivo({ tipo: "camera", id: "cam2", noAr: [{ background: { id: "cam1" } }] })).toBe("")
    })
})

describe("audio e tipos fora do seletor (menor 9)", () => {
    it("o activeEdit de cada item do roteiro: show, midia e audio sao escritos (audio nao cai no show anterior)", () => {
        expect(editDoItemDoRoteiro({ id: "s" })).toEqual({ type: "show", slide: 0, items: [], showId: "s" })
        expect(editDoItemDoRoteiro({ id: "v.mp4", type: "video" })).toEqual({ type: "media", id: "v.mp4", items: [] })
        expect(editDoItemDoRoteiro({ id: "a.mp3", type: "audio" })).toEqual({ type: "audio", id: "a.mp3", items: [] })
        expect(editDoItemDoRoteiro({ id: "p", type: "pdf" })).toBeNull()
    })
    it("audio aberto vira o item em edicao (nao a musica anterior)", () => {
        const e = itemEmEdicao({ edit: editDoItemDoRoteiro({ id: "a.mp3", type: "audio" }) as any, show: { id: "a.mp3", type: "audio" }, nomeDe: (_t, id) => id })
        expect(e).toEqual({ chave: "audio:a.mp3", tipo: "audio", id: "a.mp3", nome: "a.mp3" })
    })
    it("tipo de edicao fora da lista (pdf) nao vira item com rotulo undefined", () => {
        expect(tipoDeEdicaoDesconhecido("pdf")).toBe(true)
        expect(tipoDeEdicaoDesconhecido("audio")).toBe(false)
        expect(itemEmEdicao({ edit: { type: "pdf", id: "x.pdf" }, show: { id: "x.pdf", type: "pdf" }, nomeDe: () => "x" })).toBeNull()
    })
})

describe("saidasDoEnvio: os selos olham as mesmas saidas que o envio (menor 11)", () => {
    it("com uma saida ativa, a ligada-e-nao-ativa fica de fora (nunca recebe foto nova)", () => {
        expect(
            saidasDoEnvio([
                { id: "A", enabled: true, active: true },
                { id: "B", enabled: true, active: false }
            ])
        ).toEqual(["A"])
    })
    it("sem nenhuma ativa, valem todas as ligadas", () => {
        expect(
            saidasDoEnvio([
                { id: "A", enabled: true },
                { id: "B", enabled: true }
            ])
        ).toEqual(["A", "B"])
    })
    it("desligada, chave e palco nunca entram", () => {
        expect(
            saidasDoEnvio([
                { id: "A", enabled: false },
                { id: "K", enabled: true, isKeyOutput: true },
                { id: "S", enabled: true, stageOutput: true },
                { id: "B", enabled: true }
            ])
        ).toEqual(["B"])
    })
})
