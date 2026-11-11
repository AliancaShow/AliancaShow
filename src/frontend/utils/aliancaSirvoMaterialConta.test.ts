import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { APAGANDO_EM, conciliarMaterial, GRACA_APAGAR_MS, itemDoMaterial, MARCA, marcaDoMaterial, PREFIXO_APAGADO, type Baixado, type MaterialDoRoteiro, type OpcoesMaterial } from "./aliancaSirvoMaterialConta"
import { ID_RODAPE, NOME_RODAPE } from "./aliancaSirvoProjeto"

const cab = (id: string): ProjectShowRef => ({ id: `sirvo_${id}`, type: "section", name: id })
const rodape = (): ProjectShowRef => ({ id: ID_RODAPE, type: "section", name: NOME_RODAPE })
const doOperador = (id: string): ProjectShowRef => ({ id, type: "show" })
const baixado = (id: string, extra: Partial<Baixado> = {}): Baixado => ({ id, caminho: `C:\\Online\\Sirvo\\${id}.mp4`, nome: `Video ${id}`, tipo: "video", codec: null, ...extra })
const projeto = () => [cab("b1"), doOperador("musica"), rodape()]

const opcoes = (baixados: Baixado[], roteiro: MaterialDoRoteiro[] | null, extra: Partial<OpcoesMaterial> = {}): OpcoesMaterial => ({
    baixados: new Map(baixados.map((b) => [b.id, b])),
    noRoteiro: roteiro && new Map(roteiro.map((r) => [r.id, r])),
    jaPostos: new Set(),
    agora: 1_000_000,
    ...extra
})

describe("material entra em 'Fora do roteiro'", () => {
    it("vai para o FIM, depois do rodapé, com a marca e o tipo certo, sem mexer em nada que já existe", () => {
        const itens = projeto()
        const r = conciliarMaterial(
            itens,
            opcoes(
                [baixado("m1"), baixado("m2", { tipo: "imagem", caminho: "C:\\x\\a.png" })],
                [
                    { id: "m1", status: "pronto" },
                    { id: "m2", status: "pronto" }
                ]
            )
        )
        expect(r.itens.slice(0, 3).every((x, i) => x === itens[i])).toBe(true)
        expect(r.itens).toHaveLength(5)
        expect(r.itens[3]).toMatchObject({ id: "C:\\Online\\Sirvo\\m1.mp4", type: "video", name: "Video m1", data: { [MARCA]: "m1" } })
        expect(r.itens[4]).toMatchObject({ type: "image", data: { [MARCA]: "m2" } })
        expect(r.postos).toEqual(["m1", "m2"])
    })
    it("sem o rodapé ainda, não entra (o projeto não foi montado)", () => {
        const r = conciliarMaterial([cab("b1")], opcoes([baixado("m1")], [{ id: "m1" }]))
        expect(r.postos).toEqual([])
    })
    it("só o que o roteiro lista; sem a lista (Sirvo antigo) não põe nem tira nada", () => {
        const itens = projeto()
        expect(conciliarMaterial(itens, opcoes([baixado("m1")], [])).postos).toEqual([])
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], null))
        expect(r.itens).toBe(itens)
    })
    it("idempotente: rodar sobre o resultado não muda nada", () => {
        const o = opcoes([baixado("m1")], [{ id: "m1", status: "pronto" }])
        const r1 = conciliarMaterial(projeto(), o)
        const r2 = conciliarMaterial(r1.itens, o)
        expect(r2.itens).toBe(r1.itens)
        expect(r2.postos).toEqual([])
        expect(r2.mudouCampos).toBe(false)
    })
    it("o que o operador tirou à mão não volta (jaPostos), e o arquivo dele no projeto não é duplicado", () => {
        const itens = projeto()
        expect(conciliarMaterial(itens, opcoes([baixado("m1")], [{ id: "m1" }], { jaPostos: new Set(["m1"]) })).itens).toBe(itens)
        const dele: ProjectShowRef = { id: baixado("m1").caminho, type: "video" }
        const r = conciliarMaterial([...projeto(), dele], opcoes([baixado("m1")], [{ id: "m1" }]))
        expect(r.postos).toEqual([])
        expect(marcaDoMaterial(dele)).toBeNull()
    })
    it("HEVC leva o aviso no rótulo", () => {
        const r = conciliarMaterial(projeto(), opcoes([baixado("m1", { codec: "hvc1.1.6" })], [{ id: "m1" }]))
        expect(r.itens[3].name).toBe("Video m1 (HEVC — pode não tocar)")
    })
})

