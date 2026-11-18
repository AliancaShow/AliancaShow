import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"
import { ANTEPARO_MS, motivoVoltarLimpo, chipChat, chipDesenho, chipRoteiro, criarDecisorDeGesto, desenhoAtivo, deveEngolir, dicaDaPilula, naoChegou, pilulaClicavel, pilulaVisivel, primeiroPendente, textoDaPilula } from "./aliancaPilulaLogica"

const mat = (o: Partial<{ habilitado: boolean | null; naFila: number; falhas: { nome: string }[] }> = {}) => ({ habilitado: true as boolean | null, naFila: 0, falhas: [] as { nome: string }[], ...o })

describe("pilula visivel (tudo pronto some com chip pendente)", () => {
    const roteiro = { id: "roteiro" }
    const chat = { id: "chat" }
    const desenho = { id: "desenho" }
    it("tudo pronto sem chip: aparece", () => {
        expect(pilulaVisivel(true, [])).toBe(true)
        expect(pilulaVisivel(true, null)).toBe(true)
        expect(pilulaVisivel(true, undefined)).toBe(true)
    })
    it("tudo pronto com Roteiro mudou ou Chat: some", () => {
        expect(pilulaVisivel(true, [roteiro])).toBe(false)
        expect(pilulaVisivel(true, [chat])).toBe(false)
        expect(pilulaVisivel(true, [roteiro, chat])).toBe(false)
        expect(pilulaVisivel(true, [desenho, chat])).toBe(false)
    })
    it("so o chip de desenho nao esconde o tudo pronto", () => {
        expect(pilulaVisivel(true, [desenho])).toBe(true)
    })
    it("com pendencia (nao pronto) a pilula fica, com ou sem chip", () => {
        expect(pilulaVisivel(false, [])).toBe(true)
        expect(pilulaVisivel(false, [roteiro, chat])).toBe(true)
    })
})

describe("texto da pilula", () => {
    it("tudo zero: tudo pronto, sem clique", () => {
        expect(textoDaPilula({ conferir: 0, semLetra: 0, naoChegou: 0 })).toEqual({ texto: "tudo pronto ✓", pronto: true })
        expect(pilulaClicavel({ conferir: 0, semLetra: 0 })).toBe(false)
    })
    it("ordem e separador", () => {
        expect(textoDaPilula({ conferir: 2, semLetra: 1, naoChegou: 3 }).texto).toBe("2 pra conferir · 1 sem letra · 3 não chegou")
        expect(textoDaPilula({ conferir: 0, semLetra: 1, naoChegou: 3 }).texto).toBe("1 sem letra · 3 não chegou")
        expect(textoDaPilula({ conferir: 2, semLetra: 0, naoChegou: 0 }).texto).toBe("2 pra conferir")
    })
    it("habilitado null e false omitem 'nao chegou'", () => {
        expect(naoChegou(mat({ habilitado: null, naFila: 4 }))).toBe(0)
        expect(naoChegou(mat({ habilitado: false, naFila: 4 }))).toBe(0)
        expect(naoChegou(null)).toBe(0)
    })
    it("naoChegou = naFila + falhas (baixando nao conta)", () => {
        expect(naoChegou({ ...mat({ naFila: 1, falhas: [{ nome: "a" }] }), baixando: 9 } as any)).toBe(2)
    })
    it("so 'nao chegou': nao clicavel", () => {
        expect(pilulaClicavel({ conferir: 0, semLetra: 0 })).toBe(false)
        expect(pilulaClicavel({ conferir: 1, semLetra: 0 })).toBe(true)
        expect(pilulaClicavel({ conferir: 0, semLetra: 2 })).toBe(true)
    })
    it("dica lista ate 5 falhas e depois 'e mais N'", () => {
        const f = Array.from({ length: 7 }, (_, i) => ({ nome: "m" + i }))
        const d = dicaDaPilula({ conferir: 0, semLetra: 0 }, mat({ falhas: f }))
        expect(d).toContain("m0, m1, m2, m3, m4")
        expect(d).not.toContain("m5")
        expect(d).toContain("e mais 2")
        expect(dicaDaPilula({ conferir: 0, semLetra: 0 }, mat())).not.toContain("Não chegou")
    })
})

describe("primeiroPendente", () => {
    it("conferir vem antes de sem letra, e o indice e o certo", () => {
        expect(
            primeiroPendente(
                5,
                (i) => i === 3,
                (i) => i === 1
            )
        ).toBe(3)
    })
    it("sem conferir: o 1o sem letra", () => {
        expect(
            primeiroPendente(
                5,
                () => false,
                (i) => i === 2 || i === 4
            )
        ).toBe(2)
    })
    it("sem pendencia: null", () => {
        expect(
            primeiroPendente(
                5,
                () => false,
                () => false
            )
        ).toBeNull()
        expect(
            primeiroPendente(
                0,
                () => true,
                () => true
            )
        ).toBeNull()
    })
})

