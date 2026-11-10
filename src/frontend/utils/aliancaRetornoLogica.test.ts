import { describe, expect, it } from "vitest"
import type { Output, Outputs } from "../../types/Output"
import type { StageLayouts } from "../../types/Stage"
import { ativacaoSilenciada, desligarSoRetorno, fundoComSom, idDaFonte, layoutsDePalcoEmUso, ligarSoRetorno, modoSoRetornoLigado, NOME_FONTE, planoDoLimparTudo, primeiraSaidaDePrograma, saidasDePrograma } from "./aliancaRetornoLogica"

const saida = (name: string, extra: Partial<Output> = {}): Output => ({ name, enabled: true, active: true, color: "#fff", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, screen: null, ...extra })
const layout = (output?: string): any => ({ name: "palco", settings: output ? { output } : {}, items: {} })

// projetor, LED, NDI (travada), Retorno (palco "banda"), Pregador (palco "pregador"), uma desabilitada
function cenario(): { outs: Outputs; palco: StageLayouts } {
    const outs: Outputs = {
        proj: saida("Projetor", { out: { slide: { id: "show1", layout: "l", index: 2 } as any }, style: "s16x9" }),
        led: saida("LED", { out: { slide: { id: "show1", layout: "l", index: 2 } as any } }),
        ndi: saida("NDI", { active: false }),
        off: saida("Antiga", { enabled: false }),
        ret: saida("Retorno", { stageOutput: "banda" }),
        preg: saida("Pregador", { stageOutput: "pregador" })
    }
    const palco: StageLayouts = { banda: layout("proj"), pregador: layout(), semSaida: layout("led") }
    return { outs, palco }
}

function ligado() {
    const { outs, palco } = cenario()
    const r = ligarSoRetorno(outs, palco, { novoId: "fonte", agora: 1000 })
    if (!r.ok) throw new Error(r.motivo)
    return { antes: { outs, palco }, ...r }
}

describe("saídas de programa", () => {
    it("só as habilitadas, sem palco e sem a Fonte, por nome", () => {
        const { outputs } = ligado()
        expect(saidasDePrograma(outputs).map((o) => o.id)).toEqual(["led", "ndi", "proj"])
    })

    it("a primeira respeita a trava (modo normal = getFirstActiveOutput)", () => {
        const { outs } = cenario()
        outs.led.active = false
        expect(primeiraSaidaDePrograma(outs)?.id).toBe("proj")
        expect(primeiraSaidaDePrograma(outs, { ignorarTrava: true })?.id).toBe("led")
    })

    it("com o modo ligado (tudo travado) vale a trava de antes do modo, nunca a Fonte", () => {
        const { outputs } = ligado()
        expect(saidasDePrograma(outputs).every((o) => o.active === false)).toBe(true)
        expect(primeiraSaidaDePrograma(outputs)?.id).toBe("led")
    })

    it("sem nenhuma saída de programa: null", () => {
        expect(primeiraSaidaDePrograma({ r: saida("Retorno", { stageOutput: "x" }) })).toBeNull()
        expect(saidasDePrograma(undefined)).toEqual([])
    })

    it("a Fonte desligada não aparece em lugar nenhum", () => {
        const { outputs, stageShows } = ligado()
        const desligado = desligarSoRetorno(outputs, stageShows)!
        expect(idDaFonte(desligado.outputs)).toBe("fonte")
        expect(modoSoRetornoLigado(desligado.outputs)).toBe(false)
        expect(saidasDePrograma(desligado.outputs).map((o) => o.id)).toEqual(["led", "ndi", "proj"])
    })
})

describe("ligar", () => {
    it("cria a Fonte com cópia do que o palco mostrava, escondida e sem janela", () => {
        const { outputs, fonteId } = ligado()
        const fonte = outputs[fonteId]
        expect(fonteId).toBe("fonte")
        expect(fonte).toMatchObject({ name: NOME_FONTE, enabled: true, active: true, retornoFonte: true, invisible: true, hideFromPreview: true, style: "s16x9" })
        expect(fonte.out?.slide).toEqual({ id: "show1", layout: "l", index: 2 })
        expect(fonte.ndi).toBeUndefined()
    })

    it("a cópia é cópia: mexer na Fonte não mexe no projetor", () => {
        const { outputs } = ligado()
        ;(outputs.fonte.out!.slide as any).index = 9
        expect((outputs.proj.out!.slide as any).index).toBe(2)
    })

    it("trava o público e guarda as travas de antes", () => {
        const { outputs } = ligado()
        expect([outputs.proj.active, outputs.led.active, outputs.ndi.active]).toEqual([false, false, false])
        expect(outputs.fonte.retornoModo?.travas).toEqual({ proj: true, led: true, ndi: false })
        // palco e desabilitada não são tocadas
        expect(outputs.ret.active).toBe(true)
        expect(outputs.off.active).toBe(true)
    })

    it("aponta todos os layouts em saída de palco para a Fonte (decisão 3) e guarda a fonte de cada um", () => {
        const { stageShows, outputs } = ligado()
        expect(stageShows.banda.settings.output).toBe("fonte")
        expect(stageShows.pregador.settings.output).toBe("fonte")
        expect(stageShows.semSaida.settings.output).toBe("led") // não está em nenhuma saída de palco
        expect(outputs.fonte.retornoModo?.fontes).toEqual({ banda: "proj", pregador: null })
    })

    it("não muda nada no que recebeu", () => {
        const { antes } = ligado()
        expect(antes.outs.proj.active).toBe(true)
        expect(antes.outs.fonte).toBeUndefined()
        expect(antes.palco.banda.settings.output).toBe("proj")
    })

    it("reaproveita a Fonte que já existe", () => {
        const { outputs, stageShows } = ligado()
        const off = desligarSoRetorno(outputs, stageShows)!
        const r = ligarSoRetorno(off.outputs, off.stageShows, { novoId: "outra", agora: 2 })
        expect(r.ok && r.fonteId).toBe("fonte")
        expect(r.ok && Object.keys(r.outputs).filter((id) => r.outputs[id].retornoFonte)).toEqual(["fonte"])
    })

    it("sem saída de palco ligada: recusa", () => {
        const { outs, palco } = cenario()
        outs.ret.enabled = false
        outs.preg.enabled = false
        const r = ligarSoRetorno(outs, palco, { novoId: "f", agora: 0 })
        expect(r.ok).toBe(false)
    })

    it("já ligado: recusa", () => {
        const { outputs, stageShows } = ligado()
        expect(ligarSoRetorno(outputs, stageShows, { novoId: "x", agora: 0 }).ok).toBe(false)
    })

    it("sem fonte escolhida no palco: copia da 1ª saída de programa", () => {
        const { outs, palco } = cenario()
        outs.led.out = { slide: { id: "outro", layout: "l", index: 0 } as any }
        delete palco.banda.settings.output
        const r = ligarSoRetorno(outs, palco, { novoId: "f", agora: 0 })
        expect(r.ok && (r.outputs.f.out?.slide as any).id).toBe("outro")
    })
})