describe("marca duplicada (copiar e colar)", () => {
    it("a primeira é a oficial; a cópia vira item do operador e nunca é apagada", () => {
        const a = itemDoMaterial(baixado("m1"))
        const b = itemDoMaterial(baixado("m1"))
        const r = conciliarMaterial([...projeto(), a, b], opcoes([baixado("m1")], [{ id: "m1" }]))
        expect(r.mudouCampos).toBe(true)
        expect(marcaDoMaterial(a)).toBe("m1")
        expect(marcaDoMaterial(b)).toBeNull()
        expect(r.itens).toContain(b)
        expect(r.postos).toEqual([])
    })
})

describe("apagado no Sirvo", () => {
    const comItem = () => {
        const item = itemDoMaterial(baixado("m1"))
        return { item, itens: [...projeto(), item] }
    }
    const T0 = 1_000_000

    it("fica cinza por 30 s (e pede para ser reavaliado), depois sai do projeto", () => {
        const { item, itens } = comItem()
        const r1 = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 }))
        expect(r1.itens).toBe(itens)
        expect(item.name?.startsWith(PREFIXO_APAGADO)).toBe(true)
        expect(item.data[APAGANDO_EM]).toBe(T0)
        expect(r1.mudouCampos).toBe(true)
        expect(r1.reavaliarEm).toBe(GRACA_APAGAR_MS)

        const r2 = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 + 10_000 }))
        expect(r2.itens).toBe(itens)
        expect(r2.mudouCampos).toBe(false)
        expect(r2.reavaliarEm).toBe(GRACA_APAGAR_MS - 10_000)

        const r3 = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 + GRACA_APAGAR_MS }))
        expect(r3.itens).not.toContain(item)
        expect(r3.tirados).toEqual(["m1"])
        expect(r3.itens).toHaveLength(itens.length - 1)
    })
    it("status 'apagando' vale como apagado", () => {
        const { item, itens } = comItem()
        conciliarMaterial(itens, opcoes([baixado("m1")], [{ id: "m1", status: "apagando" }]))
        expect(item.name?.startsWith(PREFIXO_APAGADO)).toBe(true)
    })
    it("item EM USO não sai (aberto, no foco ou na saída): fica cinza até soltar", () => {
        const { item, itens } = comItem()
        const idx = itens.indexOf(item)
        const velho = T0 + 5 * GRACA_APAGAR_MS
        conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 }))
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: velho, ativos: [idx] }))
        expect(r.itens).toBe(itens)
        expect(r.tirados).toEqual([])
        expect(conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: velho, ativos: [] })).tirados).toEqual(["m1"])
    })
    it("no momento protegido só sai se nenhum ponteiro vivo está depois dele", () => {
        const { item, itens } = comItem()
        const outro = itemDoMaterial(baixado("m2"))
        const dois = [...itens, outro]
        const velho = T0 + 5 * GRACA_APAGAR_MS
        const roteiro = [{ id: "m2" }]
        const bx = [baixado("m1"), baixado("m2")]
        conciliarMaterial(dois, opcoes(bx, roteiro, { agora: T0 }))
        const bloqueado = conciliarMaterial(dois, opcoes(bx, roteiro, { agora: velho, protegido: true, ativos: [dois.indexOf(outro)] }))
        expect(bloqueado.tirados).toEqual([])
        const livre = conciliarMaterial(dois, opcoes(bx, roteiro, { agora: velho, protegido: true, ativos: [0] }))
        expect(livre.tirados).toEqual(["m1"])
        expect(livre.itens).not.toContain(item)
        const congelado = conciliarMaterial(dois, opcoes(bx, roteiro, { agora: velho, congelarRemocao: true }))
        expect(congelado.tirados).toEqual([])
    })
    it("o Sirvo restaurou: sai do cinza e volta ao nome certo", () => {
        const { item, itens } = comItem()
        conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 }))
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [{ id: "m1", nome: "Video m1" }], { agora: T0 + 10_000 }))
        expect(item.name).toBe("Video m1")
        expect(item.data[APAGANDO_EM]).toBeUndefined()
        expect(item.data[MARCA]).toBe("m1")
        expect(r.mudouCampos).toBe(true)
    })
    it("só tira o que tem a marca: item do operador (mesmo parecido) nunca é tocado", () => {
        const dele: ProjectShowRef = { id: "C:\\meus\\video.mp4", type: "video", name: "meu vídeo" }
        const itens = [...projeto(), dele]
        const r = conciliarMaterial(itens, opcoes([], [], { agora: T0 + 10 * GRACA_APAGAR_MS }))
        expect(r.itens).toBe(itens)
        expect(dele.name).toBe("meu vídeo")
    })
})