describe("chips", () => {
    it("roteiro: com linhas, so anteriores, nada", () => {
        expect(chipRoteiro({ linhas: [1, 2], anteriores: false })?.texto).toBe("Roteiro mudou · 2")
        expect(chipRoteiro({ linhas: [], anteriores: true })?.texto).toBe("Roteiro mudou")
        expect(chipRoteiro({ linhas: [], anteriores: false })).toBeNull()
    })
    const chat = { naoLidas: 2, cultoId: "c1", ligado: true, congelado: false }
    it("chat: cada um dos 4 termos falso esconde", () => {
        expect(chipChat(chat, "c1")?.texto).toBe("Chat · 2 novas")
        expect(chipChat({ ...chat, naoLidas: 1 }, "c1")?.texto).toBe("Chat · 1 nova")
        expect(chipChat({ ...chat, naoLidas: 0 }, "c1")).toBeNull()
        expect(chipChat(chat, null)).toBeNull()
        expect(chipChat(chat, "c2")).toBeNull()
        expect(chipChat({ ...chat, ligado: false }, "c1")).toBeNull()
        expect(chipChat({ ...chat, ligado: false, congelado: true }, "c1")?.texto).toBe("Chat · 2 novas")
    })
    it("desenhoAtivo: as tres condicoes", () => {
        expect(desenhoAtivo("fill", {}, [])).toBe(true)
        expect(desenhoAtivo("zoom", { zoom: { size: 150 } }, [])).toBe(true)
        expect(desenhoAtivo("zoom", { zoom: { size: 100 } }, [])).toBe(false)
        expect(desenhoAtivo("paint", {}, [1])).toBe(true)
        expect(desenhoAtivo("paint", {}, [])).toBe(false)
        expect(desenhoAtivo("focus", {}, [1])).toBe(false)
        expect(chipDesenho(true)?.texto).toBe("Desenho ativo")
        expect(chipDesenho(false)).toBeNull()
    })
    it("o texto de aliancaConferir.ts ainda tem const CHAVE = aliancaConferidos", () => {
        const src = readFileSync(join(__dirname, "aliancaConferir.ts"), "utf8")
        expect(src).toContain('const CHAVE = "aliancaConferidos"')
    })
})

describe("deveEngolir", () => {
    const base = { ate: 700, naBarra: true, naEsquerda: false }
    it("true a 0 e 699 ms, false a 700 e 701", () => {
        expect(deveEngolir({ ...base, agora: 0 })).toBe(true)
        expect(deveEngolir({ ...base, agora: 699 })).toBe(true)
        expect(deveEngolir({ ...base, agora: 700 })).toBe(false)
        expect(deveEngolir({ ...base, agora: 701 })).toBe(false)
    })
    it("false na esquerda e fora da barra", () => {
        expect(deveEngolir({ ...base, agora: 10, naEsquerda: true })).toBe(false)
        expect(deveEngolir({ ...base, agora: 10, naBarra: false })).toBe(false)
    })
    it("ANTEPARO_MS e 700", () => expect(ANTEPARO_MS).toBe(700))
})

describe("decisor de gesto", () => {
    const na = (agora: number, extra = {}) => ({ agora, ate: 700, naBarra: true, naEsquerda: false, ...extra })
    it("inicio aos 690 ms e fim aos 720 ms: tudo engolido", () => {
        const d = criarDecisorDeGesto()
        expect(d.aoEvento("pointerdown", na(690))).toBe(true)
        expect(d.aoEvento("mousedown", na(690))).toBe(true)
        expect(d.aoEvento("mouseup", na(720))).toBe(true)
        expect(d.aoEvento("click", na(720))).toBe(true)
        expect(d.aoEvento("dblclick", na(740))).toBe(true)
    })
    it("inicio fora da barra e fim sobre a barra dentro dos 700 ms: nada engolido", () => {
        const d = criarDecisorDeGesto()
        expect(d.aoEvento("pointerdown", na(100, { naBarra: false }))).toBe(false)
        expect(d.aoEvento("mousedown", na(100, { naBarra: false }))).toBe(false)
        expect(d.aoEvento("mouseup", na(200))).toBe(false)
        expect(d.aoEvento("click", na(200))).toBe(false)
    })
    it("inicio aos 701 ms: nada engolido", () => {
        const d = criarDecisorDeGesto()
        expect(d.aoEvento("pointerdown", na(701))).toBe(false)
        expect(d.aoEvento("click", na(701))).toBe(false)
    })
    it("mousedown sem pointerdown antes decide sozinho", () => {
        const d = criarDecisorDeGesto()
        expect(d.aoEvento("mousedown", na(300))).toBe(true)
        expect(d.aoEvento("click", na(900))).toBe(true)
        expect(d.aoEvento("mousedown", na(900))).toBe(false)
        expect(d.aoEvento("click", na(900))).toBe(false)
    })
    it("gesto engolido, depois keydown, depois click: o click passa", () => {
        const d = criarDecisorDeGesto()
        expect(d.aoEvento("pointerdown", na(100))).toBe(true)
        expect(d.aoEvento("keydown", na(110))).toBe(false)
        expect(d.aoEvento("click", na(120))).toBe(false)
    })
    it("contextmenu segue o gesto", () => {
        const d = criarDecisorDeGesto()
        d.aoEvento("pointerdown", na(100))
        expect(d.aoEvento("contextmenu", na(120))).toBe(true)
        const e = criarDecisorDeGesto()
        e.aoEvento("pointerdown", na(800))
        expect(e.aoEvento("contextmenu", na(810))).toBe(false)
    })
    it("pointerdown seguinte, ja fora da janela, passa (decide de novo)", () => {
        const d = criarDecisorDeGesto()
        expect(d.aoEvento("pointerdown", na(100))).toBe(true)
        d.aoEvento("mousedown", na(100))
        d.aoEvento("click", na(100))
        expect(d.aoEvento("pointerdown", na(800))).toBe(false)
    })
})

describe("menu do telao: voltar o que foi limpo", () => {
    it("explica por que esta indisponivel", () => {
        expect(motivoVoltarLimpo({ travada: true, haCache: true, pronto: true })).toContain("travada")
        expect(motivoVoltarLimpo({ travada: false, haCache: false, pronto: false })).toBe("Nada foi limpo ainda.")
        expect(motivoVoltarLimpo({ travada: false, haCache: true, pronto: false })).toBe("Espere um instante.")
        expect(motivoVoltarLimpo({ travada: false, haCache: true, pronto: true })).toBe("")
    })
})