describe("desligar", () => {
    it("volta exatamente ao estado de antes (inclusive a NDI que já estava travada)", () => {
        const { antes, outputs, stageShows } = ligado()
        const r = desligarSoRetorno(outputs, stageShows)!
        for (const id of ["proj", "led", "ndi", "off", "ret", "preg"]) expect(r.outputs[id]).toEqual(antes.outs[id])
        expect(r.stageShows).toEqual(antes.palco)
    })

    it("a Fonte fica desabilitada, vazia e sem registro", () => {
        const { outputs, stageShows } = ligado()
        const { outputs: o } = desligarSoRetorno(outputs, stageShows)!
        expect(o.fonte).toMatchObject({ enabled: false, active: false, out: {} })
        expect(o.fonte.retornoModo).toBeUndefined()
    })

    it("o layout sem fonte escolhida volta a não ter fonte (lê o projetor de novo)", () => {
        const { outputs, stageShows } = ligado()
        const r = desligarSoRetorno(outputs, stageShows)!
        expect("output" in r.stageShows.pregador.settings).toBe(false)
    })

    it("fonte de antes que sumiu: o layout fica sem fonte", () => {
        const { outputs, stageShows } = ligado()
        delete outputs.proj
        const r = desligarSoRetorno(outputs, stageShows)!
        expect(r.stageShows.banda.settings.output).toBeUndefined()
    })

    it("nunca deixa o público todo travado", () => {
        const { outs, palco } = cenario()
        outs.proj.active = false
        outs.led.active = false
        const r = ligarSoRetorno(outs, palco, { novoId: "f", agora: 0 })
        if (!r.ok) throw new Error()
        const off = desligarSoRetorno(r.outputs, r.stageShows)!
        expect(
            saidasDePrograma(off.outputs)
                .filter((o) => o.active)
                .map((o) => o.id)
        ).toEqual(["led"])
    })

    it("sem Fonte, ou já desligado: nada a fazer", () => {
        const { outs, palco } = cenario()
        expect(desligarSoRetorno(outs, palco)).toBeNull()
        const { outputs, stageShows } = ligado()
        const off = desligarSoRetorno(outputs, stageShows)!
        expect(desligarSoRetorno(off.outputs, off.stageShows)).toBeNull()
    })

    it("o app fechou no meio (registro presente com a Fonte desabilitada): desfaz assim mesmo", () => {
        const { outputs, stageShows } = ligado()
        outputs.fonte.enabled = false
        const r = desligarSoRetorno(outputs, stageShows)!
        expect(r.outputs.proj.active).toBe(true)
        expect(r.stageShows.banda.settings.output).toBe("proj")
    })
})

describe("layouts de palco em uso", () => {
    it("só os que estão numa saída de palco habilitada e existem", () => {
        const { outs, palco } = cenario()
        outs.x = saida("Outro", { stageOutput: "apagado" })
        expect(layoutsDePalcoEmUso(outs, palco).sort()).toEqual(["banda", "pregador"])
    })
})

describe("Esc e Limpar tudo", () => {
    it("modo desligado: normal", () => {
        const { outs } = cenario()
        expect(planoDoLimparTudo(outs, false)).toBe("normal")
        expect(planoDoLimparTudo(outs, true)).toBe("normal")
    })
    it("modo ligado: Esc desliga o modo e limpa tudo; o botão da barra limpa só o Retorno", () => {
        const { outputs } = ligado()
        expect(planoDoLimparTudo(outputs, false)).toBe("desligar_e_limpar")
        expect(planoDoLimparTudo(outputs, true)).toBe("so_retorno")
    })
})

describe("o clique no modo não dispara nada", () => {
    it("ativações do clique silenciadas só com o modo ligado", () => {
        const { outputs } = ligado()
        const { outs } = cenario()
        for (const a of ["output_changed", "slide_click", "group_start", "slide_cleared"]) {
            expect(ativacaoSilenciada(a, outputs)).toBe(true)
            expect(ativacaoSilenciada(a, outs)).toBe(false)
        }
        expect(ativacaoSilenciada("startup", outputs)).toBe(false)
        expect(ativacaoSilenciada("timer_end", outputs)).toBe(false)
    })
    it("fundo com som: vídeo e player online", () => {
        expect(fundoComSom("video")).toBe(true)
        expect(fundoComSom("player")).toBe(true)
        expect(fundoComSom("image")).toBe(false)
        expect(fundoComSom(undefined)).toBe(false)
    })
})
