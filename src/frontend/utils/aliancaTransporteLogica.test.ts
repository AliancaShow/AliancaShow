import { describe, expect, it, vi } from "vitest"
import { arrastoVale, criarLimitador, prenderVolume, VOLUME_MAXIMO, outrasSaidasComVideo, saidasHabilitadas, saidasDasAbas, extrasDaFaixa, fracao, limiteBusca, prenderBusca, restante, tempoCurto, timersNaFaixa, valorNaBarra, videosDaPilha, etiquetaDeSaidaNecessaria, nomeDaEtiqueta, CARTAO_ALTURA, CARTOES_SEM_ROLAR, pilhaAlturaMaxima } from "./aliancaTransporteLogica"

describe("tempoCurto", () => {
    it.each([
        [0, "0:00"],
        [5.9, "0:05"],
        [65, "1:05"],
        [3600, "1:00:00"],
        [3725, "1:02:05"],
        [-3, "0:00"],
        [NaN, "0:00"],
        [Infinity, "0:00"]
    ])("%s -> %s", (s, esperado) => expect(tempoCurto(s as number)).toBe(esperado))
})

describe("restante e fracao", () => {
    it("sem duracao nao inventa", () => {
        expect(restante(0, 10)).toBe(0)
        expect(fracao(10, 0)).toBe(0)
    })
    it("nunca negativo nem acima de 1", () => {
        expect(restante(60, 90)).toBe(0)
        expect(fracao(90, 60)).toBe(1)
        expect(fracao(-5, 60)).toBe(0)
    })
    it("conta normal", () => {
        expect(restante(60, 20.7)).toBe(40)
        expect(fracao(30, 60)).toBe(0.5)
    })
})

describe("valorNaBarra", () => {
    it("meio, pontas e fora", () => {
        expect(valorNaBarra(150, 100, 100, 60)).toBe(30)
        expect(valorNaBarra(50, 100, 100, 60)).toBe(0)
        expect(valorNaBarra(500, 100, 100, 60)).toBe(60)
    })
    it("largura ou max zero = 0", () => {
        expect(valorNaBarra(150, 100, 0, 60)).toBe(0)
        expect(valorNaBarra(150, 100, 100, 0)).toBe(0)
    })
})

describe("timersNaFaixa", () => {
    const timers = { a: { type: "counter", name: "Pregacao" }, b: { type: "clock", name: "Hora" }, c: { type: "sirvo_live", name: "Bloco" }, d: { type: "counter", name: "Abertura" }, e: { type: "counter", name: "Parado" } }
    it("so os ativos, so counter/pco_live, sem o contador do bloco do Sirvo, por nome", () => {
        const r = timersNaFaixa(timers, [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }])
        expect(r.map((x) => x.id)).toEqual(["d", "a"])
    })
    it("nada ativo = nada", () => expect(timersNaFaixa(timers, [])).toEqual([]))
})

describe("extrasDaFaixa (revisao da fatia 7, achado 3: a faixa tem uma linha so)", () => {
    it.each([
        [0, 0],
        [1, 0],
        [2, 1],
        [5, 4]
    ])("%s coisas -> +%s", (total, extras) => expect(extrasDaFaixa(total)).toBe(extras))
})

describe("varias saidas: a faixa segue a mesma saida da tela (revisao da fatia 7, achado 4)", () => {
    const o = { b: { enabled: true }, a: { enabled: true }, c: { enabled: false }, d: { enabled: true, invisible: true } }
    it("habilitadas e visiveis, na ordem do objeto (nao a de nome: a primeira e a principal)", () => {
        expect(saidasHabilitadas(o)).toEqual(["b", "a"])
        expect(saidasHabilitadas(null)).toEqual([])
    })
    it("conta so as outras saidas com video DIFERENTE do que a faixa controla", () => {
        expect(outrasSaidasComVideo([{ caminho: "/v/b.mp4", video: true }], "/v/a.mp4")).toBe(1)
        expect(outrasSaidasComVideo([{ caminho: "/v/a.mp4", video: true }], "/v/a.mp4")).toBe(0)
        expect(
            outrasSaidasComVideo(
                [
                    { caminho: "/i/foto.jpg", video: false },
                    { caminho: "", video: true }
                ],
                ""
            )
        ).toBe(0)
        expect(
            outrasSaidasComVideo(
                [
                    { caminho: "/v/b.mp4", video: true },
                    { caminho: "/v/c.mp4", video: true }
                ],
                ""
            )
        ).toBe(2)
    })
})

