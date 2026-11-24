// "aprovo tela-visual" (23/nov): estilo = Tela fisica da saida + Visual ativo. Testes da parte pura (aliancaVisualLogica.ts).
import { describe, expect, it } from "vitest"
import { desejadoDaSaida, estavel, migrarTela, novoVisual, Pendencias, planoDeEscrita, saidasParaSeparar, type Visual } from "./aliancaVisualLogica"

const estilosReais = () => ({
    sTel: {
        name: "Telão",
        template: "letra",
        templateScripture: "vers",
        layers: ["background", "slide", "overlays"],
        aspectRatio: { width: 16, height: 9 },
        transition: { text: { type: "fade", duration: 500 } }
    },
    sLed: {
        name: "LED",
        template: "letraLed",
        aspectRatio: {
            width: 16,
            height: 9,
            outputResolutionAsRatio: true,
            alignPosition: "center"
        },
        fit: "cover",
        lines: 2,
        background: "#000000",
        templateScripture_2: "vers2Led"
    },
    sObs: {
        name: "OBS",
        layers: ["slide"],
        background: "transparent",
        fit: null
    }
})
const saidas = () => ({
    tel: { name: "Telão", style: "sTel", enabled: true },
    led: { name: "Painel LED", style: "sLed", enabled: true },
    obs: { name: "OBS", style: "sObs", enabled: true, ndi: true },
    ret: { name: "Retorno", stageOutput: "palco", enabled: true }
})
const vAtivo = (): Visual => ({
    id: "v1",
    nome: "Culto",
    saidas: {
        tel: { musica: "letra", biblia: "vers" },
        led: { musica: "letraLed", biblia: "slide" },
        obs: { musica: "slide", biblia: "slide" }
    },
    retorno: { ret: "palco" }
})

function migrado() {
    const o: any = saidas()
    const est: any = estilosReais()
    const m = migrarTela(
        {
            aliancaVisuais: [vAtivo(), { ...vAtivo(), id: "v2", nome: "Outro" }],
            aliancaVisualAtivo: "v1"
        },
        o,
        est
    )!
    for (const id of Object.keys(m.telas)) o[id].aliancaTelaFisica = m.telas[id]
    return { o, est, visuais: m.visuais, m }
}

describe("migrarTela", () => {
    it("Tela recebe só os campos físicos; cada Visual recebe a aparência e a Bíblia 2–4 de hoje", () => {
        const { m } = migrado()
        expect(m.telas.led).toEqual({
            aspectRatio: {
                width: 16,
                height: 9,
                outputResolutionAsRatio: true,
                alignPosition: "center"
            },
            fit: "cover",
            lines: 2
        })
        expect(m.telas.obs).toEqual({ fit: null })
        expect(m.telas.ret).toBeUndefined()
        for (const v of m.visuais) {
            expect(v.saidas.obs.aparencia).toEqual({
                layers: ["slide"],
                background: "transparent"
            })
            expect(v.saidas.led.biblia2).toBe("vers2Led")
            expect(v.saidas.led.biblia3).toBe("slide")
        }
    })
    it("estilo composto é IDÊNTICO ao de hoje: nenhum Visual migrado pede escrita", () => {
        const { o, est, visuais } = migrado()
        for (const v of visuais) expect(planoDeEscrita(v, o, est).escritas).toEqual([])
        expect(planoDeEscrita(null, o, est).escritas).toEqual([])
    })
    it("não refaz com o marcador", () => {
        expect(migrarTela({ aliancaTelaVersao: 1 }, saidas(), estilosReais())).toBeNull()
    })
    it("estilo antigo (resolution, cropping) fica intocado: não é campo de ninguém", () => {
        const est: any = {
            ...estilosReais(),
            sTel: { name: "T", resolution: { width: 4, height: 3 } }
        }
        const m = migrarTela({ aliancaVisuais: [vAtivo()] }, saidas(), est)!
        expect(m.telas.tel).toEqual({})
    })
})