describe("volume (revisao da fatia 7, achado 5)", () => {
    it("o teto e 125 %: o que o ajuste da midia aceita nao e reduzido calado", () => {
        expect(VOLUME_MAXIMO).toBe(1.25)
        expect(prenderVolume(1.25)).toBe(1.25)
        expect(prenderVolume(9)).toBe(1.25)
        expect(prenderVolume(-1)).toBe(0)
        expect(prenderVolume(0, 0.01)).toBe(0.01)
        expect(prenderVolume(NaN)).toBe(0)
    })
    it("limitador: no maximo uma escrita por intervalo, o valor final nunca se perde", () => {
        vi.useFakeTimers()
        const escritas: number[] = []
        const l = criarLimitador<number>((v) => escritas.push(v), 100)
        for (let i = 1; i <= 30; i++) {
            l.empurrar(i / 100)
            vi.advanceTimersByTime(10) // 30 movimentos em 300 ms
        }
        expect(escritas.length).toBeLessThanOrEqual(4) // ~10 por segundo
        expect(escritas[0]).toBe(0.01) // o primeiro passa na hora
        l.fechar(0.4)
        expect(escritas[escritas.length - 1]).toBe(0.4) // soltar grava o final na hora
        vi.advanceTimersByTime(500)
        expect(escritas[escritas.length - 1]).toBe(0.4) // e nada espera atras
        vi.useRealTimers()
    })
    it("limitador: sem nada pendente, nao escreve de novo", () => {
        vi.useFakeTimers()
        const escritas: number[] = []
        const l = criarLimitador<number>((v) => escritas.push(v), 100)
        l.empurrar(1)
        vi.advanceTimersByTime(1000)
        expect(escritas).toEqual([1])
        vi.useRealTimers()
    })
})

// Guarda de TEXTO (o DOM so existe no app): a faixa e a linha ficam fora da trava de clique repetido e fora da tela No ar (nao e camada).
import { readFileSync } from "fs"
import { join } from "path"
const ler = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n")
describe("faixa de transporte (guarda de texto)", () => {
    it("a faixa e a linha levam data-sem-trava", () => {
        expect(ler("components/main/AliancaTransporte.svelte")).toMatch(/class="faixa"[^>]*data-sem-trava/)
        expect(ler("components/main/AliancaTransporteLinha.svelte")).toMatch(/class="tk"[^>]*data-sem-trava/)
    })
    it("mora no No ar, entre a tela e as outras telas, e a caixa da faixa nao e posicionada sobre ela", () => {
        expect(ler("components/main/AliancaNoAr.svelte")).toMatch(/<AliancaCamadas \/>\s*<\/div>\s*<AliancaTransporte \/>\s*<AliancaOutrasTelas/)
        const css = ler("components/main/AliancaTransporte.svelte")
        const caixa = css.slice(css.indexOf("    .faixa {"), css.indexOf("    .vazio {"))
        expect(caixa).not.toMatch(/position:\s*(absolute|fixed)/)
    })
    it("a faixa e a tela No ar escolhem a saida pela MESMA funcao (achado 4)", () => {
        // a tela No ar usa `saidasDasAbas` (A1, cabine 18/nov), cuja principal e a PRIMEIRA de `saidasHabilitadas`: a mesma que a faixa controla
        expect(ler("components/main/AliancaNoAr.svelte")).toContain("saidasDasAbas($outputs)")
        expect(ler("utils/aliancaTransporteLogica.ts")).toContain("const principal = saidasHabilitadas(outputs)[0]")
        expect(ler("components/main/AliancaTransporte.svelte")).toContain("saidasHabilitadas($outputs)")
        expect(ler("components/main/AliancaTransporte.svelte")).not.toContain("getFirstOutputIdWithBackground")
    })
    it("altura fixa reservada: 36 px sempre, sem animacao de altura nem margem que muda (achado 3)", () => {
        const css = ler("components/main/AliancaTransporte.svelte")
        const caixa = css.slice(css.indexOf("    .faixa {"), css.indexOf("    /* so a primeira linha"))
        expect(caixa).toMatch(/height:\s*36px/)
        expect(css).not.toMatch(/grid-template-rows|transition:[^;]*(height|margin)/)
    })
    it("nenhuma tecla nova: a faixa nao escuta o teclado (so o ponteiro, para fechar o painel)", () => {
        for (const a of ["AliancaTransporte", "AliancaTransporteLinha", "AliancaBarra"]) expect(ler(`components/main/${a}.svelte`)).not.toMatch(/on:key(down|up|press)|svelte:body/)
    })
})