describe("composição", () => {
    it("mudar a Tela (proporção = preenche a saída) escreve na hora no estilo da saída", () => {
        const { o, est, visuais } = migrado()
        o.tel.aliancaTelaFisica = {
            ...o.tel.aliancaTelaFisica,
            aspectRatio: { width: 16, height: 9, outputResolutionAsRatio: true }
        }
        const p = planoDeEscrita(visuais[0], o, est)
        expect(p.escritas).toEqual([
            {
                tipo: "estilo",
                estilo: "sTel",
                campo: "aspectRatio",
                valor: { width: 16, height: 9, outputResolutionAsRatio: true },
                saidas: ["tel"],
                espera: false
            }
        ])
    })
    it("Visual liga o fundo no OBS: camadas sem espera (vale na hora, como o Look)", () => {
        const { o, est, visuais } = migrado()
        const v = JSON.parse(JSON.stringify(visuais[0]))
        v.saidas.obs.aparencia.layers = ["background", "slide"]
        const p = planoDeEscrita(v, o, est)
        expect(p.escritas).toEqual([
            {
                tipo: "estilo",
                estilo: "sObs",
                campo: "layers",
                valor: ["background", "slide"],
                saidas: ["obs"],
                espera: false
            }
        ])
        const pend = new Pendencias()
        const comSlide = {
            ...o,
            obs: { ...o.obs, out: { slide: { id: "show", index: 1 } } }
        }
        expect(pend.registrar(p.escritas, comSlide)).toHaveLength(1)
    })
    it("modelo com slide no ar espera o próximo slide", () => {
        const { o, est, visuais } = migrado()
        const v = JSON.parse(JSON.stringify(visuais[0]))
        v.saidas.obs.musica = "lowerThird"
        const p = planoDeEscrita(v, o, est)
        const pend = new Pendencias()
        const comSlide = {
            ...o,
            obs: { ...o.obs, out: { slide: { id: "show", index: 1 } } }
        }
        expect(pend.registrar(p.escritas, comSlide)).toEqual([])
        expect(pend.tamanho).toBe(1)
    })
    it("alguém mudou o estilo por fora (portabilidade, menu): o plano devolve ao que Tela + Visual dizem", () => {
        const { o, est, visuais } = migrado()
        est.sLed = {
            ...est.sLed,
            aspectRatio: { width: 16, height: 9 },
            layers: ["slide"]
        }
        const campos = planoDeEscrita(visuais[0], o, est).escritas.map((e: any) => e.campo)
        expect(campos).toContain("aspectRatio")
        // `layers` nao estava no estilo do LED na migracao: ninguem pede, entao fica (chave ausente = nao mexe)
        expect(campos).not.toContain("layers")
    })
    it("Bíblia 2 versões 'Sem modelo' apaga o campo; ausente não mexe", () => {
        const { o, est, visuais } = migrado()
        const v = JSON.parse(JSON.stringify(visuais[0]))
        v.saidas.led.biblia2 = "slide"
        expect(planoDeEscrita(v, o, est).escritas).toEqual([
            {
                tipo: "estilo",
                estilo: "sLed",
                campo: "templateScripture_2",
                valor: undefined,
                saidas: ["led"],
                espera: true
            }
        ])
        delete v.saidas.led.biblia2
        expect(planoDeEscrita(v, o, est).escritas).toEqual([])
    })
    it("desejadoDaSaida: sem Visual só a Tela; undefined ≠ null", () => {
        expect(desejadoDaSaida(null, "obs", { aliancaTelaFisica: { fit: null } })).toEqual({ fit: null })
        expect(estavel(undefined)).not.toBe(estavel(null))
    })
})

describe("separar (estrito, depois da migração)", () => {
    it("toda saída normal ganha estilo só dela: dividida ou sem estilo", () => {
        const o: any = {
            ...saidas(),
            obs: { name: "OBS", style: "sTel" },
            nova: { name: "Nova" }
        }
        expect(saidasParaSeparar(vAtivo(), o, estilosReais(), true).sort()).toEqual(["nova", "obs"])
        expect(saidasParaSeparar(vAtivo(), o, estilosReais(), false)).toEqual(["obs"])
    })
})

describe("novoVisual", () => {
    it("herda camadas e fundo do ativo, modelos em 'Sem modelo'", () => {
        const { o, visuais } = migrado()
        const n = novoVisual(visuais, o, "n", visuais[0])
        expect(n.saidas.obs.aparencia).toEqual({
            layers: ["slide"],
            background: "transparent"
        })
        expect(n.saidas.led).toMatchObject({
            musica: "slide",
            biblia: "slide",
            biblia2: "slide"
        })
    })
})