describe("busca nunca chega ao fim (revisao da fatia 7, achado 1)", () => {
    it("o limite e o fim menos 0,25 s", () => {
        expect(limiteBusca(10)).toBe(9.75)
        expect(limiteBusca(10, 0)).toBe(9.75)
    })
    it("com `toTime` proprio, vale o fim do trecho", () => {
        expect(limiteBusca(10, 6)).toBe(5.75)
        expect(limiteBusca(10, 40)).toBe(9.75) // toTime alem da duracao: vale a duracao
    })
    it("sem duracao nao ha para onde buscar", () => {
        expect(limiteBusca(0)).toBe(0)
        expect(limiteBusca(NaN)).toBe(0)
    })
    it("arrastar alem da ponta direita prende antes do fim; o meio passa como veio", () => {
        expect(prenderBusca(10, 10)).toBe(9.75)
        expect(prenderBusca(99, 10, 6)).toBe(5.75)
        expect(prenderBusca(4, 10)).toBe(4)
        expect(prenderBusca(-3, 10)).toBe(0)
    })
    it("clipe curtissimo nao fica negativo", () => {
        expect(prenderBusca(0.2, 0.1)).toBe(0)
    })
})

describe("arrasto preso ao arquivo em que comecou (revisao da fatia 7, achado 2)", () => {
    const a = { caminho: "/v/a.mp4", saida: "default" }
    it("vale enquanto o mesmo arquivo segue na mesma saida", () => {
        expect(arrastoVale(a, "/v/a.mp4", "default")).toBe(true)
    })
    it("morre se outro video entra, se a saida muda ou se o fundo some", () => {
        expect(arrastoVale(a, "/v/b.mp4", "default")).toBe(false)
        expect(arrastoVale(a, "/v/a.mp4", "outra")).toBe(false)
        expect(arrastoVale(a, "", "default")).toBe(false)
    })
    it("sem arrasto nao vale nada", () => {
        expect(arrastoVale(null, "/v/a.mp4", "default")).toBe(false)
    })
})

describe("cabine 18/nov, A1: toda saida habilitada vira aba (a de rede, NDI, tambem)", () => {
    it("a saida NDI (invisible) entra nas abas, depois da principal; a principal e a primeira COM janela", () => {
        const o = { telao: { enabled: true }, ndi: { enabled: true, invisible: true }, retorno: { enabled: true }, off: { enabled: false } }
        expect(saidasDasAbas(o)).toEqual({ principal: "telao", outras: ["ndi", "retorno"] })
        // a faixa de transporte continua sem a de rede
        expect(saidasHabilitadas(o)).toEqual(["telao", "retorno"])
    })
    it("a NDI listada primeiro no objeto nao rouba o lugar da principal", () => {
        expect(saidasDasAbas({ ndi: { enabled: true, invisible: true }, telao: { enabled: true } })).toEqual({ principal: "telao", outras: ["ndi"] })
    })
    it("so saidas de rede: a primeira e a principal e as outras viram abas; nada habilitado ou nulo = vazio", () => {
        expect(saidasDasAbas({ a: { enabled: true, invisible: true }, b: { enabled: true, invisible: true } })).toEqual({ principal: "a", outras: ["b"] })
        expect(saidasDasAbas({ a: { enabled: false } })).toEqual({ principal: "", outras: [] })
        expect(saidasDasAbas(null)).toEqual({ principal: "", outras: [] })
    })
})

describe("C2: pilha de cartoes de 60 px", () => {
    const f = (id: string, caminho: string, video = true) => ({ id, caminho, video })
    it("um cartao de video por arquivo; o mesmo arquivo em duas saidas e um cartao so", () => {
        expect(videosDaPilha([f("a", "x.mp4"), f("b", "y.mp4"), f("c", "x.mp4"), f("d", "", false)])).toEqual([
            { id: "a", caminho: "x.mp4" },
            { id: "b", caminho: "y.mp4" }
        ])
    })
    it("etiqueta de saida so quando ha duvida (nunca com uma saida, nunca quando todas mostram o mesmo)", () => {
        expect(etiquetaDeSaidaNecessaria([f("a", "x.mp4")])).toBe(false)
        expect(etiquetaDeSaidaNecessaria([f("a", "x.mp4"), f("b", "x.mp4")])).toBe(false)
        expect(etiquetaDeSaidaNecessaria([f("a", "x.mp4"), f("b", "y.mp4")])).toBe(true)
        expect(etiquetaDeSaidaNecessaria([f("a", "x.mp4"), f("b", "", false)])).toBe(true)
        expect(etiquetaDeSaidaNecessaria([f("a", "", false), f("b", "", false)])).toBe(false)
    })
    it("\"Primaria\" nunca aparece", () => {
        for (const n of ["Primária", "Primaria", "primary", "Primary", "", null, undefined]) expect(nomeDaEtiqueta(n as any)).toBe("TELÃO")
        expect(nomeDaEtiqueta("NDI Live")).toBe("NDI LIVE")
    })
    it("60 px por cartao; a pilha rola a partir do 4o (188 px = 3 cartoes)", () => {
        expect(CARTAO_ALTURA).toBe(60)
        expect(pilhaAlturaMaxima()).toBe(188)
        expect(CARTOES_SEM_ROLAR).toBe(3)
    })
})
